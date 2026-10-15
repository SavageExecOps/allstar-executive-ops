'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useData } from './DataProvider';
import type { AgendaItem, Assignment, Manager, Recruit, RecruitNote } from '@/lib/recruiting';

interface Ops {
  opsReady: boolean;
  managers: Manager[];
  recruits: Recruit[];
  assignments: Assignment[];
  agenda: AgendaItem[];
  createRecruit: (r: Partial<Recruit> & { name: string }) => Promise<Recruit | null>;
  updateRecruit: (id: string, patch: Partial<Recruit>) => Promise<boolean>;
  deleteRecruit: (id: string) => Promise<boolean>;
  assign: (recruit: Recruit, managerId: string, reason: string, wasUpNext: boolean) => Promise<boolean>;
  loadNotes: (recruitId: string) => Promise<RecruitNote[]>;
  addNote: (recruitId: string, body: string) => Promise<RecruitNote | null>;
  createManager: (m: Partial<Manager> & { name: string }) => Promise<boolean>;
  updateManager: (id: string, patch: Partial<Manager>) => Promise<boolean>;
  addAgenda: (a: Partial<AgendaItem> & { topic: string }) => Promise<boolean>;
  updateAgenda: (id: string, patch: Partial<AgendaItem>) => Promise<boolean>;
  deleteAgenda: (id: string) => Promise<boolean>;
}

const Ctx = createContext<Ops | null>(null);
export const useOps = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useOps must be used inside OpsProvider');
  return v;
};

export function OpsProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useData();
  const [opsReady, setReady] = useState(false);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [recruits, setRecruits] = useState<Recruit[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);

  const fail = useCallback((what: string, e: { message?: string } | null) => {
    // A missing table means the Phase 2 database step hasn't been run yet.
    const msg = /relation .* does not exist|could not find the table/i.test(e?.message ?? '')
      ? 'The recruiting database update hasn’t been run yet in Supabase.'
      : e?.message ?? 'Check your connection and try again.';
    toast(`Couldn't ${what}. ${msg}`);
    return false as const;
  }, [toast]);

  const load = useCallback(async () => {
    const [m, r, a, g] = await Promise.all([
      supabase.from('managers').select('*').order('sort_order'),
      supabase.from('recruits').select('*').order('created_at', { ascending: false }),
      supabase.from('manager_assignments').select('*').order('assigned_at', { ascending: false }),
      supabase.from('wylie_agenda').select('*').order('created_at', { ascending: false }),
    ]);
    if (!m.error) setManagers(m.data as Manager[]);
    if (!r.error) setRecruits(r.data as Recruit[]);
    if (!a.error) setAssignments(a.data as Assignment[]);
    if (!g.error) setAgenda(g.data as AgendaItem[]);
    setReady(true);
  }, [supabase]);
  useEffect(() => { load(); }, [load]);

  const createRecruit: Ops['createRecruit'] = useCallback(async (r) => {
    const { data, error } = await supabase.from('recruits').insert(r).select().single();
    if (error) { fail('add the recruit', error); return null; }
    setRecruits(s => [data as Recruit, ...s]);
    return data as Recruit;
  }, [supabase, fail]);

  const updateRecruit: Ops['updateRecruit'] = useCallback(async (id, patch) => {
    const { data, error } = await supabase.from('recruits').update(patch).eq('id', id).select().single();
    if (error) return fail('save the recruit', error);
    setRecruits(s => s.map(x => x.id === id ? data as Recruit : x));
    return true;
  }, [supabase, fail]);

  const deleteRecruit: Ops['deleteRecruit'] = useCallback(async (id) => {
    const { error } = await supabase.from('recruits').delete().eq('id', id);
    if (error) return fail('delete the recruit', error);
    setRecruits(s => s.filter(x => x.id !== id));
    setAssignments(s => s.filter(x => x.recruit_id !== id));
    return true;
  }, [supabase, fail]);

  const assign: Ops['assign'] = useCallback(async (recruit, managerId, reason, wasUpNext) => {
    const { data: a, error } = await supabase.from('manager_assignments')
      .insert({ recruit_id: recruit.id, manager_id: managerId, reason, was_up_next: wasUpNext }).select().single();
    if (error) return fail('assign the manager', error);
    setAssignments(s => [a as Assignment, ...s]);
    const advance = ['New', 'Scheduled', 'Call Completed', 'No Show', 'Reschedule', 'Follow-up Needed'].includes(recruit.status);
    return updateRecruit(recruit.id, { manager_id: managerId, ...(advance ? { status: 'Manager Assigned' } : {}) });
  }, [supabase, fail, updateRecruit]);

  const loadNotes = useCallback(async (recruitId: string) => {
    const { data } = await supabase.from('recruit_notes').select('*').eq('recruit_id', recruitId).order('created_at', { ascending: false });
    return (data ?? []) as RecruitNote[];
  }, [supabase]);

  const addNote: Ops['addNote'] = useCallback(async (recruitId, body) => {
    const { data, error } = await supabase.from('recruit_notes').insert({ recruit_id: recruitId, body }).select().single();
    if (error) { fail('save the note', error); return null; }
    return data as RecruitNote;
  }, [supabase, fail]);

  const createManager: Ops['createManager'] = useCallback(async (m) => {
    const sort_order = Math.max(0, ...managers.map(x => x.sort_order)) + 1;
    const { data, error } = await supabase.from('managers').insert({ sort_order, ...m }).select().single();
    if (error) return fail('add the manager', error);
    setManagers(s => [...s, data as Manager]);
    return true;
  }, [supabase, fail, managers]);

  const updateManager: Ops['updateManager'] = useCallback(async (id, patch) => {
    const { data, error } = await supabase.from('managers').update(patch).eq('id', id).select().single();
    if (error) return fail('save the manager', error);
    setManagers(s => s.map(x => x.id === id ? data as Manager : x));
    return true;
  }, [supabase, fail]);

  const addAgenda: Ops['addAgenda'] = useCallback(async (a) => {
    const { data, error } = await supabase.from('wylie_agenda').insert(a).select().single();
    if (error) return fail('add it to the list', error);
    setAgenda(s => [data as AgendaItem, ...s]);
    return true;
  }, [supabase, fail]);

  const updateAgenda: Ops['updateAgenda'] = useCallback(async (id, patch) => {
    const { data, error } = await supabase.from('wylie_agenda').update(patch).eq('id', id).select().single();
    if (error) return fail('save it', error);
    setAgenda(s => s.map(x => x.id === id ? data as AgendaItem : x));
    return true;
  }, [supabase, fail]);

  const deleteAgenda: Ops['deleteAgenda'] = useCallback(async (id) => {
    const { error } = await supabase.from('wylie_agenda').delete().eq('id', id);
    if (error) return fail('delete it', error);
    setAgenda(s => s.filter(x => x.id !== id));
    return true;
  }, [supabase, fail]);

  const value = { opsReady, managers, recruits, assignments, agenda, createRecruit, updateRecruit, deleteRecruit, assign,
    loadNotes, addNote, createManager, updateManager, addAgenda, updateAgenda, deleteAgenda };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
