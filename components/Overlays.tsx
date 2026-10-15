'use client';

import { useEffect, useRef, useState } from 'react';
import { useData } from './DataProvider';
import type { QuickKind } from './UI';
import { DEPARTMENTS, NOTE_TYPES, PRIORITIES, PROJECT_STATUSES, TASK_STATUSES, type Task, type TaskActivity } from '@/lib/types';
import { addDays, fmtStamp, today, toMin } from '@/lib/time';

const csv = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean);
const orNull = (s: string) => (s.trim() ? s.trim() : null);

function useEsc(onClose: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
}

/* ---------------- Task drawer ---------------- */
export function TaskDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { tasks, projects, updateTask, deleteTask, loadActivity, toast } = useData();
  const t = tasks.find(x => x.id === id);
  const [f, setF] = useState<Task | null>(t ?? null);
  const [activity, setActivity] = useState<TaskActivity[]>([]);
  const [confirmDel, setConfirmDel] = useState(false);
  const [saving, setSaving] = useState(false);
  useEsc(onClose);
  useEffect(() => { loadActivity(id).then(setActivity); }, [id, loadActivity]);
  if (!t || !f) return null;
  const set = <K extends keyof Task>(k: K, v: Task[K]) => setF({ ...f, [k]: v });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f || !t) return;
    setSaving(true);
    const patch: Partial<Task> = {
      title: f.title.trim() || t.title, description: orNull(f.description ?? ''), priority: f.priority, department: f.department,
      due_date: f.due_date || null, waiting_on: orNull(f.waiting_on ?? ''), follow_up_date: f.follow_up_date || null,
      impact_if_delayed: orNull(f.impact_if_delayed ?? ''), project_id: f.project_id || null, contact_name: orNull(f.contact_name ?? ''),
      recurrence: orNull(f.recurrence ?? ''), owner_name: orNull(f.owner_name ?? ''), notes: orNull(f.notes ?? ''),
      needs_confirmation: f.needs_confirmation, status: f.status,
    };
    if (patch.waiting_on && !t.waiting_since) patch.waiting_since = today();
    const msgs: string[] = [];
    if (f.status !== t.status) {
      msgs.push(`Status → ${f.status}`);
      patch.completed_at = f.status === 'Done' ? new Date().toISOString() : null;
      if (f.status === 'Done') patch.is_top_priority = false;
    }
    if ((patch.due_date ?? null) !== t.due_date) msgs.push(patch.due_date ? `Due date → ${patch.due_date}` : 'Due date cleared');
    if (patch.priority !== t.priority) msgs.push(`Priority → ${patch.priority}`);
    if ((patch.waiting_on ?? null) !== t.waiting_on) msgs.push(patch.waiting_on ? `Waiting on ${patch.waiting_on}` : 'No longer waiting');
    const ok = await updateTask(t.id, patch, msgs.join(' · ') || 'Edited');
    setSaving(false);
    if (ok) { toast('Saved'); onClose(); }
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Task">
        <header><span className="eyebrow" style={{ margin: 0 }}>Task</span><button className="btn sm ghost" onClick={onClose}>Close</button></header>
        <form className="body" id="tf" onSubmit={save}>
          <div className="field"><label htmlFor="f-title">Title</label><input type="text" id="f-title" value={f.title} onChange={e => set('title', e.target.value)} required autoFocus /></div>
          <div className="field"><label htmlFor="f-desc">Description</label><textarea id="f-desc" rows={2} value={f.description ?? ''} onChange={e => set('description', e.target.value)} /></div>
          <div className="row2">
            <div className="field"><label htmlFor="f-status">Status</label><select id="f-status" value={f.status} onChange={e => set('status', e.target.value as Task['status'])}>{TASK_STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
            <div className="field"><label htmlFor="f-pri">Priority</label><select id="f-pri" value={f.priority} onChange={e => set('priority', e.target.value as Task['priority'])}>{PRIORITIES.map(s => <option key={s}>{s}</option>)}</select></div>
          </div>
          <div className="row2">
            <div className="field"><label htmlFor="f-dept">Department</label><select id="f-dept" value={f.department} onChange={e => set('department', e.target.value as Task['department'])}>{DEPARTMENTS.map(s => <option key={s}>{s}</option>)}</select></div>
            <div className="field"><label htmlFor="f-due">Due</label><input type="date" id="f-due" value={f.due_date ?? ''} onChange={e => set('due_date', e.target.value || null)} /></div>
          </div>
          <div className="row2">
            <div className="field"><label htmlFor="f-wait">Waiting on</label><input type="text" id="f-wait" value={f.waiting_on ?? ''} onChange={e => set('waiting_on', e.target.value)} placeholder="Wylie, a vendor, an agent…" /></div>
            <div className="field"><label htmlFor="f-fu">Follow up</label><input type="date" id="f-fu" value={f.follow_up_date ?? ''} onChange={e => set('follow_up_date', e.target.value || null)} /></div>
          </div>
          <div className="field"><label htmlFor="f-impact">Impact if delayed</label><input type="text" id="f-impact" value={f.impact_if_delayed ?? ''} onChange={e => set('impact_if_delayed', e.target.value)} /></div>
          <div className="row2">
            <div className="field"><label htmlFor="f-proj">Project</label><select id="f-proj" value={f.project_id ?? ''} onChange={e => set('project_id', e.target.value || null)}><option value="">None</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div className="field"><label htmlFor="f-contact">Related contact</label><input type="text" id="f-contact" value={f.contact_name ?? ''} onChange={e => set('contact_name', e.target.value)} /></div>
          </div>
          <div className="row2">
            <div className="field"><label htmlFor="f-rec">Recurrence</label><input type="text" id="f-rec" value={f.recurrence ?? ''} onChange={e => set('recurrence', e.target.value)} placeholder="e.g. Weekly · Friday" /></div>
            <div className="field"><label htmlFor="f-owner">Owner</label><input type="text" id="f-owner" value={f.owner_name ?? ''} onChange={e => set('owner_name', e.target.value)} /></div>
          </div>
          <div className="field"><label htmlFor="f-conf">Still needs confirmation (comma-separated)</label><input type="text" id="f-conf" value={f.needs_confirmation.join(', ')} onChange={e => set('needs_confirmation', csv(e.target.value))} placeholder="Amount, Deadline…" /></div>
          <div className="field"><label htmlFor="f-notes">Notes</label><textarea id="f-notes" rows={3} value={f.notes ?? ''} onChange={e => set('notes', e.target.value)} /></div>
          {activity.length > 0 && (
            <div className="field"><label>Activity</label>
              <div className="activity">{activity.map(a => <div key={a.id}><time>{fmtStamp(a.created_at)}</time>{a.body}</div>)}</div>
            </div>
          )}
          <div>
            {!confirmDel ? <button type="button" className="link" style={{ color: 'var(--crit)' }} onClick={() => setConfirmDel(true)}>Delete task</button> : (
              <span className="check">Delete permanently?
                <button type="button" className="btn sm" style={{ borderColor: 'var(--crit)', color: 'var(--crit)' }} onClick={async () => { if (await deleteTask(t.id)) { toast('Task deleted'); onClose(); } }}>Delete</button>
                <button type="button" className="btn sm ghost" onClick={() => setConfirmDel(false)}>Keep</button>
              </span>
            )}
          </div>
        </form>
        <footer><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" form="tf" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></footer>
      </aside>
    </>
  );
}

