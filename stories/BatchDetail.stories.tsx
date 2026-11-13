import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, within } from "storybook/test";
import { BatchDetail } from "@/components/batch-detail";
import { removeVoterFromBatchAction } from "../.storybook/mocks/actions";
import {
  disabledBatch,
  doorBatch,
  phoneBatch,
  publicContent,
  voters,
} from "./fixtures";
import { withStaffShell } from "./staff-decorator";

const meta = {
  title: "Screens/Batch Detail",
  component: BatchDetail,
  decorators: [withStaffShell],
  parameters: {
    nextjs: { navigation: { pathname: `/batches/${doorBatch.id}` } },
  },
  args: { batch: doorBatch, content: publicContent(doorBatch) },
} satisfies Meta<typeof BatchDetail>;
export default meta;
type Story = StoryObj<typeof meta>;

export const DoorKnocking: Story = {};
export const PhoneCalling: Story = {
  args: { batch: phoneBatch, content: publicContent(phoneBatch) },
};
export const Disabled: Story = {
  args: { batch: disabledBatch, content: publicContent(disabledBatch) },
};

export const RemoveVoter: Story = {
  play: async ({ canvas, userEvent }) => {
    const originalConfirm = window.confirm;
    const confirm = fn().mockReturnValue(false);
    window.confirm = confirm;
    try {
      const card = canvas
        .getByRole("heading", { name: "Alex Rivera" })
        .closest("article")!;
      const remove = within(card).getByRole("button", {
        name: "Remove Alex Rivera from this batch",
      });
      await userEvent.click(remove);
      await expect(confirm).toHaveBeenCalledWith(
        "Remove voter from this batch?",
      );
      await expect(removeVoterFromBatchAction).not.toHaveBeenCalled();
      await expect(card).toBeVisible();
      await expect(remove).toBeEnabled();
      confirm.mockReturnValue(true);
      await userEvent.click(remove);
      await expect(removeVoterFromBatchAction).toHaveBeenCalledWith(
        doorBatch.id,
        voters[0].id,
      );
      await expect(
        await canvas.findByText("Alex Rivera removed from this batch."),
      ).toBeVisible();
    } finally {
      window.confirm = originalConfirm;
    }
  },
};

export const RemovalFailed: Story = {
  beforeEach() {
    removeVoterFromBatchAction.mockResolvedValue({
      ok: false,
      code: 500,
      error: "Unable to remove this voter. Please try again.",
    });
  },
  play: async ({ canvas, userEvent }) => {
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    try {
      await userEvent.click(
        canvas.getByRole("button", {
          name: "Remove Alex Rivera from this batch",
        }),
      );
    } finally {
      window.confirm = originalConfirm;
    }
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Unable to remove this voter.",
    );
    await expect(
      canvas.getByRole("heading", { name: "Alex Rivera" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", {
        name: "Remove Alex Rivera from this batch",
      }),
    ).toBeEnabled();
  },
};
