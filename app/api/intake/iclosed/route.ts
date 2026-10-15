import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';

// iClosed → Zapier → here. Zapier's "Webhooks by Zapier · POST" step sends one booking event.
// Required server env vars (Vercel): SUPABASE_SERVICE_ROLE_KEY, INTAKE_SECRET, INTAKE_OWNER_EMAIL.
export const dynamic = 'force-dynamic';

const MAX_BODY = 64_000;
const norm = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, '');
const pick = (d: Record<string, string>, ...keys: string[]) => {
  for (const k of keys) { const v = d[norm(k)]; if (v && v.trim()) return v.trim(); }
  return '';
};
const KNOWN = new Set(['event', 'trigger', 'type', 'key', 'id', 'externalid', 'contactid', 'eventid', 'callid', 'name', 'fullname',
  'inviteefullname', 'firstname', 'lastname', 'email', 'inviteeemail', 'phone', 'phonenumber', 'calltime', 'starttime', 'start',
  'scheduledat', 'callstart', 'calldatetime', 'reason', 'cancelreason', 'reschedulereason'].map(norm));

function authorized(req: NextRequest) {
  const secret = process.env.INTAKE_SECRET ?? '';
  const given = req.headers.get('x-intake-key') ?? req.nextUrl.searchParams.get('key') ?? '';
  if (secret.length < 16 || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Setup check for the Settings page. Reveals nothing secret. */
export async function GET() {
  return NextResponse.json({
    configured: !!(process.env.SUPABASE_SERVICE_ROLE_KEY && (process.env.INTAKE_SECRET ?? '').length >= 16 && process.env.INTAKE_OWNER_EMAIL),
  });
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const db = admin();
  if (!db || !process.env.INTAKE_OWNER_EMAIL) return NextResponse.json({ ok: false, error: 'Intake is not configured on the server' }, { status: 503 });

  const raw = await req.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ ok: false, error: 'Payload too large' }, { status: 413 });
  let body: Record<string, unknown> = {};
  try {
    body = req.headers.get('content-type')?.includes('application/json') ? JSON.parse(raw)
      : Object.fromEntries(new URLSearchParams(raw));
  } catch { return NextResponse.json({ ok: false, error: 'Body must be JSON or form fields' }, { status: 400 }); }

  // Flatten to normalized string fields; everything unrecognized is kept as a form answer.
  const d: Record<string, string> = {};
  const answers: Record<string, string> = {};
  for (const [k, v] of Object.entries(body)) {
    const s = typeof v === 'string' ? v : v == null ? '' : JSON.stringify(v);
    d[norm(k)] = s.slice(0, 4000);
    if (!KNOWN.has(norm(k)) && s.trim()) answers[k.slice(0, 200)] = s.slice(0, 4000);
  }

  const evt = pick(d, 'event', 'trigger', 'type').toLowerCase();
  const kind = evt.includes('cancel') ? 'cancelled' : evt.includes('resched') ? 'rescheduled' : 'booked';
  const externalId = pick(d, 'external_id', 'contact_id', 'event_id', 'call_id', 'id') || null;
  const email = pick(d, 'email', 'invitee_email').toLowerCase() || null;
  const name = pick(d, 'name', 'full_name', 'invitee_full_name') || [pick(d, 'first_name'), pick(d, 'last_name')].filter(Boolean).join(' ') || email || 'New recruit';
  const phone = pick(d, 'phone', 'phone_number') || null;
  const when = pick(d, 'call_time', 'start_time', 'start', 'scheduled_at', 'call_start', 'call_datetime');
  const at = when && !Number.isNaN(Date.parse(when)) ? new Date(when).toISOString() : null;
  const reason = pick(d, 'reason', 'cancel_reason', 'reschedule_reason');

  const { data: ownerId, error: oErr } = await db.rpc('owner_id_for_email', { p_email: process.env.INTAKE_OWNER_EMAIL });
  if (oErr || !ownerId) return NextResponse.json({ ok: false, error: 'Owner account not found' }, { status: 500 });

  // Find the same person: by iClosed id first, then by email among open recruits.
  let existing: { id: string; status: string; phone: string | null; email: string | null; appointment_at: string | null } | null = null;
  if (externalId) {
    const r = await db.from('recruits').select('id,status,phone,email,appointment_at').eq('owner_id', ownerId).eq('external_id', externalId).maybeSingle();
    existing = r.data;
  }
  if (!existing && email) {
    const r = await db.from('recruits').select('id,status,phone,email,appointment_at').eq('owner_id', ownerId).ilike('email', email)
      .not('status', 'in', '("Handed Off","Not Interested","Not Qualified")').order('created_at', { ascending: false }).limit(1).maybeSingle();
    existing = r.data;
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/Chicago', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const reopen = ['New', 'Scheduled', 'No Show', 'Reschedule', 'Follow-up Needed'];
  let recruitId: string;
  let action: 'created' | 'booked' | 'rescheduled' | 'cancelled' | 'unchanged';

  if (existing) {
    recruitId = existing.id;
    const patch: Record<string, unknown> = {};
    if (!existing.phone && phone) patch.phone = phone;
    if (!existing.email && email) patch.email = email;
    if (externalId) patch.external_id = externalId;
    if (kind === 'cancelled') {
      if (['New', 'Scheduled'].includes(existing.status)) patch.status = 'Follow-up Needed';
      action = 'cancelled';
    } else {
      const sameTime = !!at && !!existing.appointment_at && Date.parse(existing.appointment_at) === Date.parse(at);
      const moved = !!at && !!existing.appointment_at && !sameTime;
      action = sameTime ? 'unchanged' : moved || kind === 'rescheduled' ? 'rescheduled' : 'booked';
      if (at) patch.appointment_at = at;
      if (reopen.includes(existing.status) && action !== 'unchanged') patch.status = 'Scheduled';
    }
    if (Object.keys(answers).length) patch.form_answers = answers;
    if (Object.keys(patch).length) {
      const { error } = await db.from('recruits').update(patch).eq('id', existing.id);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
  } else {
    const { data, error } = await db.from('recruits').insert({
      owner_id: ownerId, name: name.slice(0, 200), email, phone, source: 'iClosed', external_id: externalId,
      appointment_at: kind === 'cancelled' ? null : at, status: kind === 'cancelled' ? 'Follow-up Needed' : 'Scheduled',
      form_answers: answers,
    }).select('id').single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    recruitId = data.id; action = kind === 'cancelled' ? 'cancelled' : 'created';
  }

  if (action !== 'unchanged') {
    const lines = [
      action === 'cancelled' ? `Cancelled in iClosed.${reason ? ` Reason: ${reason}` : ''}`
        : action === 'rescheduled' ? `Rescheduled${at ? ` to ${fmt(at)} CT` : ''}.${reason ? ` Reason: ${reason}` : ''}`
        : `Booked through iClosed${at ? ` for ${fmt(at)} CT` : ''}.`,
      ...(action === 'created' ? Object.entries(answers).map(([q, a]) => `• ${q}: ${a}`) : []),
    ];
    await db.from('recruit_notes').insert({ owner_id: ownerId, recruit_id: recruitId, body: lines.join('\n') });
  }

  return NextResponse.json({ ok: true, action, recruit_id: recruitId });
}
