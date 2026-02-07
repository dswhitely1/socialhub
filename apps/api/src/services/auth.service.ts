// TODO: Implement JWT verification using AUTH_SECRET
// Auth.js handles OAuth flows on the web side.
// This service verifies JWTs issued by Auth.js for API requests.

export async function verifyToken(_token: string): Promise<{ userId: string } | null> {
  // TODO: verify JWT using AUTH_SECRET, decode payload
  return null;
}
