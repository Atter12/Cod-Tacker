#!/usr/bin/env node
/**
 * Validates tenant isolation with ordinary authenticated Supabase clients.
 *
 * Required environment:
 *   SUPABASE_URL, ANON_KEY,
 *   either USER_A_JWT/USER_B_JWT or
 *   USER_A_EMAIL, USER_A_PASSWORD, USER_B_EMAIL, USER_B_PASSWORD,
 *   AGENCY_A_ID, STORE_A_ID, AGENCY_B_ID, STORE_B_ID
 *
 * No service-role key is used: these assertions exercise the same RLS path
 * as a browser user. IDs may be UUIDs or values supported by `.eq("id", ...)`.
 */
import { createClient } from "@supabase/supabase-js";

const required = [
  "SUPABASE_URL", "ANON_KEY",
  "AGENCY_A_ID", "STORE_A_ID", "AGENCY_B_ID", "STORE_B_ID",
];
const missing = required.filter((name) => !process.env[name]);
const passwordCredentialsMissing = ["USER_A_EMAIL", "USER_A_PASSWORD", "USER_B_EMAIL", "USER_B_PASSWORD"]
  .filter((name) => !process.env[name]);
const jwtCredentialsMissing = ["USER_A_JWT", "USER_B_JWT"].filter((name) => !process.env[name]);
if (missing.length || (passwordCredentialsMissing.length && jwtCredentialsMissing.length)) {
  console.error(
    `Missing required environment variables: ${missing.join(", ")}. `
    + "Provide USER_A_JWT and USER_B_JWT, or both email/password pairs.",
  );
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const anonKey = process.env.ANON_KEY;

async function signedInClient(email, password) {
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Could not sign in ${email}: ${error.message}`);
  return client;
}

function clientFromJwt(token) {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

async function canRead(client, table, id) {
  const { data, error } = await client.from(table).select("id").eq("id", id);
  if (error) throw new Error(`${table} query failed: ${error.message}`);
  return data.length > 0;
}

/** Returns true when insert is rejected (RLS/policy) or never becomes visible. */
async function unauthorizedInsertBlocked(client, table, row) {
  const { data, error } = await client.from(table).insert(row).select("id");
  if (error) {
    // Expected: RLS / permission / check constraint from unprivileged client
    return true;
  }
  // If insert somehow returned rows, treat as failure of isolation
  return !(data && data.length > 0);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS: ${message}`);
}

try {
  const userA = process.env.USER_A_JWT
    ? clientFromJwt(process.env.USER_A_JWT)
    : await signedInClient(process.env.USER_A_EMAIL, process.env.USER_A_PASSWORD);
  const userB = process.env.USER_B_JWT
    ? clientFromJwt(process.env.USER_B_JWT)
    : await signedInClient(process.env.USER_B_EMAIL, process.env.USER_B_PASSWORD);

  assert(await canRead(userA, "agencies", process.env.AGENCY_A_ID), "User A can read Agency A");
  assert(await canRead(userA, "stores", process.env.STORE_A_ID), "User A can read Store A");
  assert(!(await canRead(userA, "agencies", process.env.AGENCY_B_ID)), "User A cannot read Agency B");
  assert(!(await canRead(userA, "stores", process.env.STORE_B_ID)), "User A cannot read Store B");
  assert(!(await canRead(userB, "agencies", process.env.AGENCY_A_ID)), "User B cannot read Agency A");
  assert(!(await canRead(userB, "stores", process.env.STORE_A_ID)), "User B cannot read Store A");

  // Unauthorized cross-tenant write: User A must not create a store under Agency B
  assert(
    await unauthorizedInsertBlocked(userA, "stores", {
      agency_id: process.env.AGENCY_B_ID,
      name: "RLS Probe Store",
      slug: `rls-probe-${Date.now()}`,
      timezone: "America/Lima",
      currency_code: "PEN",
      country_code: "PE",
      settings: {},
      is_active: true,
      attribution_window_days: 30,
    }),
    "User A cannot insert a store into Agency B",
  );

  // Unauthorized write against foreign store row (update should affect 0 rows / be denied)
  {
    const { data, error } = await userA
      .from("stores")
      .update({ name: "RLS Should Not Apply" })
      .eq("id", process.env.STORE_B_ID)
      .select("id");
    if (error) {
      assert(true, "User A cannot update Store B (error from RLS)");
    } else {
      assert(!(data && data.length > 0), "User A cannot update Store B (0 rows)");
    }
  }

  if (!process.env.USER_A_JWT && !process.env.USER_B_JWT) {
    await Promise.all([userA.auth.signOut(), userB.auth.signOut()]);
  }
  console.log("RLS tenant-isolation checks passed.");
} catch (error) {
  console.error(`RLS tenant-isolation checks failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
