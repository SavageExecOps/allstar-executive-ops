'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DataProvider, useData } from './DataProvider';
import { UICtx, useUI, type QuickKind } from './UI';
import { AllstarMark } from './Logo';
import { Icon, NAV } from './nav';
import { BlockEditor, ProjectDrawer, QuickAdd, TaskDrawer } from './Overlays';
import { isOpen, isWaiting } from '@/lib/tasks';
import { TZ } from '@/lib/time';

type Layer = { kind: 'task' | 'project' | 'block'; id: string } | { kind: 'quick'; q: QuickKind } | null;

export function Shell({ children }: { children: ReactNode }) {
  return <DataProvider><ShellInner>{children}</ShellInner></DataProvider>;
}

function ShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [layer, setLayer] = useState<Layer>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const data = useData();
  const close = () => setLayer(null);

  const ui = useMemo(() => ({
    openTask: (id: string) => setLayer({ kind: 'task', id }),
    editProject: (id: string) => setLayer({ kind: 'project', id }),
    editBlock: (id: string) => setLayer({ kind: 'block', id }),
    quickAdd: (q: QuickKind) => setLayer({ kind: 'quick', q }),
  }), []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    try { setCollapsed(localStorage.getItem('aeo.rail') === 'collapsed'); } catch { /* storage unavailable */ }
  }, []);

  // Keyboard: "/" focuses search, "N" opens quick add.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? '').toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') { e.preventDefault(); document.getElementById('q')?.focus(); }
      if ((e.key === 'n' || e.key === 'N') && !layer) { e.preventDefault(); ui.quickAdd('task'); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [layer, ui]);

  const counts = { open: data.tasks.filter(isOpen).length, waiting: data.tasks.filter(isWaiting).length };
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  function toggleRail() {
    const next = !collapsed; setCollapsed(next);
    try { localStorage.setItem('aeo.rail', next ? 'collapsed' : 'open'); } catch { /* ignore */ }
  }
  function toggleTheme() {
    const root = document.documentElement;
    const cur = root.getAttribute('data-theme') ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('aeo.theme', next); } catch { /* ignore */ }
  }

  return (
    <UICtx.Provider value={ui}>
      <div className={`app ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mopen' : ''}`}>
        <aside className="rail" aria-label="Main navigation">
          <Link href="/" className="brand" title="Home" style={{ color: 'inherit', textDecoration: 'none' }}><AllstarMark /><div className="wm">ALLSTAR<small>EXECUTIVE OPS</small></div></Link>
          <nav className="nav">
            {NAV.map((n, i) => 'group' in n
              ? <div key={i} className="nav-group-h">{n.group}</div>
              : (
                <Link key={n.href} href={n.href} className={isActive(n.href) ? 'on' : ''} title={n.label}>
                  <Icon name={n.icon} /><span className="nav-label">{n.label}</span>
                  {n.phase ? <span className="later nav-label">Ph {n.phase}</span> : n.count ? <span className="navcount">{counts[n.count]}</span> : null}
                </Link>
              ))}
          </nav>
          <div className="rail-foot">
            <button type="button" onClick={toggleRail} title="Collapse sidebar" aria-label="Collapse sidebar">⇤</button>
            <button type="button" onClick={toggleTheme}>Theme</button>
          </div>
        </aside>
        <div className="main">
          <header className="topbar">
            <button className="btn ghost menu-btn" type="button" aria-label="Open menu" onClick={() => setMobileOpen(o => !o)}>
              <svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
            <Search />
            <button className="btn primary" type="button" onClick={() => ui.quickAdd('task')}>
              <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg><span id="addBtnLabel">Quick add</span>
            </button>
            <Clock />
          </header>
          <main className="page">
            {data.error && <div className="err" role="alert">{data.error} <button className="link" onClick={() => data.refresh()}>Try again</button></div>}
            {data.ready ? children : <div className="loading">Loading your workspace…</div>}
          </main>
        </div>
      </div>
      {layer?.kind === 'task' && <TaskDrawer id={layer.id} onClose={close} />}
      {layer?.kind === 'project' && <ProjectDrawer id={layer.id} onClose={close} />}
      {layer?.kind === 'block' && <BlockEditor id={layer.id} onClose={close} />}
      {layer?.kind === 'quick' && <QuickAdd kind={layer.q} onClose={close} />}
    </UICtx.Provider>
  );
}

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const i = setInterval(() => setNow(new Date()), 15_000); return () => clearInterval(i); }, []);
  if (!now) return <div className="clock" />;
  return (
    <div className="clock">
      <b>{now.toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })}</b>
      <span>{now.toLocaleDateString('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' })} · CT</span>
    </div>
  );
}

function Search() {
  const { tasks, projects, notes, preferences } = useData();
  const { openTask, editProject } = useUI();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, []);

  const s = q.trim().toLowerCase();
  const hits = !s ? [] : [
    ...tasks.filter(t => [t.title, t.notes, t.waiting_on, t.department, t.description].join(' ').toLowerCase().includes(s))
      .map(t => ({ k: t.status === 'Done' ? 'Done' : 'Task', l: t.title, go: () => openTask(t.id) })),
    ...projects.filter(p => [p.name, p.description].join(' ').toLowerCase().includes(s)).map(p => ({ k: 'Project', l: p.name, go: () => editProject(p.id) })),
    ...notes.filter(n => n.body.toLowerCase().includes(s)).map(n => ({ k: 'Note', l: n.body.slice(0, 90), go: () => router.push('/notes') })),
    ...preferences.filter(n => n.body.toLowerCase().includes(s)).map(n => ({ k: 'Wylie', l: n.body.slice(0, 90), go: () => router.push('/notes') })),
    ...NAV.filter(n => 'label' in n && n.label.toLowerCase().includes(s)).map(n => ({ k: 'Go to', l: (n as { label: string }).label, go: () => router.push((n as { href: string }).href) })),
  ].slice(0, 12);

  return (
    <div className="search" ref={box}>
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input id="q" type="text" placeholder="Search tasks, projects, notes" autoComplete="off" aria-label="Search"
        value={q} onChange={e => { setQ(e.target.value); setOpen(true); }} onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); (e.target as HTMLInputElement).blur(); } }} />
      <kbd>/</kbd>
      {open && s && (
        <div className="results">
          {hits.length ? hits.map((h, i) => (
            <button key={i} onClick={() => { h.go(); setOpen(false); setQ(''); }}><span className="k">{h.k}</span><span>{h.l}</span></button>
          )) : <div className="empty">No matches.</div>}
        </div>
      )}
    </div>
  );
}

