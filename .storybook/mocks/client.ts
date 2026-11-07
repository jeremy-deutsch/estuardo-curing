import { fn } from "storybook/test";
import { completedReport, pendingReport } from "../../stories/fixtures";
import type { request as actualRequest } from "../../lib/client";
export { downloadCsv } from "../../lib/client";

export const request = fn<typeof actualRequest>().mockName("request");

export function resetClient() {
  request
    .mockReset()
    .mockImplementation(
      async <T>(url: string, options?: RequestInit): Promise<T> => {
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
