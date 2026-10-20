'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useData } from './DataProvider';
import { useOps } from './OpsData';
import { ctNow, fmt12, TZ, toMin, weekday } from '@/lib/time';

const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });

/** The strip across the top of every page: what you should be doing right now, and what's next. */
export function NowBar() {
  const { blocks } = useData();
  const { recruits } = useOps();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const i = setInterval(() => setNow(new Date()), 20_000); return () => clearInterval(i); }, []);
  if (!now) return <div className="nowbar" aria-hidden="true" />;

  const p = ctNow(now);
  const n = p.h * 60 + p.m;
  const wd = weekday(p.iso);
  const specific = blocks.filter(b => b.weekday === wd);
  const day = (specific.length ? specific : blocks.filter(b => b.weekday === null)).slice().sort((a, b) => a.start_time.localeCompare(b.start_time));
  const cur = day.find(b => toMin(b.start_time) <= n && n < toMin(b.end_time));
  const nextBlock = day.find(b => toMin(b.start_time) > n);

  // Today's booked calls still ahead (Central Time).
  const calls = recruits
    .filter(r => ['New', 'Scheduled'].includes(r.status) && r.appointment_at && r.appointment_at > now.toISOString() && ctNow(new Date(r.appointment_at)).iso === p.iso)
    .sort((a, b) => a.appointment_at!.localeCompare(b.appointment_at!));
  const callsIn = (start: number, end: number) => calls.filter(r => { const c = ctNow(new Date(r.appointment_at!)); const m = c.h * 60 + c.m; return m >= start && m < end; });

  let next: string | null = null;
  if (cur?.departments.includes('Recruiting') && callsIn(n, toMin(cur.end_time)).length) {
    const c = callsIn(n, toMin(cur.end_time))[0];
    next = `Call with ${c.name} · ${clock(c.appointment_at!)}`;
  } else if (nextBlock) {
    const booked = nextBlock.departments.includes('Recruiting') ? callsIn(toMin(nextBlock.start_time), toMin(nextBlock.end_time)).length : 0;
    next = `${nextBlock.title} · ${fmt12(nextBlock.start_time)}${booked ? ` · ${booked} booked` : ''}`;
  }

  const time = <span className="clk">{now.toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })}<small>CT</small></span>;

  if (!cur) {
    const label = !day.length ? 'Off the clock today.' : !nextBlock ? 'Day’s done. Off the clock.' : 'Before the day starts.';
    return (
      <div className="nowbar" role="status">
        <span className="tag dim"><span className="dot" />{nextBlock ? 'SOON' : 'OFF'}</span>
        <span className="what">{label}</span>
        {next && <><span className="sep" /><span className="tag dim ntag">NEXT</span><span className="next">{next}</span></>}
        {time}
      </div>
    );
  }

  const start = toMin(cur.start_time), end = toMin(cur.end_time);
  const pct = Math.min(100, Math.max(0, ((n - start) / (end - start)) * 100));
  const left = end - n;
  const leftTxt = left >= 60 ? `${Math.floor(left / 60)} hr ${left % 60} min left` : `${left} min left`;

  return (
    <div className="nowbar" role="status">
      <span className="tag"><span className="dot" />NOW</span>
      <Link href="/my-day" className="what">{cur.title}</Link>
      <span className="prog" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>
      <span className="left">{leftTxt}</span>
      {next && <><span className="sep" /><span className="tag dim ntag">NEXT</span><span className="next">{next}</span></>}
      {time}
    </div>
  );
}
