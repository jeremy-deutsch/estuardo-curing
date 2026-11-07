"use server";
import { revalidatePath } from "next/cache";
import { actionResult } from "@/lib/action-result";
import { staffSession, HttpError } from "@/lib/auth";
import { parseUpload } from "@/lib/import/parse";

export async function createImportAction(form: FormData) {
  return actionResult(async () => {
    const { db } = await staffSession();
    const file = form.get("file");
    if (!(file instanceof File))
      throw new HttpError("Choose a .csv or .xlsx file.");
    if (file.size > 5 * 1024 * 1024)
      throw new HttpError("Choose a file smaller than 5 MB.", 413);
    let rows;
    try {
      rows = parseUpload(Buffer.from(await file.arrayBuffer()), file.name);
    } catch (error) {
      throw new HttpError(
        error instanceof Error ? error.message : "Unable to read this file.",
      );
    }
    const { data: id, error } = await db.rpc("prepare_import", {
      p_filename: file.name.slice(0, 250),
      p_rows: rows,
    });
    if (error) throw error;
    revalidatePath("/uploads");
    return { id: id as string };
  });
}
