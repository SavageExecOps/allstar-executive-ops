'use client';

import { useEffect, useState, type ReactNode } from 'react';

/** Section tabs for a module page. Remembers the last tab per page for this viewer. */
export function ModuleTabs({ id, tabs }: { id: string; tabs: { label: string; body: ReactNode }[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    try { const v = Number(localStorage.getItem(`aeo.tab.${id}`)); if (v > 0 && v < tabs.length) setI(v); } catch { /* ignore */ }
  }, [id, tabs.length]);
  const pick = (n: number) => { setI(n); try { localStorage.setItem(`aeo.tab.${id}`, String(n)); } catch { /* ignore */ } };
  return (
    <>
      <div className="tabs mtabs" role="tablist">
        {tabs.map((t, n) => <button key={t.label} role="tab" aria-selected={i === n} className={i === n ? 'on' : ''} onClick={() => pick(n)}>{t.label}</button>)}
      </div>
      <section className="panel" key={i}>{tabs[i]?.body}</section>
    </>
  );
}
