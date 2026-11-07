import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { UploadsScreen } from "@/components/uploads-screen";
import {
  cleanReport,
  completedReport,
  importHistory,
  pendingReport,
} from "./fixtures";
import { withStaffShell } from "./staff-decorator";

const meta = {
  title: "Screens/Uploads",
  component: UploadsScreen,
  decorators: [withStaffShell],
  parameters: { nextjs: { navigation: { pathname: "/uploads" } } },
  args: { history: importHistory, initialReport: null },
} satisfies Meta<typeof UploadsScreen>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const FirstUpload: Story = { args: { history: [] } };
export const CompletedWithIssues: Story = {
  args: { initialReport: completedReport },
};
export const Completed: Story = { args: { initialReport: cleanReport } };
export const Interrupted: Story = { args: { initialReport: pendingReport } };

export const ResumeUpload: Story = {
  args: { initialReport: pendingReport },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Resume upload" }),
    );
    await expect(
      await canvas.findByText("Upload complete. Review the results below."),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: "Resume upload" }),
    ).not.toBeInTheDocument();
  },
};

export const FileReady: Story = {
  play: async ({ canvasElement, canvas, userEvent }) => {
    const input =
      canvasElement.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.upload(
      input,
      new File(
        [
          "first_name,last_name,street,city,state,zip\nAlex,Rivera,1200 W 28th St,Los Angeles,CA,90007",
        ],
        "sample-voters.csv",
        { type: "text/csv" },
      ),
    );
    await expect(
      canvas.getByRole("button", { name: "Upload & geocode" }),
    ).toBeEnabled();
    await expect(
      canvas.getByRole("heading", { name: "sample-voters.csv" }),
    ).toBeVisible();
  },
};
