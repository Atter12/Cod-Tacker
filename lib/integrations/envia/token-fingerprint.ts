import { createHash } from "node:crypto";

/** SHA-256 hex of the API token — used to resolve webhooks without storing plaintext. */
export function fingerprintEnviaApiToken(apiToken: string): string {
  return createHash("sha256").update(apiToken.trim(), "utf8").digest("hex");
}
