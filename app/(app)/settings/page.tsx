'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '@/components/DataProvider';
import { createClient } from '@/lib/supabase/client';
import { hasWeekPlan, planRows } from '@/lib/weekPlan';

type Theme = '' | 'light' | 'dark';

export default function Settings() {
  const data = useData();
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>('');
  const [exported, setExported] = useState<string | null>(null);
  const [name, setName] = useState(data.homeName);
  const [intake, setIntake] = useState<boolean | null>(null);
  const [origin, setOrigin] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => {
    setOrigin(window.location.origin);
    fetch('/api/intake/iclosed').then(r => r.json()).then(j => setIntake(!!j.configured)).catch(() => setIntake(false));
  }, []);
  useEffect(() => { try { setTheme((localStorage.getItem('aeo.theme') as Theme) ?? ''); } catch { /* ignore */ } }, []);

  function applyTheme(t: Theme) {
    setTheme(t);
    const root = document.documentElement;
    if (t) root.setAttribute('data-theme', t); else root.removeAttribute('data-theme');
    try { if (t) localStorage.setItem('aeo.theme', t); else localStorage.removeItem('aeo.theme'); } catch { /* ignore */ }
  }

  function exportData() {
    const { tasks, projects, projectUpdates, notes, preferences, blocks, recaps } = data;
    setExported(JSON.stringify({ exported_at: new Date().toISOString(), tasks, projects, projectUpdates, notes, preferences, blocks, recaps }, null, 2));
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <>
      <div className="ph"><div><div className="eyebrow">System</div><h1>Settings</h1></div></div>
      <div className="stack" style={{ maxWidth: 760 }}>
        <section className="panel">
          <div className="panel-h"><h2 className="sec">Account</h2></div>
          <p className="sub" style={{ margin: '0 0 10px' }}>Signed in as <b>{data.email}</b>.</p>
          <button className="btn" onClick={signOut}>Sign out</button>
        </section>
        <section className="panel">
          <div className="panel-h"><h2 className="sec">Home page</h2></div>
          <form className="toolbar" style={{ margin: 0 }} onSubmit={async e => { e.preventDefault(); const v = name.trim(); if (v && await data.setHomeName(v)) data.toast('Saved'); }}>
            <label htmlFor="home-name" className="hint" style={{ margin: 0 }}>Greet me as</label>
            <input id="home-name" type="text" value={name} onChange={e => setName(e.target.value)} maxLength={40} style={{ minWidth: 0 }} />
            <button className="btn sm">Save</button>
          </form>
          <p className="hint">Shows as “Good morning, {name.trim() || 'Savage'}.” The line under it changes every time you open the page.</p>
        </section>
        <section className="panel">
          <div className="panel-h"><h2 className="sec">Weekly schedule</h2>
            <span className={`pill ${hasWeekPlan(data.blocks) ? 'ok' : 'conf'}`}>{hasWeekPlan(data.blocks) ? 'Game plan loaded' : 'Old schedule'}</span></div>
          <p className="sub" style={{ margin: '0 0 10px' }}>9 to 6 Central. Recruiting blocks match iClosed, deep work rotates by day, Thursday 1:00 is the mandatory meeting. Edit any block from My Day.</p>
          {confirmReset ? (
            <div className="toolbar" style={{ margin: 0 }}>
              <span className="hint" style={{ margin: 0 }}>This replaces every block, including your edits.</span>
              <button className="btn sm primary" onClick={async () => { if (await data.replaceSchedule(planRows())) data.toast('Weekly game plan loaded'); setConfirmReset(false); }}>Replace</button>
              <button className="btn sm ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
            </div>
          ) : <button className="btn" onClick={() => setConfirmReset(true)}>{hasWeekPlan(data.blocks) ? 'Reset to the game plan' : 'Load the game plan'}</button>}
        </section>
        <section className="panel">
          <div className="panel-h"><h2 className="sec">Recruiting intake</h2>
            <span className={`pill ${intake ? 'ok' : 'conf'}`}>{intake === null ? 'Checking…' : intake ? 'Ready' : 'Not set up'}</span></div>
          <p className="sub" style={{ margin: '0 0 10px' }}>Booked calls from your Google Calendar (iClosed) land in Recruiting on their own. The intake address:</p>
          <code className="codebox">{origin}/api/intake/iclosed</code>
          <p className="hint">Setup steps are in SETUP.md under “Recruiting calls from Google Calendar.” The secret key lives in Vercel, never here.</p>
        </section>
        <section className="panel">
          <div className="panel-h"><h2 className="sec">Appearance</h2></div>
          <div className="seg">
            {(['', 'light', 'dark'] as Theme[]).map(t => (
              <button key={t || 'system'} className={theme === t ? 'on' : ''} onClick={() => applyTheme(t)}>{t ? t[0].toUpperCase() + t.slice(1) : 'System'}</button>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-h"><h2 className="sec">Your data</h2></div>
          <p className="sub" style={{ margin: '0 0 10px' }}>Everything is stored in your private Supabase database. Supabase takes daily backups; you can also export a copy here any time.</p>
          <button className="btn" onClick={exportData}>Export as JSON</button>
          {exported && <textarea readOnly rows={10} aria-label="Exported data" value={exported} onFocus={e => e.currentTarget.select()} style={{ marginTop: 10, fontFamily: 'var(--mono)', fontSize: 11.5 }} />}
        </section>
      </div>
    </>
  );
}
