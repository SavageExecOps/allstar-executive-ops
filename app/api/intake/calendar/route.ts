import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';

// Google Calendar (Apps Script) → here. Mirrors Wylie's upcoming events into calendar_events.
// Same server env vars as the recruiting intake: SUPABASE_SERVICE_ROLE_KEY, INTAKE_SECRET, INTAKE_OWNER_EMAIL.
export const dynamic = 'force-dynamic';

const MAX_BODY = 600_000;
const MAX_EVENTS = 500;

function authorized(req: NextRequest) {
  const secret = process.env.INTAKE_SECRET ?? '';
  const given = req.headers.get('x-intake-key') ?? '';
  if (secret.length < 16 || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

type In = { id?: unknown; title?: unknown; start?: unknown; end?: unknown; allDay?: unknown; location?: unknown };
const iso = (v: unknown) => typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null;
const text = (v: unknown, n: number) => typeof v === 'string' ? v.trim().slice(0, n) : '';
const guessKind = (title: string, allDay: boolean) =>
  /\b(1[:\s-]?on[:\s-]?1|1:1|one[\s-]on[\s-]one)\b/i.test(title) ? 'One-on-one'
  : /podcast/i.test(title) ? 'Podcast'
  : /flight|travel|trip|hotel/i.test(title) ? 'Travel'
  : /lock[\s-]?in/i.test(title) ? 'Team lock-in'
  : allDay ? 'Event' : 'Meeting';

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !process.env.INTAKE_OWNER_EMAIL) return NextResponse.json({ ok: false, error: 'Intake is not configured on the server' }, { status: 503 });
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const raw = await req.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ ok: false, error: 'Payload too large' }, { status: 413 });
  let body: { from?: unknown; to?: unknown; events?: unknown };
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ ok: false, error: 'Body must be JSON' }, { status: 400 }); }
  const from = iso(body.from), to = iso(body.to);
  if (!from || !to || !Array.isArray(body.events)) return NextResponse.json({ ok: false, error: 'Needs from, to and events' }, { status: 400 });
  if (body.events.length > MAX_EVENTS) return NextResponse.json({ ok: false, error: `At most ${MAX_EVENTS} events` }, { status: 413 });

  const { data: ownerId, error: oErr } = await db.rpc('owner_id_for_email', { p_email: process.env.INTAKE_OWNER_EMAIL });
  if (oErr || !ownerId) return NextResponse.json({ ok: false, error: 'Owner account not found' }, { status: 500 });

  // Hidden in the app: "rule:<title words>" hides every event whose title contains them,
  // "hide:<event id>" hides one occurrence. Stored as source='hidden' rows; never synced over.
  const { data: marks } = await db.from('calendar_events').select('external_event_id').eq('owner_id', ownerId).eq('source', 'hidden');
  const rules: string[] = [], singles = new Set<string>();
  for (const m of marks ?? []) {
    const x = String(m.external_event_id ?? '');
    if (x.startsWith('rule:')) rules.push(x.slice(5));
    else if (x.startsWith('hide:')) singles.add(x.slice(5));
  }
  const hidden = (id: string, title: string) => singles.has(id) || rules.some(r => r && title.toLowerCase().includes(r));

  const events = (body.events as In[]).map(e => {
    const allDay = e.allDay === true;
    const title = text(e.title, 300) || '(No title)';
    return { id: text(e.id, 300), title, starts_at: iso(e.start), ends_at: iso(e.end), all_day: allDay, location: text(e.location, 300) || null };
  }).filter(e => e.id && e.starts_at && e.ends_at && e.ends_at > e.starts_at! && !hidden(e.id, e.title));

  // What we already have from Google in this window (kind, notes and wins you set are kept).
  const { data: have, error: hErr } = await db.from('calendar_events').select('id,external_event_id,title,starts_at,ends_at,all_day,location')
    .eq('owner_id', ownerId).eq('source', 'google').lt('starts_at', to).gt('ends_at', from);
  if (hErr) return NextResponse.json({ ok: false, error: hErr.message }, { status: 500 });
  const byExt = new Map((have ?? []).map(h => [h.external_event_id as string, h]));

  let added = 0, updated = 0, removed = 0;
  const fresh = events.filter(e => !byExt.has(e.id));
  if (fresh.length) {
    const { error } = await db.from('calendar_events').upsert(fresh.map(e => ({
      owner_id: ownerId, external_event_id: e.id, source: 'google', title: e.title, starts_at: e.starts_at, ends_at: e.ends_at,
      all_day: e.all_day, location: e.location, kind: guessKind(e.title, e.all_day), confirmed: true,
    })), { onConflict: 'owner_id,external_event_id' });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    added = fresh.length;
  }
  for (const e of events) {
    const h = byExt.get(e.id);
    if (!h) continue;
    if (h.title === e.title && Date.parse(h.starts_at) === Date.parse(e.starts_at!) && Date.parse(h.ends_at) === Date.parse(e.ends_at!) && h.all_day === e.all_day && (h.location ?? null) === e.location) continue;
    const { error } = await db.from('calendar_events').update({ title: e.title, starts_at: e.starts_at, ends_at: e.ends_at, all_day: e.all_day, location: e.location }).eq('id', h.id);
    if (!error) updated++;
  }
  // Gone from Google (cancelled or moved out of the window) → gone here.
  const keep = new Set(events.map(e => e.id));
  const gone = (have ?? []).filter(h => !keep.has(h.external_event_id as string) && h.starts_at >= from).map(h => h.id);
  if (gone.length) {
    const { error } = await db.from('calendar_events').delete().in('id', gone);
    if (!error) removed = gone.length;
  }
  return NextResponse.json({ ok: true, added, updated, removed });
}
