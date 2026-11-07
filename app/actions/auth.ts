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
    const { data: signedIn, error } = await db.auth.signInWithPassword({
      email,
      password,
    });
    if (error?.code === "email_not_confirmed")
      throw new HttpError(
        "Confirm your email using the link Supabase sent before signing in.",
        403,
      );
    if (error)
      throw new HttpError(
        "Unable to sign in. Check your email and password.",
        401,
      );
    const { data, error: membershipError } = await db
      .from("staff_members")
      .select("user_id")
      .eq("user_id", signedIn.user.id)
      .maybeSingle();
    if (membershipError) {
      throw new HttpError(
        "The database needs setup. Ask your administrator to apply the migration.",
        503,
      );
    }
    return Boolean(data);
  });
  if (!result.ok) return { error: result.error };
  revalidatePath("/", "layout");
  redirect(result.data ? "/voters" : "/pending-approval");
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

export async function signupAction(
  _previous: { error: string | null; message: string | null },
  form: FormData,
): Promise<{ error: string | null; message: string | null }> {
  const result = await actionResult(async () => {
    const email = z
      .email()
      .max(254)
      .parse(
        String(form.get("email") || "")
          .trim()
          .toLowerCase(),
      );
    const password = z.string().min(12).max(128).parse(form.get("password"));
    if (password !== form.get("confirmPassword"))
      throw new HttpError("The passwords do not match.");
    const db = await serverClient();
    const { data, error } = await db.auth.signUp({ email, password });
    if (error) {
      if (error.code === "weak_password")
        throw new HttpError(
          "Choose a stronger password of at least 12 characters.",
        );
      if (error.code === "over_email_send_rate_limit" || error.status === 429)
        throw new HttpError(
          "Too many signup attempts. Please wait before trying again.",
          429,
        );
      throw new HttpError(
        "Unable to create an account. If you already registered, try signing in. Otherwise, try again later.",
      );
    }
    return Boolean(data.session);
  });
  if (!result.ok) return { error: result.error, message: null };
  if (result.data) {
    revalidatePath("/", "layout");
    redirect("/pending-approval");
  }
  return {
    error: null,
    message:
      "Check your email to confirm your account, then sign in. Your account must be approved by the campaign administrator before you can access the app. If you already registered, sign in with your existing password.",
  };
}
