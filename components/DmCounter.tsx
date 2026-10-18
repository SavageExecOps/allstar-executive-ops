'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useData } from '@/components/DataProvider';
import { explain } from '@/lib/useTable';
import { addDays, today, weekday } from '@/lib/time';

export type DmLog = { id: string; day: string; sent: number; replies: number; booked: number; notes: string | null };
type K = 'sent' | 'replies' | 'booked';
const LABEL: Record<K, string> = { sent: 'DMs sent', replies: 'Replies', booked: 'Calls booked' };
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

/** Tap-to-count DM tracker for the outreach block. */
export function DmCounter({ dm }: { dm: ReturnType<typeof useDmLogs> }) {
  if (dm.missing) return <section className="panel"><div className="empty">The DM tracker needs the latest database update (0007_phase2.sql).</div></section>;
  const t = dm.logs.find(l => l.day === today()) ?? { sent: 0, replies: 0, booked: 0 };
  const w = sumLogs(dm.logs, weekStart());
  return (
    <section className="panel dmc" aria-label="DM tracker">
      <div className="panel-h"><h2 className="sec">DMs today</h2>
        <span className="hint" style={{ margin: 0 }}>This week: {w.sent} sent · {w.replies} replies ({pct(w.replies, w.sent)}) · {w.booked} booked ({pct(w.booked, w.replies)})</span></div>
      <div className="dmc-row">
        {(['sent', 'replies', 'booked'] as K[]).map(k => (
          <div key={k} className="dmc-cell">
            <span className="stat-n">{t[k]}</span>
            <span className="stat-l">{LABEL[k]}</span>
            <div className="dmc-btns">
              <button className="btn sm ghost" aria-label={`Minus one ${LABEL[k]}`} onClick={() => dm.bump(k, -1)} disabled={t[k] === 0}>−</button>
              <button className="btn sm" aria-label={`Plus one ${LABEL[k]}`} onClick={() => dm.bump(k, 1)}>+1</button>
              {k === 'sent' && <button className="btn sm" aria-label="Plus five DMs sent" onClick={() => dm.bump(k, 5)}>+5</button>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
