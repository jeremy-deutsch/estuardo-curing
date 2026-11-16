import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { NotesScreen } from "@/components/notes-screen";
import { statuses, statusLabels, type VoterNote } from "@/lib/types";
import { downloadCsv } from "../.storybook/mocks/client";
import { doorBatch, voters, timestamp } from "./fixtures";
import { withStaffShell } from "./staff-decorator";

const notes: VoterNote[] = Array.from({ length: 27 }, (_, index) => ({
  id: `note-${index + 1}`,
  voter_id: voters[0].id,
  batch_id: doorBatch.id,
  voter_name: `Alex Rivera ${index + 1}`,
  voter_address: "4600 Silver Hill Rd, Suitland, MD 20746",
  voter_phone: "+13015550123",
  voter: { status: null },
  batch_name: doorBatch.name,
  author_name: "Taylor Volunteer",
  body:
    index === 0
      ? 'Call tomorrow.\nThey said "yes", please follow up.'
      : `Follow-up note ${index + 1}`,
  created_at: timestamp,
}));

const meta = {
  title: "Screens/Notes",
  component: NotesScreen,
  decorators: [withStaffShell],
  parameters: { nextjs: { navigation: { pathname: "/notes" } } },
  args: { notes },
} satisfies Meta<typeof NotesScreen>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = { args: { notes: [] } };
export const VoterFilter: Story = {
  args: {
    voterId: voters[0].id,
    notes: notes
      .slice(0, 2)
      .map((note) => ({ ...note, voter_name: "Alex Rivera" })),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/Notes for/)).toHaveTextContent(
      "Notes for Alex Rivera",
    );
    await expect(
      canvas.getByRole("link", { name: "Show all notes" }),
    ).toHaveAttribute("href", "/notes");
    for (const link of canvas.getAllByRole("link", {
      name: "Filter notes for Alex Rivera",
    })) {
      await expect(link).toHaveAttribute(
        "href",
        `/notes?voter=${voters[0].id}`,
      );
    }
  },
};
export const VoterFilterEmpty: Story = {
  args: { voterId: voters[0].id, notes: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("No notes for this voter.")).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: "Show all notes" }),
    ).toHaveAttribute("href", "/notes");
  },
};
export const CurrentVoterStatuses: Story = {
  args: {
    notes: [
      ...[...statuses, null].map((status, index) => ({
        ...notes[index],
        voter: { status },
      })),
      { ...notes[6], voter_id: null, voter: null },
    ],
  },
  play: async ({ canvas }) => {
    for (const status of [...statuses, "uncontacted"]) {
      await expect(canvas.getByText(statusLabels[status])).toBeVisible();
    }
    await expect(canvas.getByText("Voter removed")).toBeVisible();
  },
};
export const SelectAndExport: Story = {
  play: async ({ canvas, userEvent }) => {
    const exportButton = canvas.getByRole("button", {
      name: "Export selected CSV",
    });
    await expect(exportButton).toBeDisabled();
    await userEvent.click(
      canvas.getByRole("checkbox", { name: "Select all filtered notes" }),
    );
    await userEvent.click(canvas.getByRole("button", { name: "Next page" }));
    await expect(canvas.getByText("26–27 of 27 notes")).toBeVisible();
    await expect(canvas.getAllByRole("checkbox")[1]).toBeChecked();
    await userEvent.type(
      canvas.getByRole("searchbox", { name: "Search notes" }),
      "no match",
    );
    await expect(canvas.getByText("No matching notes.")).toBeVisible();
    await userEvent.click(exportButton);
    await expect(downloadCsv).toHaveBeenCalledWith(
      "voter-notes.csv",
      expect.arrayContaining([
        [
          notes[0].id,
          notes[0].voter_id,
          notes[0].voter_name,
          notes[0].voter_address,
          notes[0].voter_phone,
          notes[0].batch_name,
          notes[0].author_name,
          notes[0].body,
          notes[0].created_at,
        ],
      ]),
    );
    await expect(downloadCsv.mock.calls[0][1]).toHaveLength(28);
    await userEvent.click(
      canvas.getByRole("button", { name: "Clear selection" }),
    );
    await expect(exportButton).toBeDisabled();
    await userEvent.clear(
      canvas.getByRole("searchbox", { name: "Search notes" }),
    );
    await userEvent.click(canvas.getAllByRole("checkbox")[1]);
    await expect(
      canvas.getByRole("checkbox", { name: "Select all filtered notes" }),
    ).toBePartiallyChecked();
    await userEvent.click(exportButton);
    await expect(downloadCsv.mock.calls[1][1]).toHaveLength(2);
  },
};
