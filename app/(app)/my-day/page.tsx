'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useData } from '@/components/DataProvider';
import { Check, DueTag, TaskList } from '@/components/TaskList';
import { useUI } from '@/components/UI';
import { isOpen, isOverdue, sortTasks } from '@/lib/tasks';
import { ctNow, fmt12, fmtClock, fmtDate, fmtSecs, minutesNow, today, toMin, weekday } from '@/lib/time';
import type { BlockLog, ScheduleBlock } from '@/lib/types';
import { DAY_NAMES, hasWeekPlan, planOutdated, planRows } from '@/lib/weekPlan';

const elapsed = (l?: BlockLog) =>
  (l?.seconds_tracked ?? 0) + (l?.running_since ? Math.floor((Date.now() - Date.parse(l.running_since)) / 1000) : 0);

export default function MyDay() {
  const { blocks, blockLogs, tasks, interruptions, setBlockLog, carryForward, replaceSchedule, toast } = useData();
  const [view, setView] = useState<'today' | 'week'>('today');
  const [loading, setLoading] = useState(false);
  const { quickAdd, openTask, editBlock } = useUI();
  const [, tick] = useState(0);
  useEffect(() => { const i = setInterval(() => tick(x => x + 1), 1000); return () => clearInterval(i); }, []);

  const t = today();
  const wd = weekday(t);
  // A weekday-specific schedule wins over the everyday one when it exists.
  const blocksFor = (w: number): ScheduleBlock[] => {
    const specific = blocks.filter(b => b.weekday === w);
    return (specific.length ? specific : blocks.filter(b => b.weekday === null)).sort((a, b) => a.start_time.localeCompare(b.start_time));
  };
  const day = blocksFor(wd);
  const planned = hasWeekPlan(blocks);
  async function loadPlan() {
    setLoading(true);
    if (await replaceSchedule(planRows())) toast('Weekly game plan loaded');
    setLoading(false);
  }
  const work = day.filter(b => !b.is_protected);
  const logOf = (id: string) => blockLogs.find(l => l.block_id === id);
  const doneCount = work.filter(b => logOf(b.id)?.done).length;
  const pct = work.length ? Math.round((doneCount / work.length) * 100) : 0;
  const n = minutesNow();
  const missed = sortTasks(tasks.filter(isOverdue));

  async function toggleTimer(id: string) {
    const l = logOf(id);
    if (l?.running_since) await setBlockLog(id, { seconds_tracked: elapsed(l), running_since: null });
    else await setBlockLog(id, { running_since: new Date().toISOString() });
  }
  async function toggleDone(id: string) {
    const l = logOf(id);
    const patch: Partial<BlockLog> = { done: !l?.done };
    if (!l?.done && l?.running_since) { patch.seconds_tracked = elapsed(l); patch.running_since = null; }
    await setBlockLog(id, patch);
  }

  return (
    <>
      <div className="ph">
        <div>
          <div className="eyebrow">{fmtDate(ctNow().iso, { weekday: 'long', month: 'long', day: 'numeric' })} · Central Time</div>
          <h1>My Day</h1>
          <p className="sub">A flexible framework, not a rigid calendar. Tasks show under the block that fits their department.</p>
        </div>
        <div className="qa">
          <button className="btn" onClick={() => quickAdd('interrupt')}>Log interruption</button>
          <button className="btn" onClick={async () => { const c = await carryForward(); toast(c ? `Moved ${c} to tomorrow` : 'Nothing to move'); }}>Move unfinished to tomorrow</button>
        </div>
      </div>
      <div className="daybar">
        <b style={{ fontFamily: 'var(--mono)', fontVariantNumeric: 'tabular-nums' }}>{doneCount}/{work.length}</b>
        <span style={{ color: 'var(--fg3)' }}>blocks done</span>
        <div className="prog"><i style={{ width: `${pct}%` }} /></div>
        <span style={{ color: 'var(--fg3)', fontSize: 12.5 }}>Breaks protected</span>
      </div>
      {(!planned || planOutdated(blocks)) && (
        <div className="plan-banner">
          <div>{planned
            ? <><b>Your game plan has an update:</b> a daily DM block and refreshed deep-work blocks. Loading it replaces your schedule, including any block edits.</>
            : <><b>Your weekly game plan is ready.</b> Recruiting blocks matched to iClosed, a daily DM block, a deep-work focus for each day and Thursday’s 1:00 meeting. It replaces the current schedule.</>}</div>
          <button className="btn primary" disabled={loading} onClick={loadPlan}>{loading ? 'Loading…' : 'Load it'}</button>
        </div>
      )}
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={view === 'today'} className={view === 'today' ? 'on' : ''} onClick={() => setView('today')}>Today</button>
        <button role="tab" aria-selected={view === 'week'} className={view === 'week' ? 'on' : ''} onClick={() => setView('week')}>Week</button>
      </div>
      {view === 'week' ? (
        <div className="week">
          {[1, 2, 3, 4, 5].map(w => (
            <section key={w} className={`panel wday ${w === wd ? 'is-today' : ''}`}>
              <h2 className="sec">{DAY_NAMES[w]}{w === wd && <span className="pill ok" style={{ marginLeft: 8 }}>Today</span>}</h2>
              {blocksFor(w).map(b => (
                <div key={b.id} className={`wblock ${b.is_protected ? (/meeting/i.test(b.title) ? 'fixed' : 'protected') : ''} ${b.departments.includes('Recruiting') ? 'rec' : ''}`}>
                  <time>{fmt12(b.start_time).replace(':00', '')}–{fmt12(b.end_time).replace(':00', '')}</time>
                  <span>{b.title}</span>
                </div>
              ))}
              {blocksFor(w).length === 0 && <div className="empty">Nothing planned.</div>}
            </section>
          ))}
        </div>
      ) : (
      <div className="grid2">
        <section className="panel">
          <div className="timeline">
            {day.length === 0 && <div className="empty">{planned ? 'Weekend. Nothing on the plan today.' : 'No schedule yet.'}</div>}
            {day.map(b => {
              const l = logOf(b.id);
              const isNow = toMin(b.start_time) <= n && n < toMin(b.end_time);
              const bt = b.departments.length
                ? sortTasks(tasks.filter(x => isOpen(x) && b.departments.includes(x.department) && (!x.due_date || x.due_date <= t))).slice(0, 4)
                : [];
              return (
                <div key={b.id} className={`block ${isNow ? 'now' : ''} ${l?.done ? 'bdone' : ''} ${b.is_protected ? 'protected' : ''}`}>
                  <div className="time">{fmt12(b.start_time)}<small>to {fmt12(b.end_time)}</small></div>
                  <div style={{ minWidth: 0 }}>
                    <div className="bhead">
                      <span className="bt">{b.title}</span>
                      <div className="bact">
                        {!b.is_protected && <>
                          <span className={`timer ${l?.running_since ? 'run' : ''}`}>{fmtSecs(elapsed(l))}</span>
                          <button className="btn sm" onClick={() => toggleTimer(b.id)}>{l?.running_since ? 'Stop' : 'Start'}</button>
                        </>}
                        {b.is_recap && <Link className="btn sm" href="/recaps">Recap</Link>}
                        {!b.is_protected && <button className={`btn sm ${l?.done ? '' : 'ghost'}`} onClick={() => toggleDone(b.id)}>{l?.done ? 'Done ✓' : 'Mark done'}</button>}
                        <button className="btn sm ghost" onClick={() => editBlock(b.id)} aria-label={`Edit ${b.title}`}>Edit</button>
                      </div>
                    </div>
                    {b.description && <p className="bdesc">{b.description}</p>}
                    {bt.length > 0 && (
                      <div className="btasks">
                        {bt.map(x => (
                          <div key={x.id} className="bt-i"><Check t={x} /><button className="ttitle" style={{ fontWeight: 400 }} onClick={() => openTask(x.id)}>{x.title}</button>{x.due_date && <DueTag t={x} />}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <div className="stack sideCard">
          <section className="panel">
            <div className="panel-h"><h2 className="sec">Missed &amp; carried <span className="n">{missed.length}</span></h2></div>
            <TaskList tasks={missed} empty="Nothing missed. Overdue work shows here automatically." />
          </section>
          <section className="panel">
            <div className="panel-h"><h2 className="sec">Interruptions today</h2></div>
            {interruptions.length ? (
              <div className="activity">{interruptions.map(i => <div key={i.id}><time>{fmtClock(i.created_at)}</time>{i.body}</div>)}</div>
            ) : <div className="empty">None logged. Use “Log interruption” for urgent requests that pull you off plan.</div>}
          </section>
        </div>
      </div>
      )}
    </>
  );
}
