import "server-only";
import { staffSession, HttpError } from "@/lib/auth";

export function isSuperAdmin(userId: string) {
  const configured = process.env.SUPER_ADMIN_USER_ID?.trim();
  return Boolean(configured && configured === userId);
}

export async function superAdminSession() {
  const session = await staffSession();
  if (!isSuperAdmin(session.user.id))
    throw new HttpError("Super-admin access required.", 403);
  return session;
}
