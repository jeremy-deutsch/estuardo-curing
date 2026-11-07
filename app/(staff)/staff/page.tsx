import { notFound } from "next/navigation";
import { staffPageSession } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/super-admin";
import { adminClient } from "@/lib/supabase/admin";
import { staffAccounts } from "@/lib/staff-management";
import { ApproveForm } from "./approve-form";
import { RefreshApproval } from "@/components/refresh-approval";
import ui from "@/components/shared.module.css";
import styles from "./staff.module.css";

export const metadata = { title: "Staff management" };

export default async function StaffPage() {
  const { user } = await staffPageSession();
  if (!isSuperAdmin(user.id)) notFound();
  const configured = Boolean(process.env.SUPABASE_SECRET_KEY);
  const accounts = configured ? await staffAccounts(adminClient()) : [];
  const pending = accounts.filter((account) => !account.staff);
  const staff = accounts.filter((account) => account.staff);
  return (
    <div className={styles.workspace}>
      <header>
        <span className={ui.eyebrow}>SUPER-ADMIN</span>
        <h1>Staff management</h1>
        <p className={ui.muted}>
          Review registered accounts and approve access to the campaign
          workspace.
        </p>
        <RefreshApproval label="Refresh accounts" />
      </header>
      {!configured ? (
        <p role="alert" className={ui.errorText}>
          Set SUPABASE_SECRET_KEY on the server to manage staff approvals.
        </p>
      ) : (
        <>
          <section
            className={`${ui.panel} ${styles.section}`}
            aria-labelledby="pending-heading"
          >
            <h2 id="pending-heading">Awaiting approval ({pending.length})</h2>
            {pending.length === 0 ? (
              <p className={ui.muted}>No accounts are waiting for approval.</p>
            ) : (
              <div className={ui.tableScroll}>
                <table className={ui.table}>
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Email status</th>
                      <th>Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((account) => (
                      <tr key={account.id}>
                        <td>{account.email || "No email"}</td>
                        <td>
                          {account.confirmed ? "Confirmed" : "Not confirmed"}
                        </td>
                        <td>
                          {account.email ? (
                            <ApproveForm userId={account.id} />
                          ) : (
                            "Email account required"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section
            className={`${ui.panel} ${styles.section}`}
            aria-labelledby="staff-heading"
          >
            <h2 id="staff-heading">Staff members ({staff.length})</h2>
            <div className={ui.tableScroll}>
              <table className={ui.table}>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((account) => (
                    <tr key={account.id}>
                      <td>{account.email || "No email"}</td>
                      <td>
                        {isSuperAdmin(account.id) ? "Super-admin" : "Staff"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
