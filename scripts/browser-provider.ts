import { playwright } from "vite-plus/test/browser-playwright";
import type { PlaywrightProviderOptions } from "vite-plus/test/browser-playwright";

type LaunchOptions = NonNullable<PlaywrightProviderOptions["launchOptions"]>;

const chromiumChannel = process.env.PLAYWRIGHT_CHROMIUM_CHANNEL as
  | LaunchOptions["channel"]
  | undefined;

export function createPlaywrightProvider() {
  return playwright(
    chromiumChannel
      ? {
          launchOptions: {
            channel: chromiumChannel,
          },
        }
      : undefined,
  );
}
