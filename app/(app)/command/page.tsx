'use client';

import Link from 'next/link';
import { useData } from '@/components/DataProvider';
import { TaskList } from '@/components/TaskList';
import { useUI } from '@/components/UI';
import { isOpen, metrics, sortTasks, waitingOnWylie } from '@/lib/tasks';
import { ctNow, fmt12, fmtDate, minutesNow, relDate, toMin } from '@/lib/time';

export default function CommandCenter() {
  const { tasks, blocks } = useData();
  const { quickAdd, openTask } = useUI();
  const m = metrics(tasks);
  const p = ctNow();
  const greet = p.h < 12 ? 'Good morning' : p.h < 17 ? 'Good afternoon' : 'Good evening';
  const n = minutesNow();
  const block = blocks.find(b => (b.weekday === null) && toMin(b.start_time) <= n && n < toMin(b.end_time));
  const top = sortTasks(m.top).slice(0, 3);
  const dueNow = sortTasks([...m.overdue, ...m.today]);
  const dept = (d: string) => tasks.filter(t => isOpen(t) && t.department === d).length;
  const status: [string, number, string][] = [
    ['Waiting on Wylie', m.waiting.filter(waitingOnWylie).length, '/waiting'],
    ['Needs confirmation', m.needsConfirmation.length, '/tasks?view=confirm'],
    ['Open finance items', dept('Finance'), '/tasks?view=all&dept=Finance'],
    ['Debt follow-ups', dept('Debt'), '/tasks?view=all&dept=Debt'],
    ['Lead items', dept('Leads'), '/tasks?view=all&dept=Leads'],
    ['Advertising items', dept('Advertising'), '/tasks?view=all&dept=Advertising'],
    ['Office items', dept('Office'), '/tasks?view=all&dept=Office'],
    ['Recruiting items', dept('Recruiting'), '/tasks?view=all&dept=Recruiting'],
  ];
  const recent = m.done.slice().sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')).slice(0, 4);

  return (
    <>
      <div className="ph">
        <div>
          <div className="eyebrow">{fmtDate(p.iso, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
          <h1>{greet}.</h1>
          <p className="sub">
            {block ? <>Right now: <b>{block.title}</b> until {fmt12(block.end_time)}. </> : 'Outside the working day. '}
            {m.overdue.length ? `${m.overdue.length} overdue.` : 'Nothing overdue.'}
          </p>
        </div>
        <div className="qa"><Link className="btn" href="/my-day">Open My Day</Link><Link className="btn gold" href="/recaps">Generate recap</Link></div>
      </div>

      <div className="strip">
        <Link href="/tasks?view=today" className="stripcell"><span className="q">To do today</span><span className="v">{m.today.length}</span><span className="l">due today</span></Link>
        <Link href="/tasks?view=overdue" className="stripcell"><span className="q">Overdue or urgent</span><span className={`v ${m.overdue.length ? 'crit' : ''}`}>{m.overdue.length + m.critical.length}</span><span className="l">overdue + critical</span></Link>
        <Link href="/waiting" className="stripcell"><span className="q">Waiting on</span><span className="v">{m.waiting.length}</span><span className="l">people owe a reply</span></Link>
        <Link href="/tasks?view=week" className="stripcell"><span className="q">Coming up</span><span className="v">{m.upcoming.length}</span><span className="l">next 7 days</span></Link>
        <Link href="/tasks?view=completed" className="stripcell"><span className="q">Accomplished</span><span className="v">{m.doneToday.length}</span><span className="l">done today</span></Link>
      </div>

      <div className="grid2">
        <div className="stack">
          <section className="panel">
            <div className="panel-h"><h2 className="sec">Top three today</h2><span className="hint" style={{ margin: 0 }}>Star any task to pin it here</span></div>
            <TaskList tasks={top} empty="No priorities set. Tap ★ on a task to make it a top priority." />
          </section>
          <section className="panel">
            <div className="panel-h"><h2 className="sec">Due today &amp; overdue <span className="n">{dueNow.length}</span></h2><Link className="link" href="/tasks?view=today">All tasks</Link></div>
            <TaskList tasks={dueNow} empty="Nothing due today." />
          </section>
          <section className="panel">
            <div className="panel-h"><h2 className="sec">Needs a date <span className="n">{m.unscheduled.length}</span></h2><Link className="link" href="/tasks?view=unscheduled">Schedule them</Link></div>
            <TaskList tasks={sortTasks(m.unscheduled).slice(0, 5)} empty="Every open task has a date." />
          </section>
        </div>
        <div className="stack">
          <section className="panel">
            <div className="panel-h"><h2 className="sec">Quick actions</h2></div>
            <div className="qa">
              <button className="btn sm" onClick={() => quickAdd('task')}>Add task</button>
              <button className="btn sm" onClick={() => quickAdd('followup')}>Add follow-up</button>
              <button className="btn sm" onClick={() => quickAdd('note')}>Add note</button>
              <button className="btn sm" onClick={() => quickAdd('interrupt')}>Log interruption</button>
              <Link className="btn sm" href="/projects">Update project</Link>
              <Link className="btn sm" href="/recaps">Generate recap</Link>
              <Link className="btn sm" href="/m/ai">Ask AI</Link>
            </div>
          </section>
          <section className="panel">
            <div className="panel-h"><h2 className="sec">Waiting on <span className="n">{m.waiting.length}</span></h2><Link className="link" href="/waiting">Open</Link></div>
            {m.waiting.length ? m.waiting.slice(0, 4).map(t => (
              <div key={t.id} className="trow" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="who">{t.waiting_on || 'Someone'}</div>
                  <button className="ttitle" style={{ fontWeight: 400, color: 'var(--fg2)' }} onClick={() => openTask(t.id)}>{t.title}</button>
                </div>
                <span className="due">{t.follow_up_date ? 'F/U ' + relDate(t.follow_up_date) : ''}</span>
              </div>
            )) : <div className="empty">Not waiting on anyone.</div>}
          </section>
          <section>
            <div className="panel-h"><h2 className="sec">Operational status</h2></div>
            <div className="status">
              {status.map(([l, v, href]) => <Link key={l} href={href} className="statcell"><span>{l}</span><span className={`sv ${v ? 'has' : ''}`}>{v}</span></Link>)}
            </div>
            <p className="hint">Recruiting calls, invoices, debt balances and lead counts get their own live numbers when those modules land in Phase 2.</p>
          </section>
          <section className="panel">
            <div className="panel-h"><h2 className="sec">Recently completed</h2></div>
            <TaskList tasks={recent} empty="Nothing completed yet. Check off a task and it shows here." />
          </section>
        </div>
      </div>
    </>
  );
}
