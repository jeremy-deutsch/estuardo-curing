"use client";
import ui from "./shared.module.css";
import styles from "./batch-dialog.module.css";

import { useRef, useEffect, useState } from "react";
import { assignBatchAction } from "@/app/actions/batches";
import type { Batch } from "@/lib/types";
import { Icon } from "./icon";
export function BatchDialog({
  ids,
  batches,
  onClose,
  onSaved,
}: {
  ids: string[];
  batches: Batch[];
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [existing, setExisting] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  async function submit(form: FormData) {
    setBusy(true);
    setError("");
    try {
      const result = await assignBatchAction({
        name: existing ? "Existing batch" : String(form.get("name") || ""),
        kind: form.get("kind") === "phone" ? "phone" : "door",
        batch_id: existing || null,
        voter_ids: ids,
      });
      if (!result.ok) {
        setError(result.error);
        setBusy(false);
        return;
      }
      onSaved(result.data.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={ref}
      className={styles.modal}
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
      aria-labelledby="batch-dialog-title"
    >
      <div className={styles.modalHeading}>
        <span className={ui.featureIcon}>
          <Icon name="batches" />
        </span>
        <button
          className={ui.iconButton}
          aria-label="Close dialog"
          disabled={busy}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      <h2 id="batch-dialog-title">Add voters to a batch</h2>
      <p className={`${ui.muted} ${styles.muted}`}>
        Assign {ids.length.toLocaleString("en-US")} selected{" "}
        {ids.length === 1 ? "voter" : "voters"} to a volunteer batch.
      </p>
      <form action={submit}>
        <label htmlFor="existing-batch">Destination</label>
        <select
          id="existing-batch"
          value={existing}
          onChange={(e) => setExisting(e.target.value)}
          disabled={busy}
        >
          <option value="">Create a new batch</option>
          {batches
            .filter((b) => b.active)
            .map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ·{" "}
                {b.kind === "door" ? "Door-knocking" : "Phone-calling"}
              </option>
            ))}
        </select>
        {!existing && (
          <>
            <label htmlFor="batch-name">Batch name</label>
            <input
              id="batch-name"
              name="name"
              placeholder="e.g. Central neighborhood · Saturday"
              maxLength={120}
              required
              disabled={busy}
            />
            <label htmlFor="batch-kind">Outreach type</label>
            <select id="batch-kind" name="kind" disabled={busy}>
              <option value="door">Door-knocking</option>
              <option value="phone">Phone-calling</option>
            </select>
          </>
        )}
        {error && (
          <div
            className={`${ui.alert} ${styles.alert} ${ui.error}`}
            role="alert"
          >
            {error}
          </div>
        )}
        <div className={styles.modalActions}>
          <button
            className={`${ui.button} ${styles.button}`}
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            className={`${ui.button} ${styles.button} ${ui.primary}`}
            disabled={busy}
          >
            {busy ? "Saving…" : existing ? "Add to batch" : "Create batch"}
            <Icon name="arrow" />
          </button>
        </div>
      </form>
    </dialog>
  );
}
