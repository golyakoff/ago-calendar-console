import { useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import type { NavItem } from "./navItems.js";

export interface NavDrawerProps {
  open: boolean;
  items: NavItem[];
  /** The drawer's own accessible name (`<dialog aria-label>`). `App.tsx` passes the same string it
   * gives the hamburger button's own `aria-label` - the two are separate props, not one shared
   * constant reference, so a caller could give them different wording later without a signature
   * change, the way `ago-console`'s own `Dialog` keeps `title` and its trigger's label independent. */
  label: string;
  onClose: () => void;
}

/**
 * `11-14`: the mobile drawer, built on the native `<dialog>` element - the same choice
 * `ago-console/src/components/Dialog.tsx` made, and for the identical reason (that component's own doc
 * comment has the full case): `showModal()` gives focus-enter, a focus trap, `inert`-ing the rest of
 * the page, and focus-restore-to-the-invoker-on-close for free, in the platform itself. That is exactly
 * the half of a hand-rolled drawer that is usually implemented badly or skipped, and the reason `11-14`
 * calls it out as a Done-when rather than a note.
 *
 * This console has no shared `Dialog` component and no design system (`index.css`'s own header) - one
 * `<dialog>` used once is not yet a second call site, so this stays its own small component rather than
 * an import from a sibling repository the two consoles deliberately do not share (`11-14`'s own "what
 * makes this cheap in one console and not the other" - copy the idea, not the code).
 *
 * `showModal()`/`close()` are called imperatively from an effect, not rendered as a declarative
 * attribute, for the same reason `ago-console`'s `Dialog` does it that way: the dialog's open state is
 * DOM state the browser owns. Setting the `open` attribute directly renders a *non-modal* dialog with
 * none of the guarantees above - CSS makes it look identical, and every one of them would silently stop
 * working.
 *
 * **jsdom implements none of `<dialog>`'s modal behaviour** - not even `showModal`/`close` as callable
 * functions. Checked directly against the version this repository pins: `node_modules/jsdom`'s own
 * `HTMLDialogElement` implementation is an empty subclass of `HTMLElement`, so `element.showModal` is
 * `undefined` in every component test, not merely inert. The feature check below is load-bearing, not
 * defensive style - without it, any test that opens this drawer throws inside a `useEffect` the moment
 * `open` becomes `true`. Its fallback (toggling the `open` property by hand) buys back exactly one
 * thing a component test can still check honestly: that the drawer's own list is present and matches
 * the bar's (`src/App.test.tsx`). It proves nothing about focus entering, being trapped, or returning to
 * the hamburger - jsdom has no layout engine and no native dialog-focusing algorithm to fall back on -
 * so those stay proven the way `ago-console` proved its own focus-dependent behaviour: a real browser,
 * in `ux-gate/navDrawer.spec.ts`.
 */
export function NavDrawer({ open, items, label, onClose }: NavDrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (element === null) {
      return;
    }

    if (open && !element.open) {
      if (typeof element.showModal === "function") {
        element.showModal();
      } else {
        element.open = true;
      }
    } else if (!open && element.open) {
      if (typeof element.close === "function") {
        element.close();
      } else {
        element.open = false;
      }
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="nav-drawer"
      aria-label={label}
      // Fires for Escape as well as for a programmatic `close()` - one handler covers every native
      // exit route without a keydown listener of its own (mirrors `ago-console`'s `Dialog`).
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      // A click that lands on the `<dialog>` element itself, rather than on its content, is a click on
      // the backdrop - `::backdrop` is not an event target of its own, so this is the standard way to
      // detect it.
      onClick={(event) => {
        if (event.target === ref.current) {
          onClose();
        }
      }}
    >
      <nav className="nav-drawer__list">
        {items.map((item) => (
          // `onClick={onClose}` does not call `preventDefault`, so `NavLink`'s own navigation still
          // runs - "choosing an item" both navigates and dismisses, the third of the three required
          // dismissal routes.
          <NavLink key={item.to} to={item.to} end={item.end} onClick={onClose}>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </dialog>
  );
}
