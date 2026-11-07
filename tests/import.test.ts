import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseUpload } from "../lib/import/parse";
import { normalizeRow, dedupeKey } from "../lib/import/normalize";
import { parseGeocodes, geocode } from "../lib/import/geocode";
import type { VoterInput } from "../lib/types";

const person: VoterInput = {
  first_name: "Alex",
  last_name: "Example",
  street: "4600 Silver Hill Rd",
  unit: "",
  city: "Suitland",
  state: "MD",
  zip: "20746",
  phone: "",
};

test("both supplied exports produce the same 122 valid records", () => {
  const csv = parseUpload(
    readFileSync("data/sample-data-csv.csv"),
    "voters.csv",
  );
  const excel = parseUpload(
    readFileSync("data/sample-data.xlsx"),
    "voters.xlsx",
  );
  assert.equal(csv.length, 122);
  assert.ok(csv.every((r) => r.status === "pending"));
  assert.deepEqual(
    csv.map((r) => r.record),
    excel.map((r) => r.record),
  );
  assert.equal(csv[0].record.city, "Los Angeles");
  assert.equal(csv[0].record.state, "CA");
  assert.equal(csv[0].record.unit, "");
  assert.ok(csv[0].record.phone.startsWith("+1"));
  assert.ok(!("Support ID" in csv[0].record));
  assert.equal(csv[0].record.support_id, "None");
  assert.ok(csv.some((r) => r.record.support_id === "Strong Support"));
  assert.ok(csv.some((r) => r.record.support_id === "Lean Support"));
  assert.ok(!("V1_PARTY" in csv[0].record));
});
test("Support ID is preserved with normalized headers and whitespace", () => {
  for (const header of ["Support ID", "support_id"]) {
    const { record, error } = normalizeRow({
      ...person,
      [header]: "  Lean   Support  ",
    });
    assert.equal(error, null);
    assert.equal(record.support_id, "Lean Support");
  }
  assert.equal(
    normalizeRow(person as unknown as Record<string, unknown>).record
      .support_id,
    "",
  );
});
test("identity tolerates punctuation, casing, and whitespace but preserves apartment differences", () => {
  assert.equal(
    dedupeKey(person),
    dedupeKey({
      ...person,
      first_name: " ALEX ",
      street: "4600  SILVER Hill Rd.",
    }),
  );
  assert.notEqual(dedupeKey(person), dedupeKey({ ...person, unit: "201" }));
  assert.notEqual(
    dedupeKey({ ...person, first_name: "李" }),
    dedupeKey({ ...person, first_name: "王" }),
  );
});
test("duplicate rows are skipped and invalid rows get actionable errors", () => {
  const csv =
    "first_name,last_name,street,city,state,zip,phone\nAlex,Example,4600 Silver Hill Rd,Suitland,MD,20746,\nALEX,Example,4600 SILVER HILL RD.,Suitland,md,20746,\n,,123 Main,,California,bad,no\n";
  const result = parseUpload(Buffer.from(csv), "test.csv");
  assert.deepEqual(
    result.map((r) => r.status),
    ["pending", "duplicate", "failed"],
  );
  assert.match(result[2].error!, /First and last name/);
  assert.match(result[2].error!, /ZIP/);
  assert.equal(result[2].row_number, 4);
});
test("unit and leading-zero ZIP survive normalization; blank phones are allowed", () => {
  const result = normalizeRow({
    ...person,
    unit: "Apt 2B",
    state: "ma",
    zip: 2110,
  });
  assert.equal(result.error, null);
  assert.equal(result.record.zip, "02110");
  assert.equal(result.record.unit, "Apt 2B");
});
test("CSV parser accepts BOM, CRLF, quoted commas and embedded newlines", () => {
  const csv =
    '\uFEFFfirst_name,last_name,street,unit,city,state,zip\r\nAlex,Example,"4600 Silver Hill Rd","Unit 2,\nBuilding B",Suitland,MD,20746\r\n';
  const result = parseUpload(Buffer.from(csv), "test.csv");
  assert.equal(result[0].status, "pending");
  assert.equal(result[0].record.unit, "Unit 2, Building B");
});
test("empty, malformed and unsupported uploads fail before database writes", () => {
  assert.throws(
    () => parseUpload(Buffer.from("first_name,last_name\n"), "empty.csv"),
    /no data/,
  );
  assert.throws(() =>
    parseUpload(Buffer.from('first_name,last_name\n"unclosed'), "broken.csv"),
  );
  assert.throws(
    () => parseUpload(Buffer.from("hello"), "input.exe"),
    /csv or .xlsx/,
  );
});
test("Census accepts exact and non-exact matches; ties and omissions fail", () => {
  const rows =
    '"a","input","Match","Exact","matched","-118.2,34.1","1","L"\n"b","input","Tie"\n"c","input","No_Match"\n"d","input","Match","Non_Exact","matched","-118.2,34.1"';
  const result = parseGeocodes(rows, ["a", "b", "c", "d", "missing"]);
  assert.deepEqual(result.get("a"), { longitude: -118.2, latitude: 34.1 });
  assert.deepEqual(result.get("d"), { longitude: -118.2, latitude: 34.1 });
  assert.match((result.get("b") as { error: string }).error, /multiple/);
  for (const id of ["c", "missing"]) assert.ok("error" in result.get(id)!);
});
test("malformed coordinates are never saved as successful matches", () => {
  for (const quality of ["Exact", "Non_Exact"]) {
    for (const point of ["NaN,34", "181,34", "-118,91", "", ",34", "-118, "]) {
      assert.ok(
        "error" in
          parseGeocodes(
            `"a","input","Match","${quality}","matched","${point}"`,
            ["a"],
          ).get("a")!,
      );
    }
  }
});

