"use client";
import ui from "./shared.module.css";
import styles from "./voters-screen.module.css";

import Link from "next/link";
import { useMemo, useState } from "react";
import { VoterMap } from "./voter-map";
import { Icon } from "./icon";
import { BatchDialog } from "./batch-dialog";
import { fullName, statusLabels, type Workspace } from "@/lib/types";

const viewStyles = {
  split: styles.viewSplit,
  table: styles.viewTable,
  map: styles.viewMap,
};

export function VotersScreen({ data }: { data: Workspace }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [zip, setZip] = useState("");
  const [unassigned, setUnassigned] = useState(false);
  const [view, setView] = useState<"split" | "table" | "map">("split");
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [dialog, setDialog] = useState(false);
  const [saved, setSaved] = useState("");
  const assigned = useMemo(
    () => new Set(data?.batches.flatMap((b) => b.voter_ids)),
    [data],
  );
  const voters = useMemo(
    () =>
      data?.voters.filter((v) => {
        const haystack =
          `${fullName(v)} ${v.street} ${v.unit} ${v.city} ${v.zip} ${v.phone}`.toLowerCase();
        return (
          haystack.includes(query.toLowerCase()) &&
          (!status || (v.status || "uncontacted") === status) &&
          (!zip || v.zip === zip) &&
          (!unassigned || !assigned.has(v.id))
        );
      }) || [],
    [data, query, status, zip, unassigned, assigned],
  );
  const zips = useMemo(
    () => [...new Set(data?.voters.map((v) => v.zip))].sort(),
    [data],
  );
  function toggle(ids: string[]) {
    setSelected((prev) =>
      ids.length === 1
        ? prev.includes(ids[0])
          ? prev.filter((id) => id !== ids[0])
          : [...prev, ids[0]]
        : [...new Set([...prev, ...ids])],
    );
  }
  const safePage = Math.min(
    page,
    Math.max(0, Math.ceil(voters.length / 25) - 1),
  );
  const visible = voters.slice(safePage * 25, (safePage + 1) * 25);
  const allSelected =
    voters.length > 0 && voters.every((v) => selected.includes(v.id));
  const total = data?.voters.length || 0;
  return (
    <>
      <div className={ui.pageHeading}>
        <div>
          <h1>
            Voters<span className={ui.headingDot}>.</span>
          </h1>
        </div>
        <Link
          href="/uploads"
          className={`${ui.button} ${styles.button} ${ui.primary}`}
        >
          <Icon name="upload" />
          Upload voters
        </Link>
      </div>
      <div className={styles.statsGrid}>
        <div className={styles.stat}>
          <span>
            Total voters
            <Icon name="voters" />
          </span>
          <strong>{total.toLocaleString("en-US")}</strong>
        </div>
        <div className={styles.stat}>
          <span>
            Not yet contacted
            <i className={`${styles.statDot} ${styles.blue}`} />
          </span>
          <strong>
            {data?.voters
              .filter((v) => !v.status)
              .length.toLocaleString("en-US") || 0}
          </strong>
        </div>
        <div className={styles.stat}>
          <span>
            Interested in curing
            <i className={`${styles.statDot} ${styles.purple}`} />
          </span>
          <strong>
            {data?.voters
              .filter((v) => v.status === "interested")
              .length.toLocaleString("en-US") || 0}
          </strong>
        </div>
        <div className={`${styles.stat} ${styles.statCured}`}>
          <span>
            Ballots cured
            <Icon name="cured" />
          </span>
          <strong>
            {data?.voters
              .filter((v) => v.status === "cured")
              .length.toLocaleString("en-US") || 0}
            <span className={styles.statUnit}>
              {" "}
              / {total.toLocaleString("en-US")}
            </span>
          </strong>
        </div>
      </div>
      {saved && (
        <div className={`${ui.alert} ${ui.success}`} role="status">
          <Icon name="check" />
          Voters assigned.{" "}
          <Link href={`/batches/${saved}`}>
            Open batch <Icon name="arrow" />
          </Link>
          <button
            className={ui.iconButton}
            onClick={() => setSaved("")}
            aria-label="Dismiss"
          >
            <Icon name="close" />
          </button>
        </div>
      )}
      <section className={styles.voterWorkspace}>
        <div className={ui.sectionTop}>
          <div>
            <h2>
              Voter list{" "}
              <span className={ui.countTag}>
                {total.toLocaleString("en-US")}
              </span>
            </h2>
            <p className={ui.muted}>
              Select voters from the map or table to build a batch.
            </p>
          </div>
          <div className={styles.viewSwitch} aria-label="Voter view">
            {(
              [
                { value: "split", icon: "batches", label: "Split" },
                { value: "table", icon: "list", label: "Table" },
                { value: "map", icon: "map", label: "Map" },
              ] as const
            ).map((item) => (
              <button
                key={item.value}
                onClick={() => setView(item.value)}
                className={view === item.value ? styles.active : ""}
                aria-pressed={view === item.value}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className={`${ui.filterBar} ${styles.filterBar}`}>
          <div className={ui.searchField}>
            <Icon name="search" />
            <input
              aria-label="Search voters"
              placeholder="Search name, address, or phone…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All statuses</option>
            {Object.entries(statusLabels).map(([key, value]) => (
              <option key={key} value={key}>
                {value}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by ZIP code"
            value={zip}
            onChange={(e) => {
              setZip(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All ZIP codes</option>
            {zips.map((z) => (
              <option key={z}>{z}</option>
            ))}
          </select>
          <label className={styles.checkboxFilter}>
            <input
              type="checkbox"
              checked={unassigned}
              onChange={(e) => setUnassigned(e.target.checked)}
            />
            Unassigned only
          </label>
        </div>
        <div className={styles.selectionBar}>
          <span>
            {selected.length ? (
              <>
                <strong>{selected.length}</strong> selected{" "}
                <button
                  className={`${ui.textButton} ${styles.textButton}`}
                  onClick={() => setSelected([])}
                >
                  Clear
                </button>
              </>
            ) : (
              <>
                <span className={styles.miniCheck}>✓</span>Select voters to add
                to a batch
              </>
            )}
          </span>
          <button
            className={`${ui.button} ${styles.button} ${ui.small} ${ui.primary}`}
            disabled={!selected.length}
            onClick={() => setDialog(true)}
          >
            <Icon name="plus" />
            Add to batch
          </button>
        </div>
        <div className={`${styles.voterViews} ${viewStyles[view]}`}>
          {view !== "table" && (
            <VoterMap
              voters={voters}
              selected={selected}
              onSelect={toggle}
              className={styles.mapPanel}
              canvasClassName={styles.mapCanvas}
            />
          )}{" "}
          {view !== "map" && (
            <div className={styles.voterTableWrap}>
              <div className={ui.tableScroll}>
                <table className={`${ui.table} ${styles.voterTable}`}>
                  <thead>
                    <tr>
                      <th className={styles.checkboxCell}>
                        <input
                          type="checkbox"
                          aria-label="Select all filtered voters"
                          checked={allSelected}
                          onChange={() =>
                            setSelected((prev) =>
                              allSelected
                                ? prev.filter(
                                    (id) => !voters.some((v) => v.id === id),
                                  )
                                : [
                                    ...new Set([
                                      ...prev,
                                      ...voters.map((v) => v.id),
                                    ]),
                                  ],
                            )
                          }
                        />
                      </th>
                      <th>Voter</th>
                      <th>Status</th>
                      {view === "table" && (
                        <>
                          <th>Phone</th>
                          <th>ZIP</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((v) => (
                      <tr
                        key={v.id}
                        className={
                          selected.includes(v.id) ? styles.rowSelected : ""
                        }
                      >
                        <td className={styles.checkboxCell}>
                          <input
                            type="checkbox"
                            aria-label={`Select ${fullName(v)}`}
                            checked={selected.includes(v.id)}
                            onChange={() => toggle([v.id])}
                          />
                        </td>
                        <td>
                          <strong>{fullName(v)}</strong>
                          <small>
                            {[v.street, v.unit].filter(Boolean).join(", ")}
                          </small>
                          <small>
                            {v.city}, {v.state} {v.zip}
                          </small>
                        </td>
                        <td>
                          <span
                            className={`${ui.statusChip} ${styles.statusChip} ${ui[v.status || "uncontacted"] || ""}`}
                          >
                            <i />
                            {statusLabels[v.status || "uncontacted"]}
                          </span>
                        </td>
                        {view === "table" && (
                          <>
                            <td>
                              {v.phone ? (
                                <a href={`tel:${v.phone}`}>{v.phone}</a>
                              ) : (
                                <span className={ui.muted}>No phone</span>
                              )}
                            </td>
                            <td>{v.zip}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!visible.length && (
                  <div className={ui.emptyState}>
                    <span className={ui.featureIcon}>
                      <Icon name={total ? "search" : "voters"} />
                    </span>
                    <h3>
                      {total ? "No matching voters" : "No voters uploaded"}
                    </h3>
                    <p>
                      {total
                        ? "Try a different search or remove a filter."
                        : "Upload a CSV or Excel voter list."}
                    </p>
                    {!total && (
                      <Link
                        className={`${ui.button} ${styles.button} ${ui.small}`}
                        href="/uploads"
                      >
                        <Icon name="upload" />
                        Upload voters
                      </Link>
                    )}
                  </div>
                )}
              </div>
              <div className={ui.tablePagination}>
                <span>
                  {voters.length
                    ? `${safePage * 25 + 1}–${Math.min((safePage + 1) * 25, voters.length)}`
                    : "0"}{" "}
                  of {voters.length.toLocaleString("en-US")} voters
                </span>
                <div>
                  <button
                    className={ui.iconButton}
                    aria-label="Previous page"
                    disabled={safePage === 0}
                    onClick={() => setPage(safePage - 1)}
                  >
                    <Icon name="back" />
                  </button>
                  <button
                    className={ui.iconButton}
                    aria-label="Next page"
                    disabled={(safePage + 1) * 25 >= voters.length}
                    onClick={() => setPage(safePage + 1)}
                  >
                    <Icon name="arrow" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
      <div className={ui.workspaceTip}>
        <Icon name="pin" />
        <p>
          <strong>A good batch starts with a good plan.</strong> Group nearby
          addresses for door-knocking, or create a phone list for volunteers
          working from anywhere.
        </p>
      </div>
      {dialog && data && (
        <BatchDialog
          ids={selected}
          batches={data.batches}
          onClose={() => setDialog(false)}
          onSaved={(id) => {
            setDialog(false);
            setSelected([]);
            setSaved(id);
          }}
        />
      )}
    </>
  );
}
