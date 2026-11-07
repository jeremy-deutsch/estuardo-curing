import "server-only";
import { connection } from "next/server";
import { redirect, unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { serverClient } from "@/lib/supabase/server";
export class HttpError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const accountSession = cache(async () => {
  const db = await serverClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw new HttpError("Please sign in to continue.", 401);
  return { db, user };
});
export const staffSession = cache(async () => {
  const { db, user } = await accountSession();
  const { data: member, error: membershipError } = await db
    .from("staff_members")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError)
    throw new HttpError(
      "The database needs setup. Apply the Supabase migration in README.md.",
      503,
    );
  if (!member)
    throw new HttpError(
      "Your account is awaiting approval by the campaign administrator.",
      403,
    );
  return { db, user };
});

export async function staffPageSession() {
  try {
    return await staffSession();
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof HttpError && error.status === 401) redirect("/login");
    if (error instanceof HttpError && error.status === 403)
      redirect("/pending-approval");
    throw error;
  }
}
export async function api<T>(work: () => Promise<T>) {
  await connection();
  try {
    return Response.json(await work(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof HttpError)
      return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof Error && error.name === "ZodError")
      return Response.json(
        { error: "Check the submitted fields and try again." },
        { status: 400 },
      );
    console.error(
      "Request failed:",
      error instanceof Error ? error.message : "Database request failed",
    );
    return Response.json(
      { error: "We couldn't complete that request. Please try again." },
      { status: 500 },
    );
  }
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new HttpError("Cross-origin requests are not allowed.", 403);
}
