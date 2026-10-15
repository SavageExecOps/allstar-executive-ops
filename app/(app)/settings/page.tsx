'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '@/components/DataProvider';
import { createClient } from '@/lib/supabase/client';

type Theme = '' | 'light' | 'dark';

export default function Settings() {
  const data = useData();
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>('');
  const [exported, setExported] = useState<string | null>(null);
  const [name, setName] = useState(data.homeName);
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
