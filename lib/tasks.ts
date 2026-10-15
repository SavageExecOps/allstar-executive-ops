import type { Task } from './types';
import { addDays, dayOf, endOfWeek, fmtDate, relDate, today } from './time';
import { PRIORITIES } from './types';

export const isOpen = (t: Task) => t.status !== 'Done';
export const isOverdue = (t: Task) => isOpen(t) && !!t.due_date && t.due_date < today();
export const isWaiting = (t: Task) => isOpen(t) && (t.status === 'Waiting' || !!t.waiting_on);
export const waitingOnWylie = (t: Task) => isWaiting(t) && /wylie/i.test(t.waiting_on ?? '');

export function sortTasks(list: Task[]) {
  return list.slice().sort((a, b) =>
    (Number(b.is_top_priority) - Number(a.is_top_priority)) ||
    (PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority)) ||
    ((a.due_date ?? '9999') < (b.due_date ?? '9999') ? -1 : (a.due_date ?? '9999') > (b.due_date ?? '9999') ? 1 : 0));
}

export function metrics(tasks: Task[]) {
  const t = today();
  const open = tasks.filter(isOpen);
  return {
    open,
    today: open.filter(x => x.due_date === t),
    overdue: open.filter(isOverdue),
    critical: open.filter(x => x.priority === 'Critical' && !isOverdue(x)),
    waiting: open.filter(isWaiting),
    upcoming: open.filter(x => x.due_date && x.due_date > t && x.due_date <= addDays(t, 7)),
    doneToday: tasks.filter(x => x.status === 'Done' && x.completed_at && dayOf(x.completed_at) === t),
    done: tasks.filter(x => x.status === 'Done'),
    unscheduled: open.filter(x => !x.due_date),
    top: open.filter(x => x.is_top_priority),
    needsConfirmation: open.filter(x => x.needs_confirmation?.length),
  };
}

export type TaskView = 'today' | 'tomorrow' | 'week' | 'overdue' | 'unscheduled' | 'waiting' | 'confirm' | 'all' | 'completed';
export const TASK_VIEWS: [TaskView, string][] = [
  ['today', 'Today'], ['tomorrow', 'Tomorrow'], ['week', 'This week'], ['overdue', 'Overdue'], ['unscheduled', 'No date'],
  ['waiting', 'Waiting'], ['confirm', 'Needs confirmation'], ['all', 'All open'], ['completed', 'Completed'],
];
export function filterView(tasks: Task[], view: TaskView): Task[] {
  const t = today();
  const open = tasks.filter(isOpen);
  switch (view) {
    case 'today': return open.filter(x => x.due_date && x.due_date <= t);
    case 'tomorrow': return open.filter(x => x.due_date === addDays(t, 1));
    case 'week': return open.filter(x => x.due_date && x.due_date >= t && x.due_date <= endOfWeek(addDays(t, 1)));
    case 'overdue': return open.filter(isOverdue);
    case 'unscheduled': return open.filter(x => !x.due_date);
    case 'waiting': return open.filter(isWaiting);
    case 'confirm': return open.filter(x => x.needs_confirmation?.length);
    case 'all': return open;
    case 'completed': return tasks.filter(x => x.status === 'Done').sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));
  }
}

// Lowercase a leading capital for mid-sentence use, but leave names/acronyms ("KPA", "E2E") alone.
const lc = (s: string) => /^[A-Z][a-z]/.test(s) && !/^(Wylie|Jonathan|KPA|ATM|QuickBooks|Venmo)\b/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;

/** Recaps are built only from stored records. Nothing is invented. */
export function buildRecap(tasks: Task[], interruptions: { body: string }[]) {
  const m = metrics(tasks);
  const t = today();
  const tomorrow = sortTasks(m.open.filter(x => !x.due_date || x.due_date <= addDays(t, 1))).slice(0, 3);
  const wylie = m.waiting.filter(waitingOnWylie);
  const others = m.waiting.filter(x => !waitingOnWylie(x));
  const bullets = (a: Task[]) => a.map(x => '• ' + x.title).join('\n');

  const detailed = [
    `DAILY OPERATIONS RECAP · ${fmtDate(t, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`,
    `\nCOMPLETED TODAY (${m.doneToday.length})\n${bullets(m.doneToday) || '• Nothing marked complete'}`,
    `\nOVERDUE (${m.overdue.length})\n${m.overdue.map(x => `• ${x.title} (due ${relDate(x.due_date)})`).join('\n') || '• None'}`,
    `\nWAITING ON OTHERS (${m.waiting.length})\n${m.waiting.map(x => `• ${x.waiting_on || 'Someone'}: ${x.title}${x.follow_up_date ? ` · follow up ${relDate(x.follow_up_date)}` : ''}`).join('\n') || '• None'}`,
    `\nDECISIONS NEEDED FROM WYLIE\n${bullets(wylie) || '• None'}`,
    interruptions.length ? `\nINTERRUPTIONS\n${interruptions.map(i => '• ' + i.body).join('\n')}` : '',
    `\nOPEN TASKS: ${m.open.length} · Missing info on ${m.needsConfirmation.length}`,
    `\nTOMORROW'S TOP THREE\n${tomorrow.map((x, i) => `${i + 1}. ${x.title}`).join('\n') || '• Nothing open'}`,
  ].filter(Boolean).join('\n');

  const executive = [
    `Hey Wylie, quick update for ${fmtDate(t, { weekday: 'long' })}.`,
    m.doneToday.length ? `\nDone today: ${m.doneToday.map(x => lc(x.title)).join('; ')}.` : '\nNo items closed out today.',
    wylie.length ? `\nNeed from you: ${wylie.map(x => lc(x.title.replace(/^Follow up with Wylie to /i, ''))).join('; ')}.` : '',
    others.length ? `\nStill waiting on ${Array.from(new Set(others.map(x => x.waiting_on || 'others'))).join(', ')}.` : '',
    tomorrow.length ? `\nTomorrow I'm focused on: ${tomorrow.map(x => lc(x.title)).join('; ')}.` : '',
  ].filter(Boolean).join('\n');

  return { detailed, executive };
}
