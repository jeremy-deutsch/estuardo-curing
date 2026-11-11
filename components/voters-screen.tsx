"use client";
import ui from "./shared.module.css";
import styles from "./voters-screen.module.css";

import Link from "next/link";
import { useId, useMemo, useState, useTransition } from "react";
import {
  Button,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
} from "react-aria-components";
import { removeVotersAction } from "@/app/actions/voters";
import { VoterMap } from "./voter-map";
import { Icon } from "./icon";
import { BatchDialog } from "./batch-dialog";
import {
  fullName,
  statusLabels,
  type Batch,
  type Workspace,
} from "@/lib/types";

const viewStyles = {
  split: styles.viewSplit,
  table: styles.viewTable,
  map: styles.viewMap,
};

const ageRanges = [
  { label: "Under 18", min: 0, max: 17 },
  { label: "18–24", min: 18, max: 24 },
  { label: "25–34", min: 25, max: 34 },
  { label: "35–44", min: 35, max: 44 },
  { label: "45–54", min: 45, max: 54 },
  { label: "55–64", min: 55, max: 64 },
  { label: "65+", min: 65, max: 120 },
];

export function VotersScreen({ data }: { data: Workspace }) {
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<string[]>([]);
  const [zip, setZip] = useState("");
  const [ages, setAges] = useState<string[]>([]);
  const [unassigned, setUnassigned] = useState(false);
  const [supporters, setSupporters] = useState(false);
  const [view, setView] = useState<"split" | "table" | "map">("split");
  const [selected, setSelected] = useState<string[]>([]);
  const [selectionExpanded, setSelectionExpanded] = useState(true);
  const selectedRowsId = useId();
  const [page, setPage] = useState(0);
  const [dialog, setDialog] = useState(false);
  const [saved, setSaved] = useState("");
  const [removing, startRemoving] = useTransition();
  const [removeError, setRemoveError] = useState("");
  const [removed, setRemoved] = useState<number | null>(null);
  function removeSelected() {
    const ids = [...selected];
    if (
      !ids.length ||
      removing ||
      !window.confirm(
        `Remove ${ids.length.toLocaleString("en-US")} selected ${ids.length === 1 ? "voter" : "voters"}? They will be removed from the voter list and all batches. This cannot be undone.`,
      )
    )
      return;
    setRemoveError("");
    setRemoved(null);
    startRemoving(async () => {
      try {
        const result = await removeVotersAction(ids);
        if (!result.ok) {
          setRemoveError(result.error);
          return;
        }
        setSelected((prev) => prev.filter((id) => !ids.includes(id)));
        setSaved("");
        setRemoved(result.data.count);
      } catch {
        setRemoveError("Unable to remove voters. Please try again.");
      }
    });
  }
  const assigned = useMemo(
    () => new Set(data?.batches.flatMap((b) => b.voter_ids)),
    [data],
  );
  const batchesByVoter = useMemo(() => {
    const memberships = new Map<string, Batch[]>();
    for (const batch of data.batches) {
      for (const id of batch.voter_ids) {
        const batches = memberships.get(id) || [];
        batches.push(batch);
        memberships.set(id, batches);
      }
    }
    return memberships;
  }, [data.batches]);
  const voters = useMemo(
    () =>
      data?.voters.filter((v) => {
        const voterAge = v.age;
        const matchesAge =
          !ages.length ||
          (voterAge == null
            ? ages.includes("unknown")
            : ageRanges.some(
                (range) =>
                  ages.includes(range.label) &&
                  voterAge >= range.min &&
                  voterAge <= range.max,
              ));
        const haystack =
          `${fullName(v)} ${v.street} ${v.unit} ${v.city} ${v.zip} ${v.phone}`.toLowerCase();
        return (
          haystack.includes(query.toLowerCase()) &&
          (!statuses.length || statuses.includes(v.status || "uncontacted")) &&
          (!zip || v.zip === zip) &&
          matchesAge &&
          (!supporters ||
            v.support_id === "Strong Support" ||
            v.support_id === "Lean Support") &&
          (!unassigned || !assigned.has(v.id))
        );
      }) || [],
    [data, query, statuses, zip, ages, supporters, unassigned, assigned],
  );
  const zips = useMemo(
    () => [...new Set(data?.voters.map((v) => v.zip))].sort(),
    [data],
  );
  function toggle(ids: string[], toggleGroup = false) {
    setSelected((prev) =>
      ids.length === 1 || toggleGroup
        ? ids.every((id) => prev.includes(id))
          ? prev.filter((id) => !ids.includes(id))
          : [...new Set([...prev, ...ids])]
        : [...new Set([...prev, ...ids])],
    );
  }
  const selectedIds = useMemo(() => new Set(selected), [selected]);
  const selectedVoters = useMemo(
    () => data.voters.filter((v) => selectedIds.has(v.id)),
    [data.voters, selectedIds],
  );
  const remainingVoters = voters.filter((v) => !selectedIds.has(v.id));
  const safePage = Math.min(
    page,
    Math.max(0, Math.ceil(remainingVoters.length / 25) - 1),
  );
  const visible = remainingVoters.slice(safePage * 25, (safePage + 1) * 25);
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
      {removeError && (
        <div className={`${ui.alert} ${ui.error}`} role="alert">
          {removeError}
        </div>
      )}
      {removed !== null && (
        <div className={`${ui.alert} ${ui.success}`} role="status">
          {removed.toLocaleString("en-US")} {removed === 1 ? "voter" : "voters"}{" "}
          removed.
          <button
            className={ui.iconButton}
            onClick={() => setRemoved(null)}
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
              Select voters from the map or table to build a batch or remove
              them.
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
          <Select
            aria-label="Filter by status"
            selectionMode="multiple"
            placeholder="All statuses"
            className={styles.statusFilter}
            value={statuses}
            onChange={(values) => {
              setStatuses(values.map(String));
              setPage(0);
            }}
          >
            <Button className={styles.statusFilterButton}>
              <SelectValue>
                {({ selectedItems, selectedText, isPlaceholder }) =>
                  isPlaceholder
                    ? "All statuses"
                    : selectedItems.length === 1
                      ? selectedText
                      : `${selectedItems.length} statuses`
                }
              </SelectValue>
              <span aria-hidden="true">
                <Icon name="down" />
              </span>
            </Button>
            <Popover className={styles.statusFilterPopover}>
              <ListBox className={styles.statusFilterList}>
                {Object.entries(statusLabels).map(([key, value]) => (
                  <ListBoxItem
                    key={key}
                    id={key}
                    textValue={value}
                    className={styles.statusFilterOption}
                  >
                    {({ isSelected }) => (
                      <>
                        <span
                          className={styles.statusFilterCheck}
                          aria-hidden="true"
                        >
                          {isSelected && <Icon name="check" />}
                        </span>
                        {value}
                      </>
                    )}
                  </ListBoxItem>
                ))}
              </ListBox>
            </Popover>
          </Select>
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
          <Select
            aria-label="Filter by age"
            selectionMode="multiple"
            placeholder="All ages"
            className={styles.statusFilter}
            value={ages}
            onChange={(values) => {
              setAges(values.map(String));
              setPage(0);
            }}
          >
            <Button className={styles.statusFilterButton}>
              <SelectValue>
                {({ selectedItems, selectedText, isPlaceholder }) =>
                  isPlaceholder
                    ? "All ages"
                    : selectedItems.length === 1
                      ? selectedText
                      : `${selectedItems.length} age ranges`
                }
              </SelectValue>
              <span aria-hidden="true">
                <Icon name="down" />
              </span>
            </Button>
            <Popover className={styles.statusFilterPopover}>
              <ListBox className={styles.statusFilterList}>
                {[
                  ...ageRanges.map((range) => ({
                    id: range.label,
                    label: range.label,
                  })),
                  { id: "unknown", label: "Unknown age" },
                ].map(({ id, label }) => (
                  <ListBoxItem
                    key={id}
                    id={id}
                    textValue={label}
                    className={styles.statusFilterOption}
                  >
                    {({ isSelected }) => (
                      <>
                        <span
                          className={styles.statusFilterCheck}
                          aria-hidden="true"
                        >
                          {isSelected && <Icon name="check" />}
                        </span>
                        {label}
                      </>
                    )}
                  </ListBoxItem>
                ))}
              </ListBox>
            </Popover>
          </Select>
          <div className={styles.checkboxFilters}>
            <label className={styles.checkboxFilter}>
              <input
                type="checkbox"
                checked={unassigned}
                onChange={(e) => setUnassigned(e.target.checked)}
              />
              Unassigned only
            </label>
            <label className={styles.checkboxFilter}>
              <input
                type="checkbox"
                checked={supporters}
                onChange={(e) => {
                  setSupporters(e.target.checked);
                  setPage(0);
                }}
              />
              <Icon name="supporter" className={styles.supporterIcon} />
              Supporters
            </label>
          </div>
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
          <div className={styles.selectionActions}>
            <button
              className={`${ui.button} ${styles.button} ${ui.small} ${styles.removeButton}`}
              disabled={!selected.length || removing}
              onClick={removeSelected}
            >
              <Icon name="close" />
              {removing ? "Removing…" : "Delete selected"}
            </button>
            <button
              className={`${ui.button} ${styles.button} ${ui.small} ${ui.primary}`}
              disabled={!selected.length || removing}
              onClick={() => setDialog(true)}
            >
              <Icon name="plus" />
              Add to batch
            </button>
          </div>
        </div>
        <div className={`${styles.voterViews} ${viewStyles[view]}`}>
          {view !== "table" && (
            <VoterMap
              voters={voters}
              selected={selected}
              onSelect={toggle}
              onToggle={(ids) => toggle(ids, true)}
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
                        <label className={styles.checkboxLabel}>
                          <input
                            type="checkbox"
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
                          <span className={ui.srOnly}>
                            Select all filtered voters
                          </span>
                        </label>
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
                    {selectedVoters.length > 0 && (
                      <tr className={styles.selectedHeading}>
                        <td colSpan={view === "table" ? 5 : 3}>
                          <button
                            type="button"
                            className={styles.selectionToggle}
                            aria-expanded={selectionExpanded}
                            aria-controls={selectedVoters
                              .map((v) => `${selectedRowsId}-${v.id}`)
                              .join(" ")}
                            onClick={() =>
                              setSelectionExpanded((value) => !value)
                            }
                          >
                            <Icon name="down" />
                            Selected voters (
                            {selectedVoters.length.toLocaleString("en-US")})
                          </button>
                        </td>
                      </tr>
                    )}
                    {[...selectedVoters, ...visible].map((v) => (
                      <tr
                        key={v.id}
                        id={
                          selectedIds.has(v.id)
                            ? `${selectedRowsId}-${v.id}`
                            : undefined
                        }
                        hidden={selectedIds.has(v.id) && !selectionExpanded}
                        className={
                          selected.includes(v.id) ? styles.rowSelected : ""
                        }
                      >
                        <td className={styles.checkboxCell}>
                          <label className={styles.checkboxLabel}>
                            <input
                              type="checkbox"
                              checked={selected.includes(v.id)}
                              onChange={() => toggle([v.id])}
                            />
                            <span className={ui.srOnly}>
                              Select {fullName(v)}
                            </span>
                          </label>
                        </td>
                        <td>
                          <strong className={styles.voterName}>
                            {fullName(v)}
                            {(v.support_id === "Strong Support" ||
                              v.support_id === "Lean Support") && (
                              <span title="Supporter">
                                <Icon
                                  name="supporter"
                                  className={styles.supporterIcon}
                                />
                                <span className={ui.srOnly}> (Supporter)</span>
                              </span>
                            )}
                          </strong>
                          <small>Age: {v.age ?? "Unknown"}</small>
                          <small>
                            {[v.street, v.unit].filter(Boolean).join(", ")}
                          </small>
                          <small>
                            {v.city}, {v.state} {v.zip}
                          </small>
                        </td>
                        <td>
                          <div className={styles.statusBadges}>
                            <span
                              className={`${ui.statusChip} ${styles.statusChip} ${ui[v.status || "uncontacted"] || ""}`}
                            >
                              <i />
                              {statusLabels[v.status || "uncontacted"]}
                            </span>
                            {batchesByVoter.get(v.id)?.map((batch) => (
                              <Link
                                key={batch.id}
                                href={`/batches/${batch.id}`}
                                className={`${ui.statusChip} ${styles.statusChip} ${styles.batchBadge}`}
                                title={`Open batch: ${batch.name}`}
                                aria-label={`${batch.kind === "phone" ? "Being called" : "Being knocked"} — open batch ${batch.name}`}
                              >
                                <Icon
                                  name={
                                    batch.kind === "phone" ? "phone" : "door"
                                  }
                                />
                                {batch.kind === "phone"
                                  ? "Being called"
                                  : "Being knocked"}
                              </Link>
                            ))}
                          </div>
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
                {!voters.length && (
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
                  {remainingVoters.length
                    ? `${safePage * 25 + 1}–${Math.min((safePage + 1) * 25, remainingVoters.length)}`
                    : "0"}{" "}
                  of {remainingVoters.length.toLocaleString("en-US")}{" "}
                  {selectedVoters.length ? "unselected voters" : "voters"}
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
                    disabled={(safePage + 1) * 25 >= remainingVoters.length}
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
