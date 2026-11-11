export const statuses = [
  "cured",
  "interested",
  "not_interested",
  "no_response",
  "do_not_cure",
] as const;
export type VoterStatus = (typeof statuses)[number] | null;
export type BatchType = "door" | "phone";
export const statusLabels: Record<string, string> = {
  cured: "Cured",
  interested: "Interested",
  not_interested: "Not interested",
  no_response: "No response",
  do_not_cure: "Do not cure",
  uncontacted: "Not contacted",
};
export interface VoterInput {
  first_name: string;
  last_name: string;
  street: string;
  unit: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  age?: number | null;
  support_id?: string;
}
export interface Voter extends VoterInput {
  id: string;
  latitude: number;
  longitude: number;
  status: VoterStatus;
  updated_at: string;
  created_at: string;
}
export interface Batch {
  id: string;
  name: string;
  kind: BatchType;
  public_token: string;
  active: boolean;
  created_at: string;
  voter_ids: string[];
}
export interface Workspace {
  voters: Voter[];
  batches: Batch[];
}
export interface ImportRow {
  id: string;
  row_number: number;
  record: VoterInput;
  status: "pending" | "processing" | "imported" | "duplicate" | "failed";
  error: string | null;
}
export interface ImportReport {
  id: string;
  filename: string;
  created_at: string;
  rows: ImportRow[];
  marked_as_cured: { id: string; record: VoterInput }[];
}
export interface PublicBatch {
  name: string;
  kind: BatchType;
  voters: Voter[];
}
export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; error: string; code: number };
export type AuthState = { error: string | null };
export type ImportHistory = Omit<ImportReport, "rows" | "marked_as_cured">;
export const fullName = (v: VoterInput) => `${v.first_name} ${v.last_name}`;
export const address = (v: VoterInput) =>
  [v.street, v.unit, `${v.city}, ${v.state} ${v.zip}`]
    .filter(Boolean)
    .join(", ");
