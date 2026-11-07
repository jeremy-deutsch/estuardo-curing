import type { Decorator } from "@storybook/nextjs-vite";
import { StaffShell } from "@/components/staff-shell";
import { staffEmail } from "./fixtures";

export const withStaffShell: Decorator = (Story) => (
  <StaffShell email={staffEmail}>
    <Story />
  </StaffShell>
);
