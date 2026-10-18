'use client';

import { ModuleHead, RecordBoard, StatusPill, type Field } from '@/components/RecordBoard';
import { ModuleTabs } from '@/components/ModuleTabs';
import { money, useTable, type Row } from '@/lib/useTable';
import { addDays, today } from '@/lib/time';

type Bk = Row & { source: string; item_type: string; merchant: string | null; amount: number | null; transaction_date: string | null; description: string | null; status: string; assigned_to: string | null; follow_up_date: string | null };
type Inv = Row & { direction: 'payable' | 'receivable'; category: string; counterparty: string | null; invoice_number: string | null; amount: number | null; amount_paid: number; due_date: string | null; status: string; autopay_status: string; payment_method: string | null };
type Acct = Row & { label: string; institution: string | null; last4: string | null; connection_status: string; last_verified_at: string | null; notes: string | null };
type Vendor = Row & { name: string; contact_name: string | null; email: string | null; phone: string | null; notes: string | null };

const OPEN_INV = ['Draft', 'Open', 'Partially Paid', 'Overdue'];
const isLate = (i: Inv) => OPEN_INV.includes(i.status) && !!i.due_date && i.due_date < today();
const invStatus = (i: Inv) => isLate(i) ? 'Overdue' : i.status;

const bkFields: Field[] = [
  { key: 'item_type', label: 'Type', type: 'select', options: ['Categorization', 'W-9', 'Zelle details', 'Missing info', 'Other'], required: true },
  { key: 'source', label: 'From', type: 'select', options: ['KPA', 'QuickBooks', 'Other'], required: true },
  { key: 'description', label: 'The question', type: 'textarea', full: true },
  { key: 'merchant', label: 'Merchant / payee' },
  { key: 'amount', label: 'Amount', type: 'money' },
  { key: 'transaction_date', label: 'Transaction date', type: 'date' },
  { key: 'assigned_to', label: 'Who has to answer', placeholder: 'Wylie, me…' },
  { key: 'status', label: 'Status', type: 'select', options: ['Open', 'Waiting', 'Answered', 'Closed'], required: true },
  { key: 'follow_up_date', label: 'Follow up', type: 'date' },
];
const invFields = (dir: 'payable' | 'receivable'): Field[] => [
  { key: 'counterparty', label: dir === 'payable' ? 'Who we pay' : 'Who pays us', required: true },
  { key: 'category', label: 'Category', type: 'select', options: ['General', 'Office rent', 'Coffee machine', 'Advertising', 'Other'], required: true },
  { key: 'amount', label: 'Amount', type: 'money' },
  { key: 'amount_paid', label: 'Paid so far', type: 'money' },
  { key: 'due_date', label: 'Due', type: 'date' },
  { key: 'status', label: 'Status', type: 'select', options: ['Draft', 'Open', 'Partially Paid', 'Paid', 'Overdue', 'Void'], required: true },
  { key: 'invoice_number', label: 'Invoice #' },
  { key: 'payment_method', label: 'Paid with', placeholder: 'Card, ACH, Zelle…' },
  ...(dir === 'payable' ? [{ key: 'autopay_status', label: 'Autopay', type: 'select' as const, options: ['Off', 'Setup pending', 'Awaiting verification', 'Active'], required: true }] : []),
  { key: 'notes', label: 'Notes', type: 'textarea' },
];
const acctFields: Field[] = [
  { key: 'label', label: 'Account', required: true, placeholder: 'Business checking, Venmo…' },
  { key: 'institution', label: 'Bank / app' },
  { key: 'last4', label: 'Last 4 digits', hint: 'Only the last four. Never store full numbers or logins here.' },
  { key: 'connection_status', label: 'QuickBooks connection', type: 'select', options: ['Connected', 'Disconnected', 'Needs reconnect', 'Unknown'], required: true },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];
