'use client';

import { useState } from 'react';
import { ModuleHead, RecordBoard, StatusPill, type Field } from '@/components/RecordBoard';
import { useData } from '@/components/DataProvider';
import { money, useTable, type Row } from '@/lib/useTable';
import { fmtDate, today } from '@/lib/time';

type Debt = Row & { person_name: string; carrier: string | null; original_amount: number | null; status: string; last_contact_at: string | null; follow_up_date: string | null; notes: string | null; compensation_action_authorized: boolean };
type Pay = Row & { debt_id: string; amount: number; paid_on: string; method: string | null; notes: string | null };
type Plan = Row & { debt_id: string; installment_amount: number | null; frequency: string | null; start_date: string | null; status: string };

const STATUSES = ['Identified', 'Verified', 'Contact Required', 'Contacted', 'Payment Plan Proposed', 'Active Payment Plan', 'Paid', 'Disputed', 'Escalated', 'Closed'] as const;
const CLOSED = ['Paid', 'Closed'];
const fields: Field[] = [
  { key: 'person_name', label: 'Who owes', required: true },
  { key: 'carrier', label: 'Carrier' },
  { key: 'original_amount', label: 'Amount owed', type: 'money', hint: 'Leave blank until it’s confirmed. Never guess.' },
  { key: 'status', label: 'Status', type: 'select', options: STATUSES, required: true },
  { key: 'last_contact_at', label: 'Last contact', type: 'date' },
  { key: 'follow_up_date', label: 'Follow up', type: 'date' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
  { key: 'compensation_action_authorized', label: 'Wylie personally authorized a compensation action', type: 'bool', full: true,
    hint: 'Only Wylie makes this call. Check it after he says yes himself; nothing happens automatically.' },
];

function Ledger({ d, pays, plans, recovered, balance }: { d: Debt; pays: ReturnType<typeof useTable<Pay>>; plans: ReturnType<typeof useTable<Plan>>; recovered: (id: string) => number; balance: (d: Debt) => number | null }) {
    const { toast } = useData();
    const t = today();
    const [amt, setAmt] = useState('');
    const [on, setOn] = useState(t);
    const [inst, setInst] = useState('');
    const [freq, setFreq] = useState('Weekly');
    const mine = pays.rows.filter(p => p.debt_id === d.id);
    const plan = plans.rows.find(p => p.debt_id === d.id && ['Proposed', 'Active'].includes(p.status));
    const bal = balance(d);
    return (
      <>
        <div className="subrec">
          <label className="eyebrow" style={{ margin: 0 }}>Payments · recovered {money(recovered(d.id))}{bal != null && ` · balance ${money(bal)}`}</label>
          {mine.length === 0 && <span className="hint" style={{ margin: 0 }}>No payments recorded.</span>}
          {mine.map(p => (
            <div key={p.id} className="sr"><span>{fmtDate(p.paid_on)}{p.method ? ` · ${p.method}` : ''}</span>
              <span><b>{money(p.amount)}</b> <button type="button" className="link" onClick={() => pays.remove(p.id)} aria-label="Remove payment">remove</button></span></div>
          ))}
          <form onSubmit={async e => {
            e.preventDefault();
            const n = Number(amt.replace(/[$,]/g, ''));
            if (!(n > 0)) { toast('Enter the payment amount.'); return; }
            if (bal != null && n > bal + 0.001) { toast(`That’s more than the ${money(bal)} balance.`); return; }
            if (await pays.create({ debt_id: d.id, amount: n, paid_on: on } as Partial<Pay>)) { setAmt(''); toast('Payment recorded'); }
          }}>
            <div className="field"><label htmlFor="p-amt">Amount received</label><input id="p-amt" type="text" inputMode="decimal" value={amt} onChange={e => setAmt(e.target.value)} placeholder="$0.00" /></div>
            <div className="field"><label htmlFor="p-on">On</label><input id="p-on" type="date" value={on} onChange={e => setOn(e.target.value)} /></div>
            <button className="btn sm">Record payment</button>
          </form>
        </div>
        <div className="subrec">
          <label className="eyebrow" style={{ margin: 0 }}>Payment plan</label>
          {plan ? (
            <div className="sr"><span>{money(plan.installment_amount)} {plan.frequency?.toLowerCase()}{plan.start_date ? ` from ${fmtDate(plan.start_date)}` : ''}</span>
              <span><StatusPill s={plan.status} />{' '}
                {plan.status === 'Proposed' && <button type="button" className="link" onClick={() => plans.update(plan.id, { status: 'Active' } as Partial<Plan>)}>mark active</button>}{' '}
                <button type="button" className="link" onClick={() => plans.update(plan.id, { status: 'Completed' } as Partial<Plan>)}>complete</button></span></div>
          ) : (
            <form onSubmit={async e => {
              e.preventDefault();
              const n = Number(inst.replace(/[$,]/g, ''));
              if (!(n > 0)) { toast('Enter the installment amount.'); return; }
              if (await plans.create({ debt_id: d.id, installment_amount: n, frequency: freq, start_date: t, status: 'Proposed' } as Partial<Plan>)) toast('Plan proposed');
            }}>
              <div className="field"><label htmlFor="pl-amt">Installment</label><input id="pl-amt" type="text" inputMode="decimal" value={inst} onChange={e => setInst(e.target.value)} placeholder="$0.00" /></div>
              <div className="field"><label htmlFor="pl-f">How often</label><select id="pl-f" value={freq} onChange={e => setFreq(e.target.value)}>{['Weekly', 'Every 2 weeks', 'Monthly'].map(x => <option key={x}>{x}</option>)}</select></div>
              <button className="btn sm">Propose plan</button>
            </form>
          )}
        </div>
      </>
    );
  }

export default function DebtPage() {
  const debts = useTable<Debt>('debts');
  const pays = useTable<Pay>('debt_payments', { col: 'paid_on', asc: false });
  const plans = useTable<Plan>('payment_plans');
  const t = today();
  const recovered = (id: string) => pays.rows.filter(p => p.debt_id === id).reduce((s, p) => s + Number(p.amount), 0);
  const balance = (d: Debt) => d.original_amount == null ? null : Number(d.original_amount) - recovered(d.id);
  const open = debts.rows.filter(d => !CLOSED.includes(d.status));
  const month = t.slice(0, 7);

  return (
    <>
      <ModuleHead eyebrow="Operations" title="Debt Management"
        sub="Who owes, what’s been recovered, and what’s next. Balances come only from payments you record. Compensation actions are Wylie’s call alone."
        stats={[
          { n: open.length, l: 'Open debts' },
          { n: money(open.reduce((s, d) => s + (balance(d) ?? 0), 0)), l: 'Known balance outstanding', tone: 'warn' },
          { n: money(pays.rows.filter(p => p.paid_on.startsWith(month)).reduce((s, p) => s + Number(p.amount), 0)), l: 'Recovered this month', tone: 'ok' },
          { n: money(pays.rows.reduce((s, p) => s + Number(p.amount), 0)), l: 'Recovered all-time', tone: 'ok' },
          { n: open.filter(d => d.follow_up_date && d.follow_up_date <= t).length, l: 'Follow-ups due', tone: open.some(d => d.follow_up_date && d.follow_up_date <= t) ? 'crit' : '' },
        ]} />
      <section className="panel">
        <RecordBoard t={debts} noun="debt" fields={fields} titleOf={d => d.person_name}
          defaults={{ status: 'Identified', compensation_action_authorized: false } as Partial<Debt>}
          groups={[
            { label: 'Open', filter: d => !CLOSED.includes(d.status) },
            { label: 'Follow up today', filter: d => !CLOSED.includes(d.status) && !!d.follow_up_date && d.follow_up_date <= t },
            { label: 'Paid & closed', filter: d => CLOSED.includes(d.status) },
          ]}
          validate={(n, prev) => n.status === 'Paid' && prev && n.original_amount != null && Number(n.original_amount) - recovered(prev.id) > 0.001
            ? `Payments recorded don’t cover the amount yet (${money(Number(n.original_amount) - recovered(prev.id))} left). Record the payment first.` : null}
          extra={d => <Ledger d={d} pays={pays} plans={plans} recovered={recovered} balance={balance} />}
          columns={[
            { label: 'Who', key: 'person_name' },
            { label: 'Owed', render: d => d.original_amount == null ? <span className="pill conf">Amount not confirmed</span> : money(d.original_amount) },
            { label: 'Recovered', render: d => money(recovered(d.id)) },
            { label: 'Balance', render: d => money(balance(d)) },
            { label: 'Status', render: d => <StatusPill s={d.status} /> },
            { label: 'Follow up', render: d => d.follow_up_date ? <span className={d.follow_up_date <= t && !CLOSED.includes(d.status) ? 'pill crit' : ''}>{fmtDate(d.follow_up_date)}</span> : '—' },
          ]}
          empty="No debts tracked." />
      </section>
    </>
  );
}
