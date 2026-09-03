import { describe, expect, it } from "vitest";
import { buildNavItems } from "./navItems.js";
import { en } from "../i18n/en.js";

describe("buildNavItems", () => {
  it("returns the six screens in the order the shell renders them, root marked `end`", () => {
    const items = buildNavItems(en);

    expect(items).toEqual([
      { to: "/", label: en.navQueue, end: true },
      { to: "/setup", label: en.navSetup },
      { to: "/workers", label: en.navWorkers },
      { to: "/availability", label: en.navAvailability },
      { to: "/contacts", label: en.navContacts },
      { to: "/access", label: en.navAccess },
    ]);
  });

  it("has no `end: true` on any route but the root - the rest should stay marked current on a sub-route", () => {
    const items = buildNavItems(en);

    expect(items.filter((item) => item.end === true)).toEqual([{ to: "/", label: en.navQueue, end: true }]);
  });
});
