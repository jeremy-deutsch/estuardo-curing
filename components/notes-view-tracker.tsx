"use client";

import { startTransition, useEffect, useState } from "react";
import { markNotesViewedAction } from "@/app/actions/notes";
import ui from "./shared.module.css";

export function NotesViewTracker({ viewedAt }: { viewedAt: string }) {
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState(false);
  useEffect(() => {
    let mounted = true;
    function markViewed() {
      if (document.visibilityState === "hidden") return;
      startTransition(async () => {
        try {
          const result = await markNotesViewedAction(viewedAt);
          if (mounted) setError(!result.ok);
          if (result.ok) window.dispatchEvent(new Event("notes-viewed"));
        } catch {
          if (mounted) setError(true);
        }
      });
    }
    markViewed();
    document.addEventListener("visibilitychange", markViewed);
    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", markViewed);
    };
  }, [viewedAt, attempt]);
  return error ? (
    <div className={`${ui.alert} ${ui.error}`} role="alert">
      Unable to record your Notes visit.
      <button
        type="button"
        className={ui.textButton}
        onClick={() => setAttempt((value) => value + 1)}
      >
        Retry
      </button>
    </div>
  ) : null;
}
