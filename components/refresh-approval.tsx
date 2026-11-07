"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import ui from "./shared.module.css";

export function RefreshApproval({
  label = "Check approval status",
}: {
  label?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      className={ui.button}
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? "Checking…" : label}
    </button>
  );
}
