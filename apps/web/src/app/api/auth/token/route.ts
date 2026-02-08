import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Returns the raw Auth.js session JWT for use as a Bearer token
 * when calling the external API server. This endpoint is same-origin
 * only (no CORS headers), so external sites cannot access the token.
 */
export async function GET() {
  const cookieStore = await cookies();
  const token =
    cookieStore.get("__Secure-authjs.session-token")?.value ??
    cookieStore.get("authjs.session-token")?.value ??
    null;
  return NextResponse.json({ token });
}
