"use client";
import ui from "./shared.module.css";
import styles from "./batches-screen.module.css";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Icon } from "./icon";
import { DeleteBatchButton } from "./delete-batch-button";
import { updateBatchAction } from "@/app/actions/batches";
import type { Batch, Voter, Workspace } from "@/lib/types";
import { formatDate } from "@/lib/format";
function BatchRow({
  batch,
  voters,
  onMessage,
}: {
  batch: Batch;
  voters: Voter[];
  onMessage: (s: string) => void;
}) {
  const [name, setName] = useState(batch.name);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState("");
  const members = voters.filter((v) => batch.voter_ids.includes(v.id));
  const cured = members.filter((v) => v.status === "cured").length;
  function update(fields: { name?: string; active?: boolean }) {
    startTransition(async () => {
      setError("");
      try {
        const result = await updateBatchAction(batch.id, fields);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        onMessage(
          fields.name
            ? "Batch renamed."
            : fields.active
              ? "Batch link enabled."
              : "Batch link disabled.",
        );
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/batch/${batch.public_token}`,
      );
      onMessage("Batch link copied to clipboard.");
    } catch {
      setError(
        "Clipboard is unavailable. Open the batch and copy its volunteer link.",
      );
    }
  }
  return (
    <tr>
      <td>
        <div className={styles.batchNameEdit}>
          <span
            className={`${styles.batchTypeIcon} ${styles[batch.kind] || ""}`}
          >
            <Icon name={batch.kind} />
          </span>
          <div>
            <label className={ui.srOnly} htmlFor={`name-${batch.id}`}>
              Batch name
            </label>
            <input
              id={`name-${batch.id}`}
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
            />
            {name !== batch.name && (
              <button
                className={ui.textButton}
                disabled={busy || !name.trim()}
                onClick={() => void update({ name: name.trim() })}
              >
                Save name
              </button>
            )}
            <small>{formatDate(batch.created_at)}</small>
          </div>
        </div>
        {error && (
          <p className={ui.errorText} role="alert">
            {error}
          </p>
        )}
      </td>
      <td>
        <span className={styles.typeChip}>
          <Icon name={batch.kind} />
          {batch.kind === "door" ? "Door-knocking" : "Phone-calling"}
        </span>
      </td>
      <td>{members.length.toLocaleString("en-US")}</td>
      <td>
        <div className={styles.batchProgress}>
          <span>
            {cured} / {members.length} cured
          </span>
          <div>
            <i
              style={{
                width: `${members.length ? (cured / members.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      </td>
      <td>
        <button
          className={`${ui.statusChip} ${styles.linkToggle} ${batch.active ? ui.cured : ""}`}
          onClick={() => void update({ active: !batch.active })}
          disabled={busy}
          title={
            batch.active ? "Disable public access" : "Enable public access"
          }
        >
          <i />
          {batch.active ? "Link active" : "Disabled"}
        </button>
      </td>
      <td>
        <div className={ui.rowActions}>
          <button
            className={ui.iconButton}
            disabled={!batch.active}
            onClick={() => void copy()}
            aria-label={`Copy link for ${batch.name}`}
            title="Copy volunteer link"
          >
            <Icon name="copy" />
          </button>
          <Link
            className={`${ui.button} ${ui.small}`}
            href={`/batches/${batch.id}`}
          >
            View
            <Icon name="arrow" />
          </Link>
          <DeleteBatchButton
            batch={batch}
            disabled={busy}
            onDeleted={() => onMessage("Batch deleted.")}
          />
        </div>
      </td>
    </tr>
  );
}
export function BatchesScreen({ data }: { data: Workspace }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [message, setMessage] = useState("");
  const batches =
    data?.batches
      .filter(
        (b) =>
          b.name.toLowerCase().includes(query.toLowerCase()) &&
          (!kind || b.kind === kind),
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at)) || [];
  return (
    <>
      <div className={ui.pageHeading}>
        <div>
          <h1>
            Batches<span className={ui.headingDot}>.</span>
          </h1>
        </div>
        <Link className={`${ui.button} ${ui.primary}`} href="/voters">
          <Icon name="plus" />
          Build a batch
        </Link>
      </div>
      <div className={styles.batchSummary}>
        <span className={`${ui.featureIcon} ${styles.featureIcon}`}>
          <Icon name="batches" />
        </span>
        <div>
          <strong>
            {data?.batches.filter((b) => b.active).length || 0} active batches
          </strong>
          <p>
            Share a batch link with a volunteer. Their updates are saved to the
            shared voter record.
          </p>
        </div>
      </div>
      {message && (
        <div className={`${ui.alert} ${ui.success}`} role="status">
          <Icon name="check" />
          {message}
          <button
            className={ui.iconButton}
            onClick={() => setMessage("")}
            aria-label="Dismiss"
          >
            <Icon name="close" />
          </button>
        </div>
      )}
      <section className={ui.panel}>
        <div className={ui.sectionTop}>
          <h2>
            All batches{" "}
            <span className={ui.countTag}>{data?.batches.length || 0}</span>
          </h2>
          <span className={`${ui.muted} ${ui.smallText}`}>
            Edit a name directly in the table
          </span>
        </div>
        <div className={ui.filterBar}>
          <div className={ui.searchField}>
            <Icon name="search" />
            <input
              aria-label="Search batches"
              placeholder="Find a batch…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            aria-label="Filter batch type"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="">All outreach types</option>
            <option value="door">Door-knocking</option>
            <option value="phone">Phone-calling</option>
          </select>
        </div>
        <div className={ui.tableScroll}>
          <table className={`${ui.table} ${styles.batchesTable}`}>
            <thead>
              <tr>
                <th>Batch name</th>
                <th>Outreach type</th>
                <th>Voters</th>
                <th>Progress</th>
                <th>Public access</th>
                <th>
                  <span className={ui.srOnly}>Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <BatchRow
                  key={`${b.id}-${b.name}`}
                  batch={b}
                  voters={data?.voters || []}
                  onMessage={setMessage}
                />
              ))}
            </tbody>
          </table>
          {!batches.length && (
            <div className={ui.emptyState}>
              <span className={`${ui.featureIcon} ${styles.featureIcon}`}>
                <Icon name="batches" />
              </span>
              <h3>
                {query || kind ? "No matching batches" : "No batches yet"}
              </h3>
              <p>
                {query || kind
                  ? "No batches match these filters."
                  : "Select voters in the workspace, then add them to a door-knocking or phone-calling batch."}
              </p>
              {!query && !kind && (
                <Link href="/voters" className={`${ui.button} ${ui.small}`}>
                  Choose voters
                  <Icon name="arrow" />
                </Link>
              )}
            </div>
          )}
        </div>
      </section>
      <div className={ui.workspaceTip}>
        <Icon name="lock" />
        <p>
          <strong>A batch link grants access to its voters.</strong> Share it
          with your assigned volunteers. Disable public access here when the
          work is complete.
        </p>
      </div>
    </>
  );
}