/* ---------------- Quick add ---------------- */
const QA_LABELS: Record<QuickKind, [string, string]> = {
  task: ['Add a task', 'e.g. Check office cups Friday'],
  followup: ['Add a follow-up', 'e.g. Confirm payment date with Jonathan'],
  note: ['Add a note', 'Anything worth remembering'],
  interrupt: ['Log an interruption', 'e.g. Wylie needs flight changed today'],
  project: ['New project', 'Project name'],
};

export function QuickAdd({ kind, onClose }: { kind: QuickKind; onClose: () => void }) {
  const { createTask, createNote, createProject, createPreference, addInterruption, toast } = useData();
  const [text, setText] = useState('');
  const [dept, setDept] = useState<string>(kind === 'interrupt' ? 'Executive' : 'Operations');
  const [pri, setPri] = useState<string>(kind === 'interrupt' ? 'High' : 'Normal');
  const [due, setDue] = useState(kind === 'interrupt' ? today() : '');
  const [who, setWho] = useState('');
  const [fu, setFu] = useState(addDays(today(), 1));
  const [noteType, setNoteType] = useState<string>('Quick note');
  const [pref, setPref] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEsc(onClose);
  useEffect(() => { ref.current?.focus(); }, []);
  const [h, ph] = QA_LABELS[kind];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = text.trim(); if (!v) return;
    setBusy(true);
    let ok = false;
    const base = { title: v, department: dept as Task['department'], priority: pri as Task['priority'], due_date: due || null };
    if (kind === 'task') ok = !!(await createTask(base));
    else if (kind === 'interrupt') ok = await addInterruption(v, base);
    else if (kind === 'followup') ok = !!(await createTask({ title: v, status: 'Waiting', waiting_on: who.trim() || null, follow_up_date: fu || null, due_date: fu || null }));
    else if (kind === 'project') ok = !!(await createProject({ name: v }));
    else if (kind === 'note') {
      ok = pref
        ? await createPreference({ body: v, permanence: pref as 'Permanent' | 'Temporary', category: pref === 'Temporary' ? 'Restriction' : 'Scheduling' })
        : await createNote({ body: v, note_type: noteType as never, department: dept === 'Operations' ? null : dept });
    }
    setBusy(false);
    if (ok) { toast(kind === 'note' ? 'Note saved' : kind === 'project' ? 'Project created' : 'Added'); onClose(); }
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <form className="modal" role="dialog" aria-label={h} onSubmit={submit}>
        <div className="panel-h"><h2 className="sec">{h}</h2><button type="button" className="btn sm ghost" onClick={onClose}>Esc</button></div>
        <input ref={ref} className="big" type="text" placeholder={ph} autoComplete="off" required value={text} onChange={e => setText(e.target.value)} />
        {(kind === 'task' || kind === 'interrupt') && (
          <div className="toolbar" style={{ margin: '10px 0 0' }}>
            <select aria-label="Department" value={dept} onChange={e => setDept(e.target.value)}>{DEPARTMENTS.map(d => <option key={d}>{d}</option>)}</select>
            <select aria-label="Priority" value={pri} onChange={e => setPri(e.target.value)}>{PRIORITIES.map(d => <option key={d}>{d}</option>)}</select>
            <input type="date" aria-label="Due date" value={due} onChange={e => setDue(e.target.value)} />
          </div>
        )}
        {kind === 'followup' && (
          <div className="toolbar" style={{ margin: '10px 0 0' }}>
            <input type="text" placeholder="Waiting on (who)" style={{ flex: 1 }} value={who} onChange={e => setWho(e.target.value)} />
            <input type="date" aria-label="Follow-up date" value={fu} onChange={e => setFu(e.target.value)} />
          </div>
        )}
        {kind === 'note' && (
          <div className="toolbar" style={{ margin: '10px 0 0' }}>
            <select aria-label="Saved as" value={pref} onChange={e => setPref(e.target.value)}>
              <option value="">Regular note</option><option value="Permanent">Wylie preference · permanent</option><option value="Temporary">Wylie rule · temporary</option>
            </select>
            {!pref && <select aria-label="Note type" value={noteType} onChange={e => setNoteType(e.target.value)}>{NOTE_TYPES.map(d => <option key={d}>{d}</option>)}</select>}
            {!pref && <select aria-label="Department" value={dept} onChange={e => setDept(e.target.value)}><option value="Operations">No department</option>{DEPARTMENTS.filter(d => d !== 'Operations').map(d => <option key={d}>{d}</option>)}</select>}
          </div>
        )}
        <div className="toolbar" style={{ margin: '14px 0 0', justifyContent: 'space-between' }}>
          <span className="hint" style={{ margin: 0 }}>{kind === 'task' ? 'Press N anywhere to open this.' : kind === 'interrupt' ? 'Logged on today’s timeline and added as a task.' : ''}</span>
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Add'}</button>
        </div>
      </form>
    </>
  );
}

