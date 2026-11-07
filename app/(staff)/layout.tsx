import styles from "../../components/shared.module.css";
import { Suspense } from "react";
import { redirect, unstable_rethrow } from "next/navigation";
import { staffSession, HttpError } from "@/lib/auth";
import { StaffShell } from "@/components/staff-shell";
async function Protected({ children }: { children: React.ReactNode }) {
  let session;
  try {
    session = await staffSession();
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof HttpError && error.status === 401) redirect("/login");
    return (
      <main className={styles.standaloneState}>
        <h1>Staff access required</h1>
        <p>
          {error instanceof HttpError
            ? error.message
            : "Unable to connect. Please try again."}
        </p>
        <a className={styles.button} href="/login">
          Go to login
        </a>
      </main>
    );
  }
  return (
    <StaffShell email={session.user.email || "Staff"}>{children}</StaffShell>
  );
}
export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <main className={styles.standaloneState}>
          <span className={styles.spinner} />
          <p>Opening your workspace…</p>
        </main>
      }
    >
      <Protected>{children}</Protected>
    </Suspense>
  );
}
