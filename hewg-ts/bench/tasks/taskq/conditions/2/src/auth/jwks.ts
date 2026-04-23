/**
 *
 * JWKS (JSON Web Key Set) fetching and token signature verification.
 */

/**
 * Fetch a JWKS key set from the given HTTPS URL. The response is
 * expected to conform to the standard JWKS JSON structure.
 *
 */
export async function fetchJwks(url: string): Promise<JwksResponse> {
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(
      `JWKS fetch failed: ${response.status} ${response.statusText}`,
    );
  }

  const body = (await response.json()) as JwksResponse;

  if (!body.keys || !Array.isArray(body.keys)) {
    throw new Error("Invalid JWKS response: missing keys array");
  }

  return body;
}

/**
 * Verify a JWT token's signature against the provided JWKS key set.
 * Extracts the kid from the token header and looks up the matching
 * key. This is a simplified simulation — real verification would use
 * a crypto library.
 *
 */
export async function verifyTokenSignature(
  token: string,
  jwks: JwksResponse,
): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  try {
    const headerJson = Buffer.from(parts[0], "base64url").toString("utf-8");
    const header = JSON.parse(headerJson) as { kid?: string; alg?: string };

    if (!header.kid) return false;

    const matchingKey = jwks.keys.find((k) => k.kid === header.kid);
    if (!matchingKey) return false;

    // In a real implementation this would perform RSA/EC verification.
    // For simulation purposes we check that the key exists and the
    // algorithm matches.
    if (header.alg && matchingKey.alg !== header.alg) return false;

    return true;
  } catch {
    return false;
  }
}