/* ---------------- Project drawer ---------------- */
export function ProjectDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { projects, updateProject, toast } = useData();
  const p = projects.find(x => x.id === id);
  const [f, setF] = useState(p);
  useEsc(onClose);
  if (!p || !f) return null;
  const set = (k: string, v: string) => setF({ ...f, [k]: v });
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!f || !p) return;
    const ok = await updateProject(p.id, {
      name: f.name.trim() || p.name, description: orNull(f.description ?? ''), status: f.status, priority: f.priority,
      owner_name: orNull(f.owner_name ?? ''), deadline: f.deadline || null, next_action: orNull(f.next_action ?? ''),
      dependencies: orNull(f.dependencies ?? ''), needs_confirmation: f.needs_confirmation,
    });
    if (ok) { toast('Project saved'); onClose(); }
  }
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Project">
        <header><span className="eyebrow" style={{ margin: 0 }}>Project</span><button className="btn sm ghost" onClick={onClose}>Close</button></header>
        <form className="body" id="pf" onSubmit={save}>
          <div className="field"><label htmlFor="p-n">Name</label><input type="text" id="p-n" value={f.name} onChange={e => set('name', e.target.value)} /></div>
          <div className="field"><label htmlFor="p-d">Description</label><textarea id="p-d" rows={2} value={f.description ?? ''} onChange={e => set('description', e.target.value)} /></div>
          <div className="row2">
            <div className="field"><label htmlFor="p-s">Status</label><select id="p-s" value={f.status} onChange={e => set('status', e.target.value)}>{PROJECT_STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
            <div className="field"><label htmlFor="p-p">Priority</label><select id="p-p" value={f.priority} onChange={e => set('priority', e.target.value)}>{PRIORITIES.map(s => <option key={s}>{s}</option>)}</select></div>
          </div>
          <div className="row2">
            <div className="field"><label htmlFor="p-o">Owner</label><input type="text" id="p-o" value={f.owner_name ?? ''} onChange={e => set('owner_name', e.target.value)} /></div>
            <div className="field"><label htmlFor="p-dl">Deadline</label><input type="date" id="p-dl" value={f.deadline ?? ''} onChange={e => set('deadline', e.target.value)} /></div>
          </div>
          <div className="field"><label htmlFor="p-na">Next action</label><input type="text" id="p-na" value={f.next_action ?? ''} onChange={e => set('next_action', e.target.value)} /></div>
          <div className="field"><label htmlFor="p-dep">Dependencies</label><input type="text" id="p-dep" value={f.dependencies ?? ''} onChange={e => set('dependencies', e.target.value)} /></div>
          <div className="field"><label htmlFor="p-c">Still needs confirmation (comma-separated)</label><input type="text" id="p-c" value={f.needs_confirmation.join(', ')} onChange={e => setF({ ...f, needs_confirmation: csv(e.target.value) })} /></div>
        </form>
        <footer><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" form="pf">Save</button></footer>
      </aside>
    </>
  );
}

