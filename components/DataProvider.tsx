'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { BlockLog, Interruption, Note, Preference, Project, ProjectUpdate, Recap, ScheduleBlock, Task, TaskActivity } from '@/lib/types';
import { addDays, today } from '@/lib/time';

type NewTask = Partial<Omit<Task, 'id' | 'created_at' | 'updated_at'>> & { title: string };

interface Data {
  ready: boolean;
  error: string | null;
  email: string | null;
  homeName: string;
  tasks: Task[];
  projects: Project[];
  projectUpdates: ProjectUpdate[];
  notes: Note[];
  preferences: Preference[];
  blocks: ScheduleBlock[];
  blockLogs: BlockLog[];
  interruptions: Interruption[];
  recaps: Recap[];
}

interface Actions {
  refresh: () => Promise<void>;
  toast: (msg: string) => void;
  createTask: (t: NewTask, activity?: string) => Promise<Task | null>;
  updateTask: (id: string, patch: Partial<Task>, activity?: string) => Promise<boolean>;
  toggleDone: (t: Task) => Promise<void>;
  toggleTop: (t: Task) => Promise<void>;
  deleteTask: (id: string) => Promise<boolean>;
  loadActivity: (taskId: string) => Promise<TaskActivity[]>;
  logActivity: (taskId: string, body: string) => Promise<void>;
  carryForward: () => Promise<number>;
  createProject: (p: Partial<Project> & { name: string }) => Promise<Project | null>;
  updateProject: (id: string, patch: Partial<Project>) => Promise<boolean>;
  addProjectUpdate: (projectId: string, body: string) => Promise<boolean>;
  createNote: (n: Partial<Note> & { body: string }) => Promise<boolean>;
  updateNote: (id: string, patch: Partial<Note>) => Promise<boolean>;
  deleteNote: (id: string) => Promise<boolean>;
  createPreference: (p: Partial<Preference> & { body: string }) => Promise<boolean>;
  updatePreference: (id: string, patch: Partial<Preference>) => Promise<boolean>;
  deletePreference: (id: string) => Promise<boolean>;
  updateBlock: (id: string, patch: Partial<ScheduleBlock>) => Promise<boolean>;
  setBlockLog: (blockId: string, patch: Partial<BlockLog>) => Promise<void>;
  replaceSchedule: (rows: Partial<ScheduleBlock>[]) => Promise<boolean>;
  addInterruption: (body: string, task?: NewTask) => Promise<boolean>;
  saveRecap: (kind: Recap['kind'], body: string) => Promise<boolean>;
  setHomeName: (name: string) => Promise<boolean>;
}

const Ctx = createContext<(Data & Actions) | null>(null);
export const useData = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useData must be used inside DataProvider');
  return v;
};

const EMPTY: Data = { ready: false, error: null, email: null, homeName: 'Savage', tasks: [], projects: [], projectUpdates: [], notes: [], preferences: [], blocks: [], blockLogs: [], interruptions: [], recaps: [] };

