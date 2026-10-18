'use client';

import { useMemo, useState } from 'react';
import { ModuleHead, RecordBoard, type Field } from '@/components/RecordBoard';
import { DmCounter, pct, sumLogs, useDmLogs, weekStart } from '@/components/DmCounter';
import { useData } from '@/components/DataProvider';
import { useOps } from '@/components/OpsData';
import { money, useTable, type Row } from '@/lib/useTable';
import { addDays, dayOf, fmtDate, today } from '@/lib/time';

type Win = Row & { happened_on: string; title: string; category: string; value: number | null; notes: string | null };
type Pay = Row & { amount: number; paid_on: string };

const PERIODS = [
  { key: 'week', label: 'This week', from: () => weekStart() },
  { key: 'month', label: 'This month', from: () => today().slice(0, 8) + '01' },
  { key: '30', label: 'Last 30 days', from: () => addDays(today(), -29) },
  { key: 'all', label: 'All time', from: () => '0000-01-01' },
] as const;
const CATS = ['Recruiting', 'Money recovered', 'Money saved', 'Time saved', 'Operations', 'Project shipped'] as const;
const winFields: Field[] = [
  { key: 'title', label: 'What you did', required: true, full: true, placeholder: 'Got the internet quote down $200/mo, rebuilt the lead request flow…' },
  { key: 'happened_on', label: 'When', type: 'date', required: true },
  { key: 'category', label: 'Type', type: 'select', options: CATS, required: true },
  { key: 'value', label: 'Dollar value', type: 'money', hint: 'Only a real number. Leave blank if you can’t point to one.' },
  { key: 'notes', label: 'Details', type: 'textarea' },
];

export default function Scorecard() {
  const [period, setPeriod] = useState<typeof PERIODS[number]['key']>('week');
  const [copied, setCopied] = useState(false);
  const { tasks, homeName } = useData();
  const { recruits, assignments } = useOps();
  const dm = useDmLogs();
  const wins = useTable<Win>('wins', { col: 'happened_on', asc: false });
  const pays = useTable<Pay>('debt_payments', { col: 'paid_on', asc: false });
  const p = PERIODS.find(x => x.key === period)!;
  const from = p.from();
  const inP = (d: string | null | undefined) => !!d && d.slice(0, 10) >= from;
  const inPstamp = (s: string | null | undefined) => !!s && dayOf(s) >= from;

  const m = useMemo(() => {
    const booked = sumLogs(dm.logs, from).booked;
    const added = recruits.filter(r => inPstamp(r.created_at)).length;
    const handed = recruits.filter(r => inPstamp(r.handed_off_at)).length;
    const contracted = recruits.filter(r => inP(r.contracted_at)).length;
    const recovered = pays.rows.filter(x => inP(x.paid_on)).reduce((s, x) => s + Number(x.amount), 0);
    const ws = wins.rows.filter(w => inP(w.happened_on));
    return { booked, added, handed, contracted, recovered, wins: ws };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dm.logs, recruits, pays.rows, wins.rows, from]);

  const summary = [
    `${homeName} · Executive Ops scorecard · ${p.label}${period === 'all' ? '' : ` (since ${fmtDate(from)})`}`,
    '',
    `CONTRACTED: ${m.contracted}`,
    `• ${m.booked} calls booked from DMs`,
    `• ${m.added} recruits added · ${m.handed} handed off to managers`,
    m.recovered ? `• ${money(m.recovered)} recovered on debts` : '',
    ...(m.wins.length ? ['', 'WINS', ...m.wins.slice(0, 8).map(w => `• ${w.title}${w.value ? ` (${money(w.value)})` : ''}`)] : []),
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');

  const funnel: [number, string, string?][] = [
    [m.booked, 'Booked from DMs'],
    [m.added, 'Recruits added'],
    [m.handed, 'Handed off', pct(m.handed, m.added)],
  ];

  return (
    <>
      <ModuleHead eyebrow="Your numbers" title="Scorecard"
        sub="The receipts. Recruits you bring in, hand off and get contracted. Bring this to your one-on-one." />
      <div className="toolbar">
        <div className="seg" role="group" aria-label="Period">
          {PERIODS.map(x => <button key={x.key} className={period === x.key ? 'on' : ''} onClick={() => setPeriod(x.key)}>{x.label}</button>)}
        </div>
      </div>
      <div className="stack">
        <section className="panel">
          <div className="score-hero">
            <div className="score-main"><span className="score-n">{m.contracted}</span><span className="stat-l">Contracted · {pct(m.contracted, m.handed)} of handed off</span></div>
            <div className="funnel">
              {funnel.map(([n, l, c]) => <div key={l} className="stat"><span className="stat-n">{n}</span><span className="stat-l">{l}</span>{c && <span className="conv">{c} of added</span>}</div>)}
            </div>
          </div>
          <p className="hint">Contracted comes from the “Contracted on” date on each recruit. Fill it in when the manager confirms.</p>
        </section>
        <DmCounter dm={dm} />
        <div className="grid2">
          <section className="panel">
            <div className="panel-h"><h2 className="sec">Wins log</h2></div>
            <RecordBoard t={wins} noun="win" fields={winFields} titleOf={w => w.title} newLabel="Log a win"
              defaults={() => ({ happened_on: today(), category: 'Operations' } as Partial<Win>)}
              groups={[{ label: p.label, filter: w => inP(w.happened_on) }, { label: 'All', filter: () => true }]}
              columns={[
                { label: 'Win', key: 'title' },
                { label: 'When', key: 'happened_on' },
                { label: 'Type', key: 'category' },
                { label: 'Value', render: w => w.value ? money(w.value) : '—' },
              ]}
              empty="No wins logged for this period. Anything you fix, ship, save or recover goes here." />
          </section>
          <section className="panel">
            <div className="panel-h"><h2 className="sec">Send to Wylie</h2>
              <button className="btn sm" onClick={async () => { try { await navigator.clipboard.writeText(summary); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* select fallback */ } }}>{copied ? 'Copied' : 'Copy'}</button></div>
            <textarea className="wins-copy" readOnly rows={16} value={summary} aria-label="Scorecard summary" onFocus={e => e.currentTarget.select()} />
            <p className="hint">Copies as plain text. Nothing is sent from here.</p>
          </section>
        </div>
      </div>
    </>
  );
}
