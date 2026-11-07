"use client";
import { useActionState } from "react";
import { approveStaffAction } from "@/app/actions/staff";
import ui from "@/components/shared.module.css";

export function ApproveForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(approveStaffAction, {
    error: null,
  });
  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <button className={`${ui.button} ${ui.primary}`} disabled={pending}>
        {pending ? "Approving…" : "Approve as staff"}
      </button>
      {state.error && (
        <p role="alert" className={ui.errorText}>
          {state.error}
        </p>
      )}
    </form>
  );
}
