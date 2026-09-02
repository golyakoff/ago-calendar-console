import { createContext, useContext } from "react";
import { en } from "./en.js";
import type { ConsoleStrings } from "./strings.js";

/**
 * `11-15`: **defaulted, not nullable** - mirrors `ago-console/src/i18n/StringsContext.tsx`'s own
 * choice exactly, including its reasoning: a bad or missing locale must never be the reason a page
 * fails to render, so the context's own default is this console's built-in English rather than a
 * value that throws when nobody has wrapped the tree yet.
 *
 * That default is also what keeps every test written before this item green without editing them:
 * `renderWithAuth` mounts a page directly, with no `<StringsProvider>` of its own, and `useStrings()`
 * called from inside it resolves to `en` - the exact literal text those tests already assert against.
 * The one provider that matters at runtime is `App.tsx`, which wraps its whole tree in
 * `<StringsProvider value={getStrings(resolveConsoleLocale())}>` - today that resolves to `ru`
 * (`resolve.ts`'s own remarks explain why a hardcoded value, not a per-tenant lookup, carries this
 * item), so a human actually running the console sees it in Russian even though a test that never
 * mounts `<App>` keeps seeing the English default.
 */
const StringsContext = createContext<ConsoleStrings>(en);

export const StringsProvider = StringsContext.Provider;

export function useStrings(): ConsoleStrings {
  return useContext(StringsContext);
}
