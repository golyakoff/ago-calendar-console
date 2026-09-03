/**
 * `11-19` (`ago-root#350`, `11-16`'s other half), the fourth assertion: "on a screen rendered in
 * Russian, no user-facing text is left in another language." Ported from
 * `ago-console/ux-gate/lib/i18nCompleteness.ts` - same shape, this repository's own facts for the two
 * decisions that make it exact rather than fuzzy (this file's own header below), and a different
 * exemption list because this console renders eight different screens with a different set of
 * genuinely-technical values on them.
 *
 * ## Why the fixtures make this exact rather than fuzzy
 *
 * The hard part this item names is telling **interface text** from **data** - a customer really may
 * be called *John*, and that is not a translation failure. `ux-gate/fixtures/data.ts` seeds every
 * free-text fixture value (the tenant's own name, the calendar's name, the seeded role's name) in
 * Cyrillic for exactly this reason: once no *data* on the page can legitimately contain a Latin
 * letter, any Latin-script run left standing is, by construction, something this repository's own
 * source rendered - interface chrome, not a tenant's own words.
 *
 * Unlike `ago-console`, there is no fixture field that *switches the string table* here -
 * `src/i18n/resolve.ts`'s own `resolveConsoleLocale()` is a hardcoded constant (`"ru"`), not read off
 * any tenant record - so seeding data in Cyrillic is the whole of decision (1); there is no second
 * field to also flip.
 *
 * ## The named exemptions, and why each is not a pattern
 *
 * A regex over "words that look technical" would quietly exempt the next real defect, which is
 * exactly the failure mode this design exists to avoid. Every exemption below is a specific, audited
 * thing this repository actually renders - found by running this assertion for real against the
 * Cyrillic-seeded fixtures and reading every violation it reported, not guessed in advance:
 *
 * - **The product name** (`"AGO Calendar"`) - `App.tsx`'s own `<h1>AGO Calendar</h1>`, rendered in
 *   the shell header on every one of this gate's eight screens. `App.tsx`'s own doc comment states the
 *   same reasoning `11-15`'s backlog item gives: "a product's own brand name is a technical
 *   identifier, not interface chrome a translator should touch." Unlike `ago-console`, a bare `"AGO"`
 *   never appears on its own anywhere in this codebase's rendered text, so only the full phrase is
 *   listed.
 * - **`"IANA"`** - `ru.ts`'s own `setupCalendarZoneLabel: "Часовой пояс IANA"`, rendered on the
 *   `configuration` screen. The standards body's own name, the same "ID"/"hex" loanword precedent
 *   `ago-console`'s own list already established: the translator's own deliberate, already-merged
 *   choice, not a gap this assertion is discovering.
 * - **`"Email"`** - `ru.ts`'s own `emailFieldLabel: "Email"`, rendered on the `access` screen's invite
 *   form. The identical loanword precedent - a common, unremarkable borrowing in Russian technical
 *   writing, kept as itself rather than translated to "Электронная почта" the same deliberate way
 *   `ago-console`'s table keeps "ID" and "hex".
 * - **`"Europe/Moscow"`** - the one seeded calendar's own IANA time zone id
 *   (`ux-gate/fixtures/data.ts`'s `CONFIGURATION.calendars[0].timeZone`), rendered on both the
 *   `configuration` screen (`ConfigurationPage.tsx`'s calendar list) and the `worker-slots` screen
 *   (`WorkerSlotsPage.tsx`'s time-zone note). An IANA zone id is Latin-script by the standard itself -
 *   the same "a translator must not touch it" category the backlog names for a URL or a status code,
 *   not interface chrome. Named as the exact value this gate's own fixture carries, the same way
 *   `ago-console`'s list names literal found values rather than a shape.
 *
 * `<pre>` and `<code>` are further exemptions, but **structural** (by tag, in `acceptNode` below), not
 * phrase-based - see this file's "What this repository decided about `<code>`" section.
 *
 * ## Two whole-node exemptions this repository needed that `ago-console`'s did not
 *
 * `AccessPage.tsx` renders an invited operator's own email address verbatim
 * (`<span className="muted">{operator.invitedEmail}</span>`) - not inside an `<a href>`, so the
 * existing `isUrlText` mechanism (kept below, unchanged, for the day this repository adds a real
 * link) does not reach it. An email address is the same "a translator must not touch it" category the
 * backlog names for a URL - real Russian-speaking tenants' own invite emails are Latin-script
 * regardless of the console's language, exactly the same way a URL is - so `isEmailText` extends the
 * existing structural approach: it matches the *entire* trimmed text of a node against the
 * unambiguous, well-defined shape of an email address (`local@domain.tld`), not a heuristic over
 * "technical-looking" words. Two alternatives were rejected: naming the seeded fixture's own literal
 * address (`"invited@example.invalid"`) as an `EXEMPT_PHRASES` entry would only ever cover that one
 * seeded value, silently breaking the moment the fixture's own email address changes, for no reason
 * bound to what actually makes an email address exempt; and reseeding the fixture with a Cyrillic
 * local part was rejected as unrealistic - unlike a tenant's own name, an email address a person
 * actually receives mail at is conventionally Latin-script even for a Russian-speaking business, the
 * same "genuinely-Latin content" `docs/backlog/11-16-*.md` carves out for a customer named John.
 *
 * `ConfigurationPage.tsx`'s `OriginsForm` renders `configuration.allowedOrigins.join("\n")` straight
 * into a `<textarea>` - found, not assumed: a controlled `<textarea>`'s initial content turned out to
 * still be a real child text node this gate's own `TreeWalker` visits, on the `configuration` screen.
 * Each configured origin is a bare URL by construction (`OriginsForm`'s own `onSubmit` splits back on
 * `"\n"`), the same non-translatable category as `isEmailText` above - so `isUrlLinesText` applies the
 * identical whole-node discipline, one line at a time: every non-blank line must itself be nothing but
 * a URL for the node to be exempt, so a real sentence sharing a text node with a URL is still caught.
 *
 * ## What this repository decided about `<code>`
 *
 * `ago-console` deliberately left `<code>` undecided: it has exactly two, on a screen its own gate
 * does not cover, so no exemption was forced. This repository's gate *does* exercise both a `<code>`
 * and a `<pre>` - one of the two `<code>` uses below was added *by this item*, once running the
 * assertion for real showed why it belonged there:
 *
 * - `QueuePage.tsx`'s `<code>{row.calendarId.slice(0, 8)}</code>` - a truncated calendar id, on the
 *   `queue` screen. Today's seeded id (`33333333…`) happens to contain no Latin letters at all, but a
 *   real calendar id is a full GUID and routinely does - so this is exempted **structurally, by tag**,
 *   rather than left to pass by the current fixture's own digit-only accident. HTML's own semantics
 *   for `<code>` are "a fragment of computer code" - this codebase uses it for exactly one thing, an
 *   identifier fragment, never translated prose.
 * - `AccessPage.tsx`'s role list, `<code>{role.permissions.join(", ")}</code>` on the `access` screen -
 *   this `<code>` wrapper **did not exist before this item**. Running the assertion found
 *   `"customer:read, booking:write, schedule:write"` flagged as three untranslated words; adding it to
 *   `EXEMPT_PHRASES` was rejected because a role's permission set is open-ended server data
 *   (`Role.Create` accepts any subset), so a phrase list would have to grow forever and would silently
 *   miss the next one - exactly the failure mode a named list exists to avoid. Marking the value with
 *   the same `<code>` convention `QueuePage.tsx` already established fixed the defect at its source
 *   instead: a permission scope string is a server-assigned wire value (`strings.ts`'s own header
 *   already names this category for `WorkerSlot.status`), never translated prose, so it belongs in
 *   `<code>` the same way any other identifier in this codebase does.
 * - `ConfigurationPage.tsx`'s `<pre aria-label={strings.setupEmbedSnippetAriaLabel}>{embedSnippet(...)}
 *   </pre>` - the install snippet a tenant copies onto their own site, on the `configuration` screen.
 *   Every word in it (`script`, `src`, `async`, `data-site`, `data-booking`, the placeholder
 *   `YOUR-CHAT-SITE-KEY`) is HTML/attribute syntax or a literal token the tenant pastes verbatim -
 *   translating any part of it would corrupt the value it renders, the strongest form of "a translator
 *   must not touch it" the backlog names.
 *
 * Both are exempted the same way `<option>`'s own doc comment below already reasons for a closed
 * `<select>`: excluded by tag in `acceptNode`, not measured and found harmless, and not a CSS-class
 * convention (`ago-console`'s `.ago-mono`/`.ago-badge--mono`) this codebase has never had a reason to
 * grow.
 */