export function DataProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [d, setD] = useState<Data>(EMPTY);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const seeded = useRef(false);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600);
  }, []);

  /** Report a failed write. Never pretend a save happened. */
  const fail = useCallback((what: string, e: { message?: string } | null) => {
    toast(`Couldn't ${what}. ${e?.message ?? 'Check your connection and try again.'}`);
    return false as const;
  }, [toast]);

  const refresh = useCallback(async () => {
    const t = today();
    const [{ data: auth }, profile, tasks, projects, updates, notes, prefs, blocks, logs, ints, recaps] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('users').select('home_name').maybeSingle(),
      supabase.from('tasks').select('*').order('created_at'),
      supabase.from('projects').select('*').order('created_at'),
      supabase.from('project_updates').select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('notes').select('*').order('created_at', { ascending: false }),
      supabase.from('executive_preferences').select('*').order('created_at'),
      supabase.from('schedule_blocks').select('*').order('start_time'),
      supabase.from('day_block_logs').select('*').eq('day', t),
      supabase.from('interruptions').select('*').eq('day', t).order('created_at', { ascending: false }),
      supabase.from('daily_recaps').select('*').order('created_at', { ascending: false }).limit(60),
    ]);
    const firstErr = [tasks, projects, updates, notes, prefs, blocks, logs, ints, recaps].find(r => r.error)?.error;
    if (firstErr) { setD(s => ({ ...s, ready: true, error: firstErr.message })); return; }

    if (!seeded.current && !(tasks.data ?? []).length && !(projects.data ?? []).length) {
      seeded.current = true;
      const { error } = await supabase.rpc('seed_starting_items');
      if (!error) return refresh();
      setD(s => ({ ...s, ready: true, error: `Couldn't load starting items: ${error.message}` }));
      return;
    }
    seeded.current = true;
    setD({
      ready: true, error: null, email: auth.user?.email ?? null,
      homeName: (profile.data as { home_name?: string } | null)?.home_name || 'Savage',
      tasks: tasks.data as Task[], projects: projects.data as Project[], projectUpdates: updates.data as ProjectUpdate[],
      notes: notes.data as Note[], preferences: prefs.data as Preference[], blocks: blocks.data as ScheduleBlock[],
      blockLogs: logs.data as BlockLog[], interruptions: ints.data as Interruption[], recaps: recaps.data as Recap[],
    });
  }, [supabase]);

  useEffect(() => { refresh(); }, [refresh]);

  // Reload when the Central Time date rolls over, so the app starts the new day cleanly.
  useEffect(() => {
    let day = today();
    const i = setInterval(() => { if (today() !== day) { day = today(); refresh(); } }, 60_000);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(i); window.removeEventListener('focus', onFocus); };
  }, [refresh]);

  const logActivity = useCallback(async (taskId: string, body: string) => {
    await supabase.from('task_activity').insert({ task_id: taskId, body });
  }, [supabase]);

  const createTask: Actions['createTask'] = useCallback(async (t, activity = 'Created') => {
    const row = { ...t };
    if (row.waiting_on && !row.waiting_since) row.waiting_since = today();
    const { data, error } = await supabase.from('tasks').insert(row).select().single();
    if (error) { fail('add the task', error); return null; }
    await logActivity(data.id, activity);
    setD(s => ({ ...s, tasks: [...s.tasks, data as Task] }));
    return data as Task;
  }, [supabase, fail, logActivity]);

  const updateTask: Actions['updateTask'] = useCallback(async (id, patch, activity) => {
    const { data, error } = await supabase.from('tasks').update(patch).eq('id', id).select().single();
    if (error) return fail('save the task', error);
    if (activity) await logActivity(id, activity);
    setD(s => ({ ...s, tasks: s.tasks.map(x => x.id === id ? data as Task : x) }));
    return true;
  }, [supabase, fail, logActivity]);

  const toggleDone: Actions['toggleDone'] = useCallback(async (t) => {
    if (t.status === 'Done') {
      if (await updateTask(t.id, { status: 'To Do', completed_at: null }, 'Reopened')) toast('Reopened');
      return;
    }
    const ok = await updateTask(t.id, { status: 'Done', completed_at: new Date().toISOString(), is_top_priority: false }, 'Marked done');
    if (!ok) return;
    // Weekly recurring tasks roll forward exactly once.
    if (t.recurrence && /weekly/i.test(t.recurrence) && t.due_date) {
      const next = addDays(t.due_date, 7);
      const exists = d.tasks.some(x => x.id !== t.id && x.title === t.title && x.due_date === next);
      if (!exists) {
        const { id: _i, created_at: _c, updated_at: _u, completed_at: _d, ...rest } = t;
        await createTask({ ...rest, status: 'To Do', due_date: next, is_top_priority: false }, 'Created from recurring task');
      }
    }
    toast('Done');
  }, [updateTask, createTask, toast, d.tasks]);

  const toggleTop: Actions['toggleTop'] = useCallback(async (t) => {
    if (!t.is_top_priority && d.tasks.filter(x => x.status !== 'Done' && x.is_top_priority).length >= 3) {
      toast('Top three is full. Unstar one first.'); return;
    }
    await updateTask(t.id, { is_top_priority: !t.is_top_priority });
  }, [d.tasks, updateTask, toast]);

  const deleteTask: Actions['deleteTask'] = useCallback(async (id) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) return fail('delete the task', error);
    setD(s => ({ ...s, tasks: s.tasks.filter(x => x.id !== id) }));
    return true;
  }, [supabase, fail]);

  const loadActivity = useCallback(async (taskId: string) => {
    const { data } = await supabase.from('task_activity').select('*').eq('task_id', taskId).order('created_at', { ascending: false });
    return (data ?? []) as TaskActivity[];
  }, [supabase]);

  const carryForward = useCallback(async () => {
    const t = today(), tm = addDays(t, 1);
    const due = d.tasks.filter(x => x.status !== 'Done' && x.due_date && x.due_date <= t);
    if (!due.length) return 0;
    const { error } = await supabase.from('tasks').update({ due_date: tm }).in('id', due.map(x => x.id));
    if (error) { fail('move tasks', error); return 0; }
    await supabase.from('task_activity').insert(due.map(x => ({ task_id: x.id, body: 'Moved to tomorrow' })));
    await refresh();
    return due.length;
  }, [d.tasks, supabase, fail, refresh]);

  const createProject: Actions['createProject'] = useCallback(async (p) => {
    const { data, error } = await supabase.from('projects').insert(p).select().single();
    if (error) { fail('create the project', error); return null; }
    setD(s => ({ ...s, projects: [...s.projects, data as Project] }));
    return data as Project;
  }, [supabase, fail]);

  const updateProject: Actions['updateProject'] = useCallback(async (id, patch) => {
    const before = d.projects.find(p => p.id === id);
    const { data, error } = await supabase.from('projects').update(patch).eq('id', id).select().single();
    if (error) return fail('save the project', error);
    let upd: ProjectUpdate | null = null;
    if (before && patch.status && patch.status !== before.status) {
      const r = await supabase.from('project_updates').insert({ project_id: id, body: `Status → ${patch.status}` }).select().single();
      upd = r.data as ProjectUpdate | null;
    }
    setD(s => ({ ...s, projects: s.projects.map(x => x.id === id ? data as Project : x), projectUpdates: upd ? [upd, ...s.projectUpdates] : s.projectUpdates }));
    return true;
  }, [supabase, fail, d.projects]);

  const addProjectUpdate: Actions['addProjectUpdate'] = useCallback(async (projectId, body) => {
    const { data, error } = await supabase.from('project_updates').insert({ project_id: projectId, body }).select().single();
    if (error) return fail('add the update', error);
    setD(s => ({ ...s, projectUpdates: [data as ProjectUpdate, ...s.projectUpdates] }));
    return true;
  }, [supabase, fail]);

  const createNote: Actions['createNote'] = useCallback(async (n) => {
    const { data, error } = await supabase.from('notes').insert(n).select().single();
    if (error) return fail('save the note', error);
    setD(s => ({ ...s, notes: [data as Note, ...s.notes] }));
    return true;
  }, [supabase, fail]);
  const updateNote: Actions['updateNote'] = useCallback(async (id, patch) => {
    const { data, error } = await supabase.from('notes').update(patch).eq('id', id).select().single();
    if (error) return fail('save the note', error);
    setD(s => ({ ...s, notes: s.notes.map(x => x.id === id ? data as Note : x) }));
    return true;
  }, [supabase, fail]);
  const deleteNote: Actions['deleteNote'] = useCallback(async (id) => {
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) return fail('delete the note', error);
    setD(s => ({ ...s, notes: s.notes.filter(x => x.id !== id) }));
    return true;
  }, [supabase, fail]);

  const createPreference: Actions['createPreference'] = useCallback(async (p) => {
    const { data, error } = await supabase.from('executive_preferences').insert(p).select().single();
    if (error) return fail('save the preference', error);
    setD(s => ({ ...s, preferences: [...s.preferences, data as Preference] }));
    return true;
  }, [supabase, fail]);
  const updatePreference: Actions['updatePreference'] = useCallback(async (id, patch) => {
    const { data, error } = await supabase.from('executive_preferences').update(patch).eq('id', id).select().single();
    if (error) return fail('save the preference', error);
    setD(s => ({ ...s, preferences: s.preferences.map(x => x.id === id ? data as Preference : x) }));
    return true;
  }, [supabase, fail]);
  const deletePreference: Actions['deletePreference'] = useCallback(async (id) => {
    const { error } = await supabase.from('executive_preferences').delete().eq('id', id);
    if (error) return fail('delete the preference', error);
    setD(s => ({ ...s, preferences: s.preferences.filter(x => x.id !== id) }));
    return true;
  }, [supabase, fail]);

  const updateBlock: Actions['updateBlock'] = useCallback(async (id, patch) => {
    const { data, error } = await supabase.from('schedule_blocks').update(patch).eq('id', id).select().single();
    if (error) return fail('save the block', error);
    setD(s => ({ ...s, blocks: s.blocks.map(x => x.id === id ? data as ScheduleBlock : x).sort((a, b) => a.start_time.localeCompare(b.start_time)) }));
    return true;
  }, [supabase, fail]);

  const setBlockLog: Actions['setBlockLog'] = useCallback(async (blockId, patch) => {
    const day = today();
    const existing = d.blockLogs.find(l => l.block_id === blockId);
    const row = { block_id: blockId, day, done: existing?.done ?? false, seconds_tracked: existing?.seconds_tracked ?? 0, running_since: existing?.running_since ?? null, ...patch };
    const { data, error } = await supabase.from('day_block_logs').upsert(row, { onConflict: 'owner_id,block_id,day' }).select().single();
    if (error) { fail('update the block', error); return; }
    setD(s => ({ ...s, blockLogs: [...s.blockLogs.filter(l => l.block_id !== blockId), data as BlockLog] }));
  }, [supabase, fail, d.blockLogs]);

  // Swaps the whole schedule for a new set of blocks (today's block timers reset).
  const replaceSchedule: Actions['replaceSchedule'] = useCallback(async (rows) => {
    const { data, error } = await supabase.from('schedule_blocks').insert(rows).select();
    if (error) return fail('load the schedule', error);
    const keep = new Set((data as ScheduleBlock[]).map(x => x.id));
    const old = d.blocks.map(x => x.id).filter(id => !keep.has(id));
    if (old.length) {
      const { error: delErr } = await supabase.from('schedule_blocks').delete().in('id', old);
      if (delErr) return fail('clear the old schedule', delErr);
    }
    setD(s => ({ ...s, blocks: (data as ScheduleBlock[]).sort((a, b) => a.start_time.localeCompare(b.start_time)), blockLogs: s.blockLogs.filter(l => keep.has(l.block_id)) }));
    return true;
  }, [supabase, fail, d.blocks]);

  const addInterruption: Actions['addInterruption'] = useCallback(async (body, task) => {
    let taskId: string | null = null;
    if (task) { const created = await createTask(task, 'Logged as an interruption'); if (!created) return false; taskId = created.id; }
    const { data, error } = await supabase.from('interruptions').insert({ body, day: today(), task_id: taskId }).select().single();
    if (error) return fail('log the interruption', error);
    setD(s => ({ ...s, interruptions: [data as Interruption, ...s.interruptions] }));
    return true;
  }, [supabase, fail, createTask]);

  const saveRecap: Actions['saveRecap'] = useCallback(async (kind, body) => {
    const { data, error } = await supabase.from('daily_recaps').insert({ kind, body, recap_date: today() }).select().single();
    if (error) return fail('save the recap', error);
    setD(s => ({ ...s, recaps: [data as Recap, ...s.recaps] }));
    return true;
  }, [supabase, fail]);

  const setHomeName: Actions['setHomeName'] = useCallback(async (name) => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return fail('save your name', null);
    const { error } = await supabase.from('users').update({ home_name: name }).eq('id', auth.user.id);
    if (error) return fail('save your name', error);
    setD(s => ({ ...s, homeName: name }));
    return true;
  }, [supabase, fail]);

  const value = {
    ...d, refresh, toast, createTask, updateTask, toggleDone, toggleTop, deleteTask, loadActivity, logActivity, carryForward,
    createProject, updateProject, addProjectUpdate, createNote, updateNote, deleteNote,
    createPreference, updatePreference, deletePreference, updateBlock, setBlockLog, replaceSchedule, addInterruption, saveRecap, setHomeName,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </Ctx.Provider>
  );
}
