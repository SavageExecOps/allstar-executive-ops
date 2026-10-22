'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SetSailIntro, SetSailPreload } from '@/components/SetSail';
import { useData } from '@/components/DataProvider';
import { HOME_LINES, HOME_TITLE } from '@/lib/lines';
import { metrics } from '@/lib/tasks';
import { ctNow, fmtDate, TZ } from '@/lib/time';

export default function Home() {
  const { ready, tasks, homeName, error } = useData();
  const [now, setNow] = useState<Date | null>(null);
  const [lineIdx, setLineIdx] = useState<number | null>(null);
  const router = useRouter();
  const [sailing, setSailing] = useState(false);
  const gone = useRef(false);
  useEffect(() => {
    router.prefetch('/command');
  }, [router]);
  const arrive = useCallback(() => { if (gone.current) return; gone.current = true; router.push('/command'); }, [router]);
  useEffect(() => { setNow(new Date()); const i = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(i); }, []);
  // A fresh line on every visit, never the same one twice in a row.
  useEffect(() => {
    let last = -1;
    try { last = Number(localStorage.getItem('aeo.lastLine') ?? -1); } catch { /* storage unavailable */ }
    let i = Math.floor(Math.random() * HOME_LINES.length);
    if (HOME_LINES.length > 1 && i === last) i = (i + 1) % HOME_LINES.length;
    setLineIdx(i);
    try { localStorage.setItem('aeo.lastLine', String(i)); } catch { /* ignore */ }
  }, []);

  const p = ctNow(now ?? new Date());
  const greeting = p.h < 12 ? 'Good morning' : p.h < 17 ? 'Good afternoon' : 'Good evening';
  const m = metrics(tasks);
  const stats: [number, string, string][] = [
    [m.today.length, 'due today', '/tasks?view=today'],
    [m.waiting.length, 'waiting on others', '/waiting'],
    [m.overdue.length, 'overdue', '/tasks?view=overdue'],
  ];

  return (
    <div className="home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="home-watermark" src="/allstar-pegasus-white.png" alt="" aria-hidden="true" width={601} height={534} />
      <header className="home-top">
        <div className="home-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/allstar-wordmark-white.png" alt="ALL-STAR" width={240} height={44} />
          <span className="home-rule" aria-hidden="true" />
          <span className="home-unit">EXECUTIVE OPS</span>
        </div>
        <div className="home-clock">
          <b>{now ? now.toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }) : ' '}</b>
          <span>CENTRAL TIME</span>
        </div>
      </header>

      <main className="home-main">
        <div className="home-hero">
          <div className="home-date">{fmtDate(p.iso, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          <h1>{greeting},<br />{homeName}.</h1>
          <div className="home-title">{HOME_TITLE}</div>
          <p className="home-line">{lineIdx === null ? '\u00a0' : HOME_LINES[lineIdx]}</p>
        </div>

        {error ? <p className="home-err">{error}</p> : (
          <div className="home-stats">
            {stats.map(([n, label, href]) => (
              <Link key={label} href={href} className="home-stat">
                <span className={`home-n ${label === 'overdue' && n > 0 ? 'hot' : ''}`}>{ready ? n : '–'}</span>
                <span className="home-l">{label}</span>
              </Link>
            ))}
          </div>
        )}

        <div className="home-ctas">
          <Link href="/command" className="home-cta" onClick={e => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault(); setSailing(true);
          }}>
            Set sail
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </Link>
          <Link href="/my-day" className="home-ghost">Open My Day</Link>
        </div>
      </main>
      <SetSailPreload />
      {sailing && <SetSailIntro onDone={arrive} />}
    </div>
  );
}
