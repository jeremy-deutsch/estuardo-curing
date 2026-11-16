"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { addVoterNoteAction } from "@/app/actions/notes";
import { fullName, type Voter } from "@/lib/types";
import { Icon } from "./icon";
import ui from "./shared.module.css";
import styles from "./note-dialog.module.css";

const authorStorageKey = "ballot-operations:note-author:v1";

export function NoteDialog({
  token,
  voter,
  disabled = false,
  triggerClassName = "",
  onSaved,
}: {
  token: string;
  voter: Voter;
  disabled?: boolean;
  triggerClassName?: string;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function changeOpen(next: boolean) {
    if (busy) return;
    if (next) {
      try {
        setName(localStorage.getItem(authorStorageKey)?.slice(0, 120) || "");
      } catch {
        // Notes still work when browser storage is unavailable.
      }
      setBody("");
      setError("");
    }
    setOpen(next);
  }

  async function submit() {
    if (busy || !name.trim() || !body.trim()) return;
    setBusy(true);
    setError("");
    try {
      const result = await addVoterNoteAction(token, {
        voter_id: voter.id,
        author_name: name.trim(),
        body: body.trim(),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      try {
        localStorage.setItem(authorStorageKey, name.trim());
      } catch {
        // Saving the name locally must not prevent a successful note save.
      }
      setOpen(false);
      onSaved();
    } catch {
      setError("Unable to save your note. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogTrigger isOpen={open} onOpenChange={changeOpen}>
      <Button
        className={`${ui.button} ${ui.small} ${triggerClassName}`}
        isDisabled={disabled}
        aria-label={`Add note for ${fullName(voter)}`}
      >
        <Icon name="notes" /> Add note
      </Button>
      <ModalOverlay
        className={styles.overlay}
        isDismissable={!busy}
        isKeyboardDismissDisabled={busy}
      >
        <Modal className={styles.modal}>
          <Dialog className={styles.dialog}>
            <div className={styles.heading}>
              <Heading slot="title">Add a note</Heading>
              <Button
                className={ui.iconButton}
                aria-label="Close note dialog"
                isDisabled={busy}
                onPress={() => changeOpen(false)}
              >
                <Icon name="close" />
              </Button>
            </div>
            <p className={styles.description}>
              For {fullName(voter)}. Notes are visible to campaign staff.
            </p>
            <form action={submit} className={styles.form}>
              <label>
                Your name
                <input
                  autoFocus
                  name="author_name"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={120}
                  required
                  disabled={busy}
                />
              </label>
              <label>
                Note
                <textarea
                  name="body"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  maxLength={5000}
                  rows={6}
                  required
                  disabled={busy}
                  placeholder="Share details from your conversation or follow-up needed…"
                />
              </label>
              {error && (
                <div className={`${ui.alert} ${ui.error}`} role="alert">
                  {error}
                </div>
              )}
              <div className={styles.actions}>
                <Button
                  className={ui.button}
                  isDisabled={busy}
                  onPress={() => changeOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className={`${ui.button} ${ui.primary}`}
                  isDisabled={busy || !name.trim() || !body.trim()}
                >
                  {busy ? "Saving…" : "Save note"}
                </Button>
              </div>
            </form>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
