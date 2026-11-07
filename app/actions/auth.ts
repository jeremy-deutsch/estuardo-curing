"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { serverClient } from "@/lib/supabase/server";
import { actionResult } from "@/lib/action-result";
import { HttpError } from "@/lib/auth";
import type { AuthState } from "@/lib/types";

export async function loginAction(
  _previous: AuthState,
  form: FormData,
): Promise<AuthState> {
  const result = await actionResult(async () => {
    const { email, password } = z
      .object({ email: z.email(), password: z.string().min(1).max(256) })
      .parse({ email: form.get("email"), password: form.get("password") });
    const db = await serverClient();
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error)
      throw new HttpError(
        "Unable to sign in. Check your email and password.",
        401,
      );
    const { data, error: membershipError } = await db
      .from("staff_members")
      .select("user_id")
      .maybeSingle();
    if (membershipError || !data) {
      await db.auth.signOut();
      throw new HttpError(
        membershipError
          ? "The database needs setup. Ask your administrator to apply the migration."
          : "Your account has not been granted staff access. Contact your administrator.",
        403,
      );
    }
  });
  if (!result.ok) return { error: result.error };
  revalidatePath("/", "layout");
  redirect("/voters");
}

export async function logoutAction(
  _previous: AuthState,
  _form: FormData,
): Promise<AuthState> {
  const result = await actionResult(async () => {
    const { error } = await (await serverClient()).auth.signOut();
    if (error) throw error;
  });
  if (!result.ok) return { error: result.error };
  revalidatePath("/", "layout");
  redirect("/login");
}
