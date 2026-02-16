/**
 * JSONL ledger I/O helpers for append-only event logs.
 */
export function parseJsonl(input) {
  const rows = [];
  const warnings = [];

  String(input || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      try {
        rows.push(JSON.parse(line));
      } catch (error) {
        warnings.push(`invalid jsonl row: ${line.slice(0, 64)}`);
      }
    });

  return { rows, warnings };
}

export function toJsonl(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return "";
  }
  return `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
}

export function dedupeById(rows) {
  const map = new Map();
  for (const row of rows || []) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const key = row.id || `${row.ts || ""}:${row.ref_id || ""}:${row.duration_min || ""}`;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => String(b.ts || "").localeCompare(String(a.ts || "")));
}

export function normalizeImportedEvent(raw, index, options = {}) {
  const nowIso = options.nowIso || (() => new Date().toISOString());
  const validate = options.validate || (() => ({ ok: true }));

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const event = { ...raw };
  if (typeof event.id !== "string" || event.id.length < 8) {
    event.id = `evt_import_${Date.now()}_${index}`;
  }
  if (typeof event.ts !== "string" || event.ts.length < 10) {
    event.ts = nowIso();
  }
  if (typeof event.type !== "string") {
    event.type = "explore";
  }
  if (typeof event.ref_id !== "string" || !event.ref_id) {
    event.ref_id = `import_ref_${index}`;
  }
  if (typeof event.branch_id !== "string" || !event.branch_id) {
    event.branch_id = "branch_meta";
  }

  const duration = Number(event.duration_min);
  event.duration_min = Number.isInteger(duration) ? duration : 7;
  event.duration_min = Math.max(1, Math.min(240, event.duration_min));

  const result = validate(event);
  return result.ok ? event : null;
}

export function importJsonlRows(existingRows, importedRows, mode = "merge", options = {}) {
  const normalized = [];

  importedRows.forEach((row, index) => {
    const event = normalizeImportedEvent(row, index, options);
    if (event) {
      normalized.push(event);
    }
  });

  if (mode === "replace") {
    return dedupeById(normalized);
  }
  return dedupeById([...(normalized || []), ...(existingRows || [])]);
}
