import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { BatchesScreen } from "@/components/batches-screen";
import { updateBatchAction } from "../.storybook/mocks/actions";
import { emptyWorkspace, workspace } from "./fixtures";
import { withStaffShell } from "./staff-decorator";

const meta = {
  title: "Screens/Batches",
  component: BatchesScreen,
  decorators: [withStaffShell],
  parameters: { nextjs: { navigation: { pathname: "/batches" } } },
  args: { data: workspace },
} satisfies Meta<typeof BatchesScreen>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = { args: { data: emptyWorkspace } };

export const PhoneBatches: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.selectOptions(
      canvas.getByLabelText("Filter batch type"),
      "phone",
    );
    await expect(
      canvas.getAllByRole("textbox", { name: "Batch name" }),
    ).toHaveLength(1);
    await expect(
      canvas.getByRole("textbox", { name: "Batch name" }),
    ).toHaveValue("Downtown · Evening calls");
  },
};

export const RenameFailure: Story = {
  beforeEach() {
    updateBatchAction.mockResolvedValue({
      ok: false,
      code: 500,
      error: "We could not save this batch. Please try again.",
    });
  },
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getAllByRole("textbox", { name: "Batch name" })[0];
    await userEvent.clear(input);
    await userEvent.type(input, "Saturday afternoon doors");
    await userEvent.click(canvas.getByRole("button", { name: "Save name" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "We could not save this batch",
    );
    await expect(updateBatchAction).toHaveBeenCalledOnce();
  },
};