const vendorFields: Field[] = [
  { key: 'name', label: 'Vendor', required: true },
  { key: 'contact_name', label: 'Contact' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

export default function Finance() {
  const bk = useTable<Bk>('bookkeeping_items');
  const inv = useTable<Inv>('invoices', { col: 'due_date', asc: true });
  const acct = useTable<Acct>('financial_accounts', { col: 'label', asc: true });
  const vend = useTable<Vendor>('vendors', { col: 'name', asc: true });
  const t = today();
  const bills = inv.rows.filter(i => i.direction === 'payable');
  const dueSoon = bills.filter(i => OPEN_INV.includes(i.status) && i.due_date && i.due_date >= t && i.due_date <= addDays(t, 7));
  const late = inv.rows.filter(isLate);
  const owed = inv.rows.filter(i => i.direction === 'receivable' && OPEN_INV.includes(i.status)).reduce((s, i) => s + Number(i.amount ?? 0) - Number(i.amount_paid ?? 0), 0);

  const lateFirst = (a: Inv, b: Inv) => Number(isLate(b)) - Number(isLate(a)) || (a.due_date ?? '9').localeCompare(b.due_date ?? '9');
  const invCols = [
    { label: 'Who', render: (i: Inv) => i.counterparty ?? '—', className: 'tt' },
    { label: 'Category', render: (i: Inv) => i.category },
    { label: 'Amount', render: (i: Inv) => money(i.amount) },
    { label: 'Due', key: 'due_date' },
    { label: 'Status', render: (i: Inv) => <StatusPill s={invStatus(i)} /> },
  ];
  const groupsFor = (dir: Inv['direction']) => [
    { label: 'Open', filter: (i: Inv) => i.direction === dir && OPEN_INV.includes(i.status) },
    { label: 'Paid', filter: (i: Inv) => i.direction === dir && i.status === 'Paid' },
    { label: 'All', filter: (i: Inv) => i.direction === dir },
  ];

  return (
    <>
      <ModuleHead eyebrow="Operations" title="Finance & Bookkeeping"
        sub="KPA questions, bills, rent and the accounts QuickBooks needs connected. No banking logins are ever stored here."
        stats={[
          { n: bk.rows.filter(b => b.status === 'Open' || b.status === 'Waiting').length, l: 'KPA / bookkeeping questions open' },
          { n: dueSoon.length, l: 'Bills due next 7 days', tone: dueSoon.length ? 'warn' : '' },
          { n: late.length, l: 'Overdue', tone: late.length ? 'crit' : '' },
          { n: acct.rows.filter(a => a.connection_status !== 'Connected').length, l: 'Accounts to reconnect', tone: 'warn' },
          { n: money(owed), l: 'Owed to us' },
        ]} />
      <ModuleTabs id="finance" tabs={[
        { label: 'KPA questions', body: (
          <RecordBoard t={bk} noun="question" fields={bkFields} titleOf={b => b.description ?? b.item_type}
            defaults={{ source: 'KPA', item_type: 'Categorization', status: 'Open' } as Partial<Bk>}
            groups={[{ label: 'Open', filter: b => b.status === 'Open' || b.status === 'Waiting' }, { label: 'Answered', filter: b => b.status === 'Answered' || b.status === 'Closed' }]}
            columns={[
              { label: 'Question', render: b => b.description ?? b.item_type },
              { label: 'Merchant', key: 'merchant' },
              { label: 'Amount', render: b => money(b.amount) },
              { label: 'Who answers', key: 'assigned_to' },
              { label: 'Status', render: b => <StatusPill s={b.status} /> },
            ]}
            empty="No open KPA questions." />
        ) },
        { label: 'Bills', body: (
          <RecordBoard t={inv} noun="bill" fields={invFields('payable')} titleOf={i => i.counterparty ?? 'Bill'}
            defaults={{ direction: 'payable', category: 'General', status: 'Open', autopay_status: 'Off', amount_paid: 0 } as Partial<Inv>}
            groups={groupsFor('payable')} sort={lateFirst} columns={[...invCols, { label: 'Autopay', render: (i: Inv) => i.autopay_status === 'Off' ? '—' : <StatusPill s={i.autopay_status} /> }]}
            validate={n => Number(n.amount_paid ?? 0) > Number(n.amount ?? Infinity) ? 'Paid so far can’t be more than the amount.' : null}
            empty="No open bills." />
        ) },
        { label: 'Rent & money owed to us', body: (
          <RecordBoard t={inv} noun="invoice" fields={invFields('receivable')} titleOf={i => i.counterparty ?? 'Invoice'}
            defaults={{ direction: 'receivable', category: 'Office rent', status: 'Open', autopay_status: 'Off', amount_paid: 0 } as Partial<Inv>}
            groups={groupsFor('receivable')} sort={lateFirst} columns={invCols}
            validate={n => Number(n.amount_paid ?? 0) > Number(n.amount ?? Infinity) ? 'Paid so far can’t be more than the amount.' : null}
            empty="Nothing owed to us right now." />
        ) },
        { label: 'Accounts', body: (
          <RecordBoard t={acct} noun="account" fields={acctFields} titleOf={a => a.label}
            defaults={{ connection_status: 'Unknown' } as Partial<Acct>}
            validate={n => n.last4 && !/^\d{4}$/.test(String(n.last4)) ? 'Last 4 has to be exactly four digits.' : null}
            columns={[
              { label: 'Account', key: 'label' },
              { label: 'Bank / app', key: 'institution' },
              { label: 'Last 4', key: 'last4' },
              { label: 'QuickBooks', render: a => <StatusPill s={a.connection_status} /> },
            ]} />
        ) },
        { label: 'Vendors', body: (
          <RecordBoard t={vend} noun="vendor" fields={vendorFields} titleOf={v => v.name}
            columns={[{ label: 'Vendor', key: 'name' }, { label: 'Contact', key: 'contact_name' }, { label: 'Email', key: 'email' }, { label: 'Phone', key: 'phone' }]} />
        ) },
      ]} />
    </>
  );
}
