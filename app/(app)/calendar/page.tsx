'use client';

import { ModuleHead, RecordBoard, StatusPill, type Field } from '@/components/RecordBoard';
import { ModuleTabs } from '@/components/ModuleTabs';
import { useTable, type Row } from '@/lib/useTable';
import { addDays, ctNow, today, TZ } from '@/lib/time';

type Req = Row & { requested_by: string | null; purpose: string; priority: string; status: string; notes: string | null; created_at: string };
type Ev = Row & {
  title: string; kind: string; starts_at: string; ends_at: string; confirmed: boolean;
  wins: string | null; bottlenecks: string | null; notes: string | null;
  source?: string; all_day?: boolean; location?: string | null; updated_at?: string;
};

const REQ_STATUS = ['Requested', 'Awaiting Availability', 'Proposed', 'Confirmed', 'Completed', 'Declined'] as const;
const KINDS = ['Meeting', 'One-on-one', 'Recurring', 'Travel', 'Event', 'Podcast', 'Team lock-in', 'Personal block'] as const;
const PRI = ['Critical', 'High', 'Normal', 'Low'];
const reqFields: Field[] = [
  { key: 'purpose', label: 'What it’s for', required: true, full: true, placeholder: 'One-on-one with Nathan, podcast, vendor call…' },
  { key: 'requested_by', label: 'Requested by' },
  { key: 'priority', label: 'Priority', type: 'select', options: PRI, required: true },
  { key: 'status', label: 'Status', type: 'select', options: REQ_STATUS, required: true },
  { key: 'notes', label: 'Notes (times offered, constraints)', type: 'textarea' },
];
const evFields: Field[] = [
  { key: 'title', label: 'Title', required: true, full: true, hint: 'Events from Google update themselves; your type, notes and wins are kept.' },
  { key: 'kind', label: 'Type', type: 'select', options: KINDS, required: true },
  { key: 'confirmed', label: 'Confirmed with everyone', type: 'bool' },
  { key: 'starts_at', label: 'Starts (CT)', type: 'datetime', required: true },
  { key: 'ends_at', label: 'Ends (CT)', type: 'datetime', required: true },
  { key: 'wins', label: 'Wins (one-on-ones)', type: 'textarea' },
  { key: 'bottlenecks', label: 'Bottlenecks', type: 'textarea' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

const ctDay = (iso: string) => ctNow(new Date(iso)).iso;
/** Last day an event touches (all-day events end at midnight of the next day). */
const endDay = (e: Ev) => ctDay(new Date(Date.parse(e.ends_at) - 1).toISOString());
const ctWeekday = (iso: string) => new Date(ctDay(iso) + 'T12:00:00Z').getUTCDay();
const when = (e: Ev) => e.all_day
  ? `${new Date(ctDay(e.starts_at) + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })} · All day`
  : new Date(e.starts_at).toLocaleString('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function Calendar() {
  const reqs = useTable<Req>('scheduling_requests');
  const evs = useTable<Ev>('calendar_events', { col: 'starts_at', asc: true });
  const t = today();
  const weekEnd = addDays(t, 7);
  const isToday = (e: Ev) => ctDay(e.starts_at) <= t && endDay(e) >= t;
  const next7 = evs.rows.filter(e => ctDay(e.starts_at) >= t && ctDay(e.starts_at) < weekEnd);
  const openReqs = reqs.rows.filter(r => !['Completed', 'Declined'].includes(r.status));
  const google = evs.rows.filter(e => e.source === 'google');
  const last = google.reduce((m, e) => (e.updated_at ?? '') > m ? e.updated_at ?? '' : m, '');
  const lastSync = last ? new Date(last).toLocaleString('en-US', { timeZone: TZ, weekday: 'short', hour: 'numeric', minute: '2-digit' }) : '';

  return (
    <>
      <ModuleHead eyebrow="Operations" title="Wylie’s Calendar"
        sub={google.length
          ? `Wylie’s Google Calendar syncs here every 15 minutes (latest change ${lastSync}). Nothing on his calendar is changed from here.`
          : 'Wylie’s week and the scheduling requests you’re working. Connect his Google Calendar to fill the week in automatically (SETUP.md → Wylie’s calendar).'}
        stats={[
          { n: evs.rows.filter(isToday).length, l: 'Today' },
          { n: next7.length, l: 'Next 7 days' },
          { n: next7.filter(e => e.kind === 'One-on-one').length, l: 'One-on-ones this week' },
          { n: openReqs.length, l: 'Open requests', tone: openReqs.length ? 'warn' : '' },
        ]} />
      <ModuleTabs id="calendar" tabs={[
        { label: 'Wylie’s week', body: (
          <RecordBoard t={evs} noun="event" fields={evFields} titleOf={e => e.title}
            defaults={() => ({ kind: 'Meeting', confirmed: false, source: 'manual' } as Partial<Ev>)}
            groups={[
              { label: 'Today', filter: isToday },
              { label: 'Next 7 days', filter: e => ctDay(e.starts_at) >= t && ctDay(e.starts_at) < weekEnd },
              { label: 'Later', filter: e => ctDay(e.starts_at) >= weekEnd },
              { label: 'One-on-ones', filter: e => e.kind === 'One-on-one' && endDay(e) >= t },
              { label: 'Past', filter: e => endDay(e) < t },
            ]}
            validate={n => n.starts_at && n.ends_at && n.ends_at <= n.starts_at ? 'The end time has to be after the start time.' : null}
            warn={(n, all) => {
              const notes: string[] = [];
              if (n.kind === 'One-on-one' && n.starts_at && ctWeekday(n.starts_at) === 5) notes.push('Heads up: Wylie keeps Fridays free of one-on-ones.');
              if (n.starts_at && n.ends_at && !n.all_day) {
                const clash = all.find(e => !e.all_day && e.starts_at < n.ends_at! && n.starts_at! < e.ends_at);
                if (clash) notes.push(`Overlaps with “${clash.title}”.`);
              }
              return notes.join(' ') || null;
            }}
            columns={[
              { label: 'When', render: when },
              { label: 'What', className: 'tt', render: e => <>{e.title}{e.location && <span className="hint" style={{ display: 'block', margin: 0 }}>{e.location}</span>}</> },
              { label: 'Type', key: 'kind' },
              { label: 'Status', render: e => e.source === 'google' ? <span className="pill">From Google</span> : e.confirmed ? <span className="pill ok">Confirmed</span> : <span className="pill conf">Not confirmed</span> },
            ]}
            empty="Nothing here." />
        ) },
        { label: 'Requests', body: (
          <RecordBoard t={reqs} noun="request" fields={reqFields} titleOf={r => r.purpose}
            defaults={{ status: 'Requested', priority: 'Normal' } as Partial<Req>}
            groups={[
              { label: 'Open', filter: r => !['Completed', 'Declined'].includes(r.status) },
              { label: 'Confirmed', filter: r => r.status === 'Confirmed' },
              { label: 'Done', filter: r => ['Completed', 'Declined'].includes(r.status) },
            ]}
            sort={(a, b) => PRI.indexOf(a.priority) - PRI.indexOf(b.priority)}
            columns={[
              { label: 'Request', key: 'purpose' },
              { label: 'From', key: 'requested_by' },
              { label: 'Priority', render: r => <StatusPill s={r.priority === 'Normal' ? null : r.priority} /> },
              { label: 'Status', render: r => <StatusPill s={r.status} /> },
            ]}
            empty="No open requests. When someone asks for time with Wylie, log it here." />
        ) },
      ]} />
    </>
  );
}
