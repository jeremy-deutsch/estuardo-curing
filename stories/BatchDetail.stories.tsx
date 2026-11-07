import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BatchDetail } from "@/components/batch-detail";
import {
  disabledBatch,
  doorBatch,
  phoneBatch,
  publicContent,
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
