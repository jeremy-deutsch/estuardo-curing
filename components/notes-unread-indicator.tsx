"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { request } from "@/lib/client";
import type { NotesReadStatus } from "@/lib/types";
import { Icon } from "./icon";
import styles from "./staff-shell.module.css";

export function NotesUnreadIndicator({
  initialUnread,
}: {
  initialUnread: boolean;
}) {
  const [unread, setUnread] = useState(initialUnread);
  const pathname = usePathname();

  useEffect(() => {
    let controller: AbortController | undefined;
    async function refresh() {
      if (document.visibilityState === "hidden") return;
      controller?.abort();
      const pending = new AbortController();
      controller = pending;
      try {
        const status = await request<NotesReadStatus>("/api/notes/status", {
          signal: pending.signal,
        });
        if (!pending.signal.aborted) setUnread(status.has_unread);
      } catch {
        // Keep the last known state on network failure and retry on the next refresh.
      }
    }
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("notes-viewed", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller?.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("notes-viewed", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [pathname]);

  return unread ? (
    <span
      className={styles.unreadNotes}
      role="img"
      aria-label="Unread notes"
      title="Unread notes"
    >
      <Icon name="unread" />
    </span>
  ) : null;
}
