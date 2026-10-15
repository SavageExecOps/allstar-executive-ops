'use client';

import { useState } from 'react';
import { useData } from '@/components/DataProvider';
import { PriorityPill, TaskList } from '@/components/TaskList';
import { useUI } from '@/components/UI';
import { isOpen, sortTasks } from '@/lib/tasks';
import { fmtDate, fmtStamp } from '@/lib/time';

const statusClass: Record<string, string> = { Blocked: 'crit', Waiting: 'wait', Completed: 'ok', 'In Progress': 'gold' };

export default function Projects() {
  const { projects, tasks, projectUpdates, addProjectUpdate, toast } = useData();
  const { quickAdd, editProject } = useUI();
  const [draft, setDraft] = useState<Record<string, string>>({});

  return (
    <>
      <div className="ph">
        <div>
          <div className="eyebrow">Larger initiatives</div>
          <h1>Projects</h1>
          <p className="sub">Each project links to its tasks. Status, next action and dependencies live here.</p>
        </div>
        <div className="qa"><button className="btn primary" onClick={() => quickAdd('project')}>New project</button></div>
      </div>
      <div className="stack">
        {projects.length === 0 && <section className="panel"><div className="empty">No projects yet.</div></section>}
        {projects.map(p => {
          const ts = tasks.filter(t => t.project_id === p.id);
          const done = ts.filter(t => !isOpen(t)).length;
          const updates = projectUpdates.filter(u => u.project_id === p.id);
          return (
            <section key={p.id} className="panel">
              <div className="panel-h" style={{ alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="bhead"><span className="bt">{p.name}</span><span className={`pill ${statusClass[p.status] ?? ''}`}>{p.status}</span><PriorityPill p={p.priority} /></div>
                  {p.description && <p className="bdesc">{p.description}</p>}
                </div>
                <button className="btn sm" onClick={() => editProject(p.id)}>Edit</button>
              </div>
              <dl className="kv">
                <dt>Next action</dt><dd>{p.next_action || <span className="pill conf">Needs next action</span>}</dd>
                <dt>Depends on</dt><dd>{p.dependencies || '—'}</dd>
                <dt>Deadline</dt><dd>{p.deadline ? fmtDate(p.deadline, { year: 'numeric' }) : <span className="pill conf">Needs confirmation</span>}</dd>
                <dt>Tasks</dt><dd>{done}/{ts.length} done</dd>
                {p.needs_confirmation.length > 0 && <><dt>Confirm</dt><dd>{p.needs_confirmation.join(', ')}</dd></>}
              </dl>
              {ts.length > 0 && <div style={{ marginTop: 10 }}><TaskList tasks={sortTasks(ts)} empty="" hideProject /></div>}
              {updates.length > 0 && (
                <div className="activity" style={{ marginTop: 10 }}>{updates.map(u => <div key={u.id}><time>{fmtStamp(u.created_at)}</time>{u.body}</div>)}</div>
              )}
              <form className="toolbar" style={{ margin: '12px 0 0' }} onSubmit={async e => {
                e.preventDefault();
                const v = (draft[p.id] ?? '').trim(); if (!v) return;
                if (await addProjectUpdate(p.id, v)) { setDraft({ ...draft, [p.id]: '' }); toast('Update added'); }
              }}>
                <input type="text" aria-label={`Update for ${p.name}`} placeholder="Post an update" style={{ flex: 1 }} value={draft[p.id] ?? ''} onChange={e => setDraft({ ...draft, [p.id]: e.target.value })} />
                <button className="btn sm">Add update</button>
              </form>
            </section>
          );
        })}
      </div>
    </>
  );
}
