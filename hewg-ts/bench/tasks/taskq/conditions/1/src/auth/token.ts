
export interface TokenPayload {
  readonly sub: string;
  readonly tenantId: string;
  readonly exp: number;
  readonly iat: number;
  readonly scopes: string[];
}

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

export function isTokenExpired(payload: TokenPayload): boolean {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return payload.exp < nowSeconds;
}
