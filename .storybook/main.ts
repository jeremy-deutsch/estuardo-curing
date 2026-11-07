import type { StorybookConfig } from "@storybook/nextjs-vite";
import { fileURLToPath } from "node:url";

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    "@chromatic-com/storybook",
    "@storybook/addon-vitest",
    "@storybook/addon-mcp",
  ],
  framework: "@storybook/nextjs-vite",
  staticDirs: ["../public"],
  async viteFinal(config) {
    const { mergeConfig } = await import("vite");
    return mergeConfig(config, {
      resolve: {
        alias: [
          {
            find: /^@\/app\/actions\/(auth|batches|imports|voters)$/,
            replacement: fileURLToPath(
              new URL("./mocks/actions.ts", import.meta.url),
            ),
          },
          {
            find: "@/lib/client",
            replacement: fileURLToPath(
              new URL("./mocks/client.ts", import.meta.url),
            ),
          },
        ],
      },
    });
  },
};
export default config;
