'use client';

import { ModuleHead, RecordBoard, StatusPill, type Field } from '@/components/RecordBoard';
import { useData } from '@/components/DataProvider';
import { ModuleTabs } from '@/components/ModuleTabs';
import { useTable, type Row } from '@/lib/useTable';
import { addDays, ctNow, today, TZ } from '@/lib/time';

type Req = Row & { requested_by: string | null; purpose: string; priority: string; status: string; notes: string | null; created_at: string };
type Ev = Row & {
  title: string; kind: string; starts_at: string; ends_at: string; confirmed: boolean;
  wins: string | null; bottlenecks: string | null; notes: string | null;
  source?: string; all_day?: boolean; location?: string | null; updated_at?: string; external_event_id?: string | null;
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
  const { toast } = useData();
  const reqs = useTable<Req>('scheduling_requests');
  const evs = useTable<Ev>('calendar_events', { col: 'starts_at', asc: true });
  // Hidden markers live in the same table (source='hidden') so the sync can skip them.
  const marks = evs.rows.filter(e => e.source === 'hidden');
  const shown = (e: Ev) => e.source !== 'hidden';
  const rules = marks.filter(m => m.external_event_id?.startsWith('rule:'));

  async function hideAll(e: Ev) {
    const key = e.title.trim().toLowerCase();
    const ok = rules.some(r => r.external_event_id === `rule:${key}`) || await evs.create({ source: 'hidden', external_event_id: `rule:${key}`, title: e.title.trim(), kind: 'Personal block',
      starts_at: '2000-01-01T00:00:00Z', ends_at: '2000-01-01T00:01:00Z', confirmed: false } as Partial<Ev>);
    if (!ok) return;
    const same = evs.rows.filter(x => x.source === 'google' && x.title.toLowerCase().includes(key));
    if (same.length) await evs.supabase.from('calendar_events').delete().in('id', same.map(x => x.id));
    await evs.reload();
    toast(`Hidden: every “${e.title.trim()}”`);
  }
  async function hideOne(e: Ev) {
    if (e.external_event_id && await evs.create({ source: 'hidden', external_event_id: `hide:${e.external_event_id}`, title: e.title, kind: 'Personal block',
      starts_at: '2000-01-01T00:00:00Z', ends_at: '2000-01-01T00:01:00Z', confirmed: false } as Partial<Ev>)) {
      await evs.remove(e.id);
      toast('Hidden');
    }
  }
  async function unhide(m: Ev) {
    if (await evs.remove(m.id)) toast('Unhidden. It comes back on the next sync (within 15 minutes).');
  }
  const t = today();
  const weekEnd = addDays(t, 7);
  const isToday = (e: Ev) => shown(e) && ctDay(e.starts_at) <= t && endDay(e) >= t;
  const next7 = evs.rows.filter(e => shown(e) && ctDay(e.starts_at) >= t && ctDay(e.starts_at) < weekEnd);
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
              { label: 'Next 7 days', filter: e => shown(e) && ctDay(e.starts_at) >= t && ctDay(e.starts_at) < weekEnd },
              { label: 'Later', filter: e => shown(e) && ctDay(e.starts_at) >= weekEnd },
              { label: 'One-on-ones', filter: e => shown(e) && e.kind === 'One-on-one' && endDay(e) >= t },
              { label: 'Past', filter: e => shown(e) && endDay(e) < t },
            ]}
            validate={n => n.starts_at && n.ends_at && n.ends_at <= n.starts_at ? 'The end time has to be after the start time.' : null}
            warn={(n, all) => {
              const notes: string[] = [];
              if (n.kind === 'One-on-one' && n.starts_at && ctWeekday(n.starts_at) === 5) notes.push('Heads up: Wylie keeps Fridays free of one-on-ones.');
              if (n.starts_at && n.ends_at && !n.all_day) {
                const clash = all.find(e => shown(e) && !e.all_day && e.starts_at < n.ends_at! && n.starts_at! < e.ends_at);
                if (clash) notes.push(`Overlaps with “${clash.title}”.`);
              }
              return notes.join(' ') || null;
            }}
            columns={[
              { label: 'When', render: when },
              { label: 'What', className: 'tt', render: e => <>{e.title}{e.location && <span className="hint" style={{ display: 'block', margin: 0 }}>{e.location}</span>}</> },
              { label: 'Type', key: 'kind' },
              { label: 'Status', render: e => e.source === 'google' ? <span className="pill">From Google</span> : e.confirmed ? <span className="pill ok">Confirmed</span> : <span className="pill conf">Not confirmed</span> },
              { label: '', className: 'rb-act', render: e => e.source === 'google'
                ? <button className="btn sm ghost" title={`Hide every “${e.title}”`} aria-label={`Hide every ${e.title}`} onClick={ev => { ev.stopPropagation(); hideAll(e); }}>Hide</button> : null },
            ]}
            extra={e => e.source === 'google' ? (
              <div className="subrec">
                <label className="eyebrow" style={{ margin: 0 }}>Don’t need to see this?</label>
                <div className="toolbar" style={{ margin: 0 }}>
                  <button type="button" className="btn sm" onClick={() => hideAll(e)}>Hide every “{e.title}”</button>
                  <button type="button" className="btn sm ghost" onClick={() => hideOne(e)}>Hide just this one</button>
                </div>
                <span className="hint" style={{ margin: 0 }}>Only hides it here. Wylie’s calendar isn’t touched. Undo any time under Hidden.</span>
              </div>
            ) : null}
            empty="Nothing here." />
        ) },
        { label: `Hidden${marks.length ? ` (${marks.length})` : ''}`, body: marks.length === 0 ? (
          <div className="empty">Nothing hidden. Click <b>Hide</b> on any Google event, like a daily devotion, to stop seeing it.</div>
        ) : (
          <div className="stack" style={{ gap: 0 }}>
            {[...rules, ...marks.filter(m => !rules.includes(m))].map(m => (
              <div key={m.id} className="sr hidden-row">
                <span>{m.external_event_id?.startsWith('rule:') ? <>Every event with <b>“{m.title}”</b></> : <>One “{m.title}”</>}</span>
                <button className="btn sm ghost" onClick={() => unhide(m)}>Unhide</button>
              </div>
            ))}
          </div>
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
