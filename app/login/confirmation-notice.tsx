"use client";
import { useSearchParams } from "next/navigation";
import ui from "@/components/shared.module.css";

export function ConfirmationNotice() {
  const params = useSearchParams();
  if (params.get("confirmation") !== "failed") return null;
  return (
    <p className={`${ui.alert} ${ui.error}`} role="alert">
      We couldn’t finish confirming your session. If you confirmed your email,
      sign in below. Otherwise, reopen your confirmation link in the browser
      where you registered.
    </p>
  );
}
