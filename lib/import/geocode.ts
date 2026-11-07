import { parse } from "csv/sync";
import type { VoterInput } from "@/lib/types";
export type GeocodeResult =
  { latitude: number; longitude: number } | { error: string };
const csvCell = (s: string) => `"${s.replaceAll('"', '""')}"`;
const normalizeAddress = (address: string) =>
  address
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+#?\d+$/, "");
export function parseGeocodes(
  csv: string,
  ids: string[],
): Map<string, GeocodeResult> {
  const result = new Map<string, GeocodeResult>();
  const records: string[][] = parse(csv, {
    skip_empty_lines: true,
    relax_column_count: true,
  });
  for (const row of records) {
    if (!ids.includes(row[0])) continue;
    const coordinates = row[5]?.split(",").map(Number);
    if (
      row[2] === "Match" &&
      row[3] === "Exact" &&
      coordinates?.length === 2 &&
      coordinates.every(Number.isFinite) &&
      Math.abs(coordinates[0]) <= 180 &&
      Math.abs(coordinates[1]) <= 90
    ) {
      result.set(row[0], {
        longitude: coordinates[0],
        latitude: coordinates[1],
      });
    } else
      result.set(row[0], {
        error:
          row[2] === "Tie"
            ? "Census returned multiple possible addresses"
            : "Census could not find an exact address match",
      });
  }
  for (const id of ids)
    if (!result.has(id))
      result.set(id, { error: "Census did not return this address" });
  return result;
}
export async function geocode(rows: { id: string; record: VoterInput }[]) {
  const csv = rows
    .map(({ id, record: v }) =>
      [
        id,
        normalizeAddress([v.street, v.unit].filter(Boolean).join(" ")),
        v.city,
        v.state,
        v.zip,
      ]
        .map(csvCell)
        .join(","),
    )
    .join("\n");
  const form = new FormData();
  form.set(
    "addressFile",
    new Blob([csv], { type: "text/csv" }),
    "addresses.csv",
  );
  form.set("benchmark", "Public_AR_Current");
  const response = await fetch(
    "https://geocoding.geo.census.gov/geocoder/locations/addressbatch",
    {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(65_000),
      cache: "no-store",
    },
  );
  if (!response.ok)
    throw new Error(
      "Census Geocoder is unavailable. Resume this upload to retry.",
    );
  return parseGeocodes(
    await response.text(),
    rows.map((r) => r.id),
  );
}