test("fractional house numbers and Census-added directionals geocode without changing voter addresses", async (t) => {
  const streets = [
    "5207 3/4 S Hoover St",
    "551 1/2 W 45Th St",
    "5230 Long Beach Ave",
  ];
  const records = streets.map((street, index) => ({
    id: String(index),
    record: {
      ...person,
      street,
      city: "Los Angeles",
      state: "CA",
      zip: index === 2 ? "90058" : "90037",
    },
  }));
  const original = structuredClone(records);
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: unknown, options?: RequestInit) => {
      const csv = await (
        (options?.body as FormData).get("addressFile") as File
      ).text();
      assert.equal(
        csv,
        records
          .map(
            ({ id, record }) =>
              `"${id}","${record.street}","Los Angeles","CA","${record.zip}"`,
          )
          .join("\n"),
      );
      // Response fields captured from Census for the reported failing addresses.
      return new Response(
        [
          '"0","5207 3/4 S Hoover St, Los Angeles, CA, 90037","Match","Non_Exact","5207 3/4 S HOOVER ST, LOS ANGELES, CA, 90037","-118.287186455197,33.995097513338","141659238","R"',
          '"1","551 1/2 W 45Th St, Los Angeles, CA, 90037","Match","Non_Exact","551 1/2 W 45TH ST, LOS ANGELES, CA, 90037","-118.283461824507,34.002818534643","141607885","R"',
          '"2","5230 Long Beach Ave, Los Angeles, CA, 90058","Match","Non_Exact","5230 E LONG BEACH AVE, LOS ANGELES, CA, 90058","-118.243092246047,33.995240611889","141671526","L"',
        ].join("\n"),
      );
    },
  );
  const result = await geocode(records);
  assert.deepEqual(
    [...result.values()],
    [
      { longitude: -118.287186455197, latitude: 33.995097513338 },
      { longitude: -118.283461824507, latitude: 34.002818534643 },
      { longitude: -118.243092246047, latitude: 33.995240611889 },
    ],
  );
  assert.deepEqual(records, original);
});
test("Census submission contains addresses only and uses a multipart batch request", async (t) => {
  const mocked = t.mock.method(
    globalThis,
    "fetch",
    async (url: string | URL | Request, options?: RequestInit) => {
      assert.equal(
        url,
        "https://geocoding.geo.census.gov/geocoder/locations/addressbatch",
      );
      assert.equal(options?.method, "POST");
      const form = options?.body as FormData;
      assert.equal(form.get("benchmark"), "Public_AR_Current");
      const csv = await (form.get("addressFile") as File).text();
      assert.match(csv, /4600 Silver Hill Rd/);
      assert.ok(!csv.includes("Alex"));
      assert.ok(!csv.includes("Example"));
      return new Response('"a","input","Match","Exact","matched","-76.9,38.8"');
    },
  );
  const result = await geocode([{ id: "a", record: person }]);
  assert.deepEqual(result.get("a"), { longitude: -76.9, latitude: 38.8 });
  mocked.mock.restore();
});

test("Census submission collapses whitespace and removes trailing numeric apartments", async (t) => {
  const records = [
    { ...person, street: "  4600   Silver  Hill Rd  201  " },
    { ...person, street: "4600 Silver Hill Rd  #201" },
    { ...person, street: "4600   Silver Hill Rd", unit: " #201  " },
    { ...person, street: "4600 Silver Hill Rd", unit: "201" },
    { ...person, street: "4600  Silver Hill Rd" },
    { ...person, street: "4600  Silver Hill Rd 2B" },
  ];
  const original = structuredClone(records);
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: unknown, options?: RequestInit) => {
      const form = options?.body as FormData;
      const csv = await (form.get("addressFile") as File).text();
      assert.equal(
        csv,
        records
          .map(
            (_, index) =>
              `"${index}","4600 Silver Hill Rd${index === 5 ? " 2B" : ""}","Suitland","MD","20746"`,
          )
          .join("\n"),
      );
      return new Response("");
    },
  );
  await geocode(
    records.map((record, index) => ({ id: String(index), record })),
  );
  assert.deepEqual(records, original);
});
