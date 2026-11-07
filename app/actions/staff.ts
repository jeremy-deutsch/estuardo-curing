"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { superAdminSession } from "@/lib/super-admin";
import { adminClient } from "@/lib/supabase/admin";
import { actionResult } from "@/lib/action-result";
import { HttpError } from "@/lib/auth";

export async function approveStaffAction(
  _previous: { error: string | null },
  form: FormData,
): Promise<{ error: string | null }> {
  const result = await actionResult(async () => {
    await superAdminSession();
    const userId = z.uuid().parse(form.get("userId"));
    const db = adminClient();
    const { data, error } = await db.auth.admin.getUserById(userId);
    if (error || !data.user?.email)
      throw new HttpError(
        "That account is no longer available for approval.",
        404,
      );
    const membership = await db
      .from("staff_members")
      .upsert({ user_id: userId }, { onConflict: "user_id" });
    if (membership.error)
      throw new HttpError(
        "Unable to approve this account. Please try again.",
        503,
      );
  });
  if (!result.ok) return { error: result.error };
  revalidatePath("/staff");
  return { error: null };
}
