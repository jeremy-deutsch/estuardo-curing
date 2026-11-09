import * as XLSX from "xlsx";
import { parse } from "csv/sync";
import { normalizeRow, dedupeKey } from "./normalize";
export function parseUpload(buffer: Buffer, filename: string) {
  let raw: Record<string, unknown>[];
  if (/\.csv$/i.test(filename)) {
    raw = parse(buffer, {
      columns: true,
      bom: true,
      skip_empty_lines: true,
      trim: true,
      max_record_size: 20_000,
    });
  } else if (/\.xlsx$/i.test(filename)) {
    const workbook = XLSX.read(buffer, { type: "buffer", sheetRows: 10_002 });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error("This workbook has no worksheets.");
    const fullRange = sheet["!fullref"] || sheet["!ref"];
    if (fullRange && XLSX.utils.decode_range(fullRange).e.r > 10_000)
      throw new Error(
        "Split worksheets into 10,000 rows or fewer, excluding the header.",
      );
    raw = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  } else throw new Error("Choose a .csv or .xlsx file.");
  if (!raw.length) throw new Error("The file has no data rows.");
  if (raw.length > 10_000)
    throw new Error("Split files into uploads of 10,000 rows or fewer.");
  const seen = new Map<string, ReturnType<typeof normalizeRow>["record"]>();
  return raw.map((row, index) => {
    const { record, error } = normalizeRow(row);
    const identity = dedupeKey(record);
    const duplicate = !error && seen.has(identity);
    if (!error) {
      const first = seen.get(identity);
      // Keep age enrichment even when a later row in this file is a duplicate.
      if (first) first.age ??= record.age;
      else seen.set(identity, record);
    }
    return {
      row_number: index + 2,
      record,
      status: error ? "failed" : duplicate ? "duplicate" : "pending",
      error:
        error || (duplicate ? "Duplicate name and address in this file" : null),
    };
  });
}
