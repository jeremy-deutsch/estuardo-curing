"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { actionResult } from "@/lib/action-result";
import { HttpError, staffSession } from "@/lib/auth";
import { publicClient } from "@/lib/supabase/server";
import { statuses, type VoterStatus } from "@/lib/types";

export async function removeVotersAction(voterIds: string[]) {
  return actionResult(async () => {
    const { db } = await staffSession();
    const ids = z.array(z.uuid()).min(1).max(10000).parse(voterIds);
    const { data, error } = await db.rpc("remove_voters", {
      p_voter_ids: [...new Set(ids)],
    });
    if (error) throw error;
    revalidatePath("/voters");
    revalidatePath("/batches");
    revalidatePath("/batches/[id]", "page");
    revalidatePath("/batch/[token]", "page");
    return { count: data as number };
  });
}

export async function setVoterStatusAction(
  batchToken: string,
  input: { voter_id: string; status: VoterStatus; updated_at: string },
) {
  return actionResult(async () => {
    const token = z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(batchToken);
    const body = z
      .object({
        voter_id: z.uuid(),
        status: z.enum(statuses).nullable(),
        updated_at: z.iso.datetime({ offset: true }),
      })
      .parse(input);
    // The database verifies the bearer token, active batch, membership, and
    // expected timestamp atomically. No service-role client is used here.
    const { data, error } = await publicClient().rpc("set_public_status", {
      p_token: token,
      p_voter_id: body.voter_id,
      p_status: body.status,
      p_expected_updated_at: body.updated_at,
    });
    if (error) throw error;
    if (data?.error === "conflict")
      throw new HttpError(
        "Someone updated this voter. Refresh the batch before making another change.",
        409,
      );
    if (!data || data.error)
      throw new HttpError("This batch or voter is unavailable.", 404);
    revalidatePath(`/batch/${token}`);
    revalidatePath("/batches/[id]", "page");
    revalidatePath("/voters");
    revalidatePath("/batches");
    return data as { status: VoterStatus; updated_at: string };
  });
}
