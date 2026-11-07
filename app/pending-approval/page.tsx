import { Suspense } from "react";
import { redirect, unstable_rethrow } from "next/navigation";
import { accountSession, HttpError } from "@/lib/auth";
import { RefreshApproval } from "@/components/refresh-approval";
import { SignOutForm } from "@/components/sign-out-form";
import ui from "@/components/shared.module.css";
import styles from "./pending.module.css";

export const metadata = { title: "Awaiting approval" };

async function Pending() {
  let session;
  try {
    session = await accountSession();
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof HttpError && error.status === 401) redirect("/login");
    throw error;
  }
  const { data, error } = await session.db
    .from("staff_members")
    .select("user_id")
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (error)
    throw new Error("Unable to check approval status. Please try again.");
  if (data) redirect("/voters");
  return (
    <main className={ui.standaloneState}>
      <section className={styles.card}>
        <span className={ui.eyebrow}>CAMPAIGN WORKSPACE</span>
        <h1>Awaiting approval</h1>
        <p>
          Your account ({session.user.email}) has been created. A campaign
          administrator needs to approve it before you can access the app.
        </p>
        <p className={ui.muted}>
          Once approved, check your status below or sign in again to open the
          workspace.
        </p>
        <div className={styles.actions}>
          <RefreshApproval />
          <SignOutForm />
        </div>
      </section>
    </main>
  );
}
export default function PendingApprovalPage() {
  return (
    <Suspense
      fallback={
        <main className={ui.standaloneState}>Checking account status…</main>
      }
    >
      <Pending />
    </Suspense>
  );
}
