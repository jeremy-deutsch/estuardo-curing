import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, waitFor, within } from "storybook/test";
import { removeVotersAction } from "../.storybook/mocks/actions";
import { VotersScreen } from "@/components/voters-screen";
import { emptyWorkspace, workspace } from "./fixtures";
import { withStaffShell } from "./staff-decorator";

const meta = {
  title: "Screens/Voters",
  component: VotersScreen,
  decorators: [withStaffShell],
  parameters: { nextjs: { navigation: { pathname: "/voters" } } },
  args: { data: workspace },
} satisfies Meta<typeof VotersScreen>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SplitView: Story = {};
export const Empty: Story = { args: { data: emptyWorkspace } };

export const BatchBadges: Story = {
  play: async ({ canvas }) => {
    const row = within(canvas.getByRole("row", { name: /Morgan Patel/ }));
    await expect(row.getByText("Cured", { exact: true })).toBeVisible();
    for (const batch of workspace.batches) {
      const label = batch.kind === "phone" ? "Being called" : "Being knocked";
      await expect(
        row.getByRole("link", { name: `${label} — open batch ${batch.name}` }),
      ).toHaveAttribute("href", `/batches/${batch.id}`);
    }
    const unassigned = within(
      canvas.getByRole("row", { name: /Cameron Davis/ }),
    );
    await expect(unassigned.queryByRole("link")).not.toBeInTheDocument();
  },
};

export const DoubleClickMarker: Story = {
  play: async ({ canvas, userEvent }) => {
    const checkbox = canvas.getByRole("checkbox", {
      name: "Select Alex Rivera",
    });
    const marker = await canvas.findByTitle("Alex Rivera");
    await userEvent.dblClick(marker);
    await expect(checkbox).toBeChecked();
    await userEvent.dblClick(canvas.getByTitle("Alex Rivera"));
    await expect(checkbox).not.toBeChecked();
  },
};

export const DesktopLayout: Story = {
  play: async ({ canvas }) => {
    if (window.innerWidth <= 1000) return;
    const map = canvas.getByLabelText(/Map of \d+ voter locations/);
    const panel = map.parentElement!;
    const checkbox = canvas.getByRole("checkbox", {
      name: "Select Alex Rivera",
    });
    await expect(checkbox.getBoundingClientRect().width).toBe(21);
    await expect(panel.getBoundingClientRect().height).toBeLessThanOrEqual(480);
    await expect(getComputedStyle(panel).position).toBe("sticky");
    try {
      window.scrollTo(
        0,
        panel.getBoundingClientRect().top + window.scrollY + 100,
      );
      await waitFor(() =>
        expect(Math.abs(panel.getBoundingClientRect().top - 20)).toBeLessThan(
          1,
        ),
      );
    } finally {
      window.scrollTo(0, 0);
    }
  },
};

export const DoubleClickSharedLocation: Story = {
  args: {
    data: {
      ...workspace,
      voters: workspace.voters.map((voter, index) =>
        index === 1
          ? {
              ...voter,
              latitude: workspace.voters[0].latitude,
              longitude: workspace.voters[0].longitude,
            }
          : voter,
      ),
    },
  },
  play: async ({ canvas, userEvent }) => {
    const first = canvas.getByRole("checkbox", { name: "Select Alex Rivera" });
    const second = canvas.getByRole("checkbox", { name: "Select Jordan Chen" });
    // A partially selected address should become fully selected.
    await userEvent.click(first);
    await userEvent.dblClick(
      await canvas.findByTitle("Alex Rivera, Jordan Chen"),
    );
    await expect(first).toBeChecked();
    await expect(second).toBeChecked();
    await userEvent.dblClick(canvas.getByTitle("Alex Rivera, Jordan Chen"));
    await expect(first).not.toBeChecked();
    await expect(second).not.toBeChecked();
  },
};

export const TableView: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Table" }));
    await expect(
      canvas.getByRole("columnheader", { name: "Phone" }),
    ).toBeVisible();
  },
};

export const MapView: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Map" }));
    await expect(canvas.queryByRole("table")).not.toBeInTheDocument();
  },
};

export const Filtered: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.selectOptions(
      canvas.getByLabelText("Filter by status"),
      "interested",
    );
    await expect(
      canvas.getByText("Jordan Chen", { exact: true }),
    ).toBeVisible();
    await expect(
      canvas.queryByText("Alex Rivera", { exact: true }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.getByText("Cameron Davis", { exact: true }),
    ).toBeVisible();
  },
};

export const NoSearchResults: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Search voters" }),
      "No matching person",
    );
    await expect(
      canvas.getByRole("heading", { name: "No matching voters" }),
    ).toBeVisible();
  },
};

export const AssignToBatch: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("checkbox", { name: "Select Alex Rivera" }),
    );
    await userEvent.click(
      canvas.getByRole("checkbox", { name: "Select Jordan Chen" }),
    );
    await userEvent.click(canvas.getByRole("button", { name: "Add to batch" }));
    await expect(canvas.getByRole("dialog")).toBeVisible();
    await expect(canvas.getByRole("dialog")).toHaveTextContent(
      "Assign 2 selected voters",
    );
  },
};

export const RemoveSelected: Story = {
  play: async ({ canvas, userEvent }) => {
    const originalConfirm = window.confirm;
    const confirm = fn().mockReturnValue(false);
    window.confirm = confirm;
    try {
      const remove = canvas.getByRole("button", { name: "Remove selected" });
      await expect(remove).toBeDisabled();
      await userEvent.click(
        canvas.getByRole("checkbox", { name: "Select Alex Rivera" }),
      );
      await userEvent.click(
        canvas.getByRole("checkbox", { name: "Select Jordan Chen" }),
      );
      await userEvent.click(remove);
      await expect(confirm).toHaveBeenCalledWith(
        expect.stringContaining("Remove 2 selected voters?"),
      );
      await expect(removeVotersAction).not.toHaveBeenCalled();
      await expect(
        canvas.getByRole("checkbox", { name: "Select Alex Rivera" }),
      ).toBeChecked();
      confirm.mockReturnValue(true);
      await userEvent.click(remove);
      await waitFor(() =>
        expect(removeVotersAction).toHaveBeenCalledWith([
          workspace.voters[0].id,
          workspace.voters[1].id,
        ]),
      );
      await expect(canvas.getByText("2 voters removed.")).toHaveAttribute(
        "role",
        "status",
      );
      await expect(remove).toBeDisabled();
    } finally {
      window.confirm = originalConfirm;
    }
  },
};
