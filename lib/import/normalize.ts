import type { VoterInput } from "@/lib/types";
const clean = (value: unknown) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
export function dedupeKey(v: VoterInput) {
  const identityPart = (value: string) =>
    value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  return [
    identityPart(`${v.first_name} ${v.last_name}`),
    identityPart(v.street),
    identityPart(v.unit),
    identityPart(v.city),
    identityPart(v.state),
    identityPart(v.zip),
  ].join("|");
}
export function normalizeRow(raw: Record<string, unknown>): {
  record: VoterInput;
  error: string | null;
} {
  const row = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [key(k), clean(v)]),
  );
  const pick = (...names: string[]) =>
    names.map((n) => row[key(n)]).find(Boolean) || "";
  let city = pick("city", "res_city");
  let state = pick("state", "res_state").toUpperCase();
  let zip = pick("zip", "zipcode", "ra_zip", "res_zip");
  let unit = pick("unit", "apartment", "address2", "res_address2");
  const locality = unit.match(/^(.+?),\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (locality) {
    city ||= locality[1];
    state ||= locality[2].toUpperCase();
    zip ||= locality[3];
    unit = "";
  }
  if (/^\d{1,4}$/.test(zip)) zip = zip.padStart(5, "0");
  let phone = pick(
    "phone",
    "phone_number",
    "mobile",
    "wirelessphonenumber",
  ).replace(/[^\d+]/g, "");
  if (/^\d{10}$/.test(phone)) phone = `+1${phone}`;
  if (/^1\d{10}$/.test(phone)) phone = `+${phone}`;
  const record: VoterInput = {
    first_name: pick("first_name", "firstname", "v1_firstname"),
    last_name: pick("last_name", "lastname", "v1_lastname"),
    street: pick(
      "street",
      "street_address",
      "address",
      "address1",
      "res_address1",
    ),
    unit,
    city,
    state,
    zip,
    phone,
    support_id: pick("support_id"),
  };
  const errors: string[] = [];
  if (!record.first_name || !record.last_name)
    errors.push("First and last name are required");
  if (!record.street) errors.push("Street address is required");
  if (!city) errors.push("City is required");
  if (!/^[A-Z]{2}$/.test(state)) errors.push("Use a two-letter state code");
  if (!/^\d{5}(?:-\d{4})?$/.test(zip))
    errors.push("A valid ZIP code is required");
  if (phone && !/^\+1\d{10}$/.test(phone))
    errors.push("Phone must be a 10-digit US number (or blank)");
  if (Object.values(record).some((v) => v.length > 250))
    errors.push("A field exceeds 250 characters");
  return { record, error: errors.length ? errors.join("; ") : null };
}
