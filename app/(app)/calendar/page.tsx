'use client';

import { ModuleHead, RecordBoard, StatusPill, show, type Field } from '@/components/RecordBoard';
import { ModuleTabs } from '@/components/ModuleTabs';
import { useTable, type Row } from '@/lib/useTable';
import { addDays, ctNow, today } from '@/lib/time';

type Req = Row & { requested_by: string | null; purpose: string; priority: string; status: string; notes: string | null; created_at: string };
type Ev = Row & { title: string; kind: string; starts_at: string; ends_at: string; confirmed: boolean; wins: string | null; bottlenecks: string | null; notes: string | null };

const REQ_STATUS = ['Requested', 'Awaiting Availability', 'Proposed', 'Confirmed', 'Completed', 'Declined'] as const;
const KINDS = ['Meeting', 'One-on-one', 'Recurring', 'Travel', 'Event', 'Podcast', 'Team lock-in', 'Personal block'] as const;
const reqFields: Field[] = [
  { key: 'purpose', label: 'What it’s for', required: true, full: true, placeholder: 'One-on-one with Nathan, podcast, vendor call…' },
  { key: 'requested_by', label: 'Requested by' },
  { key: 'priority', label: 'Priority', type: 'select', options: ['Critical', 'High', 'Normal', 'Low'], required: true },
  { key: 'status', label: 'Status', type: 'select', options: REQ_STATUS, required: true },
  { key: 'notes', label: 'Notes (times offered, constraints)', type: 'textarea' },
];
const evFields: Field[] = [
  { key: 'title', label: 'Title', required: true, full: true },
  { key: 'kind', label: 'Type', type: 'select', options: KINDS, required: true },
  { key: 'confirmed', label: 'Confirmed with everyone', type: 'bool' },
  { key: 'starts_at', label: 'Starts (CT)', type: 'datetime', required: true },
  { key: 'ends_at', label: 'Ends (CT)', type: 'datetime', required: true },
  { key: 'wins', label: 'Wins (one-on-ones)', type: 'textarea' },
  { key: 'bottlenecks', label: 'Bottlenecks', type: 'textarea' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];
const ctDay = (iso: string) => ctNow(new Date(iso)).iso;
const ctWeekday = (iso: string) => new Date(ctDay(iso) + 'T12:00:00Z').getUTCDay();

export default function Calendar() {
  const reqs = useTable<Req>('scheduling_requests');
  const evs = useTable<Ev>('calendar_events', { col: 'starts_at', asc: true });
  const t = today();
  const weekEnd = addDays(t, 7);
  const upcoming = evs.rows.filter(e => ctDay(e.starts_at) >= t);
  const thisWeek = upcoming.filter(e => ctDay(e.starts_at) < weekEnd);
  const openReqs = reqs.rows.filter(r => !['Completed', 'Declined'].includes(r.status));

  return (
    <>
      <ModuleHead eyebrow="Operations" title="Wylie’s Calendar"
        sub="Every scheduling request from ask to confirmed, plus Wylie’s week. Nothing gets booked from here; this is your tracker."
        stats={[
          { n: openReqs.length, l: 'Open requests' },
          { n: openReqs.filter(r => r.status === 'Awaiting Availability').length, l: 'Waiting on availability', tone: 'warn' },
          { n: thisWeek.length, l: 'On the calendar next 7 days' },
          { n: thisWeek.filter(e => !e.confirmed).length, l: 'Not confirmed yet', tone: thisWeek.some(e => !e.confirmed) ? 'crit' : '' },
        ]} />
      <ModuleTabs id="calendar" tabs={[
        { label: 'Requests', body: (
          <RecordBoard t={reqs} noun="request" fields={reqFields} titleOf={r => r.purpose}
            defaults={{ status: 'Requested', priority: 'Normal' } as Partial<Req>}
            groups={[
              { label: 'Open', filter: r => !['Completed', 'Declined'].includes(r.status) },
              { label: 'Confirmed', filter: r => r.status === 'Confirmed' },
              { label: 'Done', filter: r => ['Completed', 'Declined'].includes(r.status) },
            ]}
            sort={(a, b) => ['Critical', 'High', 'Normal', 'Low'].indexOf(a.priority) - ['Critical', 'High', 'Normal', 'Low'].indexOf(b.priority)}
            columns={[
              { label: 'Request', key: 'purpose' },
              { label: 'From', key: 'requested_by' },
              { label: 'Priority', render: r => <StatusPill s={r.priority === 'Normal' ? null : r.priority} /> },
              { label: 'Status', render: r => <StatusPill s={r.status} /> },
            ]}
            empty="No open requests. When someone asks for time with Wylie, log it here." />
        ) },
        { label: 'Wylie’s week', body: (
          <RecordBoard t={evs} noun="event" fields={evFields} titleOf={e => e.title}
            defaults={() => ({ kind: 'Meeting', confirmed: false } as Partial<Ev>)}
            groups={[
              { label: 'Upcoming', filter: e => ctDay(e.ends_at) >= t },
              { label: 'One-on-ones', filter: e => e.kind === 'One-on-one' },
              { label: 'Past', filter: e => ctDay(e.ends_at) < t },
            ]}
            validate={n => n.starts_at && n.ends_at && n.ends_at <= n.starts_at ? 'The end time has to be after the start time.' : null}
            warn={(n, all) => {
              const notes: string[] = [];
              if (n.kind === 'One-on-one' && n.starts_at && ctWeekday(n.starts_at) === 5) notes.push('Heads up: Wylie keeps Fridays free of one-on-ones.');
              if (n.starts_at && n.ends_at) {
                const clash = all.find(e => e.starts_at < n.ends_at! && n.starts_at! < e.ends_at);
                if (clash) notes.push(`Overlaps with “${clash.title}”.`);
              }
              return notes.join(' ') || null;
            }}
            columns={[
              { label: 'When', render: e => show({ key: '', label: '', type: 'datetime' }, e.starts_at) },
              { label: 'What', key: 'title', className: 'tt' },
              { label: 'Type', key: 'kind' },
              { label: 'Confirmed', render: e => e.confirmed ? <span className="pill ok">Confirmed</span> : <span className="pill conf">Not yet</span> },
            ]}
            empty="Nothing on Wylie’s calendar here yet." />
        ) },
      ]} />
    </>
  );
}
