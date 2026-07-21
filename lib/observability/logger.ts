import type { RequestContext } from "@/lib/observability/request-context";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogFields = Record<string, unknown> & Partial<RequestContext>;

const priorities: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function configuredLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL?.trim().toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  // Production default: hide debug noise so Vercel audits stay readable.
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function write(level: LogLevel, message: string, fields: LogFields = {}) {
  if (priorities[level] < priorities[configuredLevel()]) return;

  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...fields,
  });

  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}

export const logger = {
  debug: (message: string, fields?: LogFields) => write("debug", message, fields),
  info: (message: string, fields?: LogFields) => write("info", message, fields),
  warn: (message: string, fields?: LogFields) => write("warn", message, fields),
  error: (message: string, fields?: LogFields) => write("error", message, fields),
};
