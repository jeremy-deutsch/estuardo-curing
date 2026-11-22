import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, waitFor, within } from "storybook/test";
import { PublicBatchView } from "@/components/public-batch";
import {
  addVoterNoteAction,
  setVoterStatusAction,
} from "../.storybook/mocks/actions";
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

export const DoorKnocking: Story = {
  play: async ({ canvas }) => {
    const alex = canvas.getByRole("heading", { name: "Alex Rivera" });
    const jordan = canvas.getByRole("heading", { name: "Jordan Chen" });
    await expect(
      within(alex.closest("article")!).getByText("Age: 42"),
    ).toBeVisible();
    await expect(
      within(jordan.closest("article")!).getByText("Age: Unknown"),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: /Remove .* from this batch/ }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole("link", { name: /^View notes for / }),
    ).not.toBeInTheDocument();
  },
};
export const PhoneCalling: Story = {
  args: { token: phoneBatch.public_token, batch: publicContent(phoneBatch) },
};
export const NoteDialogOpen: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Add note for Alex Rivera" }),
    );
  },
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

export const NoteSaved: Story = {
  beforeEach() {
    localStorage.removeItem("ballot-operations:note-author:v1");
    return () => localStorage.removeItem("ballot-operations:note-author:v1");
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const screen = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", {
      name: "Add note for Alex Rivera",
    });
    await userEvent.click(trigger);
    let dialog = within(
      await screen.findByRole("dialog", { name: "Add a note" }),
    );
    await expect(
      dialog.getByRole("button", { name: "Save note" }),
    ).toBeDisabled();
    await userEvent.type(
      dialog.getByRole("textbox", { name: "Your name" }),
      "Taylor Volunteer",
    );
    await userEvent.type(
      dialog.getByRole("textbox", { name: "Note" }),
      "Please call tomorrow.",
    );
    await userEvent.click(dialog.getByRole("button", { name: "Save note" }));
    await expect(
      await canvas.findByText("Note for Alex Rivera saved. Thank you."),
    ).toBeVisible();
    await expect(addVoterNoteAction).toHaveBeenCalledWith(
      doorBatch.public_token,
      {
        voter_id: voters[0].id,
        author_name: "Taylor Volunteer",
        body: "Please call tomorrow.",
      },
    );
    await expect(localStorage.getItem("ballot-operations:note-author:v1")).toBe(
      "Taylor Volunteer",
    );
    await waitFor(() => expect(trigger).toHaveFocus());
    const otherTrigger = canvas.getAllByRole("button", {
      name: /^Add note for /,
    })[1];
    await userEvent.click(otherTrigger);
    dialog = within(await screen.findByRole("dialog", { name: "Add a note" }));
    await expect(
      dialog.getByRole("textbox", { name: "Your name" }),
    ).toHaveValue("Taylor Volunteer");
    await expect(dialog.getByRole("textbox", { name: "Note" })).toHaveValue("");
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await expect(otherTrigger).toHaveFocus();
  },
};

export const NoteSaveError: Story = {
  beforeEach() {
    addVoterNoteAction.mockResolvedValue({
      ok: false,
      code: 404,
      error:
        "This batch or voter is unavailable. Refresh the batch and try again.",
    });
    localStorage.removeItem("ballot-operations:note-author:v1");
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Add note for Alex Rivera" }),
    );
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog"),
    );
    await userEvent.type(
      dialog.getByRole("textbox", { name: "Your name" }),
      "Taylor",
    );
    await userEvent.type(
      dialog.getByRole("textbox", { name: "Note" }),
      "Keep this draft.",
    );
    await userEvent.click(dialog.getByRole("button", { name: "Save note" }));
    await expect(await dialog.findByRole("alert")).toHaveTextContent(
      "This batch or voter is unavailable",
    );
    await expect(dialog.getByRole("textbox", { name: "Note" })).toHaveValue(
      "Keep this draft.",
    );
    await userEvent.click(dialog.getByRole("button", { name: "Cancel" }));
  },
};
