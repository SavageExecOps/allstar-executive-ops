'use client';

import { useEffect, useMemo, useState } from 'react';
import { useOps } from './OpsData';
import { useData } from './DataProvider';
import { ASSIGN_REASONS, DISQUALIFY_REASONS, LICENSED, RECRUIT_STATUSES, STATUS_LABEL, introMessage, rotation, suggestFor, type Recruit, type RecruitNote } from '@/lib/recruiting';
import { fmtStamp, TZ } from '@/lib/time';

/** "2026-10-16T13:00" in Central Time for a datetime-local input. */
export function toLocalInput(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(d).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${String(Number(p.hour) % 24).padStart(2, '0')}:${p.minute}`;
}
/** Interpret a datetime-local value as Central Time. */
export function fromLocalInput(v: string) {
  if (!v) return null;
  const guess = new Date(v + ':00Z');
  // Find the Central offset at that moment and correct for it.
  const asCt = new Date(guess.toLocaleString('en-US', { timeZone: TZ }));
  const asUtc = new Date(guess.toLocaleString('en-US', { timeZone: 'UTC' }));
  return new Date(guess.getTime() + (asUtc.getTime() - asCt.getTime())).toISOString();
}
export const fmtAppt = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const orNull = (s: string) => (s.trim() ? s.trim() : null);

export function RecruitDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { recruits, managers, assignments, updateRecruit, deleteRecruit, assign, loadNotes, addNote } = useOps();
  const { toast } = useData();
  const r = recruits.find(x => x.id === id);
  const [f, setF] = useState<Recruit | null>(r ?? null);
  const [notes, setNotes] = useState<RecruitNote[]>([]);
  const [draft, setDraft] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const suggestion = useMemo(() => (f ? suggestFor(f, managers, assignments) : null), [f, managers, assignments]);
  const upNext = rotation(managers, assignments)[0];
  const [pick, setPick] = useState('');
  const [reason, setReason] = useState<string>('Round robin');
  const [dqOpen, setDqOpen] = useState(false);
  const [dqReason, setDqReason] = useState<string>('Not in the U.S.');

  useEffect(() => { loadNotes(id).then(setNotes); }, [id, loadNotes]);
  useEffect(() => { if (r) setF(cur => cur && cur.id === r.id ? { ...cur, status: r.status, manager_id: r.manager_id, group_chat_confirmed: r.group_chat_confirmed, handed_off_at: r.handed_off_at, us_based: r.us_based, other_agency: r.other_agency, other_agency_name: r.other_agency_name, disqualify_reason: r.disqualify_reason } : r); }, [r]);
  useEffect(() => { if (suggestion && !pick) { setPick(suggestion.manager.id); setReason(suggestion.reason); } }, [suggestion, pick]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  if (!r || !f) return null;

  const set = <K extends keyof Recruit>(k: K, v: Recruit[K]) => setF({ ...f, [k]: v });
  const mgr = managers.find(m => m.id === r.manager_id);
  const history = assignments.filter(a => a.recruit_id === r.id);

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (!f || !r) return;
    const ok = await updateRecruit(r.id, {
      name: f.name.trim() || r.name, phone: orNull(f.phone ?? ''), email: orNull(f.email ?? ''), source: orNull(f.source ?? ''),
      location: orNull(f.location ?? ''), age: f.age, licensed: f.licensed, status: f.status, appointment_at: f.appointment_at,
      follow_up_date: f.follow_up_date || null, next_action: orNull(f.next_action ?? ''),
      other_agency_name: orNull(f.other_agency_name ?? ''),
    });
    if (ok) { toast('Saved'); onClose(); }
  }

  async function doAssign() {
    if (!pick || !r) return;
    const wasUpNext = pick === upNext?.id;
    const why = wasUpNext && reason !== 'Age 30+' ? 'Round robin' : reason === 'Round robin' ? 'Other' : reason;
    if (await assign({ ...r, age: f?.age ?? r.age }, pick, why, wasUpNext)) toast(`Assigned to ${managers.find(m => m.id === pick)?.name}`);
  }

  async function saveNote() {
    const body = draft.trim(); if (!body) return;
    const n = await addNote(id, body);
    if (n) { setNotes([n, ...notes]); setDraft(''); toast('Note saved'); }
  }

  async function setQual(patch: Partial<Recruit>) {
    if (!r) return;
    setF(cur => cur ? { ...cur, ...patch } : cur);
    await updateRecruit(r.id, patch);
  }
  async function qualify() {
    if (!r) return;
    if (await updateRecruit(r.id, { status: 'Call Completed', disqualify_reason: null, us_based: f?.us_based === 'Unknown' ? 'Yes' : f?.us_based, other_agency: f?.other_agency === 'Unknown' ? 'No' : f?.other_agency }))
      toast('Qualified. Ready for a manager.');
  }
  async function disqualify(why: string) {
    if (!r) return;
    const status = why === 'Not interested' ? 'Not Interested' : why.startsWith('Didn') ? 'No Show' : 'Not Qualified';
    if (await updateRecruit(r.id, { status, disqualify_reason: why })) { toast(status === 'No Show' ? 'Marked no-show' : 'Marked not qualified'); setDqOpen(false); }
  }
  const qualifiable = ['New', 'Scheduled', 'No Show', 'Reschedule', 'Follow-up Needed'].includes(r.status);
  const answers = Object.entries(r.form_answers ?? {});

  const intro = mgr ? introMessage(r, mgr, notes[0]?.body) : '';
  async function copyIntro() {
    try { await navigator.clipboard.writeText(intro); toast('Intro copied'); }
    catch { toast('Couldn’t copy. Select the text and copy it.'); }
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer drawer-wide" role="dialog" aria-label={`Recruit ${r.name}`}>
        <header><span className="eyebrow" style={{ margin: 0 }}>Recruit · {STATUS_LABEL[r.status]}</span><button className="btn sm ghost" onClick={onClose}>Close</button></header>
        <form className="body" id="rf" onSubmit={save}>
          <div className="field"><label htmlFor="r-name">Name</label><input type="text" id="r-name" value={f.name} onChange={e => set('name', e.target.value)} required /></div>
          <div className="row2">
            <div className="field"><label htmlFor="r-phone">Phone</label><input type="text" id="r-phone" inputMode="tel" value={f.phone ?? ''} onChange={e => set('phone', e.target.value)} /></div>
            <div className="field"><label htmlFor="r-email">Email</label><input type="text" id="r-email" inputMode="email" value={f.email ?? ''} onChange={e => set('email', e.target.value)} /></div>
          </div>
          <div className="row2">
            <div className="field"><label htmlFor="r-loc">Location</label><input type="text" id="r-loc" placeholder="City, State" value={f.location ?? ''} onChange={e => set('location', e.target.value)} /></div>
            <div className="field"><label htmlFor="r-age">Age</label><input type="text" id="r-age" inputMode="numeric" value={f.age ?? ''} onChange={e => { const n = parseInt(e.target.value, 10); set('age', Number.isFinite(n) ? n : null); }} /></div>
          </div>
          <div className="row2">
            <div className="field"><label htmlFor="r-appt">Call booked for (CT)</label><input type="datetime-local" id="r-appt" value={toLocalInput(f.appointment_at)} onChange={e => set('appointment_at', fromLocalInput(e.target.value))} /></div>
            <div className="field"><label htmlFor="r-status">Stage</label><select id="r-status" value={f.status} onChange={e => set('status', e.target.value as Recruit['status'])}>{RECRUIT_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></div>
          </div>
          <div className="row2">
            <div className="field"><label htmlFor="r-src">Source</label><input type="text" id="r-src" value={f.source ?? ''} onChange={e => set('source', e.target.value)} /></div>
            <div className="field"><label htmlFor="r-fu">Follow up</label><input type="date" id="r-fu" value={f.follow_up_date ?? ''} onChange={e => set('follow_up_date', e.target.value || null)} /></div>
          </div>
          <div className="field"><label htmlFor="r-next">Next action</label><input type="text" id="r-next" value={f.next_action ?? ''} onChange={e => set('next_action', e.target.value)} /></div>

          <section className="rsec">
            <h3 className="rsec-h">Qualify</h3>
            <div className="qual">
              <div className="qual-row"><span>Based in the U.S.?</span>
                <div className="seg">{(['Yes', 'No'] as const).map(v => <button type="button" key={v} className={f.us_based === v ? 'on' : ''} onClick={() => setQual({ us_based: f.us_based === v ? 'Unknown' : v })}>{v}</button>)}</div></div>
              <div className="qual-row"><span>With another agency?</span>
                <div className="seg">{(['Yes', 'No'] as const).map(v => <button type="button" key={v} className={f.other_agency === v ? 'on' : ''} onClick={() => setQual({ other_agency: f.other_agency === v ? 'Unknown' : v })}>{v}</button>)}</div></div>
              {f.other_agency === 'Yes' && <input type="text" aria-label="Which agency" placeholder="Which agency? e.g. another FFL agency" value={f.other_agency_name ?? ''} onChange={e => set('other_agency_name', e.target.value)} onBlur={() => setQual({ other_agency_name: orNull(f.other_agency_name ?? '') })} />}
              <div className="qual-row"><span>Licensed?</span>
                <select aria-label="Licensed" value={f.licensed} onChange={e => setQual({ licensed: e.target.value as Recruit['licensed'] })}>{LICENSED.map(x => <option key={x}>{x}</option>)}</select></div>
            </div>
            {(f.us_based === 'No' || f.other_agency === 'Yes') && r.status !== 'Not Qualified' && (
              <p className="qual-warn">{f.us_based === 'No' ? 'Outside the U.S., so we can’t hire him.' : 'Already with another agency.'} <button type="button" className="link" onClick={() => disqualify(f.us_based === 'No' ? 'Not in the U.S.' : 'With another agency')}>Mark not qualified</button></p>
            )}
            {qualifiable && (
              <div className="qa" style={{ marginTop: 10 }}>
                <button type="button" className="btn gold" onClick={qualify} disabled={f.us_based === 'No' || f.other_agency === 'Yes'}>Qualified → ready for a manager</button>
                <button type="button" className="btn" onClick={() => disqualify('Didn’t show / no response')}>No show</button>
                <button type="button" className="btn ghost" onClick={() => setDqOpen(o => !o)}>Not qualified…</button>
              </div>
            )}
            {dqOpen && (
              <div className="toolbar" style={{ margin: '10px 0 0' }}>
                <select aria-label="Reason" value={dqReason} onChange={e => setDqReason(e.target.value)}>{DISQUALIFY_REASONS.map(x => <option key={x}>{x}</option>)}</select>
                <button type="button" className="btn sm" style={{ borderColor: 'var(--crit)', color: 'var(--crit)' }} onClick={() => disqualify(dqReason)}>Confirm not qualified</button>
              </div>
            )}
            {r.disqualify_reason && ['Not Qualified', 'Not Interested', 'No Show'].includes(r.status) && <p className="hint">Closed out: {r.disqualify_reason}</p>}
            {answers.length > 0 && (
              <details className="answers"><summary>iClosed form answers ({answers.length})</summary>
                <dl className="kv">{answers.map(([q, a]) => <><dt key={q + 'q'}>{q}</dt><dd key={q + 'a'}>{a}</dd></>)}</dl>
              </details>
            )}
          </section>

          <section className="rsec">
            <h3 className="rsec-h">Call notes</h3>
            <textarea rows={6} value={draft} onChange={e => setDraft(e.target.value)} aria-label="New call note"
              placeholder="Dictate or paste: how the call went, licensed or not, goals, your read on him, who he'd click with…" />
            <div className="qa" style={{ marginTop: 8 }}><button type="button" className="btn sm primary" onClick={saveNote} disabled={!draft.trim()}>Save note</button></div>
            {notes.length > 0 && (
              <div className="rnotes">{notes.map(n => <div key={n.id} className="rnote"><time>{fmtStamp(n.created_at)}</time><p>{n.body}</p></div>)}</div>
            )}
          </section>

          <section className="rsec">
            <h3 className="rsec-h">Manager</h3>
            {mgr && <p className="rsec-now">With <b>{mgr.name}</b>{history[0] ? <> · {history[0].reason}{history[0].was_up_next ? '' : ' (override)'}</> : null}</p>}
            <div className="assign-row">
              <select aria-label="Manager" value={pick} onChange={e => { setPick(e.target.value); if (e.target.value !== upNext?.id && reason === 'Round robin') setReason('Location'); if (e.target.value === upNext?.id) setReason('Round robin'); }}>
                {managers.filter(m => m.active).map(m => (
                  <option key={m.id} value={m.id}>{m.name}{m.id === upNext?.id ? ' · up next' : ''}{m.specialty ? ` · ${m.specialty}` : ''}{!m.in_rotation && !m.specialty ? ' · not in rotation' : ''}</option>
                ))}
              </select>
              {pick !== upNext?.id && (
                <select aria-label="Reason" value={reason} onChange={e => setReason(e.target.value)}>
                  {ASSIGN_REASONS.filter(x => x !== 'Round robin').map(x => <option key={x}>{x}</option>)}
                </select>
              )}
              <button type="button" className="btn primary sm" onClick={doAssign}>{mgr ? 'Reassign' : 'Assign'}</button>
            </div>
            {suggestion && <p className="hint" style={{ marginTop: 6 }}>{suggestion.reason === 'Age 30+' ? `Over 30, so ${suggestion.manager.name} is suggested.` : `${suggestion.manager.name} is up next in the rotation.`}</p>}
            {mgr && (
              <div className="intro">
                <div className="intro-h"><span>Group chat intro</span><button type="button" className="btn sm" onClick={copyIntro}>Copy</button></div>
                <textarea readOnly rows={5} value={intro} aria-label="Intro message" onFocus={e => e.currentTarget.select()} />
                <div className="qa" style={{ marginTop: 8 }}>
                  <label className="check"><input type="checkbox" checked={r.group_chat_confirmed}
                    onChange={async e => { if (await updateRecruit(r.id, { group_chat_confirmed: e.target.checked, ...(e.target.checked && ['Manager Assigned'].includes(r.status) ? { status: 'Group Chat Created' } : {}) })) toast(e.target.checked ? 'Group chat marked created' : 'Unmarked'); }} />
                    Group chat created</label>
                  {r.status !== 'Handed Off' && <button type="button" className="btn sm" onClick={async () => { if (await updateRecruit(r.id, { status: 'Handed Off', handed_off_at: new Date().toISOString() })) toast('Handed off'); }}>Mark handed off</button>}
                </div>
              </div>
            )}
          </section>

          {mgr && (
            <section className="rsec"><h3 className="rsec-h">Outcome</h3>
              <p className="hint" style={{ marginTop: 0 }}>Fill these in when you hear back from the manager. They feed your Scorecard.</p>
              <div className="row2">
                <div className="field"><label htmlFor="r-contracted">Contracted on</label>
                  <input type="date" id="r-contracted" value={r.contracted_at ?? ''} onChange={async e => { if (await updateRecruit(r.id, { contracted_at: e.target.value || null })) toast(e.target.value ? 'Marked contracted' : 'Cleared'); }} /></div>
                <div className="field"><label htmlFor="r-producing">First production on</label>
                  <input type="date" id="r-producing" value={r.producing_at ?? ''} onChange={async e => { if (await updateRecruit(r.id, { producing_at: e.target.value || null })) toast(e.target.value ? 'Marked producing' : 'Cleared'); }} /></div>
              </div>
            </section>
          )}

          {history.length > 1 && (
            <section className="rsec"><h3 className="rsec-h">Assignment history</h3>
              <div className="activity">{history.map(a => <div key={a.id}><time>{fmtStamp(a.assigned_at)}</time>{managers.find(m => m.id === a.manager_id)?.name ?? 'Removed manager'} · {a.reason}</div>)}</div>
            </section>
          )}

          <div>
            {!confirmDel ? <button type="button" className="link" style={{ color: 'var(--crit)' }} onClick={() => setConfirmDel(true)}>Delete recruit</button> : (
              <span className="check">Delete {r.name} and all notes?
                <button type="button" className="btn sm" style={{ borderColor: 'var(--crit)', color: 'var(--crit)' }} onClick={async () => { if (await deleteRecruit(r.id)) { toast('Recruit deleted'); onClose(); } }}>Delete</button>
                <button type="button" className="btn sm ghost" onClick={() => setConfirmDel(false)}>Keep</button>
              </span>
            )}
          </div>
        </form>
        <footer><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" form="rf">Save</button></footer>
      </aside>
    </>
  );
}
