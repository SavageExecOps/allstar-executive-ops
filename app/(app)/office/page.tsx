'use client';

import { useState } from 'react';
import { ModuleHead, RecordBoard, StatusPill, type Field } from '@/components/RecordBoard';
import { ModuleTabs } from '@/components/ModuleTabs';
import { Check, DueTag } from '@/components/TaskList';
import { useData } from '@/components/DataProvider';
import { useUI } from '@/components/UI';
import { money, useTable, type Row } from '@/lib/useTable';
import { isOpen, sortTasks } from '@/lib/tasks';
import { fmtDate, today } from '@/lib/time';

type Item = Row & { item: string; category: string | null; level: string; reorder_threshold: string | null; last_restock: string | null; next_restock: string | null; notes: string | null };
type Rent = Row & { direction: string; category: string; counterparty: string | null; amount: number | null; amount_paid: number; due_date: string | null; status: string; payment_method: string | null; notes: string | null };

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
  { key: 'due_date', label: 'Due', type: 'date', required: true },
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

  const t = today();
  const ym = t.slice(0, 7);
  const rent = inv.rows.filter(r => r.direction === 'receivable' && r.category === 'Office rent');
  const thisMonth = rent.filter(r => r.due_date?.startsWith(ym));
  const unpaid = thisMonth.filter(r => UNPAID.includes(r.status));
  const owed = rent.filter(r => UNPAID.includes(r.status)).reduce((s, r) => s + Number(r.amount ?? 0) - Number(r.amount_paid ?? 0), 0);
  const late = (r: Rent) => UNPAID.includes(r.status) && !!r.due_date && r.due_date < t;
  // Tenants = everyone with a rent record; their latest one sets the amount and due day.
  const tenants = Array.from(new Set(rent.map(r => r.counterparty).filter(Boolean))) as string[];
  const missing = tenants.filter(n => !thisMonth.some(r => r.counterparty === n));

  async function startMonth() {
    let made = 0;
    for (const n of missing) {
      const last = rent.filter(r => r.counterparty === n).sort((a, b) => (b.due_date ?? '').localeCompare(a.due_date ?? ''))[0];
      const day = last?.due_date?.slice(8, 10) ?? '01';
      if (await inv.create({ direction: 'receivable', category: 'Office rent', counterparty: n, amount: last?.amount ?? null, amount_paid: 0, due_date: `${ym}-${day}`, status: 'Open' } as Partial<Rent>)) made++;
    }
    toast(made ? `${monthName(ym)} rent added for ${made} tenant${made > 1 ? 's' : ''}` : 'Nothing to add');
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
            {missing.length > 0 && (
              <div className="plan-banner">
                <div><b>{monthName(ym)} rent isn’t set up for {missing.length} tenant{missing.length > 1 ? 's' : ''}</b> ({missing.join(', ')}). Uses each tenant’s last amount and due day.</div>
                <button className="btn primary" onClick={startMonth}>Add {monthName(ym)} rent</button>
              </div>
            )}
            <RecordBoard t={inv} noun="rent payment" newLabel="Add tenant rent" fields={rentFields} titleOf={r => r.counterparty ?? 'Rent'}
              defaults={() => ({ direction: 'receivable', category: 'Office rent', status: 'Open', amount_paid: 0, due_date: `${ym}-01` } as Partial<Rent>)}
              groups={[
                { label: 'Hasn’t paid', filter: r => r.direction === 'receivable' && r.category === 'Office rent' && UNPAID.includes(r.status) },
                { label: monthName(ym), filter: r => r.direction === 'receivable' && r.category === 'Office rent' && !!r.due_date?.startsWith(ym) },
                { label: 'All', filter: r => r.direction === 'receivable' && r.category === 'Office rent' },
              ]}
              validate={n => {
                if (Number(n.amount_paid ?? 0) > Number(n.amount ?? Infinity)) return 'Paid so far can’t be more than the rent.';
                if (n.status === 'Paid' && n.amount != null) (n as Record<string, unknown>).amount_paid = n.amount;
                return null;
              }}
              sort={(a, b) => Number(late(b)) - Number(late(a)) || (a.counterparty ?? '').localeCompare(b.counterparty ?? '')}
              columns={[
                { label: 'Tenant', render: r => r.counterparty ?? '—', className: 'tt' },
                { label: 'Month', render: r => r.due_date ? monthName(r.due_date.slice(0, 7)) : '—' },
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
