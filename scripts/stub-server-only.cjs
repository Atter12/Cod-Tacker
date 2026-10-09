/**
 * `server-only` throws outside the Next server bundle. Unit tests load those
 * modules through tsx (CJS require), so resolve the marker to a no-op.
 */
const Module = require("module");
const path = require("path");

const empty = path.join(__dirname, "stub-server-only-empty.cjs");
const original = Module._resolveFilename;

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "server-only") return empty;
  return original.call(this, request, parent, isMain, options);
};
