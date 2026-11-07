import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import Login from "@/app/login/page";
import { loginAction } from "../.storybook/mocks/actions";

const meta = {
  title: "Screens/Login",
  component: Login,
  parameters: { nextjs: { navigation: { pathname: "/login" } } },
} satisfies Meta<typeof Login>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const InvalidCredentials: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(
      canvas.getByLabelText("Email address"),
      "sam@example.org",
    );
    await userEvent.type(
      canvas.getByLabelText("Password"),
      "storybook-password",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Sign in" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Unable to sign in",
    );
    await expect(loginAction).toHaveBeenCalledOnce();
  },
};

export const SigningIn: Story = {
  beforeEach() {
    loginAction.mockImplementation(() => new Promise(() => {}));
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(
      canvas.getByLabelText("Email address"),
      "sam@example.org",
    );
    await userEvent.type(
      canvas.getByLabelText("Password"),
      "storybook-password",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Sign in" }));
    await expect(
      canvas.getByRole("button", { name: /Signing in/ }),
    ).toBeDisabled();
  },
};
