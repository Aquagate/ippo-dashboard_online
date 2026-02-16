/**
 * SEED v4.1 Standard CSV Utilities
 * RFC4180 Compliant Parser & Generator
 * 
 * Usage:
 * const rows = parseRawCsv(csvText);
 * const csv = toCsv(rows);
 */

function parseRawCsv(text) {
    const rows = [];
    let currentRow = [];
    let currentField = "";
    let inQuote = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (inQuote) {
            if (char === '"') {
                if (nextChar === '"') {
                    currentField += '"';
                    i++; // skip escaped quote
                } else {
                    inQuote = false;
                }
            } else {
                currentField += char;
            }
        } else {
            if (char === '"') {
                inQuote = true;
            } else if (char === ',') {
                currentRow.push(currentField);
                currentField = "";
            } else if (char === '\r' || char === '\n') {
                if (char === '\r' && nextChar === '\n') {
                    i++;
                }
                currentRow.push(currentField);
                rows.push(currentRow);
                currentRow = [];
                currentField = "";
            } else {
                currentField += char;
            }
        }
    }
    if (currentField || currentRow.length > 0) {
        currentRow.push(currentField);
        rows.push(currentRow);
    }
    return rows;
}

function toCsv(rows) {
    return rows.map(cols => cols.map(c => {
        const s = (c == null) ? "" : String(c);
        if (s.includes('"') || s.includes(",") || s.includes("\n") || s.includes("\r")) {
            return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    }).join(",")).join("\r\n");
}

// For Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseRawCsv, toCsv };
}
