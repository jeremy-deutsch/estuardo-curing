"use client";
import ui from "./shared.module.css";
import styles from "./uploads-screen.module.css";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "./icon";
import { request, downloadCsv } from "@/lib/client";
import { fullName, type ImportReport, type ImportHistory } from "@/lib/types";
import { createImportAction } from "@/app/actions/imports";
import { formatDateTime } from "@/lib/format";
const columns = [
  "first_name",
  "last_name",
  "street",
  "unit",
  "city",
  "state",
  "zip",
  "phone",
  "age",
] as const;
export function UploadsScreen({
  history,
  initialReport,
}: {
  history: ImportHistory[];
  initialReport: ImportReport | null;
}) {
  const router = useRouter();
  const [creating, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setReport] = useState<ImportReport | null>(null);
  const report = progress || initialReport;
  const [message, setMessage] = useState("");
  const [issueType, setIssueType] = useState("failed");
  const [issuePage, setIssuePage] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const pause = useRef(false);
  useEffect(() => {
    return () => {
      pause.current = true;
    };
  }, []);
  function choose(next: File | undefined) {
    setError("");
    setMessage("");
    if (!next) return;
    if (!/\.(xlsx|csv)$/i.test(next.name)) {
      setError("Choose a .csv or .xlsx file.");
      return;
    }
    if (next.size > 5 * 1024 * 1024) {
      setError("Choose a file smaller than 5 MB.");
      return;
    }
    setFile(next);
  }
  async function process(id: string) {
    pause.current = false;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      let current = await request<ImportReport>(`/api/imports/${id}`);
      setReport(current);
      while (
        current.rows.some(
          (r) => r.status === "pending" || r.status === "processing",
        ) &&
        !pause.current
      ) {
        const next = await request<ImportReport & { claimed: number }>(
          `/api/imports/${id}`,
          { method: "POST" },
        );
        setReport(next);
        current = next;
        if (!next.claimed && next.rows.some((r) => r.status === "processing")) {
          setMessage(
            "This upload has an active processing chunk. If it was interrupted, wait three minutes, then resume.",
          );
          break;
        }
      }
      if (pause.current)
        setMessage("Upload paused. Select Resume upload to continue.");
      else if (
        !current.rows.some(
          (r) => r.status === "pending" || r.status === "processing",
        )
      )
        setMessage("Upload complete. Review the results below.");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      try {
        setReport(await request<ImportReport>(`/api/imports/${id}`));
      } catch {
        /* Keep last saved progress visible. */
      }
    } finally {
      setBusy(false);
    }
  }
  function upload() {
    if (!file) return;
    startTransition(async () => {
      setBusy(true);
      setError("");
      setMessage("");
      setReport(null);
      const form = new FormData();
      form.set("file", file);
      try {
        const result = await createImportAction(form);
        if (!result.ok) {
          setError(result.error);
          setBusy(false);
          return;
        }
        const { id } = result.data;
        await process(id);
        setFile(null);
        if (input.current) input.current.value = "";
      } catch (e) {
        setError((e as Error).message);
        setBusy(false);
      }
    });
  }
  function downloadIssues() {
    if (!report) return;
    const issues = report.rows.filter((r) => r.status === "failed");
    downloadCsv("failed-voters.csv", [
      ["source_row", ...columns, "error"],
      ...issues.map((r) => [
        r.row_number,
        ...columns.map((c) => r.record[c]),
        r.error,
      ]),
    ]);
  }
  const counts = {
    imported: 0,
    duplicate: 0,
    failed: 0,
    pending: 0,
    processing: 0,
  };
  report?.rows.forEach((r) => counts[r.status]++);
  const remaining = counts.pending + counts.processing;
  const issues = report?.rows.filter((r) => r.status === issueType) || [];
  const safePage = Math.min(
    issuePage,
    Math.max(0, Math.ceil(issues.length / 25) - 1),
  );
  return (
    <>
      <div className={ui.pageHeading}>
        <div>
          <h1>
            Uploads<span className={ui.headingDot}>.</span>
          </h1>
          <p className={ui.muted}>
            Import voter lists, skip duplicates, and geocode addresses.
          </p>
        </div>
        <button
          className={`${ui.button} ${styles.button}`}
          onClick={() =>
            downloadCsv("voter-template.csv", [
              columns.slice(),
              [
                "Alex",
                "Example",
                "4600 Silver Hill Rd",
                "",
                "Suitland",
                "MD",
                "20746",
                "",
              ],
            ])
          }
        >
          <Icon name="file" />
          Download template
        </button>
      </div>
      {error && (
        <div className={`${ui.alert} ${ui.error}`} role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className={`${ui.alert} ${ui.success}`} role="status">
          <Icon name="check" />
          {message}
        </div>
      )}
      <div className={styles.uploadLayout}>
        <section className={ui.panel}>
          <div className={`${ui.sectionTop} ${styles.sectionTop}`}>
            <div>
              <h2>Upload a voter list</h2>
              <p className={ui.muted}>
                CSV or Excel. Up to 5 MB and 10,000 rows.
              </p>
            </div>
            <span className={styles.stepLabel}>01 / IMPORT</span>
          </div>
          <div
            className={`${styles.dropzone} ${dragging ? styles.dragging : ""} ${file ? styles.hasFile : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              if (!busy) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!busy) choose(e.dataTransfer.files[0]);
            }}
          >
            <span className={styles.uploadGlyph}>
              <Icon name={file ? "file" : "upload"} />
            </span>
            <h3>{file ? file.name : "Drop your voter list here"}</h3>
            <p>
              {file
                ? `${(file.size / 1024).toFixed(1)} KB · Ready to upload`
                : "or choose a file from your computer"}
            </p>
            <input
              ref={input}
              id="voter-file"
              type="file"
              accept=".csv,.xlsx"
              className={ui.srOnly}
              disabled={busy}
              onChange={(e) => choose(e.target.files?.[0])}
            />
            <button
              className={`${ui.button} ${styles.button} ${ui.small}`}
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              {file ? "Choose another file" : "Browse files"}
              <Icon name="plus" />
            </button>
          </div>
          <div className={styles.uploadStart}>
            <span className={`${ui.muted} ${ui.smallText} ${styles.smallText}`}>
              <Icon name="lock" />
              Only staff can upload voter records.
            </span>
            <button
              className={`${ui.button} ${styles.button} ${ui.primary}`}
              disabled={!file || busy}
              onClick={() => void upload()}
            >
              {busy ? (
                <>
                  <span className={ui.spinner} />
                  Processing…
                </>
              ) : (
                <>
                  Upload & geocode
                  <Icon name="arrow" />
                </>
              )}
            </button>
          </div>
        </section>
        <aside className={styles.importGuide}>
          <span className={`${ui.featureIcon} ${styles.featureIcon}`}>
            <Icon name="list" />
          </span>
          <h3>Import requirements</h3>
          <div>
            <span>1</span>
            <p>
              <strong>Use your existing export.</strong> The supplied PDI column
              names work, or use the downloadable template. Excel uses the first
              worksheet.
            </p>
          </div>
          <div>
            <span>2</span>
            <p>
              <strong>We skip existing voters.</strong> Matching names and full
              addresses are deduplicated, including rows in the same upload.
            </p>
          </div>
          <div>
            <span>3</span>
            <p>
              <strong>Addresses become map points.</strong> Exact Census
              Geocoder matches are saved. Unmatched addresses appear in your
              report.
            </p>
          </div>
          <p className={styles.guideFootnote}>
            Required: first name, last name, street, city, state, and ZIP. Phone
            and unit are optional. Political and demographic fields are not
            imported.
          </p>
        </aside>
      </div>
      {report && (
        <section className={`${ui.panel} ${styles.importResults}`}>
          <div className={`${ui.sectionTop} ${styles.sectionTop}`}>
            <div>
              <div className={`${ui.eyebrow} ${styles.eyebrow}`}>
                UPLOAD RESULTS
              </div>
              <h2>{report.filename}</h2>
            </div>
            <div className={`${ui.rowActions} ${styles.rowActions}`}>
              {!!counts.failed && (
                <button
                  className={`${ui.button} ${styles.button} ${ui.small}`}
                  onClick={downloadIssues}
                >
                  <Icon name="file" />
                  Download failed rows
                </button>
              )}
              {remaining > 0 && (
                <button
                  className={`${ui.button} ${styles.button} ${ui.small} ${ui.primary}`}
                  onClick={() =>
                    busy ? (pause.current = true) : void process(report.id)
                  }
                >
                  {busy ? "Pause after chunk" : "Resume upload"}
                  <Icon name={busy ? "close" : "arrow"} />
                </button>
              )}
            </div>
          </div>
          <div className={styles.importCounts}>
            <div>
              <strong>{counts.imported}</strong>
              <span className={ui.greenText}>Imported</span>
            </div>
            <div>
              <strong>{counts.duplicate}</strong>
              <span>Duplicates skipped</span>
            </div>
            <div>
              <strong>{counts.failed}</strong>
              <span className={counts.failed ? ui.errorText : ""}>
                Failed rows
              </span>
            </div>
            <div>
              <strong>{remaining}</strong>
              <span>Remaining</span>
            </div>
          </div>
          <div className={styles.importProgress}>
            <i
              style={{
                width: `${report.rows.length ? ((report.rows.length - remaining) / report.rows.length) * 100 : 0}%`,
              }}
            />
          </div>
          {busy && (
            <p className={styles.processingNote} role="status">
              <span className={ui.spinner} />
              Geocoding in chunks of 100. Progress is saved after every chunk;
              Census may take a minute per request.
            </p>
          )}
          <div
            className={`${ui.sectionTop} ${styles.sectionTop} ${styles.issueHeading}`}
          >
            <div className={styles.tabButtons}>
              <button
                className={issueType === "failed" ? styles.active : ""}
                onClick={() => {
                  setIssueType("failed");
                  setIssuePage(0);
                }}
              >
                Failed rows <span>{counts.failed}</span>
              </button>
              <button
                className={issueType === "duplicate" ? styles.active : ""}
                onClick={() => {
                  setIssueType("duplicate");
                  setIssuePage(0);
                }}
              >
                Duplicates <span>{counts.duplicate}</span>
              </button>
            </div>
            <span className={`${ui.smallText} ${styles.smallText} ${ui.muted}`}>
              Correct failed rows and upload the downloaded CSV again.
            </span>
          </div>
          <div className={ui.tableScroll}>
            <table className={`${ui.table} ${styles.issuesTable}`}>
              <thead>
                <tr>
                  <th>Source row</th>
                  <th>Voter</th>
                  <th>Address</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {issues.slice(safePage * 25, (safePage + 1) * 25).map((r) => (
                  <tr key={r.id}>
                    <td>{r.row_number}</td>
                    <td>{fullName(r.record)}</td>
                    <td>
                      {r.record.street}
                      <small>
                        {r.record.city}, {r.record.state} {r.record.zip}
                      </small>
                    </td>
                    <td>{r.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!issues.length && (
              <div className={`${ui.emptyState} ${ui.compact}`}>
                <Icon name="check" />
                <p>
                  {issueType === "failed"
                    ? "No failed rows in the results so far."
                    : "No duplicate rows in the results so far."}
                </p>
              </div>
            )}
          </div>
          {issues.length > 25 && (
            <div className={ui.tablePagination}>
              <span>
                {safePage * 25 + 1}–
                {Math.min((safePage + 1) * 25, issues.length)} of{" "}
                {issues.length}
              </span>
              <div>
                <button
                  className={ui.iconButton}
                  aria-label="Previous issues"
                  disabled={!safePage}
                  onClick={() => setIssuePage(safePage - 1)}
                >
                  <Icon name="back" />
                </button>
                <button
                  className={ui.iconButton}
                  aria-label="Next issues"
                  disabled={(safePage + 1) * 25 >= issues.length}
                  onClick={() => setIssuePage(safePage + 1)}
                >
                  <Icon name="arrow" />
                </button>
              </div>
            </div>
          )}
          <div className={styles.resultsFooter}>
            <Icon name="check" />
            Imported voters are ready in your workspace.
            <Link href="/voters">
              View voters
              <Icon name="arrow" />
            </Link>
          </div>
        </section>
      )}
      <section className={`${ui.panel} ${styles.uploadHistory}`}>
        <div className={`${ui.sectionTop} ${styles.sectionTop}`}>
          <div>
            <h2>
              Recent uploads{" "}
              <span className={ui.countTag}>{history.length}</span>
            </h2>
            <p className={ui.muted}>
              Review a report or pick up an interrupted upload.
            </p>
          </div>
          <button
            className={ui.iconButton}
            aria-label="Refresh uploads"
            disabled={busy}
            onClick={() => router.refresh()}
          >
            <Icon name="refresh" />
          </button>
        </div>
        {!history.length ? (
          <div className={`${ui.emptyState} ${ui.compact}`}>
            <p>Your uploaded lists will appear here.</p>
          </div>
        ) : (
          <div className={ui.tableScroll}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Uploaded (Pacific)</th>
                  <th>
                    <span className={ui.srOnly}>Report</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>
                      <span className={styles.historyFile}>
                        <Icon name="file" />
                        {h.filename}
                      </span>
                    </td>
                    <td>{formatDateTime(h.created_at)}</td>
                    <td>
                      <Link
                        className={`${ui.button} ${styles.button} ${ui.small}`}
                        href={`/uploads?import=${h.id}`}
                        aria-disabled={busy || creating}
                        onClick={(e) => {
                          if (busy || creating) e.preventDefault();
                        }}
                      >
                        View report
                        <Icon name="arrow" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
