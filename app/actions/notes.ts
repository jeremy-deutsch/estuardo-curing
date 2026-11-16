"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { actionResult } from "@/lib/action-result";
import { HttpError, staffSession } from "@/lib/auth";
import { publicClient } from "@/lib/supabase/server";

export async function markNotesViewedAction(viewedAt: string) {
  return actionResult(async () => {
    const { db } = await staffSession();
    const timestamp = z.iso.datetime({ offset: true }).parse(viewedAt);
    const { data, error } = await db.rpc("mark_notes_viewed", {
      p_viewed_at: timestamp,
    });
    if (error) throw error;
    return { viewed_at: data as string };
  });
}

export async function addVoterNoteAction(
  batchToken: string,
  input: { voter_id: string; author_name: string; body: string },
) {
  return actionResult(async () => {
    const token = z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(batchToken);
    const note = z
      .object({
        voter_id: z.uuid(),
        author_name: z.string().trim().min(1).max(120),
        body: z.string().trim().min(1).max(5000),
      })
      .parse(input);
    const { data, error } = await publicClient().rpc("add_public_note", {
      p_token: token,
      p_voter_id: note.voter_id,
      p_author_name: note.author_name,
      p_body: note.body,
    });
    if (error) throw error;
    if (!data)
      throw new HttpError(
        "This batch or voter is unavailable. Refresh the batch and try again.",
        404,
      );
    revalidatePath("/notes");
    revalidatePath("/voters");
    return { id: data as string };
  });
}
