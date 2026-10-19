// Reads an invoice list copied from QuickBooks (Sales → Invoices) and turns it into rent rows.
// Each invoice starts with "M/D/YY  NUMBER  CUSTOMER  $AMOUNT", followed by its status
// ("Overdue 18 days", "Due in 12 days", "Paid", "Deposited") and sometimes "Sent"/"Viewed".
import { addDays, today } from '@/lib/time';

export type QbInvoice = {
  invoice_number: string; counterparty: string; amount: number;
  invoice_sent_at: string; due_date: string | null; paid: boolean | null; qb_status: string;
};

const START = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{3,7})\s+(.+?)\s+\$\s?([\d,]+(?:\.\d{2})?)/g;

/** "Orvedahl, Logan" → "Logan Orvedahl"; "Mr Luke Rapaport" → "Luke Rapaport"; "DAVID LAYTON" → "David Layton". */
export function cleanName(raw: string) {
  let n = raw.trim().replace(/\s+/g, ' ').replace(/^(mr|mrs|ms|miss|dr)\.?\s+/i, '');
  const comma = /^([^,]+),\s*(.+)$/.exec(n);
  if (comma) n = `${comma[2]} ${comma[1]}`;
  if (n === n.toUpperCase() || n === n.toLowerCase()) n = n.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  return n;
}

export function parseQuickBooks(text: string): QbInvoice[] {
  const t = today();
  const hits = Array.from(text.matchAll(START));
  return hits.map((m, i) => {
    const [, mo, d, y] = m;
    const year = y.length === 2 ? `20${y}` : y;
    const invoiceDate = `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
    const tail = text.slice(m.index! + m[0].length, hits[i + 1]?.index ?? text.length);
    const over = /overdue\s+(\d+)\s+day/i.exec(tail);
    const dueIn = /due\s+in\s+(\d+)\s+day/i.exec(tail);
    const dueToday = /due\s+today/i.test(tail);
    const paid = /\b(paid|deposited)\b/i.test(tail);
    const due = over ? addDays(t, -Number(over[1])) : dueIn ? addDays(t, Number(dueIn[1])) : dueToday ? t : null;
    const status = (/(overdue\s+\d+\s+days?|due\s+in\s+\d+\s+days?|due today|paid|deposited)/i.exec(tail)?.[0] ?? '').trim();
    const action = /\b(sent|viewed)\b/i.exec(tail)?.[0];
    return {
      invoice_number: m[4],
      counterparty: cleanName(m[5]),
      amount: Number(m[6].replace(/,/g, '')),
      invoice_sent_at: invoiceDate,
      due_date: due,
      paid: paid ? true : (over || dueIn || dueToday) ? false : null,   // null = no status in the paste
      qb_status: [status, action].filter(Boolean).join(' · '),
    };
  });
}
