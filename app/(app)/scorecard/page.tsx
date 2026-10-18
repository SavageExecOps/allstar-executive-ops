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
    const d = sumLogs(dm.logs, from);
    const added = recruits.filter(r => inPstamp(r.created_at)).length;
    const assigned = new Set(assignments.filter(a => inPstamp(a.assigned_at)).map(a => a.recruit_id)).size;
    const handed = recruits.filter(r => inPstamp(r.handed_off_at)).length;
    const contracted = recruits.filter(r => inP(r.contracted_at)).length;
    const producing = recruits.filter(r => inP(r.producing_at)).length;
    const recovered = pays.rows.filter(x => inP(x.paid_on)).reduce((s, x) => s + Number(x.amount), 0);
    const ws = wins.rows.filter(w => inP(w.happened_on));
    const saved = ws.filter(w => w.category === 'Money saved').reduce((s, w) => s + Number(w.value ?? 0), 0);
    const done = tasks.filter(t => t.status === 'Done' && inPstamp(t.completed_at)).length;
    return { ...d, added, assigned, handed, contracted, producing, recovered, saved, wins: ws, done };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dm.logs, recruits, assignments, pays.rows, wins.rows, tasks, from]);

  const summary = [
    `${homeName} · Executive Ops scorecard · ${p.label}${period === 'all' ? '' : ` (since ${fmtDate(from)})`}`,
    '',
    'RECRUITING',
    `• ${m.sent} DMs sent → ${m.replies} replies → ${m.booked} calls booked from DMs`,
    `• ${m.added} recruits in the pipeline · ${m.assigned} paired with a manager · ${m.handed} handed off`,
    `• ${m.contracted} contracted · ${m.producing} producing`,
    '',
    'MONEY',
    `• ${money(m.recovered)} recovered on debts`,
    m.saved ? `• ${money(m.saved)} saved` : '',
    '',
    'OPERATIONS',
    `• ${m.done} tasks closed out`,
    ...m.wins.slice(0, 8).map(w => `• ${w.title}${w.value ? ` (${money(w.value)})` : ''}`),
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');

  const funnel: [number, string, string?][] = [
    [m.sent, 'DMs sent'],
    [m.replies, 'Replies', pct(m.replies, m.sent)],
    [m.booked, 'Booked from DMs', pct(m.booked, m.replies)],
    [m.added, 'Recruits added'],
    [m.handed, 'Handed off', pct(m.handed, m.added)],
    [m.contracted, 'Contracted', pct(m.contracted, m.handed)],
    [m.producing, 'Producing', pct(m.producing, m.contracted)],
  ];

  return (
    <>
      <ModuleHead eyebrow="Your numbers" title="Scorecard"
        sub="The receipts. Everything you move, from first DM to producing agent and every dollar recovered. Bring this to your one-on-one." />
      <div className="toolbar">
        <div className="seg" role="group" aria-label="Period">
          {PERIODS.map(x => <button key={x.key} className={period === x.key ? 'on' : ''} onClick={() => setPeriod(x.key)}>{x.label}</button>)}
        </div>
      </div>
      <div className="stack">
        <section className="panel">
          <div className="panel-h"><h2 className="sec">Recruiting funnel</h2></div>
          <div className="funnel">
            {funnel.map(([n, l, c]) => <div key={l} className="stat"><span className="stat-n">{n}</span><span className="stat-l">{l}</span>{c && <span className="conv">{c} from last step</span>}</div>)}
          </div>
          <p className="hint">Contracted and producing come from the Outcome dates on each recruit. Fill them in when the manager confirms.</p>
        </section>
        <div className="mstats" style={{ margin: 0 }}>
          <div className="stat ok"><span className="stat-n">{money(m.recovered)}</span><span className="stat-l">Recovered on debts</span></div>
          <div className="stat ok"><span className="stat-n">{money(m.saved)}</span><span className="stat-l">Money saved (logged wins)</span></div>
          <div className="stat"><span className="stat-n">{m.done}</span><span className="stat-l">Tasks closed</span></div>
          <div className="stat gold"><span className="stat-n">{m.wins.length}</span><span className="stat-l">Wins logged</span></div>
        </div>
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
