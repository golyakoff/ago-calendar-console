/**
 * Environment-based, per Vite's `import.meta.env` mechanism - `VITE_`-prefixed variables from
 * `.env.local` (gitignored) or `.env.production` (committed; none of the values are secrets).
 *
 * The shape is `ago-console`'s, and this is the first of several places in this repository where
 * that is true. `adr/0064` records the duplication as an accepted cost of the console being its own
 * deployable rather than pretending it does not exist: what is copied here is four lines of
 * environment reading, and what is *not* copied is anything either product's console does with the
 * result.
 */
export interface Config {
  /** `Ago.Calendar.Api`'s origin. Not `Ago.Chat.Api`'s - the two products have separate hosts and
   * separate databases (`adr/0027`), and this console never talks to the other one. */
  apiBaseUrl: string;
  /** The Keycloak realm, which *is* AGO Chat's: one identity provider across both products
   * (`adr/0027`). What the token means afterwards is this product's own business. */
  keycloakAuthority: string;
  keycloakClientId: string;
}

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable ${name} - see .env.example.`);
  }

  return value;
}

// Dot access, not a dynamic lookup: Vite's `ImportMetaEnv` carries a permissive index signature, so
// indexing by a variable name resolves to `any` regardless of the declared properties.
export const config: Config = {
  apiBaseUrl: required("VITE_API_BASE_URL", import.meta.env.VITE_API_BASE_URL).replace(/\/+$/, ""),
  keycloakAuthority: required("VITE_KEYCLOAK_AUTHORITY", import.meta.env.VITE_KEYCLOAK_AUTHORITY).replace(/\/+$/, ""),
  keycloakClientId: required("VITE_KEYCLOAK_CLIENT_ID", import.meta.env.VITE_KEYCLOAK_CLIENT_ID),
};
