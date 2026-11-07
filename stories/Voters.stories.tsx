import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
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
