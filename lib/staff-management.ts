import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function staffAccounts(db: SupabaseClient) {
  const accounts: {
    id: string;
    email: string;
    confirmed: boolean;
    staff: boolean;
  }[] = [];
  // Check memberships for each auth page to avoid the database's row limit.
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error("Unable to load accounts.");
    if (!data.users.length) break;
    const members = await db
      .from("staff_members")
      .select("user_id")
      .in(
        "user_id",
        data.users.map((user) => user.id),
      );
    if (members.error) throw new Error("Unable to load staff memberships.");
    const ids = new Set(members.data.map((member) => member.user_id));
    accounts.push(
      ...data.users.map((user) => ({
        id: user.id,
        email: user.email || "",
        confirmed: Boolean(user.email_confirmed_at),
        staff: ids.has(user.id),
      })),
    );
    if (data.users.length < 200) break;
  }
  return accounts;
}
