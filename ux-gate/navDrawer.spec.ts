import { test, expect, type TestInfo } from "@playwright/test";
import { openScreen } from "./fixtures/openScreen.js";
import { UX_GATE_SCREENS } from "./fixtures/screens.js";

/**
 * `11-14`: what jsdom cannot prove about `src/nav/NavDrawer.tsx` - focus entering the drawer on open,
 * staying trapped inside it while open, and returning to the hamburger on every close route - proven
 * here against a real Chromium `<dialog>` instead. `NavDrawer.tsx`'s own doc comment has the full case
 * for why a browser is required: jsdom implements none of `<dialog>`'s modal behaviour, not even
 * `showModal`/`close` as callable functions, so `src/App.test.tsx`'s own drawer tests are honest about
 * proving only the two dismissal routes that are this codebase's own click-handling logic (backdrop,
 * choosing an item) and this component's own `onCancel` wiring - never that Escape actually fires it,
 * and never focus of any kind.
 *
 * **Mobile-only, deliberately.** The drawer does not exist at the desktop viewport
 * (`src/index.css`'s own `@media (max-width: 40rem)` hides the hamburger and shows the bar instead
 * above that width), so every test below skips itself on the `desktop-1280x800` project rather than
 * failing on a control that is correctly absent there. `skipUnlessMobile` takes `TestInfo` as a plain
 * parameter rather than living in a `test.beforeEach` - a fixtures-object callback with nothing
 * destructured out of it is `no-empty-pattern` for this repository's own linter, and Playwright's own
 * runtime requires the literal destructuring pattern it exists to warn about, so there is no version of
 * that hook this repository's lint config accepts.
 *
 * **Selectors are classes and indices, not translated label text.** This console's default locale is
 * Russian (`src/i18n/resolve.ts`), and a test that located a link by an English name would be testing
 * the wrong build without ever failing loudly about it.
 */
function skipUnlessMobile(testInfo: TestInfo): void {
  test.skip(testInfo.project.name !== "mobile-375x812", "the drawer only exists at mobile widths");
}

test.describe("mobile nav drawer", () => {
  test("opening the drawer moves focus into it, off the hamburger", async ({ page }, testInfo) => {
    skipUnlessMobile(testInfo);
    await openScreen(page, UX_GATE_SCREENS[0]);

    const hamburger = page.locator(".nav-hamburger");
    await expect(hamburger).toBeVisible();
    await hamburger.click();

    const dialog = page.locator(".nav-drawer");
    await expect(dialog).toBeVisible();

    const firstLink = dialog.locator("a").first();
    await expect(firstLink).toBeFocused();
  });

  test("focus is trapped inside the drawer while it is open", async ({ page }, testInfo) => {
    skipUnlessMobile(testInfo);
    await openScreen(page, UX_GATE_SCREENS[0]);
    await page.locator(".nav-hamburger").click();

    const linkCount = await page.locator(".nav-drawer a").count();

    // Measured directly against this Chromium build rather than assumed: Tab past the last item
    // inside a modal `<dialog>` does not wrap straight back to the first one here - it resets through
    // an intermediate "nothing focused" state (`document.activeElement` briefly `<body>`) once per
    // cycle, then continues into the drawer's own items again on the next press. That reset is
    // invisible to a user (nothing outside ever gets focus, so nothing outside ever shows a focus
    // ring) and is not what this test is about - the actual safety property a "trap" promises is that
    // focus can never land on `header` (the hamburger, the top bar, sign-out), and that is what is
    // checked on every single press below, across more than two full cycles.
    for (let i = 0; i < linkCount * 2 + 2; i++) {
      await page.keyboard.press("Tab");
      const escapedToHeader = await page.evaluate(() => document.activeElement?.closest("header") !== null);
      expect(escapedToHeader, `Tab press ${i + 1} moved focus into <header> - the trap leaked`).toBe(false);
    }

    // And the trap is not merely "focus goes nowhere" - continuing to Tab does keep landing back on
    // the drawer's own first link, proving the loop the six presses above measured, once, honestly.
    await expect(page.locator(".nav-drawer a").first()).toBeFocused();
  });

  test("Escape closes the drawer and returns focus to the hamburger", async ({ page }, testInfo) => {
    skipUnlessMobile(testInfo);
    await openScreen(page, UX_GATE_SCREENS[0]);
    const hamburger = page.locator(".nav-hamburger");
    await hamburger.click();

    const dialog = page.locator(".nav-drawer");
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(dialog).toBeHidden();
    await expect(hamburger).toBeFocused();
  });

  test("a click on the backdrop closes the drawer and returns focus to the hamburger", async ({ page }, testInfo) => {
    skipUnlessMobile(testInfo);
    await openScreen(page, UX_GATE_SCREENS[0]);
    const hamburger = page.locator(".nav-hamburger");
    await hamburger.click();

    const dialog = page.locator(".nav-drawer");
    await expect(dialog).toBeVisible();

    // The drawer panel is 16rem wide (256px), capped at 80vw, against a 375px viewport - clicking near
    // the right edge lands on the `<dialog>` element itself (the backdrop's own click target, since
    // `::backdrop` is not a real event target - `NavDrawer.tsx`'s own comment on this), not its content.
    await page.mouse.click(370, 400);

    await expect(dialog).toBeHidden();
    await expect(hamburger).toBeFocused();
  });

  test("choosing an item closes the drawer, navigates, and returns focus to the hamburger", async ({ page }, testInfo) => {
    skipUnlessMobile(testInfo);
    await openScreen(page, UX_GATE_SCREENS[0]);
    const hamburger = page.locator(".nav-hamburger");
    await hamburger.click();

    const dialog = page.locator(".nav-drawer");
    // Index 2: queue(0), setup(1), workers(2) - `src/nav/navItems.ts`'s own order.
    await dialog.locator("a").nth(2).click();

    await expect(page).toHaveURL(/\/workers$/);
    await expect(dialog).toBeHidden();
    await expect(hamburger).toBeFocused();
  });
});
