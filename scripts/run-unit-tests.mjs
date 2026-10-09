/**
 * Runs the unit suite with the server-only stub on this process and on
 * the test-runner workers (they inherit NODE_OPTIONS).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const stub = fileURLToPath(new URL("./stub-server-only.cjs", import.meta.url));
const tsx = fileURLToPath(new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url));
const existing = process.env.NODE_OPTIONS ?? "";
const env = {
  ...process.env,
  NODE_OPTIONS: `${existing} --require ${stub}`.trim(),
};
const patterns = process.argv.slice(2);
const args = [tsx, "--test", ...(patterns.length > 0 ? patterns : ["lib/**/*.test.ts"])];
const result = spawnSync(process.execPath, args, { stdio: "inherit", env });
process.exit(result.status ?? 1);
