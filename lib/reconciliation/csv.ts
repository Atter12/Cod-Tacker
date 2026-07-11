/**
 * Minimal RFC4180-ish CSV parser (no external dependency).
 * Handles quoted fields, escaped quotes, CRLF/LF, and BOM.
 */

export type ParsedCsv = {
  headers: string[];
  rows: string[][];
};

function normalizeNewlines(input: string): string {
  return input.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function parseCsv(text: string): ParsedCsv {
  const source = normalizeNewlines(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      continue;
    }
    field += ch;
  }

  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);

  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0]!.map((h) => h.trim());
  const body = rows.slice(1).map((r) => {
    const padded = [...r];
    while (padded.length < headers.length) padded.push("");
    return padded.slice(0, headers.length);
  });
  return { headers, rows: body };
}

export function rowsToObjects(headers: string[], rows: string[][]): Record<string, string>[] {
  return rows.map((row) => {
    const obj: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      const key = headers[i]!;
      obj[key] = (row[i] ?? "").trim();
    }
    return obj;
  });
}

/** Escape formula injection for spreadsheet export (=, +, -, @, tab, CR). */
export function escapeCsvFormula(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) return `'${value}`;
  return value;
}

export function toCsvCell(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value);
  const safe = escapeCsvFormula(raw);
  if (/[",\n\r]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

export function serializeCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const lines = [
    headers.map((h) => toCsvCell(h)).join(","),
    ...rows.map((row) => row.map((cell) => toCsvCell(cell)).join(",")),
  ];
  return lines.join("\n");
}
