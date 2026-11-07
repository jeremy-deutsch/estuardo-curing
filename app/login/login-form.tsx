"use client";
import ui from "../../components/shared.module.css";
import styles from "./login.module.css";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
import { Icon } from "@/components/icon";
export function LoginForm() {
  const [{ error }, submit, busy] = useActionState(loginAction, {
    error: null,
  });
  return (
    <form action={submit} className={styles.loginForm}>
      <label htmlFor="email">Email address</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="username"
        placeholder="you@campaign.org"
        required
        disabled={busy}
      />
      <label htmlFor="password">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="Enter your password"
        required
        disabled={busy}
      />
      {error && (
        <div className={`${ui.alert} ${ui.error}`} role="alert">
          {error}
        </div>
      )}
      <button
        className={`${ui.button} ${ui.primary} ${styles.loginSubmit}`}
        disabled={busy}
      >
        {busy ? "Signing in…" : "Sign in"}
        <Icon name="arrow" />
      </button>
    </form>
  );
}
