'use client';

import { Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useData } from '@/components/DataProvider';
import { TaskList } from '@/components/TaskList';
import { useUI } from '@/components/UI';
import { filterView, sortTasks, TASK_VIEWS, type TaskView } from '@/lib/tasks';
import { DEPARTMENTS } from '@/lib/types';

export default function TasksPage() {
  return <Suspense fallback={null}><Tasks /></Suspense>;
}

function Tasks() {
  const { tasks } = useData();
  const { quickAdd } = useUI();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const view = (TASK_VIEWS.find(([k]) => k === params.get('view'))?.[0] ?? 'today') as TaskView;
  const dept = params.get('dept') ?? '';

  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(params.toString());
    if (v) p.set(k, v); else p.delete(k);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  let list = filterView(tasks, view);
  if (dept) list = list.filter(t => t.department === dept);
  if (view !== 'completed') list = sortTasks(list);

  return (
    <>
      <div className="ph">
        <div>
          <div className="eyebrow">Unified task system</div>
          <h1>Tasks &amp; Follow-ups</h1>
          <p className="sub">Unfinished work never disappears at the end of the day. It carries forward until it’s done.</p>
        </div>
        <div className="qa"><button className="btn primary" onClick={() => quickAdd('task')}>New task</button></div>
      </div>
      <div className="tabs" role="tablist">
        {TASK_VIEWS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={view === k} className={view === k ? 'on' : ''} onClick={() => setParam('view', k)}>
            {label}<span className="c">{filterView(tasks, k).filter(t => !dept || t.department === dept).length}</span>
          </button>
        ))}
      </div>
      <div className="toolbar">
        <select aria-label="Department" value={dept} onChange={e => setParam('dept', e.target.value)}>
          <option value="">All departments</option>
          {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
        </select>
        <span className="hint" style={{ margin: 0 }}>{list.length} {list.length === 1 ? 'task' : 'tasks'}</span>
      </div>
      <section className="panel">
        <TaskList tasks={list} empty={view === 'today' ? 'Nothing due today or overdue.' : 'No tasks here.'} />
      </section>
    </>
  );
}