export interface UntranslatedTextViolation {
  selector: string;
  text: string;
  latinRuns: string[];
}

export interface UntranslatedTextResult {
  scanned: number;
  violations: UntranslatedTextViolation[];
}

/**
 * Passed straight to Playwright's `page.evaluate`, which serialises only *this function's own source
 * text* into the browser - not this module, not any top-level `const`/`function` declared beside it.
 * Every helper and constant it needs is therefore declared **inside** its body, the same discipline
 * `ux-gate/lib/minSize.ts` and `ux-gate/lib/contrast.ts` both already state in their own doc comments.
 */
export function measureUntranslatedLatinText(): UntranslatedTextResult {
  // See this function's own file-level doc comment above for why each of these is here. Longer
  // phrases first, so a shorter phrase never matches inside a longer one it is a prefix of (not
  // actually exercised by this list today, but the discipline `ago-console`'s own list follows).
  const EXEMPT_PHRASES = ["AGO Calendar", "Europe/Moscow", "IANA", "Email"];
  const LATIN_RUN = /[A-Za-z]{2,}/g;

  // Word-boundary, not substring: `"IANA".split(text)` would also strip the "iana" inside a genuinely
  // untranslated word, which is exactly the false-negative a short exempt token risks.
  // `(?<![A-Za-z])phrase(?![A-Za-z])` only matches the phrase as a standalone run, never as part of a
  // longer Latin word either side of it - Cyrillic characters are outside `[A-Za-z]` entirely, so a
  // phrase sitting next to Russian text (the normal case here, e.g. "Часовой пояс IANA") is never
  // blocked by this check.
  function stripExemptPhrases(text: string): string {
    let residual = text;
    for (const phrase of EXEMPT_PHRASES) {
      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      residual = residual.replace(new RegExp(`(?<![A-Za-z])${escaped}(?![A-Za-z])`, "g"), " ");
    }
    return residual;
  }

  function describeSelector(el: Element): string {
    const id = el.id ? `#${el.id}` : "";
    const cls = el.className && typeof el.className === "string" ? `.${el.className.trim().split(/\s+/).join(".")}` : "";
    return `${el.tagName.toLowerCase()}${id}${cls}`;
  }

  // The identical visibility test `ux-gate/lib/contrast.ts`'s own `isRenderedVisible` uses - a text
  // node whose containing element is not actually painted is not "on the page" in the sense this
  // assertion cares about.
  function isRenderedVisible(el: Element): boolean {
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity || "1") === 0) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  // Kept for the day this repository adds a real `<a href>` with URL text - not currently exercised
  // (`grep`, done before writing this file, found no `<a href` anywhere in `src`), the same "kept
  // anyway" reasoning `ago-console`'s own copy states for its own unexercised case.
  function isUrlText(el: Element, text: string): boolean {
    const anchor = el.closest("a[href]");
    if (!anchor) {
      return false;
    }
    const href = anchor.getAttribute("href") ?? "";
    return href.length > 0 && href.includes(text.trim());
  }

  // See this file's own header, "Two whole-node exemptions this repository needed that ago-console's
  // did not". Matches the *entire* trimmed node text against an email address's own unambiguous
  // shape - not a substring, not a "looks technical" heuristic.
  const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function isEmailText(text: string): boolean {
    return EMAIL_SHAPE.test(text.trim());
  }

  // `ConfigurationPage.tsx`'s `OriginsForm` renders `configuration.allowedOrigins.join("\n")` as a
  // `<textarea>`'s own rendered content - one origin per line, by construction (the form's own
  // `onSubmit` splits back on `"\n"`). Every *non-blank* line must itself be a bare URL for the whole
  // node to be exempt - this stays exact rather than "the node contains a URL somewhere": a genuinely
  // untranslated sentence sharing a text node with a URL would still be caught.
  const BARE_URL_LINE = /^https?:\/\/\S+$/;
  function isUrlLinesText(text: string): boolean {
    const lines = text.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
    return lines.length > 0 && lines.every((line) => BARE_URL_LINE.test(line));
  }

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.textContent || node.textContent.trim().length === 0) {
        return NodeFilter.FILTER_REJECT;
      }
      const parent = node.parentElement;
      if (!parent) {
        return NodeFilter.FILTER_REJECT;
      }
      const tag = parent.tagName.toLowerCase();
      // `script`/`style`: never user-facing text. `option`: `Select.tsx`-equivalent reasoning
      // (`ago-console`'s own doc comment) - a closed native `<select>` never paints an unselected
      // option's text, so scoring it against a bounding rect the browser does not reliably lay out
      // for a closed control would be the wrong kind of check even if it happened to pass. `pre`/
      // `code`: this file's own header, "What this repository decided about `<code>`".
      if (tag === "script" || tag === "style" || tag === "option" || tag === "pre" || tag === "code") {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let scanned = 0;
  const violations: UntranslatedTextViolation[] = [];

  let node: Node | null = walker.nextNode();
  while (node) {
    const text = node.textContent ?? "";
    const parent = node.parentElement;
    node = walker.nextNode();

    if (!parent || !isRenderedVisible(parent)) {
      continue;
    }
    scanned++;

    if (isUrlText(parent, text) || isEmailText(text) || isUrlLinesText(text)) {
      continue;
    }

    const matches = stripExemptPhrases(text).match(LATIN_RUN);
    if (!matches || matches.length === 0) {
      continue;
    }

    violations.push({
      selector: describeSelector(parent),
      text: text.trim().slice(0, 80),
      latinRuns: matches,
    });
  }

  return { scanned, violations };
}
