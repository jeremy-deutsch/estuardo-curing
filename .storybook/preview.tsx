import type { Preview } from "@storybook/nextjs-vite";
import "../app/globals.css";
import { resetActions } from "./mocks/actions";
import { resetClient } from "./mocks/client";

const preview: Preview = {
  async beforeAll() {
    // Rapid story changes can unmount a map during Leaflet's delayed zoom callback.
    // Keep the real map interactive while making previews and snapshots stable.
    const { Map } = await import("leaflet");
    Map.mergeOptions({
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
    });
  },
  beforeEach() {
    resetActions();
    resetClient();
  },
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
    options: { storySort: { order: ["Screens", "Example"] } },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
