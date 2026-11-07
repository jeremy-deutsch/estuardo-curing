import { z } from "zod";
import { api, staffSession, HttpError, sameOrigin } from "@/lib/auth";
import { importReport } from "@/lib/data";
import { dedupeKey } from "@/lib/import/normalize";
import { geocode } from "@/lib/import/geocode";
import type { ImportRow } from "@/lib/types";
export const maxDuration = 120;
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  return api(async () => {
    const { db } = await staffSession();
    const report = await importReport(db, z.uuid().parse((await params).id));
    if (!report) throw new HttpError("Upload not found.", 404);
    return report;
  });
}
export async function POST(request: Request, { params }: Context) {
  return api(async () => {
    sameOrigin(request);
    const { db } = await staffSession();
    const id = z.uuid().parse((await params).id);
    const { data: claimed, error } = await db.rpc("claim_import_rows", {
      p_import_id: id,
    });
    if (error) throw error;
    const rows = claimed as ImportRow[];
    if (rows.length) {
      try {
        const { data: existing, error: lookupError } = await db
          .from("voters")
          .select("dedupe_key")
          .in(
            "dedupe_key",
            rows.map((r) => dedupeKey(r.record)),
          );
        if (lookupError) throw lookupError;
        const keys = new Set(existing.map((v) => v.dedupe_key));
        const fresh = rows.filter((r) => !keys.has(dedupeKey(r.record)));
        const coordinates = fresh.length ? await geocode(fresh) : new Map();
        const outcomes = rows.map((r) => ({
          id: r.id,
          ...(keys.has(dedupeKey(r.record))
            ? { error: "Duplicate" }
            : coordinates.get(r.id)),
        }));
        const { error: saveError } = await db.rpc("finish_import_rows", {
          p_results: outcomes,
        });
        if (saveError) throw saveError;
      } catch (error) {
        console.error(
          "Import chunk failed:",
          error instanceof Error ? error.message : "Database operation failed",
        );
        await db
          .from("import_rows")
          .update({ status: "pending", claimed_at: null })
          .in(
            "id",
            rows.map((r) => r.id),
          )
          .eq("status", "processing");
        throw new HttpError(
          "This chunk could not be processed. Your progress is saved; resume the upload to retry. Census requests can take about a minute.",
          503,
        );
      }
    }
    const report = await importReport(db, id);
    if (!report) throw new HttpError("Upload not found.", 404);
    return { ...report, claimed: rows.length };
  });
}
