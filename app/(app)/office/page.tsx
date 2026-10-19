'use client';

import { useState } from 'react';
import { ModuleHead, RecordBoard, StatusPill, type Field } from '@/components/RecordBoard';
import { ModuleTabs } from '@/components/ModuleTabs';
import { Check, DueTag } from '@/components/TaskList';
import { useData } from '@/components/DataProvider';
import { useUI } from '@/components/UI';
import { money, useTable, type Row } from '@/lib/useTable';
import { isOpen, sortTasks } from '@/lib/tasks';
import { addDays, fmtDate, today } from '@/lib/time';
import { parseQuickBooks } from '@/lib/qbRent';

type Item = Row & { item: string; category: string | null; level: string; reorder_threshold: string | null; last_restock: string | null; next_restock: string | null; notes: string | null };
type Rent = Row & { direction: string; category: string; counterparty: string | null; invoice_number: string | null; invoice_sent_at: string | null; amount: number | null; amount_paid: number; due_date: string | null; status: string; payment_method: string | null; notes: string | null };

const supplyFields: Field[] = [
  { key: 'item', label: 'Item', required: true, placeholder: 'Coffee pods, paper towels…' },
  { key: 'category', label: 'Category', type: 'select', options: ['Consumables', 'Kitchen', 'Cleaning', 'Office supplies', 'Equipment', 'Other'] },
  { key: 'level', label: 'Level', type: 'select', options: ['Stocked', 'Low', 'Out', 'Unknown'], required: true },
  { key: 'reorder_threshold', label: 'Reorder when', placeholder: 'Down to 1 box' },
  { key: 'next_restock', label: 'Next restock', type: 'date' },
  { key: 'notes', label: 'Where to buy / notes', type: 'textarea' },
];
const rentFields: Field[] = [
  { key: 'counterparty', label: 'Tenant', required: true },
  { key: 'amount', label: 'Rent', type: 'money', required: true },
  { key: 'invoice_sent_at', label: 'Invoice date', type: 'date' },
  { key: 'due_date', label: 'Due', type: 'date', required: true },
  { key: 'invoice_number', label: 'Invoice #' },
  { key: 'status', label: 'Status', type: 'select', options: ['Open', 'Partially Paid', 'Paid', 'Void'], required: true },
  { key: 'amount_paid', label: 'Paid so far', type: 'money' },
  { key: 'payment_method', label: 'Paid with', placeholder: 'Zelle, check…' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];
const rank: Record<string, number> = { Out: 0, Low: 1, Unknown: 2, Stocked: 3 };
const UNPAID = ['Open', 'Partially Paid', 'Overdue', 'Draft'];
const monthName = (ym: string) => new Date(ym + '-15T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long' });

