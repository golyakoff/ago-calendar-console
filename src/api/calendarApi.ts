import { config } from "../config.js";

/**
 * Every call this console makes, in one file.
 *
 * <b>Plain `fetch`, no generated client</b> - matching `ago-console`'s own `api/*.ts` shape. Field
 * names match `Ago.Calendar.Contracts`' C# records verbatim under ASP.NET Core's default camelCase
 * policy.
 *
 * <b>The tenant is never sent.</b> Not in a path, not in a body, not in a query string. It comes off
 * the operator's own token, resolved server-side by `OperatorIdentityClaimsTransformation` against
 * `ago-calendar`'s own `operators` table. A console that could name a tenant would be a console that
 * could name somebody else's, and every cross-tenant bug is made of exactly that.
 *
 * <b>The access token is a parameter, never a module-level capture.</b> Silent renewal replaces it
 * on its own schedule (`auth/userManager.ts`), so a captured token is a token that goes stale -
 * `ago-console` shipped that defect once (`5-16`) and this is the shape that cannot.
 */

export interface WorkingHoursRule {
  ruleId: string;
  workerId: string;
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
}

export interface ConfiguredCalendar {
  calendarId: string;
  name: string;
  timeZone: string;
  bufferMinutes: number;
  isPublished: boolean;
  workerIds: string[];
  workingHours: WorkingHoursRule[];
}

export interface ConfiguredWorker {
  workerId: string;
  displayName: string;
  isActive: boolean;
  serviceIds: string[];
}

export interface ConfiguredService {
  serviceId: string;
  name: string;
  durationMinutes: number;
}

export interface TenantConfiguration {
  tenantName: string;
  /** What the shop pastes into its own page's script tag. Shown only here - the console is the only
   * place it ever appears. */
  publicKey: string;
  allowedOrigins: string[];
  calendars: ConfiguredCalendar[];
  workers: ConfiguredWorker[];
  services: ConfiguredService[];
}

export interface PendingBooking {
  bookingId: string;
  calendarId: string;
  workerId: string;
  serviceId: string;
  customerId: string;
  startsAt: string;
  endsAt: string;
  localDate: string;
  confirmationDeadline: string;
  /** The sweep's health, on the one screen a human already looks at (`20-04`). A row that shows this
   * means the confirmation sweep is not doing its job, and the customer has already been told they
   * are booked. */
  isOverdue: boolean;
  /**
   * `20-12`. `null` means exactly one thing: this operator does not hold `customer:read` in this
   * tenant, so the server never joined to `customers` at all - never "no phone recorded", which
   * cannot happen (`Ago.Calendar.Domain.Customer.Phone` is not nullable). `QueuePage` renders that
   * one state as "hidden, not absent" rather than as an empty cell indistinguishable from either
   * reading.
   */
  phone: string | null;
}

export interface Role {
  roleId: string;
  name: string;
  permissions: string[];
}

export interface OperatorInfo {
  operatorId: string;
  displayName: string;
  /** `20-12`: the tenant's own account owner - the first operator ever provisioned for it, always
   * holding a role that grants `customer:read` (`Ago.Calendar.Domain.Operator.IsAccountOwner`'s own
   * invariant). The console never offers to revoke that role from this operator - not because the
   * button is hidden, but because the server refuses it either way; hiding it here just saves an
   * operator a round trip that would only ever fail. */
  isAccountOwner: boolean;
  roleIds: string[];
}

export interface Contact {
  customerId: string;
  phone: string;
  displayName: string | null;
  notes: string | null;
  /** Always zero today - nothing in this product writes it yet (`20-04`'s own retro note). Shown
   * honestly rather than hidden, so the report does not imply a feature that does not exist. */
  noShowCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

/**
 * Carries the server's stable problem-details `type` alongside its human-readable `detail` -
 * `api-design.md`: "clients branch on `type`, never on the message". This console branches on
 * `configuration.forbidden` (to say *why* a screen is empty rather than showing an empty screen) and
 * renders `message` verbatim for everything else, so a rejection this file has never heard of still
 * reaches the operator worded as the server worded it.
 */
export class CalendarApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "CalendarApiError";
    this.code = code;
    this.status = status;
  }
}

const base = () => `${config.apiBaseUrl}/api/v1/console`;

export function getConfiguration(token: string, signal?: AbortSignal): Promise<TenantConfiguration> {
  return request<TenantConfiguration>(token, "GET", "/configuration", undefined, signal);
}

export function setAllowedOrigins(token: string, origins: string[]): Promise<void> {
  return requestVoid(token, "PUT", "/configuration/allowed-origins", { origins });
}

export function createCalendar(
  token: string,
  body: { name: string; timeZone: string; bufferMinutes: number; publish: boolean },
): Promise<{ calendarId: string }> {
  return request<{ calendarId: string }>(token, "POST", "/calendars", body);
}

