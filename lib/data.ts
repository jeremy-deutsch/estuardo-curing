import "server-only";
import { connection } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicClient } from "./supabase/server";
import type {
  Voter,
  Batch,
  ImportReport,
  ImportRow,
  ImportHistory,
  PublicBatch,
} from "./types";
export const voterColumns =
  "id,first_name,last_name,street,unit,city,state,zip,phone,age,support_id,latitude,longitude,status,updated_at,created_at";
export async function allRows<T>(
  db: SupabaseClient,
  table: string,
  columns: string,
  order = "id",
  filter?: [string, string],
) {
  const results: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = db
      .from(table)
      .select(columns)
      .order(order)
      .range(offset, offset + 999);
    if (table === "batch_voters") query = query.order("batch_id");
    if (filter) query = query.eq(filter[0], filter[1]);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    results.push(...(data as T[]));
    if (data.length < 1000) return results;
  }
}
export async function workspace(db: SupabaseClient) {
  const [voters, batches, memberships] = await Promise.all([
    allRows<Voter>(db, "voters", voterColumns, "id"),
    allRows<Omit<Batch, "voter_ids">>(
      db,
      "batches",
      "id,name,kind,public_token,active,created_at",
    ),
    allRows<{ batch_id: string; voter_id: string }>(
      db,
      "batch_voters",
      "batch_id,voter_id",
      "voter_id",
    ),
  ]);
  return {
    voters,
    batches: batches.map((b) => ({
      ...b,
      voter_ids: memberships
        .filter((m) => m.batch_id === b.id)
        .map((m) => m.voter_id),
    })),
  };
}
export async function importReport(
  db: SupabaseClient,
  id: string,
): Promise<ImportReport | null> {
  const { data, error } = await db
    .from("imports")
    .select("id,filename,created_at,marked_as_cured")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const rows = await allRows<ImportRow>(
    db,
    "import_rows",
    "id,row_number,record,status,error",
    "row_number",
    ["import_id", id],
  );
  return { ...data, rows };
}

export async function importHistory(
  db: SupabaseClient,
): Promise<ImportHistory[]> {
  const { data, error } = await db
    .from("imports")
    .select("id,filename,created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data;
}

export async function staffBatch(db: SupabaseClient, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const { data, error } = await db
    .from("batches")
    .select("id,name,kind,public_token,active,created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const members = await allRows<{ voters: Voter }>(
    db,
    "batch_voters",
    `voters(${voterColumns})`,
    "voter_id",
    ["batch_id", id],
  );
  const voters = members.map((member) => member.voters);
  return {
    batch: { ...data, voter_ids: voters.map((v) => v.id) } as Batch,
    content: { name: data.name, kind: data.kind, voters } as PublicBatch,
  };
}

export async function publicBatch(token: string): Promise<PublicBatch | null> {
  await connection();
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const { data, error } = await publicClient().rpc("read_public_batch", {
    p_token: token,
  });
  if (error) throw new Error(error.message);
  return data as PublicBatch | null;
}
