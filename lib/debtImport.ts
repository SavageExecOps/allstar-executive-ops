// Reads a carrier debt report pasted from a spreadsheet or PDF:
//   NAME / AGENT ID / current balance (as of the report date) / original debt amount
// one value per line or tab-separated, amounts usually negative ("-1008.73").

export type DebtLine = { name: string; agentId: string; current: number; original: number };

const AMT = /-?\$?\s?[\d,]+(?:\.\d+)?/;
const titleCase = (s: string) => s.toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase()).replace(/\bMc([a-z])/g, (_, c) => 'Mc' + c.toUpperCase());
const num = (s: string) => Math.abs(Number(s.replace(/[$,\s]/g, '')));

export function parseDebtReport(text: string) {
  const lines = text.split(/\r?\n|\t/).map(l => l.trim()).filter(Boolean);
  const rows: DebtLine[] = [];
  const skipped: string[] = [];
  const isName = (l: string) => /^[A-Za-z][A-Za-z .'\-]+$/.test(l) && !/^(name|agent ?id|original ?debt ?amt|as of)/i.test(l) && l.split(' ').length >= 2;
  const isId = (l: string) => /^[0-9A-Z]{4,8}$/.test(l) && /\d/.test(l);
  const amtOf = (l: string | undefined) => { const m = l ? AMT.exec(l) : null; return m && /^-?\$?\s?[\d,]/.test(l!) ? num(m[0]) : null; };
  for (let i = 0; i < lines.length; i++) {
    if (!isName(lines[i])) continue;
    const name = lines[i];
    if (!isId(lines[i + 1] ?? '')) { skipped.push(titleCase(name)); continue; }
    const cur = amtOf(lines[i + 2]), orig = amtOf(lines[i + 3]);
    if (cur == null || orig == null) { skipped.push(titleCase(name)); continue; }
    rows.push({ name: titleCase(name), agentId: lines[i + 1], current: cur, original: orig });
    i += 3;
  }
  const asOf = /as of\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i.exec(text);
  const asOfIso = asOf ? `${asOf[3].length === 2 ? '20' + asOf[3] : asOf[3]}-${asOf[1].padStart(2, '0')}-${asOf[2].padStart(2, '0')}` : null;
  return { rows, skipped, asOf: asOfIso };
}

/** Splits CSV text into rows, honoring quoted fields ("($1,196.04)"). Tabs work too (pasted from Sheets). */
function csvRows(text: string) {
  const sep = text.split('\n')[0].includes('\t') ? '\t' : ',';
  const out: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; continue; }
    if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell.trim()); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell.trim()); if (row.some(Boolean)) out.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  row.push(cell.trim()); if (row.some(Boolean)) out.push(row);
  return out;
}
/** "($1,196.04)" → 1196.04, "$0.00" → 0, "-12.5" → 12.5 */
const money = (s: string | undefined) => {
  if (s == null || !/\d/.test(s)) return null;
  const n = Number(s.replace(/[()$,\s-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

/**
 * A carrier spreadsheet with a header row, like Ethos's rolled-up chargeback report:
 * Agent, Rolled up chargeback, Adjustment credit, Net chargeback paid.
 * What's still owed comes from the net/balance column; the original from the chargeback/original column.
 */
export function parseDebtSheet(text: string) {
  const rows = csvRows(text.trim());
  const head = (rows[0] ?? []).map(h => h.toLowerCase());
  const col = (re: RegExp, not?: RegExp) => head.findIndex(h => re.test(h) && !(not && not.test(h)));
  const nameI = col(/agent|name/, /id|code/);
  const idI = col(/agent ?id|writing ?code|code/);
  const owedI = (() => { const n = col(/net|balance|owed|due|current/); return n >= 0 ? n : col(/amount|debt/); })();
  const origI = col(/rolled|original|chargeback|debt/, /net|credit|paid/);
  const creditI = col(/credit|adjust/);
  if (nameI < 0 || owedI < 0) return null;
  const lines: (DebtLine & { credit: number | null })[] = [];
  const settled: string[] = [];
  for (const r of rows.slice(1)) {
    const name = (r[nameI] ?? '').trim();
    if (!name || /^(grand )?total$/i.test(name)) continue;
    const owed = money(r[owedI]) ?? 0;
    const orig = origI >= 0 ? money(r[origI]) ?? owed : owed;
    const nice = name === name.toLowerCase() || name === name.toUpperCase() ? titleCase(name) : name;
    if (owed <= 0.004) { settled.push(nice); continue; }
    lines.push({ name: nice, agentId: idI >= 0 ? (r[idI] ?? '').trim() : '', current: owed, original: Math.max(orig, owed), credit: creditI >= 0 ? money(r[creditI]) : null });
  }
  return { rows: lines, settled, headers: rows[0] ?? [] };
}