export default function Office() {
  const { tasks, createTask, toast } = useData();
  const { openTask } = useUI();
  const supplies = useTable<Item>('office_inventory', { col: 'item', asc: true });
  const inv = useTable<Rent>('invoices', { col: 'due_date', asc: false });
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [paste, setPaste] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const t = today();
  const ym = t.slice(0, 7);
  const rent = inv.rows.filter(r => r.direction === 'receivable' && r.category === 'Office rent');
  // The rent month is the invoice date (QuickBooks bills on the 1st, due 30 days later).
  const monthOf = (r: Rent) => (r.invoice_sent_at ?? r.due_date ?? '').slice(0, 7);
  const thisMonth = rent.filter(r => monthOf(r) === ym);
  const unpaid = thisMonth.filter(r => UNPAID.includes(r.status));
  const owed = rent.filter(r => UNPAID.includes(r.status)).reduce((s, r) => s + Number(r.amount ?? 0) - Number(r.amount_paid ?? 0), 0);
  const late = (r: Rent) => UNPAID.includes(r.status) && !!r.due_date && r.due_date < t;
  // Tenants = everyone with a rent record; their latest one sets the amount and due day.
  const tenants = Array.from(new Set(rent.map(r => r.counterparty).filter(Boolean))) as string[];
  const missing = tenants.filter(n => !thisMonth.some(r => r.counterparty === n));

  async function startMonth() {
    let made = 0;
    for (const n of missing) {
      const last = rent.filter(r => r.counterparty === n).sort((a, b) => monthOf(b).localeCompare(monthOf(a)))[0];
      const billed = `${ym}-${(last?.invoice_sent_at ?? last?.due_date ?? '').slice(8, 10) || '01'}`;
      const gap = last?.invoice_sent_at && last.due_date ? Math.round((Date.parse(last.due_date) - Date.parse(last.invoice_sent_at)) / 864e5) : 0;
      if (await inv.create({ direction: 'receivable', category: 'Office rent', counterparty: n, amount: last?.amount ?? null, amount_paid: 0,
        invoice_sent_at: billed, due_date: addDays(billed, gap), status: 'Open' } as Partial<Rent>)) made++;
    }
    toast(made ? `${monthName(ym)} rent added for ${made} tenant${made > 1 ? 's' : ''}` : 'Nothing to add');
  }

  async function importQb() {
    const list = parseQuickBooks(paste ?? '');
    if (!list.length) { toast('Couldn’t find any invoices in that. Copy the rows from QuickBooks → Invoices and paste again.'); return; }
    setImporting(true);
    let added = 0, updated = 0;
    const noStatus: string[] = [];
    for (const q of list) {
      if (q.paid === null) noStatus.push(`#${q.invoice_number}`);
      const existing = rent.find(r => r.invoice_number === q.invoice_number);
      const status = q.paid ? 'Paid' : existing && q.paid === null ? existing.status : 'Open';
      const row = {
        counterparty: q.counterparty, amount: q.amount, invoice_number: q.invoice_number, invoice_sent_at: q.invoice_sent_at,
        due_date: q.due_date ?? existing?.due_date ?? addDays(q.invoice_sent_at, 30), status,
        amount_paid: status === 'Paid' ? q.amount : existing?.amount_paid ?? 0,
        notes: q.qb_status ? `QuickBooks: ${q.qb_status}` : existing?.notes ?? null,
      } as Partial<Rent>;
      if (existing) { if (await inv.update(existing.id, row)) updated++; }
      else if (await inv.create({ ...row, direction: 'receivable', category: 'Office rent' } as Partial<Rent>)) added++;
    }
    setImporting(false);
    setPaste(null);
    toast(`Imported ${list.length}: ${added} new, ${updated} updated.${noStatus.length ? ` No status for ${noStatus.join(', ')}; marked not paid, change it if it was.` : ''}`);
  }

  const fixes = sortTasks(tasks.filter(x => x.department === 'Office' && isOpen(x)));
  const doneFixes = tasks.filter(x => x.department === 'Office' && !isOpen(x)).slice(0, 5);

  return (
    <>
      <ModuleHead eyebrow="Operations" title="Office & Rent"
        sub="Who hasn’t paid rent, what needs fixing, and what’s running low."
        stats={[
          { n: `${thisMonth.length - unpaid.length}/${thisMonth.length}`, l: `Paid ${monthName(ym)} rent`, tone: unpaid.length ? 'warn' : 'ok' },
          { n: money(owed), l: 'Rent outstanding', tone: owed ? 'crit' : '' },
          { n: fixes.length, l: 'Fixes & projects open' },
          { n: supplies.rows.filter(i => i.level === 'Low' || i.level === 'Out').length, l: 'Supplies to restock', tone: 'warn' },
        ]} />
      <ModuleTabs id="office" tabs={[
        { label: 'Rent', body: (
          <>
            {paste === null ? (
              <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
                <button className="btn sm" onClick={() => setPaste('')}>Import from QuickBooks</button>
              </div>
            ) : (
              <div className="qb-import">
                <label htmlFor="qb-paste" className="eyebrow" style={{ margin: 0 }}>Paste your QuickBooks invoice list</label>
                <textarea id="qb-paste" rows={7} value={paste} onChange={e => setPaste(e.target.value)} autoFocus
                  placeholder={'QuickBooks → Sales → Invoices. Select the rows, copy, paste here.\n9/1/26  1085  Orvedahl, Logan  $500.00  Overdue 18 days  Sent'} />
                <div className="toolbar" style={{ margin: 0 }}>
                  <span className="hint" style={{ margin: 0, flex: 1 }}>{(() => { const n = parseQuickBooks(paste).length; return n ? `${n} invoice${n > 1 ? 's' : ''} found. Matching invoice numbers get updated, new ones get added.` : 'Nothing found yet.'; })()}</span>
                  <button className="btn sm ghost" onClick={() => setPaste(null)}>Cancel</button>
                  <button className="btn sm primary" disabled={importing || !parseQuickBooks(paste).length} onClick={importQb}>{importing ? 'Importing…' : 'Import'}</button>
                </div>
              </div>
            )}
            {missing.length > 0 && (
              <div className="plan-banner">
                <div><b>No {monthName(ym)} rent invoice for {missing.join(', ')}.</b> If they still owe this month, this adds it using their last amount.</div>
                <button className="btn primary" onClick={startMonth}>Add {monthName(ym)} rent</button>
              </div>
            )}
            <RecordBoard t={inv} noun="rent payment" newLabel="Add tenant rent" fields={rentFields} titleOf={r => r.counterparty ?? 'Rent'}
              defaults={() => ({ direction: 'receivable', category: 'Office rent', status: 'Open', amount_paid: 0, invoice_sent_at: `${ym}-01`, due_date: addDays(`${ym}-01`, 30) } as Partial<Rent>)}
              groups={[
                { label: 'Hasn’t paid', filter: r => r.direction === 'receivable' && r.category === 'Office rent' && UNPAID.includes(r.status) },
                { label: monthName(ym), filter: r => r.direction === 'receivable' && r.category === 'Office rent' && monthOf(r) === ym },
                { label: 'All', filter: r => r.direction === 'receivable' && r.category === 'Office rent' },
              ]}
              validate={n => {
                if (Number(n.amount_paid ?? 0) > Number(n.amount ?? Infinity)) return 'Paid so far can’t be more than the rent.';
                if (n.status === 'Paid' && n.amount != null) (n as Record<string, unknown>).amount_paid = n.amount;
                return null;
              }}
              sort={(a, b) => Number(late(b)) - Number(late(a)) || monthOf(b).localeCompare(monthOf(a)) || (a.counterparty ?? '').localeCompare(b.counterparty ?? '')}
              columns={[
                { label: 'Tenant', render: r => r.counterparty ?? '—', className: 'tt' },
                { label: 'Month', render: r => monthOf(r) ? monthName(monthOf(r)) : '—' },
                { label: 'Inv #', render: r => r.invoice_number ?? '—' },
                { label: 'Rent', render: r => money(r.amount) },
                { label: 'Due', render: r => r.due_date ? fmtDate(r.due_date) : '—' },
                { label: 'Status', render: r => <StatusPill s={late(r) ? 'Overdue' : r.status === 'Open' ? 'Not paid' : r.status} /> },
              ]}
              empty="Everyone’s paid. Nice." />
          </>
        ) },
        { label: 'Fixes & projects', body: (
          <>
            <form className="toolbar" onSubmit={async e => {
              e.preventDefault();
              if (!title.trim()) return;
              if (await createTask({ title: title.trim(), department: 'Office', due_date: due || null, status: 'To Do', priority: 'Normal' })) { setTitle(''); setDue(''); toast('Added'); }
            }}>
              <input type="text" aria-label="What needs doing" placeholder="Fix the sink, new Wi-Fi router, deep clean…" value={title} onChange={e => setTitle(e.target.value)} style={{ flex: '1 1 260px' }} />
              <input type="date" aria-label="Due date" value={due} onChange={e => setDue(e.target.value)} />
              <button className="btn primary sm">Add</button>
            </form>
            {fixes.length === 0 ? <div className="empty">Nothing open. Add anything the office needs fixed or set up.</div> : (
              <div className="btasks" style={{ marginTop: 0 }}>
                {fixes.map(x => (
                  <div key={x.id} className="bt-i"><Check t={x} /><button className="ttitle" style={{ fontWeight: 400 }} onClick={() => openTask(x.id)}>{x.title}</button>{x.due_date && <DueTag t={x} />}</div>
                ))}
              </div>
            )}
            {doneFixes.length > 0 && <p className="hint">Recently done: {doneFixes.map(x => x.title).join(' · ')}</p>}
          </>
        ) },
        { label: 'Supplies', body: (
          <RecordBoard t={supplies} noun="item" fields={supplyFields} titleOf={i => i.item}
            defaults={{ level: 'Stocked', category: 'Consumables' } as Partial<Item>}
            groups={[{ label: 'Needs restock', filter: i => i.level === 'Low' || i.level === 'Out' }, { label: 'Everything', filter: () => true }]}
            sort={(a, b) => (rank[a.level] ?? 9) - (rank[b.level] ?? 9) || a.item.localeCompare(b.item)}
            columns={[
              { label: 'Item', key: 'item' },
              { label: 'Level', render: i => <StatusPill s={i.level} /> },
              { label: 'Reorder when', key: 'reorder_threshold' },
              { label: 'Next restock', key: 'next_restock' },
            ]}
            empty="Nothing needs restocking." />
        ) },
      ]} />
    </>
  );
}
