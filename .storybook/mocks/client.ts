import { fn } from "storybook/test";
import { completedReport, pendingReport } from "../../stories/fixtures";
import type { request as actualRequest } from "../../lib/client";
import { downloadCsv as actualDownloadCsv } from "../../lib/client";

export const downloadCsv = fn(actualDownloadCsv).mockName("downloadCsv");

export const request = fn<typeof actualRequest>().mockName("request");

export function resetClient() {
  downloadCsv.mockReset().mockImplementation(actualDownloadCsv);
  request
    .mockReset()
    .mockImplementation(
      async <T>(url: string, options?: RequestInit): Promise<T> => {
        if (url === "/api/notes/status")
          return {
            has_unread: false,
            checked_at: "2026-11-16T18:00:00Z",
            last_viewed_at: null,
          } as T;
        const report =
          url === `/api/imports/${pendingReport.id}`
            ? pendingReport
            : url === `/api/imports/${completedReport.id}`
              ? completedReport
              : null;
        if (!report) throw new Error(`No Storybook fixture for ${url}`);
        return structuredClone(
          options?.method === "POST"
            ? {
                ...report,
                claimed: report.rows.filter((row) => row.status === "pending")
                  .length,
                rows: report.rows.map((row) =>
                  row.status === "pending"
                    ? { ...row, status: "imported", error: null }
                    : row,
                ),
              }
            : report,
        ) as T;
      },
    );
}
