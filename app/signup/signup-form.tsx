"use client";
import Link from "next/link";
import { useActionState } from "react";
import { signupAction } from "@/app/actions/auth";
import ui from "@/components/shared.module.css";
import styles from "@/app/login/login.module.css";

export function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, {
    error: null,
    message: null,
  });
  return (
    <form action={action} className={styles.loginForm}>
      <label htmlFor="email">Email address</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        maxLength={254}
        required
        disabled={pending}
      />
      <label htmlFor="password">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={12}
        maxLength={128}
        required
        disabled={pending}
        aria-describedby="password-help"
      />
      <label htmlFor="confirm-password">Confirm password</label>
      <input
        id="confirm-password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        minLength={12}
        maxLength={128}
        required
        disabled={pending}
      />
      <p id="password-help" className={ui.muted}>
        Use at least 12 characters.
      </p>
      {state.error && (
        <p className={`${ui.alert} ${ui.error}`} role="alert">
          {state.error}
        </p>
      )}
      {state.message && (
        <div className={`${ui.alert} ${ui.success}`} role="status">
          <p>{state.message}</p>
          <Link href="/login">Go to sign in</Link>
        </div>
      )}
      <button
        className={`${ui.button} ${ui.primary} ${styles.loginSubmit}`}
        disabled={pending}
      >
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
