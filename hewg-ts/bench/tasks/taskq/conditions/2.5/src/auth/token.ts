/**
 *
 * JWT-style token parsing utilities. These functions decode tokens
 * without performing cryptographic verification — that is handled
 * by the JWKS module.
 */

/**
 * Parse an Authorization header value into its scheme and token
 * components. Returns null if the header is malformed.
 *
 */
export function parseAuthHeader(
  header: string,
): { scheme: string; token: string } | null {
  const trimmed = header.trim();
  const spaceIndex = trimmed.indexOf(" ");
  if (spaceIndex === -1) return null;

  const scheme = trimmed.substring(0, spaceIndex);
  const token = trimmed.substring(spaceIndex + 1).trim();

  if (!scheme || !token) return null;
  return { scheme, token };
}

/**
 * Decode the payload section of a JWT-style token using base64
 * decoding. Does NOT verify the signature. Returns null if the
 * token structure is invalid or the payload cannot be parsed.
 *
 */
export function decodeTokenPayload(token: string): TokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const payloadB64 = parts[1];
    const json = Buffer.from(payloadB64, "base64url").toString("utf-8");
    const parsed = JSON.parse(json);

    if (
      typeof parsed.sub !== "string" ||
      typeof parsed.tenantId !== "string" ||
      typeof parsed.exp !== "number" ||
      typeof parsed.iat !== "number" ||
      !Array.isArray(parsed.scopes)
    ) {
      return null;
    }

    return parsed as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Check whether a token payload has expired based on the current
 * system time. Uses the `exp` claim as seconds since epoch.
 *
 */
export function isTokenExpired(payload: TokenPayload): boolean {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return payload.exp < nowSeconds;
}