export function updateCalendar(
  token: string,
  calendarId: string,
  body: { name: string; bufferMinutes: number; publish: boolean },
): Promise<void> {
  return requestVoid(token, "PUT", `/calendars/${encodeURIComponent(calendarId)}`, body);
}

export function createService(
  token: string,
  body: { name: string; durationMinutes: number },
): Promise<{ serviceId: string }> {
  return request<{ serviceId: string }>(token, "POST", "/services", body);
}

export function createWorker(
  token: string,
  body: { displayName: string; calendarId: string; serviceIds: string[] },
): Promise<{ workerId: string }> {
  return request<{ workerId: string }>(token, "POST", "/workers", body);
}

export function addWorkingHoursRule(
  token: string,
  body: { calendarId: string; workerId: string; dayOfWeek: number; startsAt: string; endsAt: string },
): Promise<{ ruleId: string }> {
  return request<{ ruleId: string }>(token, "POST", "/working-hours", body);
}

export function getPendingBookings(token: string, signal?: AbortSignal): Promise<PendingBooking[]> {
  return request<PendingBooking[]>(token, "GET", "/pending-bookings", undefined, signal);
}

/** The queue's own verb. Confirmation is what happens when nobody acts, so the operator-facing
 * action is *reject* - the queue is a veto list, not an approval list (`20-04`). */
export function rejectBooking(token: string, bookingId: string): Promise<void> {
  return requestVoid(token, "POST", `/bookings/${encodeURIComponent(bookingId)}/reject`);
}

export function cancelBooking(token: string, bookingId: string): Promise<void> {
  return requestVoid(token, "POST", `/bookings/${encodeURIComponent(bookingId)}/cancel`);
}

export function markNoShow(token: string, bookingId: string): Promise<void> {
  return requestVoid(token, "POST", `/bookings/${encodeURIComponent(bookingId)}/no-show`);
}

export function deleteDayOff(
  token: string,
  body: { calendarId: string; workerId: string; localDate: string },
): Promise<void> {
  return requestVoid(token, "POST", "/availability/day-off", body);
}

export function editDayBoundary(
  token: string,
  body: { calendarId: string; workerId: string; localDate: string; opensAt: string; closesAt: string },
): Promise<void> {
  return requestVoid(token, "POST", "/availability/day-boundary", body);
}

export function getRoles(token: string, signal?: AbortSignal): Promise<Role[]> {
  return request<Role[]>(token, "GET", "/roles", undefined, signal);
}

export function createRole(
  token: string,
  body: { name: string; permissions: string[] },
): Promise<{ roleId: string }> {
  return request<{ roleId: string }>(token, "POST", "/roles", body);
}

export function getOperators(token: string, signal?: AbortSignal): Promise<OperatorInfo[]> {
  return request<OperatorInfo[]>(token, "GET", "/operators", undefined, signal);
}

export function grantOperatorRole(token: string, operatorId: string, roleId: string): Promise<void> {
  return requestVoid(
    token,
    "POST",
    `/operators/${encodeURIComponent(operatorId)}/roles/${encodeURIComponent(roleId)}`,
  );
}

export function revokeOperatorRole(token: string, operatorId: string, roleId: string): Promise<void> {
  return requestVoid(
    token,
    "DELETE",
    `/operators/${encodeURIComponent(operatorId)}/roles/${encodeURIComponent(roleId)}`,
  );
}

export function getContacts(token: string, signal?: AbortSignal): Promise<Contact[]> {
  return request<Contact[]>(token, "GET", "/contacts", undefined, signal);
}

async function request<T>(
  token: string,
  method: string,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await send(token, method, path, body, signal);
  return (await response.json()) as T;
}

async function requestVoid(token: string, method: string, path: string, body?: unknown): Promise<void> {
  await send(token, method, path, body);
}

async function send(
  token: string,
  method: string,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<Response> {
  const response = await fetch(`${base()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      Accept: "application/json",
    },
    body: body === undefined ? null : JSON.stringify(body),
    signal: signal ?? null,
  });

  if (!response.ok) {
    throw await problemFrom(response);
  }

  return response;
}

async function problemFrom(response: Response): Promise<CalendarApiError> {
  // A 401 has no problem-details body worth parsing: it is the framework refusing before any of this
  // product's code ran, so it gets its own sentence rather than an empty one.
  if (response.status === 401) {
    return new CalendarApiError("auth.unauthenticated", "Your session has expired. Sign in again.", 401);
  }

  try {
    const problem = (await response.json()) as { type?: unknown; detail?: unknown };
    return new CalendarApiError(
      typeof problem.type === "string" ? problem.type : `http.${response.status}`,
      typeof problem.detail === "string" ? problem.detail : `The request failed (${String(response.status)}).`,
      response.status,
    );
  } catch {
    return new CalendarApiError(`http.${response.status}`, `The request failed (${String(response.status)}).`, response.status);
  }
}
