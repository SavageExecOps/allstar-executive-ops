'use client';

import type { Task } from '@/lib/types';
import { isOpen, isOverdue } from '@/lib/tasks';
import { fmtStamp, relDate } from '@/lib/time';
import { useData } from './DataProvider';
import { useUI } from './UI';

export function PriorityPill({ p }: { p: string }) {
  if (p === 'Critical') return <span className="pill crit">Critical</span>;
  if (p === 'High') return <span className="pill high">High</span>;
  if (p === 'Low') return <span className="pill">Low</span>;
  return null;
}

export function DueTag({ t }: { t: Task }) {
  if (!t.due_date) return t.status === 'Done' ? null : <span className="pill conf">No date</span>;
  const over = isOverdue(t);
  return <span className={`due ${over ? 'over' : ''}`}>{over ? 'Overdue · ' : ''}{relDate(t.due_date)}</span>;
}

export function Check({ t }: { t: Task }) {
  const { toggleDone } = useData();
  const done = t.status === 'Done';
  return <button className={`chk ${done ? 'on' : ''}`} onClick={() => toggleDone(t)} aria-label={done ? 'Mark not done' : 'Mark done'} />;
}

export function TaskRow({ t, hideProject, hideDue }: { t: Task; hideProject?: boolean; hideDue?: boolean }) {
  const { projects, toggleTop } = useData();
  const { openTask } = useUI();
  const p = t.project_id ? projects.find(x => x.id === t.project_id) : null;
  const open = isOpen(t);
  return (
    <div className={`trow ${open ? '' : 'done'}`}>
      <Check t={t} />
      <div style={{ minWidth: 0 }}>
        <button className="ttitle" onClick={() => openTask(t.id)}>{t.title}</button>
        <div className="meta">
          <PriorityPill p={t.priority} />
          <span>{t.department}</span>
          {t.waiting_on && open && <span className="pill wait">Waiting · {t.waiting_on}</span>}
          {t.status === 'Blocked' && <span className="pill crit">Blocked</span>}
          {p && !hideProject && <span>{p.name}</span>}
          {open && t.needs_confirmation?.length > 0 && (
            <span className="pill conf" title={`Needs confirmation: ${t.needs_confirmation.join(', ')}`}>Confirm: {t.needs_confirmation.join(', ')}</span>
          )}
          {!open && t.completed_at && <span>Done {fmtStamp(t.completed_at)}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {!hideDue && <DueTag t={t} />}
        {open && (
          <button className={`star ${t.is_top_priority ? 'on' : ''}`} onClick={() => toggleTop(t)}
            title={t.is_top_priority ? 'Remove from top priorities' : 'Add to today’s top priorities'} aria-label="Top priority">★</button>
        )}
      </div>
    </div>
  );
}

export function TaskList({ tasks, empty, hideProject }: { tasks: Task[]; empty: string; hideProject?: boolean }) {
  if (!tasks.length) return <div className="empty">{empty}</div>;
  return <div className="tlist">{tasks.map(t => <TaskRow key={t.id} t={t} hideProject={hideProject} />)}</div>;
}
