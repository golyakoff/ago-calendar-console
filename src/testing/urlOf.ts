/**
 * `fetch`'s first argument is a string, a `URL` or a `Request`, and only the first stringifies
 * usefully. A bare `String(...)` would read `[object Object]` for a `Request` and make every
 * assertion that inspects a URL vacuously true - which is a test that cannot fail, and
 * `@typescript-eslint/no-base-to-string` is what noticed.
 */
export function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }

  return input instanceof URL ? input.href : input.url;
}

/**
 * The same narrowing for a request body, which `fetch` types as `BodyInit | null` - a union wide
 * enough to include `Blob` and `FormData`, neither of which stringifies to anything a test can
 * assert on. Everything this console sends is a JSON string; this makes that explicit instead of
 * relying on it.
 */
export function bodyOf(init: RequestInit | undefined): string {
  const body = init?.body;
  return typeof body === "string" ? body : "";
}
