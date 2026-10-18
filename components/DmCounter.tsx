'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useData } from '@/components/DataProvider';
import { explain } from '@/lib/useTable';
import { addDays, today, weekday } from '@/lib/time';

export type DmLog = { id: string; day: string; sent: number; replies: number; booked: number; notes: string | null };
type K = 'sent' | 'replies' | 'booked';
export const weekStart = (d = today()) => addDays(d, -((weekday(d) + 6) % 7));

/** All DM days, newest first. */
export function useDmLogs() {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useData();
  const [logs, setLogs] = useState<DmLog[]>([]);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    supabase.from('dm_logs').select('*').order('day', { ascending: false }).then(({ data, error }) => {
      if (error) setMissing(true); else setLogs(data as DmLog[]);
    });
  }, [supabase]);
  const bump = useCallback(async (k: K, by: number) => {
    const d = today();
    const cur = logs.find(l => l.day === d) ?? { sent: 0, replies: 0, booked: 0 };
    const row = { day: d, sent: cur.sent, replies: cur.replies, booked: cur.booked, [k]: Math.max(0, cur[k] + by) };
    const { data, error } = await supabase.from('dm_logs').upsert(row, { onConflict: 'owner_id,day' }).select().single();
    if (error) { toast(`Couldn't save. ${explain(error)}`); return; }
    setLogs(ls => [data as DmLog, ...ls.filter(l => l.day !== d)]);
  }, [supabase, logs, toast]);
  return { logs, missing, bump };
}

export const sumLogs = (logs: DmLog[], from: string, to = '9999') =>
  logs.filter(l => l.day >= from && l.day <= to).reduce((s, l) => ({ sent: s.sent + l.sent, replies: s.replies + l.replies, booked: s.booked + l.booked }), { sent: 0, replies: 0, booked: 0 });
export const pct = (a: number, b: number) => b ? `${Math.round((a / b) * 100)}%` : '—';

/** One tap each time a DM turns into a booked call. */
export function DmCounter({ dm }: { dm: ReturnType<typeof useDmLogs> }) {
  if (dm.missing) return <section className="panel"><div className="empty">The DM counter needs the latest database update (see SETUP.md).</div></section>;
  const t = dm.logs.find(l => l.day === today())?.booked ?? 0;
  const w = sumLogs(dm.logs, weekStart()).booked;
  return (
    <section className="panel dmc" aria-label="Calls booked from DMs">
      <div className="dmc-one">
        <div><span className="stat-n">{t}</span><span className="stat-l"> booked from DMs today · {w} this week</span></div>
        <div className="dmc-btns" style={{ marginTop: 0 }}>
          <button className="btn sm ghost" aria-label="Minus one booked" onClick={() => dm.bump('booked', -1)} disabled={t === 0}>−</button>
          <button className="btn sm primary" aria-label="Plus one booked from DMs" onClick={() => dm.bump('booked', 1)}>+1 booked</button>
        </div>
      </div>
    </section>
  );
}
