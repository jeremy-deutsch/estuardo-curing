"use client";

import { useState } from "react";
import Link from "next/link";
import { Checkbox } from "react-aria-components";
import { downloadCsv } from "@/lib/client";
import { formatDateTime } from "@/lib/format";
import { statusLabels, type VoterNote } from "@/lib/types";
import { Icon } from "./icon";
import ui from "./shared.module.css";
import styles from "./notes-screen.module.css";

export function NotesScreen({
  notes,
  voterId,
}: {
  notes: VoterNote[];
  voterId?: string;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [message, setMessage] = useState("");
  const filtered = notes.filter((note) =>
    `${note.voter_name} ${note.voter_address} ${note.voter_phone} ${note.batch_name} ${note.author_name} ${note.body}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const selectedNotes = notes.filter((note) => selected.has(note.id));
  const allSelected =
    filtered.length > 0 && filtered.every((note) => selected.has(note.id));
  const someSelected = filtered.some((note) => selected.has(note.id));
  const safePage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / 25) - 1),
  );
  const visible = filtered.slice(safePage * 25, (safePage + 1) * 25);

  function toggle(ids: string[], checked: boolean) {
    setSelected((previous) => {
      const next = new Set(previous);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function exportSelected() {
    if (!selectedNotes.length) return;
    downloadCsv("voter-notes.csv", [
      [
        "Note ID",
        "Voter ID",
        "Voter",
        "Address",
        "Phone",
        "Batch",
        "Author",
        "Note",
        "Created at",
      ],
      ...selectedNotes.map((note) => [
        note.id,
        note.voter_id,
        note.voter_name,
        note.voter_address,
        note.voter_phone,
        note.batch_name,
        note.author_name,
        note.body,
        note.created_at,
      ]),
    ]);
    setMessage(
      `Exported ${selectedNotes.length} ${selectedNotes.length === 1 ? "note" : "notes"}.`,
    );
  }

  return (
    <>
      <div className={ui.pageHeading}>
        <div>
          <h1>
            Notes<span className={ui.headingDot}>.</span>
          </h1>
          <p className={ui.muted}>
            Conversation notes and follow-ups from your batches.
          </p>
        </div>
      </div>
      <section className={ui.panel} aria-label="Voter notes">
        {voterId && (
          <div className={styles.voterFilter}>
            <span>
              Notes for{" "}
              <strong>{notes[0]?.voter_name || "selected voter"}</strong>
            </span>
            <Link className={ui.textButton} href="/notes">
              Show all notes
            </Link>
          </div>
        )}
        <div className={`${ui.sectionTop} ${styles.toolbar}`}>
          <h2>
            {voterId ? "Voter notes" : "All notes"}{" "}
            <span className={ui.countTag}>
              {notes.length.toLocaleString("en-US")}
            </span>
          </h2>
          <div className={ui.searchField}>
            <Icon name="search" />
            <input
              type="search"
              aria-label="Search notes"
              placeholder="Find a voter, author, or note…"
              spellCheck={false}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
            />
          </div>
        </div>
        <div className={styles.selectionBar}>
          <span>
            {selectedNotes.length.toLocaleString("en-US")} selected (including
            selections outside this search)
          </span>
          <button
            type="button"
            className={ui.textButton}
            disabled={!selectedNotes.length}
            onClick={() => setSelected(new Set())}
          >
            Clear selection
          </button>
          <button
            type="button"
            className={`${ui.button} ${ui.small}`}
            disabled={!selectedNotes.length}
            onClick={exportSelected}
          >
            <Icon name="file" />
            Export selected CSV
          </button>
        </div>
        <p role="status" className={styles.announcement}>
          {message}
        </p>
        <div className={ui.tableScroll}>
          <table
            className={`${ui.table} ${styles.table}`}
            aria-label="Voter notes"
          >
            <thead>
              <tr>
                <th scope="col">
                  <Checkbox
                    className={styles.checkbox}
                    aria-label="Select all filtered notes"
                    isSelected={allSelected}
                    isIndeterminate={someSelected && !allSelected}
                    isDisabled={!filtered.length}
                    onChange={(checked) =>
                      toggle(
                        filtered.map((note) => note.id),
                        checked,
                      )
                    }
                  >
                    <span className={styles.checkmark} />
                  </Checkbox>
                </th>
                <th scope="col">Voter</th>
                <th scope="col">Note</th>
                <th scope="col">Left by</th>
                <th scope="col">Batch</th>
                <th scope="col">Created</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((note) => (
                <tr
                  key={note.id}
                  data-selected={selected.has(note.id) || undefined}
                >
                  <td>
                    <Checkbox
                      className={styles.checkbox}
                      aria-label={`Select note by ${note.author_name} for ${note.voter_name} from ${formatDateTime(note.created_at)}`}
                      isSelected={selected.has(note.id)}
                      onChange={(checked) => toggle([note.id], checked)}
                    >
                      <span className={styles.checkmark} />
                    </Checkbox>
                  </td>
                  <td className={styles.voter}>
                    <strong>
                      {note.voter_id ? (
                        <Link
                          className={styles.voterLink}
                          href={`/notes?voter=${note.voter_id}`}
                          aria-label={`Filter notes for ${note.voter_name}`}
                        >
                          {note.voter_name}
                        </Link>
                      ) : (
                        note.voter_name
                      )}
                    </strong>
                    <small>{note.voter_address}</small>
                    <small>{note.voter_phone}</small>
                    {note.voter ? (
                      <span
                        className={`${ui.statusChip} ${styles.statusChip} ${ui[note.voter.status || "uncontacted"] || ""}`}
                      >
                        <i />
                        {statusLabels[note.voter.status || "uncontacted"]}
                      </span>
                    ) : (
                      <small>Voter removed</small>
                    )}
                  </td>
                  <td className={styles.body}>{note.body}</td>
                  <td>{note.author_name}</td>
                  <td>
                    {note.batch_id ? (
                      <Link
                        className={ui.textButton}
                        href={`/batches/${note.batch_id}`}
                      >
                        {note.batch_name}
                      </Link>
                    ) : (
                      note.batch_name
                    )}
                  </td>
                  <td>
                    <time dateTime={note.created_at}>
                      {formatDateTime(note.created_at)}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <div className={ui.emptyState}>
            <Icon name="notes" />
            <h3>
              {notes.length
                ? "No matching notes."
                : voterId
                  ? "No notes for this voter."
                  : "No notes yet."}
            </h3>
            <p>
              {notes.length
                ? "Try searching for another voter, author, or phrase."
                : voterId
                  ? "Use Show all notes to see notes for other voters."
                  : "Anyone with an active batch link can add a note from a voter’s card."}
            </p>
          </div>
        )}
        <div className={ui.tablePagination}>
          <span>
            {filtered.length
              ? `${safePage * 25 + 1}–${Math.min((safePage + 1) * 25, filtered.length)} of ${filtered.length.toLocaleString("en-US")} notes`
              : "0 notes"}
          </span>
          <div>
            <button
              type="button"
              className={ui.iconButton}
              aria-label="Previous page"
              disabled={!safePage}
              onClick={() => setPage(safePage - 1)}
            >
              <Icon name="back" />
            </button>
            <button
              type="button"
              className={ui.iconButton}
              aria-label="Next page"
              disabled={(safePage + 1) * 25 >= filtered.length}
              onClick={() => setPage(safePage + 1)}
            >
              <Icon name="arrow" />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
