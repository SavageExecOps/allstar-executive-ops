'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useData } from '@/components/DataProvider';
import { AllstarMark } from '@/components/Logo';
import { HOME_LINES } from '@/lib/lines';
import { metrics } from '@/lib/tasks';
import { ctNow, fmtDate, TZ } from '@/lib/time';

export default function Home() {
  const { ready, tasks, homeName, error } = useData();
  const [now, setNow] = useState<Date | null>(null);
  const [bump, setBump] = useState(0);
  useEffect(() => { setNow(new Date()); const i = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(i); }, []);

  const p = ctNow(now ?? new Date());
  const greeting = p.h < 12 ? 'Good morning' : p.h < 17 ? 'Good afternoon' : 'Good evening';
  const line = HOME_LINES[bump % HOME_LINES.length];
  const m = metrics(tasks);
  const stats: [number, string, string][] = [
    [m.today.length, 'due today', '/tasks?view=today'],
    [m.waiting.length, 'waiting on others', '/waiting'],
    [m.overdue.length, 'overdue', '/tasks?view=overdue'],
  ];

  return (
    <div className="home">
      <AllstarMark className="home-watermark" />
      <header className="home-top">
        <div className="home-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/allstar-lockup-white.png" alt="ALL-STAR" width={220} height={40} />
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
          <div className="home-line-row">
            <p className="home-line" key={bump}>{line}</p>
            <button type="button" className="home-another" onClick={() => setBump(b => b + 1)}>Another one</button>
          </div>
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
          <Link href="/command" className="home-cta">
            Take the wheel
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </Link>
          <Link href="/my-day" className="home-ghost">Open My Day</Link>
        </div>
      </main>
    </div>
  );
}
