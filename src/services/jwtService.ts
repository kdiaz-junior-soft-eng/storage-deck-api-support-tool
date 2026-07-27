// StorageDeckAPI/src/services/jwtService.ts
import jwt, { SignOptions, JwtHeader, JwtPayload } from "jsonwebtoken";
import { env, validateJwtEnv } from "../config/env";

export interface DecodedJwtInfo {
  header: JwtHeader | null;
  payload: JwtPayload | string | null;
  isExpired: boolean;
  expiresAt?: Date;
  issuedAt?: Date;
}

export function getOrGenerateToken(): string {
  // 2. Validate JWT variables exist (throws error at runtime if missing)
  validateJwtEnv();

  // 3. Since validateJwtEnv() guarantees these fields are populated,
  // we assert them with non-null assertion (!), making TypeScript happy.
  const payload = {
    sub: env.JWT_SUB!,
    tenantUUID: env.JWT_TENANT_UUID!,
    tenantId: env.JWT_TENANT_ID!,
    sn: env.JWT_SN!,
    userSRN: env.JWT_USER_SRN!,
  };

  return jwt.sign(payload, env.JWT_SECRET!, {
    algorithm: "HS512",
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  });
}

/**
 * Decodes a JWT token string without requiring the secret key.
 * Automatically handles strings prefixed with "Bearer ".
 */
export function decodeJwtToken(tokenString: string): DecodedJwtInfo {
  // Strip "Bearer " prefix if present
  const cleanToken = tokenString.replace(/^Bearer\s+/i, "").trim();

  // Decode complete token (includes header + payload) without verifying signature
  const decoded = jwt.decode(cleanToken, { complete: true });

  if (!decoded || typeof decoded === "string") {
    throw new Error("Invalid or malformed JWT token string.");
  }

  const payload = decoded.payload as JwtPayload;
  let isExpired = false;
  let expiresAt: Date | undefined;
  let issuedAt: Date | undefined;

  if (payload && typeof payload === "object") {
    if (payload.exp) {
      expiresAt = new Date(payload.exp * 1000);
      isExpired = Date.now() >= expiresAt.getTime();
    }
    if (payload.iat) {
      issuedAt = new Date(payload.iat * 1000);
    }
  }

  return {
    header: decoded.header,
    payload: decoded.payload,
    isExpired,
    expiresAt,
    issuedAt,
  };
}