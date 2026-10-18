'use client';

import { ModuleHead, RecordBoard, StatusPill, type Field } from '@/components/RecordBoard';
import { money, useTable, type Row } from '@/lib/useTable';
import { addDays, fmtDate, today } from '@/lib/time';

type Agent = Row & {
  agent_name: string; lead_type: string; lead_type_other: string | null; states: string | null;
  lead_spend: number | null; spend_period: string; support_start: string | null; support_end: string | null;
  status: 'Active' | 'Ended'; notes: string | null;
};

const LEAD_TYPES = ['Final Expense', 'Veterans', 'Truckers', 'Mortgage Protection', 'Other'] as const;
const fields: Field[] = [
  { key: 'agent_name', label: 'Agent', required: true },
  { key: 'lead_type', label: 'Lead type', type: 'select', options: LEAD_TYPES, required: true },
  { key: 'lead_type_other', label: 'If other, what', placeholder: 'Only when Lead type is Other' },
  { key: 'states', label: 'Licensed in', placeholder: 'TX, OK, FL' },
  { key: 'lead_spend', label: 'Lead spend', type: 'money' },
  { key: 'spend_period', label: 'Spend is', type: 'select', options: ['Weekly', 'Monthly', 'Total'], required: true },
  { key: 'support_start', label: 'Support started', type: 'date' },
  { key: 'support_end', label: 'Cut from support on', type: 'date' },
  { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Ended'], required: true },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];
const leadType = (a: Agent) => a.lead_type === 'Other' && a.lead_type_other ? a.lead_type_other : a.lead_type;
/** Normalize "tx,ok / fl" → "TX, OK, FL". */
const tidyStates = (s: unknown) => s == null ? null : String(s).split(/[\s,/;]+/).filter(Boolean).map(x => x.toUpperCase()).join(', ') || null;

export default function AgentSupport() {
  const agents = useTable<Agent>('agent_support', { col: 'support_end', asc: true });
  const t = today();
  const soon = addDays(t, 14);
  const active = agents.rows.filter(a => a.status === 'Active');
  const pastDue = active.filter(a => a.support_end && a.support_end < t);
  const cutSoon = active.filter(a => a.support_end && a.support_end >= t && a.support_end <= soon);
  const weekly = active.reduce((s, a) => s + (a.spend_period === 'Weekly' ? Number(a.lead_spend ?? 0) : a.spend_period === 'Monthly' ? Number(a.lead_spend ?? 0) * 12 / 52 : 0), 0);

  const cutCell = (a: Agent) => {
    if (!a.support_end) return <span className="pill conf">No date</span>;
    if (a.status === 'Active' && a.support_end < t) return <span className="pill crit">Past due · {fmtDate(a.support_end)}</span>;
    if (a.status === 'Active' && a.support_end <= soon) return <span className="pill high">{fmtDate(a.support_end)}</span>;
    return fmtDate(a.support_end);
  };

  return (
    <>
      <ModuleHead eyebrow="Operations" title="Agent Support"
        sub="Every agent we’re supporting: what they run, where they’re licensed, what we spend and when support ends."
        stats={[
          { n: active.length, l: 'Agents supported', tone: 'ok' },
          { n: money(weekly), l: 'Lead spend per week' },
          { n: cutSoon.length, l: 'Cut in the next 14 days', tone: cutSoon.length ? 'warn' : '' },
          { n: pastDue.length, l: 'Past their cut date', tone: pastDue.length ? 'crit' : '' },
        ]} />
      {pastDue.length > 0 && (
        <div className="rb-warn" style={{ marginBottom: 16 }} role="status">
          Past their cut date and still active: {pastDue.map(a => a.agent_name).join(', ')}. Confirm with Wylie, then mark them Ended.
        </div>
      )}
      <section className="panel">
        <RecordBoard t={agents} noun="agent" fields={fields} titleOf={a => a.agent_name}
          defaults={() => ({ lead_type: 'Final Expense', spend_period: 'Weekly', status: 'Active', support_start: today() } as Partial<Agent>)}
          groups={[
            { label: 'Active', filter: a => a.status === 'Active' },
            ...LEAD_TYPES.slice(0, 3).map(lt => ({ label: lt, filter: (a: Agent) => a.status === 'Active' && a.lead_type === lt })),
            { label: 'Ended', filter: a => a.status === 'Ended' },
          ]}
          sort={(a, b) => (a.support_end ?? '9999').localeCompare(b.support_end ?? '9999')}
          validate={n => {
            if (n.support_start && n.support_end && n.support_end < n.support_start) return 'The cut date can’t be before support started.';
            if (n.lead_type === 'Other' && !n.lead_type_other) return 'Say what the lead type is.';
            (n as Record<string, unknown>).states = tidyStates(n.states);
            return null;
          }}
          columns={[
            { label: 'Agent', key: 'agent_name' },
            { label: 'Lead type', render: a => <span className="pill gold">{leadType(a)}</span> },
            { label: 'Licensed in', render: a => a.states ?? '—' },
            { label: 'Lead spend', render: a => a.lead_spend == null ? '—' : `${money(a.lead_spend)}${a.spend_period === 'Total' ? '' : a.spend_period === 'Weekly' ? '/wk' : '/mo'}` },
            { label: 'Cut on', render: cutCell },
            { label: 'Status', render: a => a.status === 'Active' ? <StatusPill s="Active" /> : <span className="pill">Ended</span> },
          ]}
          empty="No agents here yet. Add the agents you’re supporting." />
      </section>
    </>
  );
}
