import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({
  server: vi.fn(),
  admin: vi.fn(),
  revalidate: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ serverClient: mocks.server }));
vi.mock("@/lib/supabase/admin", () => ({ adminClient: mocks.admin }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({
  unstable_rethrow: vi.fn(),
  redirect: mocks.redirect,
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: (fn: unknown) => fn,
}));

import { isSuperAdmin, superAdminSession } from "../lib/super-admin";
import { staffSession, staffPageSession } from "../lib/auth";
import { approveStaffAction } from "../app/actions/staff";
import { removeVotersAction } from "../app/actions/voters";
import { deleteBatchAction } from "../app/actions/batches";
import { signupAction, loginAction } from "../app/actions/auth";
import { staffAccounts } from "../lib/staff-management";
import { GET } from "../app/auth/callback/route";
import { NextRequest } from "next/server";

const ownerId = "00000000-0000-4000-8000-000000000001";
const applicantId = "00000000-0000-4000-8000-000000000002";
const initial = { error: null };

function sessionFixture({
  id = ownerId,
  approved = true,
  signedIn = true,
} = {}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: approved ? { user_id: id } : null,
    error: null,
  });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const from = vi
    .fn()
    .mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) });
  const auth = {
    getUser: vi.fn().mockResolvedValue({
      data: { user: signedIn ? { id, email: "user@example.org" } : null },
      error: null,
    }),
    signInWithPassword: vi
      .fn()
      .mockResolvedValue({ data: { user: { id } }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn().mockResolvedValue({
      data: { user: { id }, session: null },
      error: null,
    }),
    exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
  };
  const db = { auth, from };
  mocks.server.mockResolvedValue(db);
  return { db, auth, from, eq, maybeSingle };
}

function adminFixture() {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const getUserById = vi.fn().mockResolvedValue({
    data: { user: { id: applicantId, email: "new@example.org" } },
    error: null,
  });
  const from = vi.fn().mockReturnValue({ upsert });
  const db = { from, auth: { admin: { getUserById } } };
  mocks.admin.mockReturnValue(db);
  return { upsert, getUserById, from };
}

function approvalForm(userId = applicantId) {
  const form = new FormData();
  form.set("userId", userId);
  return form;
}
function credentials(password = "a-long-enough-password") {
  const form = new FormData();
  form.set("email", "person@example.org");
  form.set("password", password);
  form.set("confirmPassword", password);
  return form;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SUPER_ADMIN_USER_ID", ownerId);
  mocks.redirect.mockImplementation((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  });
  sessionFixture();
});
afterEach(() => vi.unstubAllEnvs());

