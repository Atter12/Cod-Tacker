import { normalizePagination, type PaginationInput } from "@/lib/http/pagination";

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

export function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function parseStringParam(
  params: SearchParamsRecord,
  key: string,
  options: { maxLength?: number } = {},
): string | undefined {
  const raw = firstParam(params[key])?.trim();
  if (!raw) return undefined;
  const maxLength = options.maxLength ?? 200;
  return raw.slice(0, maxLength);
}

export function parseEnumParam<T extends string>(
  params: SearchParamsRecord,
  key: string,
  allowed: readonly T[],
): T | undefined {
  const raw = parseStringParam(params, key);
  if (!raw) return undefined;
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : undefined;
}

export function parseCsvEnumParam<T extends string>(
  params: SearchParamsRecord,
  key: string,
  allowed: readonly T[],
): T[] | undefined {
  const raw = parseStringParam(params, key, { maxLength: 500 });
  if (!raw) return undefined;
  const allowedSet = new Set<string>(allowed);
  const values = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part): part is T => allowedSet.has(part));
  return values.length ? values : undefined;
}

export function parsePositiveIntParam(
  params: SearchParamsRecord,
  key: string,
  fallback?: number,
): number | undefined {
  const raw = firstParam(params[key]);
  if (raw == null || raw === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function parseBooleanParam(params: SearchParamsRecord, key: string): boolean | undefined {
  const raw = firstParam(params[key])?.toLowerCase();
  if (raw == null) return undefined;
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  return undefined;
}

export function parsePaginationParams(
  params: SearchParamsRecord,
  defaults?: { pageSize?: number; maxPageSize?: number },
): PaginationInput {
  return normalizePagination(
    parsePositiveIntParam(params, "page", 1),
    parsePositiveIntParam(params, "pageSize") ?? parsePositiveIntParam(params, "page_size"),
    defaults,
  );
}

/** Safe date (YYYY-MM-DD or ISO). Returns undefined if invalid. */
export function parseDateParam(params: SearchParamsRecord, key: string): string | undefined {
  const raw = parseStringParam(params, key, { maxLength: 40 });
  if (!raw) return undefined;
  const time = Date.parse(raw);
  if (!Number.isFinite(time)) return undefined;
  return raw;
}
