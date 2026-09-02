import { en } from "./en.js";
import { ru } from "./ru.js";
import type { ConsoleStrings } from "./strings.js";

export type SupportedLocale = "en" | "ru";

/**
 * `11-15`'s own open question was what decides the locale here: `ago-console` resolves it from the
 * active site's `WidgetLocale`, read off the same `/operators/me` response that already carries
 * `siteId` (`11-11`). AGO Calendar has no such field on the wire today - no `Locale` column on its
 * tenant, no endpoint that would return one - and this item's own brief is explicit that building
 * that round trip is not what "give this console a language" means: "pick the simplest thing that
 * works... do not build a tenant-locale round trip if a simpler default carries this item."
 *
 * The simpler default: **one hardcoded value**, because there is exactly one tenant this console
 * serves today and that tenant is the Russian-speaking single-person business the item names. This
 * function is the one seam a real per-tenant lookup would replace later - callers ask it, not the
 * constant directly, so that day's change is contained here rather than at every call site.
 *
 * Rejected: (1) guessing from the operator's browser (`navigator.language`) - `ago-console`'s own
 * `11-11` already rejected the identical idea for the widget side of this same problem, for the
 * reason that still applies here: a console's language is a property of the *business*, not of
 * whichever machine happens to be open it this minute. (2) A manual per-operator toggle - explicitly
 * out of scope for `ago-console`'s own `11-11` ("a personal, per-operator language preference... a
 * real follow-on if ever asked for, not built speculatively"), and nothing about this product's
 * single-tenant shape makes that call less right here.
 */
const DEFAULT_CONSOLE_LOCALE: SupportedLocale = "ru";

export function resolveConsoleLocale(): SupportedLocale {
  return DEFAULT_CONSOLE_LOCALE;
}

/** The locale's own string table - the one place that maps `SupportedLocale` to a `ConsoleStrings`
 * object, so a caller never imports `en.js`/`ru.js` directly (mirrors `ago-console/src/i18n/
 * resolve.ts`'s own `getStrings` exactly). */
export function getStrings(locale: SupportedLocale): ConsoleStrings {
  return locale === "ru" ? ru : en;
}
