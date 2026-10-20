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
