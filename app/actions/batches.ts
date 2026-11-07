"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { staffSession, HttpError } from "@/lib/auth";
import { actionResult } from "@/lib/action-result";

export async function deleteBatchAction(
  batchId: string,
  redirectToList = false,
) {
  const result = await actionResult(async () => {
    const { db } = await staffSession();
    const id = z.uuid().parse(batchId);
    const { data, error } = await db
      .from("batches")
      .delete()
      .eq("id", id)
      .select("id,public_token")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError("Batch not found.", 404);
    revalidatePath("/batches");
    revalidatePath(`/batches/${id}`);
    revalidatePath("/voters");
    revalidatePath(`/batch/${data.public_token}`);
    return null;
  });
  if (result.ok && redirectToList) redirect("/batches");
  return result;
}

export async function assignBatchAction(input: {
  name: string;
  kind: "door" | "phone";
  voter_ids: string[];
  batch_id: string | null;
}) {
  return actionResult(async () => {
    const { db } = await staffSession();
    const data = z
      .object({
        name: z.string().trim().min(1).max(120),
        kind: z.enum(["door", "phone"]),
        voter_ids: z.array(z.uuid()).min(1).max(10000),
        batch_id: z.uuid().nullable(),
      })
      .parse(input);
    const { data: id, error } = await db.rpc("assign_batch", {
      p_name: data.name,
      p_kind: data.kind,
      p_voter_ids: data.voter_ids,
      p_batch_id: data.batch_id,
    });
    if (error) throw error;
    revalidatePath("/voters");
    revalidatePath("/batches");
    revalidatePath(`/batches/${id}`);
    return { id: id as string };
  });
}

export async function updateBatchAction(
  batchId: string,
  input: { name?: string; active?: boolean },
) {
  return actionResult(async () => {
    const { db } = await staffSession();
    const id = z.uuid().parse(batchId);
    const update = z
      .object({
        name: z.string().trim().min(1).max(120).optional(),
        active: z.boolean().optional(),
      })
      .strict()
      .refine((v) => Object.keys(v).length > 0)
      .parse(input);
    const { data, error } = await db
      .from("batches")
      .update(update)
      .eq("id", id)
      .select("id,public_token")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError("Batch not found.", 404);
    revalidatePath("/batches");
    revalidatePath(`/batches/${id}`);
    revalidatePath("/voters");
    revalidatePath(`/batch/${data.public_token}`);
    return null;
  });
}
