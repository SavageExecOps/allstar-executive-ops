'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useData } from '@/components/DataProvider';

export type Row = { id: string } & Record<string, unknown>;

/** Explains a failed save in plain words. A missing table means a database update hasn't been run. */
export function explain(e: { message?: string } | null) {
  return /relation .* does not exist|could not find the table|schema cache/i.test(e?.message ?? '')
    ? 'The latest database update hasn’t been run in Supabase yet.'
    : e?.message ?? 'Check your connection and try again.';
}

/** Loads one table (owner-only via RLS) and keeps it in sync with every change made here. */
export function useTable<T extends Row = Row>(table: string, order: { col: string; asc?: boolean } = { col: 'created_at', asc: false }) {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useData();
  const [rows, setRows] = useState<T[]>([]);
  const [ready, setReady] = useState(false);
  const [missing, setMissing] = useState(false);

  const fail = useCallback((what: string, e: { message?: string } | null) => { toast(`Couldn't ${what}. ${explain(e)}`); return false as const; }, [toast]);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from(table).select('*').order(order.col, { ascending: order.asc ?? false, nullsFirst: false });
    if (error) setMissing(/does not exist|could not find|schema cache/i.test(error.message));
    else setRows(data as T[]);
    setReady(true);
  }, [supabase, table, order.col, order.asc]);
  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (row: Partial<T>) => {
    const { data, error } = await supabase.from(table).insert(row).select().single();
    if (error) { fail('save it', error); return null; }
    setRows(r => [data as T, ...r]);
    return data as T;
  }, [supabase, table, fail]);

  const update = useCallback(async (id: string, patch: Partial<T>) => {
    const { data, error } = await supabase.from(table).update(patch).eq('id', id).select().single();
    if (error) return fail('save it', error);
    setRows(r => r.map(x => x.id === id ? data as T : x));
    return true;
  }, [supabase, table, fail]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) return fail('delete it', error);
    setRows(r => r.filter(x => x.id !== id));
    return true;
  }, [supabase, table, fail]);

  return { rows, ready, missing, reload: load, create, update, remove, supabase };
}

export const money = (n: unknown) =>
  n == null || n === '' ? '—' : Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
