import { toUserMessage } from "@/lib/errors/to-user-message";

/**
 * Canonical Server Action result. Domain-specific aliases may extend the data shape
 * (e.g. `{ id?: string }`) while always exposing an optional `error` string.
 */
export type ActionResult<T extends object = object> = {
  error?: string;
} & Partial<T>;

export function actionOk(): ActionResult;
export function actionOk<T extends object>(data: T): ActionResult<T>;
export function actionOk<T extends object>(data?: T): ActionResult | ActionResult<T> {
  if (data === undefined) return {};
  return data as ActionResult<T>;
}

export function actionFail(error: unknown): ActionResult {
  return { error: toUserMessage(error) };
}

/** Map a PostgREST/Supabase query error into a safe ActionResult error, or null if no error. */
export function actionFromQueryError(
  error: { message?: string; code?: string; details?: string } | null | undefined,
): ActionResult | null {
  if (!error) return null;
  return { error: toUserMessage(error) };
}
