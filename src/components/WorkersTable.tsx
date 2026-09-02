import type { ReactNode } from "react";
import type { WorkerDetail } from "../api/calendarApi.js";
import { useStrings } from "../i18n/StringsContext.js";

/**
 * `20-13`: the one table of every worker the tenant has - display name, activity, created, updated.
 *
 * <b>Extensibility.</b> Per-row actions come through `renderRowActions` rather than being hard-coded
 * here, so `20-14`'s "open schedule" and `20-15`'s "open slots" links are additional buttons a later
 * item passes in - not columns this file has to grow. The core columns are fixed (this item's own
 * scope names exactly them: display name, activity, created, updated), but the actions cell is the
 * seam three more background workers extend without touching this component.
 */
export interface WorkersTableProps {
  workers: WorkerDetail[];
  renderRowActions: (worker: WorkerDetail) => ReactNode;
}

export function WorkersTable({ workers, renderRowActions }: WorkersTableProps) {
  const strings = useStrings();

  if (workers.length === 0) {
    return <p className="muted">{strings.workersEmpty}</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th scope="col">{strings.workersColumnName}</th>
          <th scope="col">{strings.workersColumnActive}</th>
          <th scope="col">{strings.workersColumnCreated}</th>
          <th scope="col">{strings.workersColumnUpdated}</th>
          <th scope="col">{strings.workersColumnActions}</th>
        </tr>
      </thead>
      <tbody>
        {workers.map((worker) => (
          <tr key={worker.workerId}>
            <td>
              {worker.displayName}
              {worker.firstName === "—" && (
                <>
                  {" "}
                  <span className="error" title={strings.backfilledNameTooltip}>
                    {strings.needsCorrectionLabel}
                  </span>
                </>
              )}
            </td>
            <td>{worker.isActive ? strings.activeLabel : strings.inactiveLabel}</td>
            <td>{formatDate(worker.createdAt)}</td>
            <td>{formatDate(worker.updatedAt)}</td>
            <td>{renderRowActions(worker)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}
