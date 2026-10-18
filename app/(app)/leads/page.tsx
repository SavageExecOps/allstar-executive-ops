'use client';

import { ModuleHead, RecordBoard, StatusPill, type Field } from '@/components/RecordBoard';
import { ModuleTabs } from '@/components/ModuleTabs';
import { useTable, type Row } from '@/lib/useTable';
import { addDays, fmtDate, today, weekday } from '@/lib/time';

type Enr = Row & { agent_name: string; status: string; requested_at: string | null; added_at: string | null; closed_deal_verified: boolean; notes: string | null };
type Group = Row & { name: string; responsible_contact: string | null; notes: string | null };
type Ready = Row & { lead_group_id: string; week_of: string; required_volume: number | null; confirmed_volume: number | null; status: string; outstanding_issues: string | null; notes: string | null };

const ENR = ['Request Received', 'Reviewed', 'Added', 'Active', 'Deal Closed', 'Removal Required', 'Completed'] as const;
const enrFields: Field[] = [
  { key: 'agent_name', label: 'Agent', required: true },
  { key: 'status', label: 'Status', type: 'select', options: ENR, required: true },
  { key: 'requested_at', label: 'Requested', type: 'date' },
  { key: 'added_at', label: 'Added to program', type: 'date' },
  { key: 'closed_deal_verified', label: 'Closed deal verified (checked against the carrier or Wylie, not just a notice)', type: 'bool', full: true,
    hint: 'Required before anyone is removed or their leads are pulled.' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];
const nextMonday = () => { const t = today(); return addDays(t, ((8 - weekday(t)) % 7) || 7); };

export default function Leads() {
  const enr = useTable<Enr>('atm_enrollments');
  const groups = useTable<Group>('lead_groups', { col: 'name', asc: true });
  const ready = useTable<Ready>('weekly_lead_readiness', { col: 'week_of', asc: false });
  const nm = nextMonday();
  const gName = (id: string) => groups.rows.find(g => g.id === id)?.name ?? '—';
  const notReady = groups.rows.filter(g => !ready.rows.some(r => r.lead_group_id === g.id && r.week_of === nm && r.status === 'Ready'));
  const wd = weekday(today());

  const readyFields: Field[] = [
    { key: 'lead_group_id', label: 'Group', type: 'select', options: groups.rows.map(g => ({ value: g.id, label: g.name })), required: true },
    { key: 'week_of', label: 'Week of (Monday)', type: 'date', required: true },
    { key: 'required_volume', label: 'Leads needed', type: 'number', hint: 'Blank until confirmed.' },
    { key: 'confirmed_volume', label: 'Leads confirmed', type: 'number' },
    { key: 'status', label: 'Status', type: 'select', options: ['Not Started', 'In Progress', 'Awaiting Confirmation', 'Ready', 'At Risk'], required: true },
    { key: 'outstanding_issues', label: 'What’s blocking', type: 'textarea' },
  ];

  return (
    <>
      <ModuleHead eyebrow="Operations" title="Agent Support & Leads"
        sub="The ATM free lead program and weekly volume leads for both groups. Nobody gets removed on an unverified deal notice."
        stats={[
          { n: enr.rows.filter(e => e.status === 'Request Received').length, l: 'Requests to review' },
          { n: enr.rows.filter(e => ['Added', 'Active'].includes(e.status)).length, l: 'In the program', tone: 'ok' },
          { n: enr.rows.filter(e => e.status === 'Deal Closed' && !e.closed_deal_verified).length, l: 'Deal notices to verify', tone: 'warn' },
          { n: enr.rows.filter(e => e.status === 'Removal Required').length, l: 'Removal queue', tone: 'crit' },
          { n: `${groups.rows.length - notReady.length}/${groups.rows.length}`, l: `Groups ready for ${fmtDate(nm)}` },
        ]} />
      {(wd === 4 || wd === 5) && notReady.length > 0 && (
        <div className="rb-warn" style={{ marginBottom: 16 }} role="status">
          Friday check: next week’s volume leads aren’t marked ready for {notReady.map(g => g.name).join(' and ')}.
        </div>
      )}
      <ModuleTabs id="leads" tabs={[
        { label: 'ATM free leads', body: (
          <RecordBoard t={enr} noun="enrollment" fields={enrFields} titleOf={e => e.agent_name}
            defaults={() => ({ status: 'Request Received', requested_at: today(), closed_deal_verified: false } as Partial<Enr>)}
            groups={[
              { label: 'Requests', filter: e => ['Request Received', 'Reviewed'].includes(e.status) },
              { label: 'In program', filter: e => ['Added', 'Active'].includes(e.status) },
              { label: 'Deal closed', filter: e => e.status === 'Deal Closed' },
              { label: 'Removal queue', filter: e => e.status === 'Removal Required' },
              { label: 'Completed', filter: e => e.status === 'Completed' },
            ]}
            validate={n => (n.status === 'Removal Required' || n.status === 'Completed') && !n.closed_deal_verified
              ? 'Verify the closed deal first. No removals based only on an unverified notice.' : null}
            warn={n => n.status === 'Deal Closed' && !n.closed_deal_verified ? 'Deal notice logged. Verify it before moving to removal.' : null}
            columns={[
              { label: 'Agent', key: 'agent_name' },
              { label: 'Status', render: e => <StatusPill s={e.status} /> },
              { label: 'Requested', key: 'requested_at' },
              { label: 'Added', key: 'added_at' },
              { label: 'Deal verified', render: e => e.closed_deal_verified ? <span className="pill ok">Verified</span> : e.status === 'Deal Closed' ? <span className="pill high">Not yet</span> : '—' },
            ]}
            empty="Nothing in this stage." />
        ) },
        { label: 'Weekly volume leads', body: groups.rows.length === 0 ? <div className="empty">Add your lead groups first (next tab).</div> : (
          <RecordBoard t={ready} noun="week" fields={readyFields} titleOf={r => `${gName(r.lead_group_id)} · ${r.week_of}`}
            defaults={() => ({ week_of: nm, status: 'Not Started', lead_group_id: notReady[0]?.id ?? groups.rows[0]?.id } as Partial<Ready>)}
            validate={(n, prev) => {
              if (n.week_of && weekday(String(n.week_of)) !== 1) return 'Week of has to be a Monday.';
              const dup = ready.rows.find(r => r.id !== prev?.id && r.lead_group_id === n.lead_group_id && r.week_of === n.week_of);
              return dup ? 'That group already has an entry for that week.' : null;
            }}
            groups={[{ label: 'Next week', filter: r => r.week_of === nm }, { label: 'All weeks', filter: () => true }]}
            columns={[
              { label: 'Group', render: r => gName(r.lead_group_id), className: 'tt' },
              { label: 'Week of', key: 'week_of' },
              { label: 'Needed', render: r => r.required_volume ?? <span className="pill conf">Confirm</span> },
              { label: 'Confirmed', render: r => r.confirmed_volume ?? '—' },
              { label: 'Status', render: r => <StatusPill s={r.status} /> },
            ]}
            empty="Nothing logged for next week yet." />
        ) },
        { label: 'Lead groups', body: (
          <RecordBoard t={groups} noun="group" titleOf={g => g.name}
            fields={[{ key: 'name', label: 'Group name', required: true }, { key: 'responsible_contact', label: 'Who runs it' }, { key: 'notes', label: 'Notes', type: 'textarea' }]}
            columns={[{ label: 'Group', key: 'name' }, { label: 'Who runs it', key: 'responsible_contact' }, { label: 'Notes', key: 'notes' }]} />
        ) },
      ]} />
    </>
  );
}
