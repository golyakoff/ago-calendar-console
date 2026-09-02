/**
 * `15-11`: seed the session, stub the API, navigate, and wait for the screen to actually be there.
 *
 * Simpler than `ago-console`'s equivalent by one whole mechanism: that console's conversation screen
 * populates its thread through a SignalR hub invoke, so its gate has to hand-roll a Hub Protocol
 * mock. Nothing in this console reads a hub - every screen here is REST - so there is no transport to
 * fake, and this file is the poorer for nothing.
 */
import { expect, type Page } from "@playwright/test";
import { signInAsSeededOperator } from "./auth.js";
import { stubConsoleApi } from "./apiStubs.js";
import type { UxGateScreen } from "./screens.js";

export async function openScreen(page: Page, screen: UxGateScreen): Promise<void> {
  await signInAsSeededOperator(page);
  await stubConsoleApi(page);

  // A console error is not failed here on purpose - this gate measures rendered geometry and colour,
  // and turning it into a console-error detector as well would give it two jobs and one name. What is
  // waited for is the screen's own evidence that it rendered.
  await page.goto(screen.path);
  await expect(page.locator(screen.readySelector).first()).toBeVisible();
}
