'use client';

import { useMemo, useState } from 'react';
import { ModuleHead, RecordDrawer, type Field } from '@/components/RecordBoard';
import { money, useTable, type Row } from '@/lib/useTable';
import { addDays, fmtDate, today } from '@/lib/time';

type Agent = Row & {
  agent_name: string; email: string | null; team: string | null;
  lead_type: string | null; lead_type_other: string | null; states: string | null;
  lead_spend: number | null; spend_period: string; support_start: string | null; support_end: string | null;
  status: 'Active' | 'Ended'; notes: string | null;
};

const LEAD_TYPES = ['Final Expense', 'Veterans', 'Truckers', 'Mortgage Protection', 'Other'] as const;
const fields = (teams: string[]): Field[] => [
  { key: 'agent_name', label: 'Agent', required: true },
  { key: 'email', label: 'Email' },
  { key: 'team', label: 'Team', placeholder: teams.join(' / ') || 'Team 1', hint: teams.length ? `Type it exactly to match: ${teams.join(', ')}` : undefined },
  { key: 'lead_spend', label: 'Lead spend for this agent', type: 'money' },
  { key: 'lead_type', label: 'Lead type', type: 'select', options: LEAD_TYPES },
  { key: 'lead_type_other', label: 'If other, what' },
  { key: 'states', label: 'Licensed in', placeholder: 'TX, OK, FL' },
  { key: 'support_end', label: 'Cut from support on', type: 'date' },
  { key: 'support_start', label: 'Support started', type: 'date' },
  { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Ended'], required: true },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];
const tidyStates = (s: unknown) => s == null ? null : String(s).split(/[\s,/;]+/).filter(Boolean).map(x => x.toUpperCase()).join(', ') || null;
const NO_TEAM = 'No team';

export default function AgentSupport() {
  const agents = useTable<Agent>('agent_support', { col: 'agent_name', asc: true });
  const [open, setOpen] = useState<Agent | 'new' | null>(null);
  const [showEnded, setShowEnded] = useState(false);
  const t = today();
  const soon = addDays(t, 14);

  const active = agents.rows.filter(a => a.status === 'Active');
  const teams = useMemo(() => Array.from(new Set(agents.rows.map(a => a.team).filter(Boolean) as string[])).sort(), [agents.rows]);
  const groups = [...teams, NO_TEAM].map(name => ({
    name,
    list: active.filter(a => (a.team ?? NO_TEAM) === name).sort((a, b) => a.agent_name.localeCompare(b.agent_name)),
  })).filter(g => g.list.length);
  const pastDue = active.filter(a => a.support_end && a.support_end < t);
  const cutSoon = active.filter(a => a.support_end && a.support_end >= t && a.support_end <= soon);
  const ended = agents.rows.filter(a => a.status === 'Ended');

  if (agents.missing) return <div className="empty">Agent Support needs the latest database update (see SETUP.md).</div>;

  return (
    <>
      <ModuleHead eyebrow="Operations" title="Agent Support"
        sub="Who we’re supporting, by team. Click a name to see or edit lead spend, lead type, states and cut date."
        stats={[
          { n: active.length, l: 'Agents supported', tone: 'ok' },
          { n: money(Math.round(active.reduce((s, a) => s + Number(a.lead_spend ?? 0), 0))), l: 'Total lead spend' },
          { n: cutSoon.length, l: 'Cut in the next 14 days', tone: cutSoon.length ? 'warn' : '' },
          { n: pastDue.length, l: 'Past their cut date', tone: pastDue.length ? 'crit' : '' },
        ]} />
      {pastDue.length > 0 && (
        <div className="rb-warn" style={{ marginBottom: 16 }} role="status">
          Past their cut date and still active: {pastDue.map(a => a.agent_name).join(', ')}. Confirm with Wylie, then mark them Ended.
        </div>
      )}
      <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
        <button className="btn primary sm" onClick={() => setOpen('new')}>Add agent</button>
      </div>
      {!agents.ready ? <div className="empty">Loading…</div> : groups.length === 0 ? (
        <section className="panel"><div className="empty">No agents yet. Add the agents you’re supporting.</div></section>
      ) : (
        <div className="teams">
          {groups.map(g => {
            const spends = g.list.map(a => a.lead_spend).filter(v => v != null).map(Number);
            const each = spends.length && spends.every(v => v === spends[0]) ? spends[0] : null;
            const total = spends.reduce((s, v) => s + v, 0);
            return (
              <section key={g.name} className="panel team">
                <div className="team-h">
                  <h2 className="sec">{g.name}</h2>
                  <span className="team-meta">{g.list.length} agents{each != null ? ` · ${money(each)} each` : ''}{total ? ` · ${money(Math.round(total))} total` : ''}</span>
                </div>
                <ul className="team-list">
                  {g.list.map(a => {
                    const late = a.support_end && a.support_end < t;
                    const near = a.support_end && !late && a.support_end <= soon;
                    return (
                      <li key={a.id}>
                        <button className="team-name" onClick={() => setOpen(a)}>
                          <span>{a.agent_name}</span>
                          {late ? <span className="pill crit">Past cut · {fmtDate(a.support_end)}</span> : near ? <span className="pill high">Cut {fmtDate(a.support_end)}</span> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
      {ended.length > 0 && (
        <p className="hint">{ended.length} no longer supported. <button className="link" onClick={() => setShowEnded(s => !s)}>{showEnded ? 'Hide' : 'Show'}</button>
          {showEnded && <span style={{ display: 'block', marginTop: 6 }}>{ended.map(a => <button key={a.id} className="link" style={{ marginRight: 12 }} onClick={() => setOpen(a)}>{a.agent_name}</button>)}</span>}
        </p>
      )}
      {open && (
        <RecordDrawer t={agents} noun="agent" fields={fields(teams)} row={open === 'new' ? null : open}
          defaults={{ status: 'Active', spend_period: 'Total', team: teams[0] ?? null } as Partial<Agent>}
          titleOf={a => a.agent_name} onClose={() => setOpen(null)}
          validate={n => {
            if (n.support_start && n.support_end && n.support_end < n.support_start) return 'The cut date can’t be before support started.';
            if (n.lead_type === 'Other' && !n.lead_type_other) return 'Say what the lead type is.';
            (n as Record<string, unknown>).states = tidyStates(n.states);
            return null;
          }} />
      )}
    </>
  );
}
