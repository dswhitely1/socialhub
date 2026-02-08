import { jwtDecrypt } from "jose";
import { hkdf } from "node:crypto";
import { promisify } from "node:util";
import { env } from "../env.js";

const hkdfAsync = promisify(hkdf);

const SESSION_COOKIE_NAME =
  env.NODE_ENV === "production" ? "__Secure-authjs.session-token" : "authjs.session-token";

/**
 * Derives the encryption key used by Auth.js to encrypt JWTs.
 * Must match @auth/core's internal HKDF key derivation exactly.
 */
async function getDerivedEncryptionKey(secret: string, salt: string): Promise<Uint8Array> {
  const derivedKey = await hkdfAsync(
    "sha256",
    secret,
    salt,
    `Auth.js Generated Encryption Key (${salt})`,
    64,
  );
  return new Uint8Array(derivedKey);
}

/**
 * Verifies and decodes an Auth.js v5 encrypted JWT (JWE).
 * Returns the userId from the token payload, or null if invalid.
 */
export async function verifyToken(token: string): Promise<{ userId: string } | null> {
  try {
    const key = await getDerivedEncryptionKey(env.AUTH_SECRET, SESSION_COOKIE_NAME);
    const { payload } = await jwtDecrypt(token, key, { clockTolerance: 15 });
    const userId = payload.id ?? payload.sub;
    if (typeof userId !== "string" || !userId) return null;
    return { userId };
  } catch {
    return null;
  }
}
