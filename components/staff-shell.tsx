"use client";
import ui from "./shared.module.css";
import styles from "./staff-shell.module.css";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState } from "react";
import { Icon } from "./icon";
import { logoutAction } from "@/app/actions/auth";
export function StaffShell({
  email,
  superAdmin = false,
  children,
}: {
  email: string;
  superAdmin?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [{ error }, logout, busy] = useActionState(logoutAction, {
    error: null,
  });
  return (
    <div className={styles.appShell}>
      <aside className={styles.sidebar}>
        <div className={styles.workspaceLabel}>
          <span className={styles.workspaceAvatar}>BO</span>
          <div>
            Ballot operations<small>Campaign workspace</small>
          </div>
          <span className={`${ui.liveDot} ${styles.liveDot}`} />
        </div>
        <p className={styles.navLabel}>WORKSPACE</p>
        <nav aria-label="Staff navigation">
          {(
            [
              { href: "/voters", label: "Voters", icon: "voters" },
              { href: "/batches", label: "Batches", icon: "batches" },
              { href: "/uploads", label: "Uploads", icon: "upload" },
            ] as const
          ).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${pathname.startsWith(item.href) ? styles.active : ""}`}
            >
              <Icon name={item.icon} />
              {item.label}
              {pathname.startsWith(item.href) && (
                <span className={styles.navActiveDot} />
              )}
            </Link>
          ))}
        </nav>
        {superAdmin && (
          <Link
            href="/staff"
            className={`${styles.navItem} ${pathname.startsWith("/staff") ? styles.active : ""}`}
          >
            <Icon name="voters" />
            Staff management
          </Link>
        )}
        <div className={styles.sidebarBottom}>
          <div className={styles.staffAccount}>
            <span className={styles.accountAvatar}>
              {email[0]?.toUpperCase() || "S"}
            </span>
            <div>
              <strong>{superAdmin ? "Super-admin" : "Campaign staff"}</strong>
              <small title={email}>{email}</small>
            </div>
            <form
              action={logout}
              onSubmit={(event) => {
                if (!window.confirm("Are you sure you want to log out?")) {
                  event.preventDefault();
                }
              }}
            >
              <button
                className={`${ui.iconButton} ${styles.iconButton}`}
                disabled={busy}
                title="Sign out"
                aria-label="Sign out"
              >
                <Icon name="logout" />
              </button>
            </form>
          </div>
          {error && (
            <p role="alert" className={ui.errorText}>
              {error}
            </p>
          )}
        </div>
      </aside>
      <div className={styles.mainColumn}>
        <header className={styles.topbar}>
          <div>
            <span className={styles.breadcrumb}>Workspace</span>
            <span className={styles.slash}>/</span>
            <span>
              {pathname.startsWith("/staff")
                ? "Staff management"
                : pathname.startsWith("/uploads")
                  ? "Uploads"
                  : pathname.startsWith("/batches")
                    ? "Batches"
                    : "Voters"}
            </span>
          </div>
          <span className={ui.staffBadge}>
            <span className={`${ui.liveDot} ${styles.liveDot}`} /> Staff
            workspace
          </span>
        </header>
        <main className={styles.mainContent}>{children}</main>
      </div>
    </div>
  );
}
