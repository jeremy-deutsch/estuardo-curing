import type {
  Batch,
  ImportReport,
  PublicBatch,
  Voter,
  Workspace,
} from "@/lib/types";

// Entirely synthetic records. Fixed dates keep previews consistent.
export const timestamp = "2026-11-07T17:00:00.000Z";
export const staffEmail = "sam@example.org";

const people = [
  ["Alex", "Rivera", "1200 W 28th St", "", "90007", null, "213-555-0101"],
  [
    "Jordan",
    "Chen",
    "1220 W 28th St",
    "Apt 2",
    "90007",
    "interested",
    "213-555-0102",
  ],
  ["Morgan", "Patel", "1250 W 28th St", "", "90007", "cured", "213-555-0103"],
  ["Taylor", "Brooks", "1300 W 29th St", "", "90007", "no_response", ""],
  [
    "Casey",
    "Nguyen",
    "1320 W 29th St",
    "Unit B",
    "90007",
    "not_interested",
    "213-555-0105",
  ],
  ["Riley", "Torres", "2100 S Figueroa St", "", "90015", null, "213-555-0106"],
  ["Avery", "Kim", "2120 S Figueroa St", "", "90015", "cured", "213-555-0107"],
  [
    "Cameron",
    "Davis",
    "2140 S Figueroa St",
    "Apt 8",
    "90015",
    "interested",
    "",
  ],
] as const;

export const voters: Voter[] = people.map((person, index) => ({
  id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  first_name: person[0],
  last_name: person[1],
  street: person[2],
  unit: person[3],
  city: "Los Angeles",
  state: "CA",
  zip: person[4],
  status: person[5],
  phone: person[6],
  latitude: 34.029 + index * 0.0012,
  longitude: -118.292 + index * 0.0018,
  created_at: timestamp,
  updated_at: timestamp,
}));

export const doorBatch: Batch = {
  id: "20000000-0000-4000-8000-000000000001",
  name: "University Park · Saturday doors",
  kind: "door",
  public_token: "a".repeat(64),
  active: true,
  created_at: timestamp,
  voter_ids: voters.slice(0, 5).map((voter) => voter.id),
};

export const phoneBatch: Batch = {
  ...doorBatch,
  id: "20000000-0000-4000-8000-000000000002",
  name: "Downtown · Evening calls",
  kind: "phone",
  public_token: "b".repeat(64),
  voter_ids: voters.slice(2, 7).map((voter) => voter.id),
};

export const disabledBatch: Batch = {
  ...doorBatch,
  id: "20000000-0000-4000-8000-000000000003",
  name: "University Park · Previous shift",
  public_token: "c".repeat(64),
  active: false,
  voter_ids: voters.slice(0, 3).map((voter) => voter.id),
};

export function publicContent(batch: Batch): PublicBatch {
  return {
    name: batch.name,
    kind: batch.kind,
    voters: voters.filter((voter) => batch.voter_ids.includes(voter.id)),
  };
}

export const workspace: Workspace = {
  voters,
  batches: [doorBatch, phoneBatch, disabledBatch],
};
export const emptyWorkspace: Workspace = { voters: [], batches: [] };

export const completedReport: ImportReport = {
  id: "30000000-0000-4000-8000-000000000001",
  filename: "university-park-voters.csv",
  created_at: timestamp,
  marked_as_cured: [{ id: voters[0].id, record: voters[0] }],
  rows: voters.map((voter, index) => ({
    id: `40000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    row_number: index + 2,
    record: voter,
    status: index === 3 ? "failed" : index === 4 ? "duplicate" : "imported",
    error:
      index === 3
        ? "No exact address match. Check the street address and ZIP code."
        : index === 4
          ? "This voter already exists in the workspace."
          : null,
  })),
};

export const pendingReport: ImportReport = {
  ...completedReport,
  id: "30000000-0000-4000-8000-000000000002",
  filename: "downtown-follow-up.xlsx",
  rows: completedReport.rows.map((row, index) => ({
    ...row,
    status: index < 3 ? "imported" : "pending",
    error: null,
  })),
};

export const cleanReport: ImportReport = {
  ...completedReport,
  rows: completedReport.rows.map((row) => ({
    ...row,
    status: "imported",
    error: null,
  })),
};

export const importHistory = [pendingReport, completedReport].map(
  ({ id, filename, created_at }) => ({ id, filename, created_at }),
);
