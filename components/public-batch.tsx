"use client";
import ui from "./shared.module.css";
import styles from "./public-batch.module.css";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setVoterStatusAction } from "@/app/actions/voters";
import {
  fullName,
  address,
  statuses,
  statusLabels,
  type ActionResult,
  type PublicBatch,
  type VoterStatus,
} from "@/lib/types";
import { Icon } from "./icon";
import { VoterMap } from "./voter-map";
export function PublicBatchView({
  token,
  batch,
  readOnly = false,
  embedded = false,
  removeVoterAction,
}: {
  token: string;
  batch: PublicBatch;
  readOnly?: boolean;
  embedded?: boolean;
  removeVoterAction?: (voterId: string) => Promise<ActionResult<null>>;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [refreshing, startRefresh] = useTransition();
  const [busy, setBusy] = useState<string[]>([]);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState("");
  function refresh() {
    setRowErrors({});
    startRefresh(() => router.refresh());
  }
  function update(id: string, status: VoterStatus) {
    const voter = batch?.voters.find((v) => v.id === id);
    if (!voter) return;
    setBusy((prev) => [...prev, id]);
    setRowErrors((prev) => ({ ...prev, [id]: "" }));
    setMessage("");
    startTransition(async () => {
      try {
        const result = await setVoterStatusAction(token, {
          voter_id: id,
          status,
          updated_at: voter.updated_at,
        });
        if (!result.ok) {
          setRowErrors((prev) => ({ ...prev, [id]: result.error }));
          if (result.code === 404) router.refresh();
          return;
        }
        setMessage(
          `${fullName(voter)}: ${status ? statusLabels[status] : "status cleared"}. Saved.`,
        );
      } catch (e) {
        setRowErrors((prev) => ({ ...prev, [id]: (e as Error).message }));
      } finally {
        setBusy((prev) => prev.filter((v) => v !== id));
      }
    });
  }
  function remove(id: string) {
    const voter = batch.voters.find((v) => v.id === id);
    if (!voter || !removeVoterAction) return;
    if (!window.confirm("Remove voter from this batch?")) return;
    setBusy((prev) => [...prev, id]);
    setRowErrors((prev) => ({ ...prev, [id]: "" }));
    setMessage("");
    startTransition(async () => {
      try {
        const result = await removeVoterAction(id);
        if (!result.ok) {
          setRowErrors((prev) => ({ ...prev, [id]: result.error }));
          if (result.code === 404) router.refresh();
          return;
        }
        setMessage(`${fullName(voter)} removed from this batch.`);
      } catch (e) {
        setRowErrors((prev) => ({ ...prev, [id]: (e as Error).message }));
      } finally {
        setBusy((prev) => prev.filter((v) => v !== id));
      }
    });
  }
  const voters =
    batch?.voters.filter(
      (v) =>
        `${fullName(v)} ${v.street} ${v.zip}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (!filter || (v.status || "uncontacted") === filter),
    ) || [];
  const cured = batch?.voters.filter((v) => v.status === "cured").length || 0;
  return (
    <div className={embedded ? styles.embeddedBatch : styles.publicPage}>
      {!embedded && (
        <header className={styles.publicHeader}>
          <span className={ui.staffBadge}>
            <span className={ui.liveDot} />
            Volunteer workspace
          </span>
        </header>
      )}
      <div className={embedded ? "" : styles.publicContent}>
        <>
          <div className={styles.publicIntro}>
            <div>
              <div className={`${ui.eyebrow} ${styles.eyebrow}`}>
                <Icon name={batch.kind} />{" "}
                {batch.kind === "door"
                  ? "DOOR-KNOCKING BATCH"
                  : "PHONE-CALLING BATCH"}
              </div>
              <h1>{batch.name}</h1>
              <p className={`${ui.muted} ${styles.muted}`}>
                {batch.voters.length} voters
              </p>
            </div>
            {!readOnly && (
              <button
                className={`${ui.button} ${styles.button} ${ui.small}`}
                disabled={!!busy.length || refreshing}
                onClick={() => void refresh()}
              >
                <Icon name="refresh" />
                Refresh
              </button>
            )}
          </div>
          <div className={styles.publicProgress}>
            <div>
              <span className={`${ui.featureIcon} ${styles.featureIcon}`}>
                <Icon name="cured" />
              </span>
              <div>
                <strong>
                  {cured} of {batch.voters.length} ballots cured
                </strong>
              </div>
            </div>
            <div className={styles.progressTrack}>
              <i
                style={{
                  width: `${batch.voters.length ? (cured / batch.voters.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
          {readOnly && (
            <div className={`${ui.alert} ${styles.alert}`}>
              This public link is disabled. Staff can still view the batch here.
            </div>
          )}
          {batch.kind === "door" && (
            <VoterMap
              voters={batch.voters}
              className={styles.mapPanel}
              canvasClassName={styles.mapCanvas}
            />
          )}
          <div className={styles.volunteerInstructions}>
            <Icon name="check" />
            <p>
              Select a status after each conversation. Select it again to clear
              it. Updates are shared across every batch containing this voter.
            </p>
          </div>
          <div className={styles.publicToolbar}>
            <h2>
              Your voter list{" "}
              <span className={ui.countTag}>{voters.length}</span>
            </h2>
            <div className={`${ui.searchField} ${styles.searchField}`}>
              <Icon name="search" />
              <input
                aria-label="Search batch voters"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a voter or address…"
              />
            </div>
            <select
              aria-label="Filter voter status"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              {Object.entries(statusLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <p
            className={styles.saveAnnouncement}
            role="status"
            aria-live="polite"
          >
            {message || "Changes save automatically when you select a status."}
          </p>
          <div className={styles.voterCards}>
            {voters.map((v, index) => (
              <article
                className={`${styles.voterCard} ${v.status === "cured" ? styles.cardCured : ""}`}
                key={v.id}
              >
                <div className={styles.cardPerson}>
                  <span className={styles.cardNumber}>{index + 1}</span>
                  <div>
                    <h3>{fullName(v)}</h3>
                    <p>
                      {v.street}
                      {v.unit && `, ${v.unit}`}
                      <br />
                      {v.city}, {v.state} {v.zip}
                    </p>
                    <p className={styles.cardPhone}>
                      {v.phone || "No phone number on file"}
                    </p>
                  </div>
                  <span className={styles.statusActions}>
                    <span
                      className={`${ui.statusChip} ${styles.statusChip} ${ui[v.status || "uncontacted"] || ""}`}
                    >
                      <i />
                      {statusLabels[v.status || "uncontacted"]}
                    </span>
                    {removeVoterAction && (
                      <button
                        type="button"
                        className={styles.removeVoter}
                        aria-label={`Remove ${fullName(v)} from this batch`}
                        title="Remove from batch"
                        disabled={busy.includes(v.id) || refreshing}
                        onClick={() => remove(v.id)}
                      >
                        <Icon name="close" />
                      </button>
                    )}
                  </span>
                </div>
                <div className={styles.contactLinks}>
                  {v.phone && (
                    <>
                      <a
                        className={`${ui.button} ${styles.button} ${ui.small}`}
                        href={`tel:${v.phone}`}
                      >
                        <Icon name="phone" />
                        Call
                      </a>
                      <a
                        className={`${ui.button} ${styles.button} ${ui.small}`}
                        href={`sms:${v.phone}`}
                      >
                        <Icon name="text" />
                        Text
                      </a>
                    </>
                  )}
                  {batch.kind === "door" && (
                    <a
                      className={`${ui.button} ${styles.button} ${ui.small}`}
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address(v))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icon name="pin" />
                      Directions
                      <Icon name="external" />
                    </a>
                  )}
                </div>
                <div
                  className={styles.statusControls}
                  role="group"
                  aria-label={`Curing status for ${fullName(v)}`}
                >
                  {statuses.map((s) => (
                    <button
                      key={s}
                      className={`${styles.statusOption} ${styles[s] || ""} ${v.status === s ? styles.chosen : ""}`}
                      aria-pressed={v.status === s}
                      disabled={busy.includes(v.id) || readOnly}
                      onClick={() =>
                        void update(v.id, v.status === s ? null : s)
                      }
                    >
                      {v.status === s && <Icon name="check" />}
                      {statusLabels[s]}
                    </button>
                  ))}
                </div>
                {busy.includes(v.id) && (
                  <p
                    role="status"
                    className={`${ui.smallText} ${styles.smallText} ${ui.muted} ${styles.muted}`}
                  >
                    Saving…
                  </p>
                )}
                {rowErrors[v.id] && (
                  <div
                    role="alert"
                    className={`${ui.alert} ${styles.alert} ${ui.error}`}
                  >
                    {rowErrors[v.id]}
                    <button
                      className={ui.textButton}
                      disabled={!!busy.length}
                      onClick={() => void refresh()}
                    >
                      Refresh batch
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
          {!voters.length && (
            <div className={ui.emptyState}>
              <h3>No voters to show.</h3>
              <p>
                {batch.voters.length
                  ? "Try changing your search or filter."
                  : "Your campaign contact can add voters to this batch."}
              </p>
            </div>
          )}
        </>
      </div>
      {!embedded && (
        <footer className={styles.publicFooter}>
          <span>Only share this link with assigned volunteers.</span>
        </footer>
      )}
    </div>
  );
}
