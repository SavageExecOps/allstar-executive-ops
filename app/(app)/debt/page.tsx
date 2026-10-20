'use client';

import { useState } from 'react';
import { ModuleHead, RecordBoard, StatusPill, type Field } from '@/components/RecordBoard';
import { useData } from '@/components/DataProvider';
import { money, useTable, type Row } from '@/lib/useTable';
import { fmtDate, today } from '@/lib/time';
import { parseDebtReport, parseDebtSheet } from '@/lib/debtImport';

type Debt = Row & { person_name: string; carrier: string | null; original_amount: number | null; status: string; last_contact_at: string | null; follow_up_date: string | null; notes: string | null; compensation_action_authorized: boolean; documents?: { agent_id?: string; as_of?: string }[] | null };
type Pay = Row & { debt_id: string; amount: number; paid_on: string; method: string | null; notes: string | null };
type Plan = Row & { debt_id: string; installment_amount: number | null; frequency: string | null; start_date: string | null; status: string };

const STATUSES = ['Identified', 'Verified', 'Contact Required', 'Contacted', 'Payment Plan Proposed', 'Active Payment Plan', 'Paid', 'Disputed', 'Escalated', 'Closed'] as const;
const CLOSED = ['Paid', 'Closed'];
const fields: Field[] = [
  { key: 'person_name', label: 'Who owes', required: true },
  { key: 'carrier', label: 'Carrier', placeholder: 'Mutual of Omaha, Americo…', hint: 'Spelled the same each time so the carrier totals add up. Existing names are matched for you.' },
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

const agentIdOf = (d: Debt) => (Array.isArray(d.documents) ? d.documents.find(x => x && x.agent_id)?.agent_id : undefined) ?? null;

export default function DebtPage() {
  const { toast } = useData();
  const [imp, setImp] = useState<{ text: string; carrier: string; asOf: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const debts = useTable<Debt>('debts');
  const pays = useTable<Pay>('debt_payments', { col: 'paid_on', asc: false });
  const plans = useTable<Plan>('payment_plans');
  const t = today();
  const recovered = (id: string) => pays.rows.filter(p => p.debt_id === id).reduce((s, p) => s + Number(p.amount), 0);
  const balance = (d: Debt) => d.original_amount == null ? null : Number(d.original_amount) - recovered(d.id);
  const open = debts.rows.filter(d => !CLOSED.includes(d.status));
  const month = t.slice(0, 7);

  // Carrier totals. Names are matched case-insensitively so "americo" and "Americo" add up together.
  const NO_CARRIER = 'No carrier';
  const keyOf = (c: string | null) => (c ?? '').trim().toLowerCase() || NO_CARRIER.toLowerCase();
  const carriers = new Map<string, { name: string; list: Debt[] }>();
  for (const d of debts.rows) {
    const k = keyOf(d.carrier);
    if (!carriers.has(k)) carriers.set(k, { name: d.carrier?.trim() || NO_CARRIER, list: [] });
    carriers.get(k)!.list.push(d);
  }
  const sumUp = (list: Debt[]) => {
    const openList = list.filter(d => !CLOSED.includes(d.status));
    return {
      open: openList.length,
      owed: list.reduce((s, d) => s + Number(d.original_amount ?? 0), 0),
      recovered: list.reduce((s, d) => s + recovered(d.id), 0),
      balance: openList.reduce((s, d) => s + (balance(d) ?? 0), 0),
      unconfirmed: openList.filter(d => d.original_amount == null).length,
    };
  };
  const byCarrier = Array.from(carriers.values()).map(c => ({ ...c, ...sumUp(c.list) }))
    .sort((a, b) => (a.name === NO_CARRIER ? 1 : 0) - (b.name === NO_CARRIER ? 1 : 0) || b.balance - a.balance || a.name.localeCompare(b.name));
  const total = sumUp(debts.rows);
  // A sheet with a header row (CSV or pasted from Sheets), or the one-value-per-line report format.
  const sheet = imp && /^[^\n]*(,|\t)[^\n]*\n/.test(imp.text.trim() + '\n') ? parseDebtSheet(imp.text) : null;
  const parsed = !imp ? null : sheet && sheet.rows.length
    ? { rows: sheet.rows, skipped: [] as string[], settled: sheet.settled, asOf: null as string | null }
    : { ...parseDebtReport(imp.text), settled: [] as string[] };

  async function runImport() {
    if (!imp || !parsed?.rows.length) return;
    const carrier = tidyCarrier(imp.carrier);
    if (!carrier) { setImpErr('Pick which carrier this report is from.'); return; }
    const asOf = imp.asOf || parsed.asOf || t;
    setImporting(true);
    let added = 0, updated = 0;
    for (const r of parsed.rows) {
      const sameName = (d: Debt) => d.person_name.trim().toLowerCase() === r.name.trim().toLowerCase();
      const existing = debts.rows.find(d => keyOf(d.carrier) === keyOf(carrier) && (r.agentId ? agentIdOf(d) === r.agentId : sameName(d) && !agentIdOf(d)))
        ?? (r.agentId ? debts.rows.find(d => keyOf(d.carrier) === keyOf(carrier) && sameName(d) && !agentIdOf(d)) : undefined);
      const x = r as typeof r & { gross?: number; credit?: number | null; exact?: boolean };
      // Sheet imports (net chargeback): the net IS the debt. Clear any balance-matching entries an
      // earlier import added, so only payments you recorded yourself count against it.
      if (existing && x.exact) {
        const auto = pays.rows.filter(p => p.debt_id === existing.id && p.method === `${carrier} report`);
        for (const p of auto) await pays.remove(p.id);
      }
      const rec = existing ? pays.rows.filter(p => p.debt_id === existing.id && !(x.exact && p.method === `${carrier} report`)).reduce((s, p) => s + Number(p.amount), 0) : 0;
      let orig: number, pay: number;
      if (x.exact) { orig = Math.round((r.current + rec) * 100) / 100; pay = 0; }
      else {
        // Original never goes down; if the balance grew past it, the original rises to match.
        orig = Math.max(r.original, r.current, Number(existing?.original_amount ?? 0));
        if (orig - r.current < rec) orig = r.current + rec;
        pay = Math.round((orig - r.current - rec) * 100) / 100;
      }
      const docs = [{ ...(r.agentId ? { agent_id: r.agentId } : {}), as_of: asOf, source: `${carrier} report` }];
      const credit = x.credit;
      const note = x.exact
        ? `${carrier} report as of ${fmtDate(asOf)}: net chargeback ${money(r.current)}${x.gross != null ? ` (rolled up ${money(x.gross)}${credit != null ? `, credits ${money(credit)}` : ''})` : ''}.`
        : `${r.agentId ? `Agent ID ${r.agentId}. ` : ''}${carrier} report as of ${fmtDate(asOf)}: original ${money(r.original)}, still owed ${money(r.current)}.`;
      const row = { person_name: r.name, carrier, original_amount: orig, documents: docs,
        ...(x.exact ? { notes: existing?.notes && !existing.notes.includes(`${carrier} report`) ? `${existing.notes}\n${note}` : note } : {}),
        status: r.current <= 0.004 ? 'Paid' : existing && !['Paid', 'Closed'].includes(existing.status) ? existing.status : 'Verified' } as Partial<Debt>;
      let id = existing?.id;
      if (existing) { if (await debts.update(existing.id, row)) updated++; }
      else {
        const made = await debts.create({ ...row, compensation_action_authorized: false,
          notes: note } as Partial<Debt>);
        if (made) { added++; id = made.id; }
      }
      if (id && pay > 0.004) await pays.create({ debt_id: id, amount: pay, paid_on: asOf, method: `${carrier} report`, notes: 'Recovered per carrier report' } as Partial<Pay>);
    }
    setImporting(false);
    setImp(null);
    toast(`Imported ${parsed.rows.length} from ${carrier}: ${added} new, ${updated} updated.${parsed.skipped.length ? ` Skipped (no amounts): ${parsed.skipped.join(', ')}.` : ''}${parsed.settled.length ? ` ${parsed.settled.length} owe nothing, not added.` : ''}`);
  }
  const [impErr, setImpErr] = useState<string | null>(null);

  const tidyCarrier = (c: unknown) => {
    const v = String(c ?? '').trim().replace(/\s+/g, ' ');
    if (!v) return null;
    return byCarrier.find(x => x.name !== NO_CARRIER && x.name.toLowerCase() === v.toLowerCase())?.name ?? v;
  };

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
      {byCarrier.length > 0 && (
        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-h"><h2 className="sec">By carrier</h2></div>
          <div className="scroll-x">
            <table className="ttable carriers">
              <thead><tr><th>Carrier</th><th>Open</th><th>Owed</th><th>Recovered</th><th>Balance</th></tr></thead>
              <tbody>
                {byCarrier.map(c => (
                  <tr key={c.name}>
                    <td className="tt">{c.name}</td>
                    <td>{c.open}</td>
                    <td>{money(c.owed)}{c.unconfirmed ? <span className="hint" style={{ display: 'block', margin: 0 }}>+{c.unconfirmed} not confirmed</span> : null}</td>
                    <td className="ok-n">{money(c.recovered)}</td>
                    <td className="bal-n">{money(c.balance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td className="tt">Total</td><td>{total.open}</td><td>{money(total.owed)}</td><td className="ok-n">{money(total.recovered)}</td><td className="bal-n">{money(total.balance)}</td></tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}
      {imp === null ? (
        <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
          <button className="btn sm" onClick={() => { setImpErr(null); setImp({ text: '', carrier: '', asOf: '' }); }}>Import carrier report</button>
        </div>
      ) : (
        <section className="panel qb-import" style={{ marginBottom: 20 }}>
          <span className="eyebrow" style={{ margin: 0 }}>Import a carrier debt report</span>
          <div className="row2">
            <div className="field"><label htmlFor="di-carrier">Carrier *</label>
              <input id="di-carrier" type="text" list="di-carriers" value={imp.carrier} onChange={e => { setImpErr(null); setImp({ ...imp, carrier: e.target.value }); }} placeholder="Which carrier is this from?" />
              <datalist id="di-carriers">{byCarrier.filter(c => c.name !== NO_CARRIER).map(c => <option key={c.name} value={c.name} />)}</datalist></div>
            <div className="field"><label htmlFor="di-asof">Balances as of</label>
              <input id="di-asof" type="date" value={imp.asOf || parsed?.asOf || ''} onChange={e => setImp({ ...imp, asOf: e.target.value })} /></div>
          </div>
          <div className="field"><label htmlFor="di-text">Paste the report, or upload the CSV</label>
            <input type="file" accept=".csv,.tsv,.txt,text/csv" aria-label="Upload CSV" onChange={async e => { const f = e.target.files?.[0]; if (f) setImp({ ...imp, text: await f.text() }); }} style={{ fontSize: 12.5 }} />
            <textarea id="di-text" rows={7} value={imp.text} onChange={e => setImp({ ...imp, text: e.target.value })} placeholder={'VIRGINIA BERGSTROM\n0Q8MM\n-1008.73\n-1320.47'} /></div>
          {impErr && <div className="rb-err" role="alert">{impErr}</div>}
          <div className="toolbar" style={{ margin: 0 }}>
            <span className="hint" style={{ margin: 0, flex: 1 }}>{parsed?.rows.length
              ? `${parsed.rows.length} agents · ${money(parsed.rows.reduce((s, r) => s + r.current, 0))} ${sheet?.rows.length ? 'net chargebacks' : `owed now · ${money(parsed.rows.reduce((s, r) => s + r.original, 0))} original`}.${parsed.skipped.length ? ` ${parsed.skipped.length} without amounts will be skipped (${parsed.skipped.join(', ')}).` : ''}${parsed.settled.length ? ` ${parsed.settled.length} owe nothing and won’t be added.` : ''} Anyone already listed for this carrier gets updated instead of duplicated.`
              : 'Nothing found yet.'}</span>
            <button className="btn sm ghost" onClick={() => setImp(null)}>Cancel</button>
            <button className="btn sm primary" disabled={importing || !parsed?.rows.length} onClick={runImport}>{importing ? 'Importing…' : 'Import'}</button>
          </div>
        </section>
      )}
      <section className="panel">
        <RecordBoard t={debts} noun="debt" fields={fields} titleOf={d => d.person_name}
          defaults={{ status: 'Identified', compensation_action_authorized: false } as Partial<Debt>}
          groups={[
            { label: 'Open', filter: d => !CLOSED.includes(d.status) },
            { label: 'Follow up today', filter: d => !CLOSED.includes(d.status) && !!d.follow_up_date && d.follow_up_date <= t },
            ...byCarrier.filter(c => c.open && byCarrier.length > 1).map(c => ({ label: c.name, filter: (d: Debt) => !CLOSED.includes(d.status) && keyOf(d.carrier) === keyOf(c.name === NO_CARRIER ? null : c.name) })),
            { label: 'Paid & closed', filter: d => CLOSED.includes(d.status) },
          ]}
          validate={(n, prev) => {
            (n as Record<string, unknown>).carrier = tidyCarrier(n.carrier);
            return n.status === 'Paid' && prev && n.original_amount != null && Number(n.original_amount) - recovered(prev.id) > 0.001
              ? `Payments recorded don’t cover the amount yet (${money(Number(n.original_amount) - recovered(prev.id))} left). Record the payment first.` : null;
          }}
          extra={d => <Ledger d={d} pays={pays} plans={plans} recovered={recovered} balance={balance} />}
          columns={[
            { label: 'Who', key: 'person_name' },
            { label: 'Carrier', render: d => d.carrier ?? '—' },
            { label: 'Agent ID', render: d => agentIdOf(d) ?? '—' },
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
