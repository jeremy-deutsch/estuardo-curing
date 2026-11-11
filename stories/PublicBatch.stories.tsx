import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { PublicBatchView } from "@/components/public-batch";
import { setVoterStatusAction } from "../.storybook/mocks/actions";
import { doorBatch, phoneBatch, publicContent, voters } from "./fixtures";

const meta = {
  title: "Screens/Volunteer Batch",
  component: PublicBatchView,
  parameters: {
    nextjs: { navigation: { pathname: `/batch/${doorBatch.public_token}` } },
  },
  args: { token: doorBatch.public_token, batch: publicContent(doorBatch) },
} satisfies Meta<typeof PublicBatchView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const DoorKnocking: Story = {};
export const PhoneCalling: Story = {
  args: { token: phoneBatch.public_token, batch: publicContent(phoneBatch) },
};
export const Empty: Story = {
  args: { batch: { name: "New volunteer shift", kind: "phone", voters: [] } },
};
export const AllCured: Story = {
  args: {
    batch: {
      ...publicContent(phoneBatch),
      voters: voters.map((voter) => ({ ...voter, status: "cured" })),
    },
  },
};

export const StatusSaved: Story = {
  play: async ({ canvas, userEvent }) => {
    const controls = within(
      canvas.getByRole("group", { name: "Curing status for Alex Rivera" }),
    );
    await userEvent.click(controls.getByRole("button", { name: "Interested" }));
    await expect(
      await canvas.findByText("Alex Rivera: Interested. Saved."),
    ).toBeVisible();
    await expect(setVoterStatusAction).toHaveBeenCalledWith(
      doorBatch.public_token,
      {
        voter_id: voters[0].id,
        status: "interested",
        updated_at: voters[0].updated_at,
      },
    );
  },
};

export const DoNotCureSaved: Story = {
  play: async ({ canvas, userEvent }) => {
    const controls = within(
      canvas.getByRole("group", { name: "Curing status for Alex Rivera" }),
    );
    await userEvent.click(
      controls.getByRole("button", { name: "Do not cure" }),
    );
    await expect(
      await canvas.findByText("Alex Rivera: Do not cure. Saved."),
    ).toBeVisible();
    await expect(setVoterStatusAction).toHaveBeenCalledWith(
      doorBatch.public_token,
      {
        voter_id: voters[0].id,
        status: "do_not_cure",
        updated_at: voters[0].updated_at,
      },
    );
  },
};

export const StatusConflict: Story = {
  beforeEach() {
    setVoterStatusAction.mockResolvedValue({
      ok: false,
      code: 409,
      error:
        "Another volunteer updated this voter. Refresh the batch and try again.",
    });
  },
  play: async ({ canvas, userEvent }) => {
    const controls = within(
      canvas.getByRole("group", { name: "Curing status for Alex Rivera" }),
    );
    await userEvent.click(controls.getByRole("button", { name: "Cured" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Another volunteer updated this voter",
    );
  },
};
