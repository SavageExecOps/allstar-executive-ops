'use client';

import { useEffect, useRef, useState } from 'react';
import { useOps } from '@/components/OpsData';
import { useData } from '@/components/DataProvider';
import { RecruitDrawer, fmtAppt, fromLocalInput } from '@/components/RecruitDrawer';
import { DmCounter, useDmLogs } from '@/components/DmCounter';
import { CLOSED, LANES, STATUS_LABEL, rotation, type Manager, type Recruit } from '@/lib/recruiting';
import { addDays, dayOf, fmtDate, today, weekday } from '@/lib/time';

const weekStart = () => { const t = today(); return addDays(t, -((weekday(t) + 6) % 7)); }; // Monday

export default function Recruiting() {
  const { opsReady, managers, recruits, assignments, createRecruit, createManager, updateManager } = useOps();
  const { toast } = useData();
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [editMgr, setEditMgr] = useState<Manager | 'new' | null>(null);
  const dm = useDmLogs();

  const order = rotation(managers, assignments);
  const upNext = order[0];
  const lastFor = (id: string) => assignments.find(a => a.manager_id === id)?.assigned_at;
  const ws = weekStart();
  const thisWeek = (iso: string | null) => !!iso && dayOf(iso) >= ws;
  const countSince = (id: string, days: number) => assignments.filter(a => a.manager_id === id && dayOf(a.assigned_at) >= addDays(today(), -days)).length;
  const senior = managers.find(m => /over 30|30\+/i.test(m.specialty ?? ''));

  const stats: [number, string][] = [
    [recruits.filter(r => ['New', 'Scheduled'].includes(r.status) && r.appointment_at && r.appointment_at >= new Date().toISOString()).length, 'calls booked ahead'],
    [recruits.filter(r => r.status === 'Call Completed').length, 'need a manager'],
    [assignments.filter(a => thisWeek(a.assigned_at)).length, 'assigned this week'],
    [recruits.filter(r => r.status === 'Handed Off' && thisWeek(r.handed_off_at)).length, 'handed off this week'],
  ];
  const closed = recruits.filter(r => CLOSED.includes(r.status));

  return (
    <>
      <div className="ph">
        <div>
          <div className="eyebrow">Two-stack · round robin</div>
          <h1>Recruiting</h1>
          <p className="sub">Book, talk, pair with a manager, hand off. Up next is whoever has gone longest without a recruit; override when location, vibe or age says otherwise.</p>
        </div>
        <div className="qa"><button className="btn primary" onClick={() => setAdding(true)}>New recruit</button></div>
      </div>

      <div style={{ marginBottom: 20 }}><DmCounter dm={dm} /></div>

      <div className="grid2" style={{ marginBottom: 20 }}>
        <section className="panel upnext">
          <div className="eyebrow">Up next</div>
          {!opsReady ? <div className="empty">Loading…</div> : upNext ? (
            <>
              <div className="upnext-name">{upNext.name}</div>
              <div className="meta">{upNext.location && <span>{upNext.location}</span>}<span>{lastFor(upNext.id) ? `Last recruit ${fmtDate(dayOf(lastFor(upNext.id)!))}` : 'No recruits yet'}</span></div>
              <ol className="upnext-order" aria-label="Rotation order">
                {order.slice(1).map(m => (
                  <li key={m.id}><span>{m.name}</span><span className="due">{countSince(m.id, 30)} in 30 days</span></li>
                ))}
              </ol>
              {senior && <p className="hint">Over 30 → {senior.name}. Not part of the rotation.</p>}
            </>
          ) : <div className="empty">No managers in the rotation. Add one below.</div>}
        </section>
        <section className="stat-grid">
          {stats.map(([n, l]) => <div key={l} className="stat"><span className="stat-n">{opsReady ? n : '–'}</span><span className="stat-l">{l}</span></div>)}
        </section>
      </div>

      <h2 className="sec" style={{ marginBottom: 12 }}>Pipeline</h2>
      <div className="lanes-wrap">
        <div className="lanes">
          {LANES.map(lane => {
            const items = recruits.filter(r => lane.statuses.includes(r.status))
              .sort((a, b) => (a.appointment_at ?? a.created_at).localeCompare(b.appointment_at ?? b.created_at));
            return (
              <section key={lane.key} className={`lane lane-${lane.key}`} aria-label={lane.label}>
                <header><span>{lane.label}</span><span className="n">{items.length}</span></header>
                {items.length === 0 ? <div className="lane-empty">{lane.key === 'booked' ? 'Add a recruit when a call gets booked.' : '—'}</div> :
                  items.map(r => <RecruitCard key={r.id} r={r} managers={managers} onOpen={() => setOpenId(r.id)} />)}
              </section>
            );
          })}
        </div>
      </div>
      <p className="hint">
        {closed.length} handed off or closed out. <button className="link" onClick={() => setShowClosed(s => !s)}>{showClosed ? 'Hide' : 'Show'}</button>
      </p>
      {showClosed && closed.length > 0 && (
        <section className="panel" style={{ marginTop: 8 }}>
          {(() => {
            const why = new Map<string, number>();
            closed.forEach(r => { const k = r.status === 'Handed Off' ? 'Handed off' : r.disqualify_reason || STATUS_LABEL[r.status]; why.set(k, (why.get(k) ?? 0) + 1); });
            return <div className="meta" style={{ marginBottom: 8 }}>{Array.from(why).sort((a, b) => b[1] - a[1]).map(([k, n]) => <span key={k} className="pill">{k} · {n}</span>)}</div>;
          })()}
          <div className="tlist">{closed.map(r => (
            <div key={r.id} className="trow" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
              <div style={{ minWidth: 0 }}><button className="ttitle" onClick={() => setOpenId(r.id)}>{r.name}</button>
                <div className="meta"><span>{STATUS_LABEL[r.status]}</span>{r.disqualify_reason && <span>{r.disqualify_reason}</span>}{r.manager_id && <span>{managers.find(m => m.id === r.manager_id)?.name}</span>}</div></div>
              <span className="due">{r.handed_off_at ? fmtDate(dayOf(r.handed_off_at)) : ''}</span>
            </div>))}
          </div>
        </section>
      )}

      <section style={{ marginTop: 28 }}>
        <div className="panel-h"><h2 className="sec">Managers</h2><button className="btn sm" onClick={() => setEditMgr('new')}>Add manager</button></div>
        <div className="panel scroll-x" style={{ padding: 0 }}>
          <table className="ttable">
            <thead><tr><th>Manager</th><th>Location</th><th>In rotation</th><th>Last 30 days</th><th>All time</th><th>Last recruit</th><th /></tr></thead>
            <tbody>
              {managers.filter(m => m.active).map(m => (
                <tr key={m.id}>
                  <td className="tt">{m.name}{m.id === upNext?.id && <span className="pill gold" style={{ marginLeft: 8 }}>Up next</span>}{m.specialty && <div className="hint" style={{ margin: 0 }}>{m.specialty}</div>}</td>
                  <td>{m.location || <button className="pill conf" style={{ cursor: 'pointer' }} onClick={() => setEditMgr(m)}>Add</button>}</td>
                  <td><label className="check"><input type="checkbox" checked={m.in_rotation} onChange={e => updateManager(m.id, { in_rotation: e.target.checked }).then(ok => ok && toast(e.target.checked ? `${m.name} added to rotation` : `${m.name} out of rotation`))} /><span className="sr-only">In rotation</span></label></td>
                  <td className="due">{countSince(m.id, 30)}</td>
                  <td className="due">{assignments.filter(a => a.manager_id === m.id).length}</td>
                  <td className="due">{lastFor(m.id) ? fmtDate(dayOf(lastFor(m.id)!)) : '—'}</td>
                  <td><button className="btn sm ghost" onClick={() => setEditMgr(m)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">Roster review with Wylie is on the For Wylie list.</p>
      </section>

      {openId && <RecruitDrawer id={openId} onClose={() => setOpenId(null)} />}
      {adding && <NewRecruit onClose={() => setAdding(false)} onCreated={id => { setAdding(false); setOpenId(id); }} create={createRecruit} />}
      {editMgr && <ManagerEditor m={editMgr === 'new' ? null : editMgr} onClose={() => setEditMgr(null)}
        onSave={async (vals) => {
          const ok = editMgr === 'new' ? await createManager({ ...vals, name: vals.name ?? '' }) : await updateManager(editMgr.id, vals);
          if (ok) { toast('Manager saved'); setEditMgr(null); }
        }} />}
    </>
  );
}

function RecruitCard({ r, managers, onOpen }: { r: Recruit; managers: Manager[]; onOpen: () => void }) {
  const m = managers.find(x => x.id === r.manager_id);
  return (
    <button className="rcard" onClick={onOpen}>
      <span className="rcard-name">{r.name}</span>
      {r.appointment_at && <span className="due">{fmtAppt(r.appointment_at)}</span>}
      <span className="meta" style={{ margin: 0 }}>
        {r.location && <span>{r.location}</span>}
        {r.age != null && <span>{r.age}</span>}
        {r.licensed !== 'Unknown' && <span className={`pill ${r.licensed === 'Licensed' ? 'ok' : ''}`}>{r.licensed}</span>}
        {['No Show', 'Reschedule', 'Follow-up Needed'].includes(r.status) && <span className="pill high">{STATUS_LABEL[r.status]}</span>}
        {r.us_based === 'No' && <span className="pill crit">Outside U.S.</span>}
        {r.other_agency === 'Yes' && <span className="pill crit">Other agency</span>}
        {r.source === 'iClosed' && r.status === 'Scheduled' && <span>iClosed</span>}
      </span>
      {m && <span className="rcard-mgr">→ {m.name}{r.group_chat_confirmed ? ' · chat ✓' : ''}</span>}
    </button>
  );
}

function NewRecruit({ onClose, onCreated, create }: { onClose: () => void; onCreated: (id: string) => void; create: ReturnType<typeof useOps>['createRecruit'] }) {
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [appt, setAppt] = useState('');
  const [loc, setLoc] = useState(''); const [source, setSource] = useState(''); const [talked, setTalked] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <form className="modal" role="dialog" aria-label="New recruit" onSubmit={async e => {
        e.preventDefault(); if (!name.trim()) return;
        const r = await create({ name: name.trim(), phone: phone.trim() || null, location: loc.trim() || null, source: source.trim() || null,
          appointment_at: fromLocalInput(appt), status: talked ? 'Call Completed' : appt ? 'Scheduled' : 'New' });
        if (r) onCreated(r.id);
      }}>
        <div className="panel-h"><h2 className="sec">New recruit</h2><button type="button" className="btn sm ghost" onClick={onClose}>Esc</button></div>
        <input ref={ref} className="big" type="text" placeholder="Full name" required value={name} onChange={e => setName(e.target.value)} aria-label="Full name" />
        <div className="row2" style={{ marginTop: 10 }}>
          <div className="field"><label htmlFor="n-phone">Phone</label><input id="n-phone" type="text" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} /></div>
          <div className="field"><label htmlFor="n-appt">Call booked for (CT)</label><input id="n-appt" type="datetime-local" value={appt} onChange={e => setAppt(e.target.value)} /></div>
        </div>
        <div className="row2" style={{ marginTop: 10 }}>
          <div className="field"><label htmlFor="n-loc">Location</label><input id="n-loc" type="text" placeholder="City, State" value={loc} onChange={e => setLoc(e.target.value)} /></div>
          <div className="field"><label htmlFor="n-src">Source</label><input id="n-src" type="text" value={source} onChange={e => setSource(e.target.value)} /></div>
        </div>
        <label className="check" style={{ marginTop: 10 }}><input type="checkbox" checked={talked} onChange={e => setTalked(e.target.checked)} /> Already talked to them (ready for a manager)</label>
        <div className="toolbar" style={{ margin: '14px 0 0', justifyContent: 'flex-end' }}><button className="btn primary">Add recruit</button></div>
      </form>
    </>
  );
}

function ManagerEditor({ m, onClose, onSave }: { m: Manager | null; onClose: () => void; onSave: (v: Partial<Manager>) => void }) {
  const [name, setName] = useState(m?.name ?? ''); const [loc, setLoc] = useState(m?.location ?? '');
  const [phone, setPhone] = useState(m?.phone ?? ''); const [chat, setChat] = useState(m?.group_chat_name ?? '');
  const [spec, setSpec] = useState(m?.specialty ?? ''); const [rot, setRot] = useState(m?.in_rotation ?? true);
  const [confirmRemove, setConfirmRemove] = useState(false);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <form className="modal" role="dialog" aria-label="Manager" onSubmit={e => { e.preventDefault(); if (!name.trim()) return;
        onSave({ name: name.trim(), location: loc.trim() || null, phone: phone.trim() || null, group_chat_name: chat.trim() || null, specialty: spec.trim() || null, in_rotation: rot }); }}>
        <div className="panel-h"><h2 className="sec">{m ? 'Edit manager' : 'Add manager'}</h2><button type="button" className="btn sm ghost" onClick={onClose}>Esc</button></div>
        <div className="row2">
          <div className="field"><label htmlFor="m-name">Name</label><input id="m-name" type="text" required value={name} onChange={e => setName(e.target.value)} /></div>
          <div className="field"><label htmlFor="m-loc">Location</label><input id="m-loc" type="text" placeholder="City, State" value={loc} onChange={e => setLoc(e.target.value)} /></div>
        </div>
        <div className="row2" style={{ marginTop: 10 }}>
          <div className="field"><label htmlFor="m-phone">Phone</label><input id="m-phone" type="text" value={phone} onChange={e => setPhone(e.target.value)} /></div>
          <div className="field"><label htmlFor="m-chat">Group chat name</label><input id="m-chat" type="text" value={chat} onChange={e => setChat(e.target.value)} /></div>
        </div>
        <div className="field" style={{ marginTop: 10 }}><label htmlFor="m-spec">Special handling</label><input id="m-spec" type="text" placeholder="e.g. Recruits over 30" value={spec} onChange={e => setSpec(e.target.value)} /></div>
        <label className="check" style={{ marginTop: 10 }}><input type="checkbox" checked={rot} onChange={e => setRot(e.target.checked)} /> In the round-robin rotation</label>
        <div className="toolbar" style={{ margin: '14px 0 0', justifyContent: 'space-between' }}>
          {m ? (!confirmRemove ? <button type="button" className="link" style={{ color: 'var(--crit)' }} onClick={() => setConfirmRemove(true)}>Remove from roster</button>
            : <span className="check">Remove {m.name}? Past assignments stay.<button type="button" className="btn sm" style={{ borderColor: 'var(--crit)', color: 'var(--crit)' }} onClick={() => onSave({ active: false, in_rotation: false })}>Remove</button></span>) : <span />}
          <button className="btn primary">Save</button>
        </div>
      </form>
    </>
  );
}
