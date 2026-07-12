/**
 * The access token lives only in memory (module scope) — never in
 * localStorage — so XSS cannot exfiltrate a persisted credential. On a page
 * reload the httpOnly refresh cookie silently mints a new one.
 */
let accessToken = null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token) {
  accessToken = token;
}

export function clearAccessToken() {
  accessToken = null;
}