describe("staff and super-admin authorization", () => {
  it("fails closed with no configured owner", () => {
    vi.stubEnv("SUPER_ADMIN_USER_ID", "");
    expect(isSuperAdmin(ownerId)).toBe(false);
    expect(isSuperAdmin("")).toBe(false);
  });
  it("blocks signed-out accounts", async () => {
    sessionFixture({ signedIn: false });
    await expect(staffSession()).rejects.toMatchObject({ status: 401 });
  });
  it("blocks unapproved accounts even if they are the configured owner", async () => {
    sessionFixture({ approved: false });
    await expect(superAdminSession()).rejects.toMatchObject({ status: 403 });
    await expect(staffPageSession()).rejects.toThrow(
      "REDIRECT:/pending-approval",
    );
  });
  it("blocks ordinary staff from directly invoking approval", async () => {
    sessionFixture({ id: applicantId });
    expect((await approveStaffAction(initial, approvalForm())).error).toContain(
      "Super-admin",
    );
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("blocks unapproved users from directly invoking approval", async () => {
    sessionFixture({ approved: false });
    expect((await approveStaffAction(initial, approvalForm())).error).toContain(
      "awaiting approval",
    );
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("never treats a membership lookup failure as approval", async () => {
    sessionFixture().maybeSingle.mockResolvedValue({
      data: null,
      error: new Error("Database unavailable"),
    });
    await expect(staffSession()).rejects.toMatchObject({ status: 503 });
  });
});

describe("staff approval", () => {
  it("adds existing accounts to staff without changing credentials or sending mail", async () => {
    const admin = adminFixture();
    expect(await approveStaffAction(initial, approvalForm())).toEqual({
      error: null,
    });
    expect(admin.getUserById).toHaveBeenCalledWith(applicantId);
    expect(admin.upsert).toHaveBeenCalledWith(
      { user_id: applicantId },
      { onConflict: "user_id" },
    );
    expect(mocks.revalidate).toHaveBeenCalledWith("/staff");
  });
  it("allows repeated approvals safely", async () => {
    const admin = adminFixture();
    await approveStaffAction(initial, approvalForm());
    await approveStaffAction(initial, approvalForm());
    expect(admin.upsert).toHaveBeenCalledTimes(2);
  });
  it("rejects malformed IDs before using privileged credentials", async () => {
    expect(
      (await approveStaffAction(initial, approvalForm("invalid"))).error,
    ).toBeTruthy();
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("does not grant access to deleted accounts", async () => {
    const admin = adminFixture();
    admin.getUserById.mockResolvedValue({
      data: { user: null },
      error: new Error("Not found"),
    });
    expect((await approveStaffAction(initial, approvalForm())).error).toContain(
      "no longer available",
    );
    expect(admin.upsert).not.toHaveBeenCalled();
  });
  it("reports failed staff grants without reporting success", async () => {
    const admin = adminFixture();
    admin.upsert.mockResolvedValue({ error: new Error("DB failure") });
    expect((await approveStaffAction(initial, approvalForm())).error).toContain(
      "Unable to approve",
    );
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});

describe("batch deletion", () => {
  function deletionFixture(
    data: { id: string; public_token: string } | null = {
      id: applicantId,
      public_token: "volunteer-token",
    },
    error: Error | null = null,
  ) {
    const f = sessionFixture({ id: applicantId });
    const maybeSingle = vi.fn().mockResolvedValue({ data, error });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const eq = vi.fn().mockReturnValue({ select });
    const remove = vi.fn().mockReturnValue({ eq });
    f.from.mockImplementation((table) =>
      table === "batches"
        ? { delete: remove }
        : { select: vi.fn().mockReturnValue({ eq: f.eq }) },
    );
    return { remove, eq };
  }

  it("blocks signed-out and unapproved callers", async () => {
    for (const [session, code] of [
      [{ signedIn: false }, 401],
      [{ approved: false }, 403],
    ] as const) {
      const f = sessionFixture(session);
      expect(await deleteBatchAction(applicantId)).toMatchObject({
        ok: false,
        code,
      });
      expect(f.from).not.toHaveBeenCalledWith("batches");
    }
  });

  it("rejects malformed IDs before deleting", async () => {
    const f = deletionFixture();
    expect(await deleteBatchAction("invalid")).toMatchObject({
      ok: false,
      code: 400,
    });
    expect(f.remove).not.toHaveBeenCalled();
  });

  it("lets ordinary staff delete the batch and refresh affected pages", async () => {
    const f = deletionFixture();
    expect(await deleteBatchAction(applicantId)).toEqual({
      ok: true,
      data: null,
    });
    expect(f.eq).toHaveBeenCalledWith("id", applicantId);
    for (const path of [
      "/batches",
      `/batches/${applicantId}`,
      "/voters",
      "/batch/volunteer-token",
    ]) {
      expect(mocks.revalidate).toHaveBeenCalledWith(path);
    }
    expect(mocks.admin).not.toHaveBeenCalled();
  });

  it("redirects to the list after deletion from the detail page", async () => {
    deletionFixture();
    await expect(deleteBatchAction(applicantId, true)).rejects.toThrow(
      "REDIRECT:/batches",
    );
  });

  it("reports missing batches without redirecting or refreshing", async () => {
    deletionFixture(null);
    expect(await deleteBatchAction(applicantId, true)).toMatchObject({
      ok: false,
      code: 404,
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("reports database errors without refreshing", async () => {
    deletionFixture(null, new Error("DB failure"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await deleteBatchAction(applicantId)).toMatchObject({
        ok: false,
        code: 500,
      });
      expect(mocks.revalidate).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
});

describe("voter removal", () => {
  it("blocks signed-out and unapproved accounts before deleting", async () => {
    sessionFixture({ signedIn: false });
    expect(await removeVotersAction([applicantId])).toMatchObject({
      ok: false,
      code: 401,
    });
    sessionFixture({ approved: false });
    expect(await removeVotersAction([applicantId])).toMatchObject({
      ok: false,
      code: 403,
    });
  });
  it("rejects empty, malformed, and oversized selections", async () => {
    for (const ids of [[], ["invalid"], Array(10001).fill(applicantId)]) {
      expect(await removeVotersAction(ids)).toMatchObject({
        ok: false,
        code: 400,
      });
    }
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("lets ordinary staff remove a selection and refreshes affected pages", async () => {
    const f = sessionFixture({ id: applicantId });
    const rpc = vi.fn().mockResolvedValue({ data: 2, error: null });
    Object.assign(f.db, { rpc });
    expect(await removeVotersAction([ownerId, applicantId, ownerId])).toEqual({
      ok: true,
      data: { count: 2 },
    });
    expect(rpc).toHaveBeenCalledWith("remove_voters", {
      p_voter_ids: [ownerId, applicantId],
    });
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(mocks.revalidate).toHaveBeenCalledWith("/voters");
    expect(mocks.revalidate).toHaveBeenCalledWith("/batches");
    expect(mocks.revalidate).toHaveBeenCalledWith("/batches/[id]", "page");
    expect(mocks.revalidate).toHaveBeenCalledWith("/batch/[token]", "page");
  });
  it("reports database failures without reporting removal or refreshing", async () => {
    const f = sessionFixture();
    Object.assign(f.db, {
      rpc: vi
        .fn()
        .mockResolvedValue({ data: null, error: new Error("DB failure") }),
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await removeVotersAction([applicantId])).toMatchObject({
        ok: false,
        code: 500,
      });
      expect(mocks.revalidate).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
});

describe("public signup and login", () => {
  it("creates accounts with the public client and never grants membership", async () => {
    const f = sessionFixture({ signedIn: false });
    const form = credentials();
    form.set("email", " Person@Example.org ");
    const result = await signupAction({ error: null, message: null }, form);
    expect(f.auth.signUp).toHaveBeenCalledWith({
      email: "person@example.org",
      password: "a-long-enough-password",
    });
    expect(result.message).toContain("must be approved");
    expect(result.message).toContain("confirm");
    expect(f.from).not.toHaveBeenCalled();
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("sends immediate-session signups to pending approval", async () => {
    const f = sessionFixture({ approved: false });
    f.auth.signUp.mockResolvedValue({
      data: { user: { id: applicantId }, session: { access_token: "token" } },
      error: null,
    });
    await expect(
      signupAction({ error: null, message: null }, credentials()),
    ).rejects.toThrow("REDIRECT:/pending-approval");
    expect(f.from).not.toHaveBeenCalled();
  });
  it("validates password length and confirmation before signup", async () => {
    const f = sessionFixture();
    expect(
      (await signupAction({ error: null, message: null }, credentials("short")))
        .error,
    ).toBeTruthy();
    const form = credentials();
    form.set("confirmPassword", "different-password");
    expect(
      (await signupAction({ error: null, message: null }, form)).error,
    ).toContain("do not match");
    expect(f.auth.signUp).not.toHaveBeenCalled();
  });
  it("reports signup delivery/provider errors without granting access", async () => {
    const f = sessionFixture();
    f.auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "over_email_send_rate_limit", status: 429 },
    });
    expect(
      (await signupAction({ error: null, message: null }, credentials())).error,
    ).toContain("Please wait");
    expect(f.from).not.toHaveBeenCalled();
  });
  it("keeps unapproved logins signed in and sends them to pending approval", async () => {
    const f = sessionFixture({ id: applicantId, approved: false });
    await expect(loginAction(initial, credentials())).rejects.toThrow(
      "REDIRECT:/pending-approval",
    );
    expect(f.eq).toHaveBeenCalledWith("user_id", applicantId);
    expect(f.auth.signOut).not.toHaveBeenCalled();
  });
  it("sends approved logins to the workspace", async () => {
    await expect(loginAction(initial, credentials())).rejects.toThrow(
      "REDIRECT:/voters",
    );
  });
  it("explains the default email confirmation requirement", async () => {
    const f = sessionFixture();
    f.auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { code: "email_not_confirmed" },
    });
    expect((await loginAction(initial, credentials())).error).toContain(
      "Confirm your email",
    );
    expect(f.from).not.toHaveBeenCalled();
  });
  it("does not redirect into the app when the membership lookup fails", async () => {
    sessionFixture().maybeSingle.mockResolvedValue({
      data: null,
      error: new Error("Database failure"),
    });
    expect((await loginAction(initial, credentials())).error).toContain(
      "database needs setup",
    );
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

describe("account listing", () => {
  it("loads every auth page and separates staff by actual membership", async () => {
    const users = Array.from({ length: 200 }, (_, i) => ({
      id: `user-${i}`,
      email: `person${i}@example.org`,
    }));
    const listUsers = vi
      .fn()
      .mockResolvedValueOnce({ data: { users }, error: null })
      .mockResolvedValueOnce({
        data: {
          users: [
            {
              id: "last-user",
              email: "last@example.org",
              email_confirmed_at: "confirmed",
            },
          ],
        },
        error: null,
      });
    const inQuery = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ user_id: "user-0" }], error: null })
      .mockResolvedValueOnce({ data: [], error: null });
    const db = {
      auth: { admin: { listUsers } },
      from: vi
        .fn()
        .mockReturnValue({ select: vi.fn().mockReturnValue({ in: inQuery }) }),
    } as unknown as SupabaseClient;
    const accounts = await staffAccounts(db);
    expect(accounts).toHaveLength(201);
    expect(accounts.filter((user) => !user.staff)).toHaveLength(200);
    expect(accounts.at(-1)).toMatchObject({
      email: "last@example.org",
      staff: false,
      confirmed: true,
    });
    expect(listUsers).toHaveBeenLastCalledWith({ page: 2, perPage: 200 });
  });
});

describe("default email confirmation callback", () => {
  it("exchanges the code and always opens the local approval page", async () => {
    const f = sessionFixture();
    const response = await GET(
      new NextRequest(
        "https://campaign.example.org/auth/callback?code=confirmation-code&next=https://evil.example",
      ),
    );
    expect(f.auth.exchangeCodeForSession).toHaveBeenCalledWith(
      "confirmation-code",
    );
    expect(response.headers.get("location")).toBe(
      "https://campaign.example.org/pending-approval",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });
  it("handles invalid and expired confirmations without exposing tokens", async () => {
    const f = sessionFixture();
    f.auth.exchangeCodeForSession.mockResolvedValue({
      error: new Error("Expired"),
    });
    const response = await GET(
      new NextRequest("https://campaign.example.org/auth/callback?code=secret"),
    );
    expect(response.headers.get("location")).toBe(
      "https://campaign.example.org/login?confirmation=failed",
    );
  });
  it("does not exchange missing codes", async () => {
    const f = sessionFixture();
    await GET(new NextRequest("https://campaign.example.org/auth/callback"));
    expect(f.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
});
