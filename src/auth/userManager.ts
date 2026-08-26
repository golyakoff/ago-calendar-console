import { UserManager, WebStorageStateStore } from "oidc-client-ts";
import { config } from "../config.js";

/**
 * `adr/0022`'s Authorization Code + PKCE against Keycloak, reused unchanged - and `adr/0023`'s React
 * choice reused unchanged with it. **Neither is re-litigated by `20-06`**; the item says so and this
 * file is where it would have been tempting to drift.
 *
 * <b>Its own client id, not `ago-console`'s.</b> Two static bundles served from two origins need two
 * redirect-URI allowlists, and one shared client would mean either bundle could complete the other's
 * login - which is the kind of thing that is fine until the day one of them is compromised.
 *
 * <b>The same realm, though.</b> `adr/0027` is explicit that one identity provider spans both
 * products; what is not shared is what a validated token *means*, which each product answers against
 * its own `operators` table. An operator of AGO Chat who signs in here successfully still resolves
 * to no operator row and is refused by the API's own policy - the honest expression of "two products
 * that share nothing but the platform and the IdP".
 *
 * <b>`sessionStorage`, not `localStorage`</b> - `oidc-client-ts`'s own recommendation, and the right
 * default for an internal tool: an operator's session ends when the tab does.
 */
export const userManager = new UserManager({
  authority: config.keycloakAuthority,
  client_id: config.keycloakClientId,
  redirect_uri: `${window.location.origin}/callback`,
  post_logout_redirect_uri: `${window.location.origin}/`,
  response_type: "code",
  scope: "openid profile email",
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  // `automaticSilentRenew` defaults to true and, with a refresh token present, renews without an
  // iframe or a silent-redirect route. Recorded because it is invisible - there is no setting here
  // that says it is happening - and because `ago-console` learned the hard way (`5-16`) that code
  // holding an access token must treat it as a value that rotates on its own schedule.
});
