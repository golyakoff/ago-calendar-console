/**
 * `15-11`: the screens this gate measures, and how it knows each one has finished rendering.
 *
 * **All eight routes, not a chosen five.** `ago-console`'s own gate covers five because it has more
 * screens than are worth photographing; this console has exactly eight and every one of them is a
 * screen the first tenant uses. Three of them - workers, slots, re-cut - are also the ones nobody
 * has ever seen running, because AGO Calendar is not deployed (`20-20`), so this gate is currently
 * the only way to look at them at all.
 *
 * `readySelector` is what separates "the route resolved" from "the screen rendered". Measuring a
 * skeleton is the same class of mistake as `5-18`'s SignalR negotiate succeeding while the console
 * could not connect: the check passes, and it passed against nothing.
 */
import { SEED_DATE, WORKER_ID } from "./data.js";

export interface UxGateScreen {
  name: string;
  path: string;
  readySelector: string;
}

export const UX_GATE_SCREENS: readonly UxGateScreen[] = [
  { name: "queue", path: "/", readySelector: "table, [data-empty]" },
  { name: "configuration", path: "/setup", readySelector: "form, table" },
  { name: "workers", path: "/workers", readySelector: "table" },
  {
    name: "worker-slots",
    path: `/workers/${WORKER_ID}/slots?from=${SEED_DATE}`,
    readySelector: "table",
  },
  { name: "worker-recut", path: `/workers/${WORKER_ID}/recut`, readySelector: "form, table" },
  { name: "availability", path: "/availability", readySelector: "form" },
  { name: "contacts", path: "/contacts", readySelector: "table" },
  { name: "access", path: "/access", readySelector: "table" },
];
