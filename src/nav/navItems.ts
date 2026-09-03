import type { ConsoleStrings } from "../i18n/strings.js";

/**
 * `11-14`: the navigation as data, not markup - six `<NavLink>`s written inline in `App.tsx` before
 * this item, one array now. `ago-console`'s own `buildTenantNavItems` (`shell/consoleNav.ts`) is the
 * idea being copied, not the code, and the difference is the whole reason `11-14` treats the two
 * consoles as separate items: that function is permission-filtered, because `site:configure` gates
 * eight of its tenant's fifteen items. This console gates nothing on its navigation - every signed-in
 * operator sees the same six screens today - so there is no permission parameter to give this one.
 *
 * `App.tsx`'s desktop bar and its mobile `NavDrawer` both map over the return value of a single call
 * to this function, in the same render, rather than each keeping its own list - that is what makes
 * "the drawer disagrees with the bar" structurally impossible rather than merely unlikely, and it is
 * what `src/App.test.tsx`'s own "same array drives both" test demonstrates.
 */
export interface NavItem {
  to: string;
  label: string;
  /** `NavLink`'s own `end` prop, passed through unchanged. `true` only for the root route, so it does
   * not stay marked "current" for every other route underneath it (`react-router`'s default prefix
   * match). */
  end?: boolean;
}

export function buildNavItems(strings: ConsoleStrings): NavItem[] {
  return [
    { to: "/", label: strings.navQueue, end: true },
    { to: "/setup", label: strings.navSetup },
    { to: "/workers", label: strings.navWorkers },
    { to: "/availability", label: strings.navAvailability },
    { to: "/contacts", label: strings.navContacts },
    { to: "/access", label: strings.navAccess },
  ];
}
