import { fn } from "storybook/test";
import type * as Auth from "../../app/actions/auth";
import type * as Batches from "../../app/actions/batches";
import type * as Imports from "../../app/actions/imports";
import type * as Voters from "../../app/actions/voters";
import { completedReport, doorBatch, timestamp } from "../../stories/fixtures";

// Type-only imports keep the real server modules and their dependencies out of Storybook.
export const loginAction =
  fn<typeof Auth.loginAction>().mockName("loginAction");
export const logoutAction =
  fn<typeof Auth.logoutAction>().mockName("logoutAction");
export const assignBatchAction =
  fn<typeof Batches.assignBatchAction>().mockName("assignBatchAction");
export const updateBatchAction =
  fn<typeof Batches.updateBatchAction>().mockName("updateBatchAction");
export const createImportAction =
  fn<typeof Imports.createImportAction>().mockName("createImportAction");
export const setVoterStatusAction = fn<
  typeof Voters.setVoterStatusAction
>().mockName("setVoterStatusAction");

export function resetActions() {
  loginAction.mockReset().mockResolvedValue({
    error: "Unable to sign in. Check your email and password.",
  });
  logoutAction.mockReset().mockResolvedValue({ error: null });
  assignBatchAction
    .mockReset()
    .mockResolvedValue({ ok: true, data: { id: doorBatch.id } });
  updateBatchAction.mockReset().mockResolvedValue({ ok: true, data: null });
  createImportAction
    .mockReset()
    .mockResolvedValue({ ok: true, data: { id: completedReport.id } });
  setVoterStatusAction
    .mockReset()
    .mockImplementation(async (_token, input) => ({
      ok: true,
      data: { status: input.status, updated_at: timestamp },
    }));
}
