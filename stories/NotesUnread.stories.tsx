import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState, type ComponentProps } from "react";
import { expect, waitFor, within } from "storybook/test";
import { StaffShell } from "@/components/staff-shell";
import { NotesViewTracker } from "@/components/notes-view-tracker";
import { request } from "../.storybook/mocks/client";
import { markNotesViewedAction } from "../.storybook/mocks/actions";

const viewedAt = "2026-11-16T19:00:00Z";
const status = (unread: boolean) => ({
  has_unread: unread,
  checked_at: viewedAt,
  last_viewed_at: null,
});

function VisitPreview(args: ComponentProps<typeof StaffShell>) {
  const [viewing, setViewing] = useState(false);
  return (
    <StaffShell {...args}>
      <button type="button" onClick={() => setViewing(true)}>
        Open Notes preview
      </button>
      {viewing && <NotesViewTracker viewedAt={viewedAt} />}
    </StaffShell>
  );
}

const meta = {
  title: "Screens/Notes Unread",
  component: StaffShell,
  parameters: { nextjs: { navigation: { pathname: "/voters" } } },
  args: {
    email: "staff@example.org",
    hasUnreadNotes: false,
    children: <p>Staff workspace</p>,
  },
} satisfies Meta<typeof StaffShell>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NoUnread: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.queryByRole("img", { name: "Unread notes" }),
    ).not.toBeInTheDocument();
  },
};
export const Unread: Story = {
  args: { hasUnreadNotes: true },
  beforeEach() {
    request.mockResolvedValue(status(true));
  },
  play: async ({ canvas }) => {
    const link = canvas.getByRole("link", { name: /Notes/ });
    await expect(
      await within(link).findByRole("img", { name: "Unread notes" }),
    ).toBeVisible();
    await expect(markNotesViewedAction).not.toHaveBeenCalled();
  },
};
export const ClearedAfterVisit: Story = {
  render: (args) => <VisitPreview {...args} />,
  beforeEach() {
    request.mockResolvedValue(status(true));
    markNotesViewedAction.mockImplementation(async () => {
      request.mockResolvedValue(status(false));
      return { ok: true, data: { viewed_at: viewedAt } };
    });
  },
  play: async ({ canvas, userEvent }) => {
    await expect(
      await canvas.findByRole("img", { name: "Unread notes" }),
    ).toBeVisible();
    await expect(markNotesViewedAction).not.toHaveBeenCalled();
    await userEvent.click(
      canvas.getByRole("button", { name: "Open Notes preview" }),
    );
    await waitFor(() =>
      expect(markNotesViewedAction).toHaveBeenCalledWith(viewedAt),
    );
    await waitFor(() =>
      expect(
        canvas.queryByRole("img", { name: "Unread notes" }),
      ).not.toBeInTheDocument(),
    );
    request.mockResolvedValue(status(true));
    window.dispatchEvent(new Event("focus"));
    await expect(
      await canvas.findByRole("img", { name: "Unread notes" }),
    ).toBeVisible();
  },
};
export const FailedVisitCanRetry: Story = {
  render: (args) => <VisitPreview {...args} />,
  beforeEach() {
    request.mockResolvedValue(status(true));
    markNotesViewedAction
      .mockResolvedValueOnce({ ok: false, code: 500, error: "Unavailable" })
      .mockImplementation(async () => {
        request.mockResolvedValue(status(false));
        return { ok: true, data: { viewed_at: viewedAt } };
      });
  },
  play: async ({ canvas, userEvent }) => {
    await expect(
      await canvas.findByRole("img", { name: "Unread notes" }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Open Notes preview" }),
    );
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Unable to record your Notes visit",
    );
    await expect(
      canvas.getByRole("img", { name: "Unread notes" }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Retry" }));
    await waitFor(() =>
      expect(canvas.queryByRole("alert")).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(
        canvas.queryByRole("img", { name: "Unread notes" }),
      ).not.toBeInTheDocument(),
    );
  },
};