/* ---------------- Block editor ---------------- */
export function BlockEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const { blocks, updateBlock, toast } = useData();
  const b = blocks.find(x => x.id === id);
  const [title, setTitle] = useState(b?.title ?? '');
  const [start, setStart] = useState(b?.start_time.slice(0, 5) ?? '');
  const [end, setEnd] = useState(b?.end_time.slice(0, 5) ?? '');
  const [desc, setDesc] = useState(b?.description ?? '');
  const [prot, setProt] = useState(!!b?.is_protected);
  const [depts, setDepts] = useState<string[]>(b?.departments ?? []);
  useEsc(onClose);
  if (!b) return null;
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!b) return;
    if (toMin(end) <= toMin(start)) { toast('End time must be after start'); return; }
    const ok = await updateBlock(b.id, { title: title.trim() || b.title, start_time: start, end_time: end, description: desc, is_protected: prot, departments: prot ? [] : depts });
    if (ok) { toast('Block updated'); onClose(); }
  }
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <form className="modal" role="dialog" aria-label="Edit block" onSubmit={save}>
        <div className="panel-h"><h2 className="sec">Edit time block</h2><button type="button" className="btn sm ghost" onClick={onClose}>Esc</button></div>
        <div className="field"><label htmlFor="b-t">Name</label><input type="text" id="b-t" value={title} onChange={e => setTitle(e.target.value)} /></div>
        <div className="row2" style={{ marginTop: 10 }}>
          <div className="field"><label htmlFor="b-s">Start</label><input type="time" id="b-s" value={start} onChange={e => setStart(e.target.value)} /></div>
          <div className="field"><label htmlFor="b-e">End</label><input type="time" id="b-e" value={end} onChange={e => setEnd(e.target.value)} /></div>
        </div>
        <div className="field" style={{ marginTop: 10 }}><label htmlFor="b-d">What happens here</label><textarea id="b-d" rows={2} value={desc} onChange={e => setDesc(e.target.value)} /></div>
        {!prot && (
          <div className="field" style={{ marginTop: 10 }}><label>Show tasks from</label>
            <div className="qa">{DEPARTMENTS.map(d => (
              <label key={d} className="check" style={{ fontSize: 12.5 }}><input type="checkbox" checked={depts.includes(d)} onChange={e => setDepts(e.target.checked ? [...depts, d] : depts.filter(x => x !== d))} />{d}</label>
            ))}</div>
          </div>
        )}
        <label className="check" style={{ marginTop: 10 }}><input type="checkbox" checked={prot} onChange={e => setProt(e.target.checked)} /> Protected (break, no work tasks)</label>
        <div className="toolbar" style={{ margin: '14px 0 0', justifyContent: 'flex-end' }}><button className="btn primary">Save block</button></div>
      </form>
    </>
  );
}
