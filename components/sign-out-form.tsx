"use client";
import { useActionState } from "react";
import { logoutAction } from "@/app/actions/auth";
import ui from "./shared.module.css";

export function SignOutForm() {
  const [state, action, pending] = useActionState(logoutAction, {
    error: null,
  });
  return (
    <form action={action}>
      <button className={ui.button} disabled={pending}>
        {pending ? "Signing out…" : "Sign out"}
      </button>
      {state.error && (
        <p role="alert" className={ui.errorText}>
          {state.error}
        </p>
      )}
    </form>
  );
}
