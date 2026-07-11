/**
 * CLI job worker. Requires service role + ALLOW_JOB_WORKER=true.
 *
 *   ALLOW_JOB_WORKER=true npx tsx scripts/process-jobs.ts [--limit=10] [--queue=default] [--recover]
 */
import { createClient } from "@supabase/supabase-js";
import {
  processJobBatch,
  recoverStuckJobs,
} from "../lib/jobs/processor";
import type { Database } from "../types/database.generated";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

function parseArgs(argv: string[]) {
  let limit = 10;
  let queue = "default";
  let recover = false;
  for (const arg of argv) {
    if (arg.startsWith("--limit=")) {
      const n = Number.parseInt(arg.slice("--limit=".length), 10);
      if (Number.isFinite(n) && n > 0) limit = Math.min(n, 50);
    } else if (arg.startsWith("--queue=")) {
      queue = arg.slice("--queue=".length).trim() || "default";
    } else if (arg === "--recover") {
      recover = true;
    }
  }
  return { limit, queue, recover };
}

async function main() {
  if (process.env.ALLOW_JOB_WORKER !== "true") {
    console.error("Refusing to run: set ALLOW_JOB_WORKER=true to enable the job worker CLI.");
    process.exit(1);
  }

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { limit, queue, recover } = parseArgs(process.argv.slice(2));
  const workerId = `cli:${process.pid}:${Date.now()}`;

  if (recover) {
    const recovered = await recoverStuckJobs(admin);
    console.log(JSON.stringify({ recovered }, null, 2));
  }

  const result = await processJobBatch(admin, { workerId, limit, queue });
  console.log(JSON.stringify({ workerId, ...result }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
