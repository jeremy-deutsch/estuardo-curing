"use client";

import { useState, useTransition } from "react";
import { deleteBatchAction } from "@/app/actions/batches";
import type { Batch } from "@/lib/types";
import ui from "./shared.module.css";

export function DeleteBatchButton({
  batch,
  redirectToList = false,
  disabled = false,
  onDeleted,
}: {
  batch: Pick<Batch, "id" | "name">;
  redirectToList?: boolean;
  disabled?: boolean;
  onDeleted?: () => void;
}) {
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState("");

  function remove() {
    if (
      !window.confirm(
        `Delete batch “${batch.name}”? Its volunteer link will stop working. Voter records and contact history will be kept. This cannot be undone.`,
      )
    )
      return;

    setError("");
    startTransition(async () => {
      try {
        const result = await deleteBatchAction(batch.id, redirectToList);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        onDeleted?.();
      } catch {
        setError("Unable to delete the batch. Please try again.");
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        className={`${ui.button} ${ui.small}`}
        aria-label={`Delete batch ${batch.name}`}
        disabled={disabled || busy}
        onClick={remove}
      >
        {busy ? "Deleting…" : "Delete batch"}
      </button>
      {error && (
        <p className={ui.errorText} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
