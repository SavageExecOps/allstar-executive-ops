'use client';

import { useState } from 'react';
import { useOps } from '@/components/OpsData';
import { useData } from '@/components/DataProvider';
import { useUI } from '@/components/UI';
import { waitingOnWylie } from '@/lib/tasks';
import { dayOf, fmtDate, relDate } from '@/lib/time';

export default function ForWylie() {
  const { agenda, addAgenda, updateAgenda, deleteAgenda, opsReady } = useOps();
  const { tasks, toast } = useData();
  const { openTask } = useUI();
  const [topic, setTopic] = useState('');
  const [details, setDetails] = useState('');
  const [closing, setClosing] = useState<string | null>(null);
  const [outcome, setOutcome] = useState('');

  const open = agenda.filter(a => a.status === 'Open').sort((a, b) => (Number(b.priority) - Number(a.priority)) || a.created_at.localeCompare(b.created_at));
  const done = agenda.filter(a => a.status === 'Discussed').sort((a, b) => (b.discussed_at ?? '').localeCompare(a.discussed_at ?? ''));
  const waiting = tasks.filter(waitingOnWylie);

  async function copyList() {
    const lines = [
      ...open.map((a, i) => `${i + 1}. ${a.topic}${a.details ? ` (${a.details})` : ''}`),
      ...(waiting.length ? ['', 'Also waiting on you:', ...waiting.map(t => `• ${t.title.replace(/^Follow up with Wylie to /i, '')}`)] : []),
    ].join('\n');
    try { await navigator.clipboard.writeText(lines); toast('List copied'); } catch { toast('Couldn’t copy. Select and copy manually.'); }
  }

  return (
    <>
      <div className="ph">
        <div>
          <div className="eyebrow">Next one-on-one</div>
          <h1>For Wylie</h1>
          <p className="sub">Everything to bring up when you sit down. Add things the moment they come up; mark them discussed with the outcome.</p>
        </div>
        <div className="qa"><button className="btn" onClick={copyList} disabled={!open.length && !waiting.length}>Copy the list</button></div>
      </div>

      <div className="grid2">
        <div className="stack">
          <section className="panel">
            <form className="stack" style={{ gap: 10 }} onSubmit={async e => {
              e.preventDefault(); const t = topic.trim(); if (!t) return;
              if (await addAgenda({ topic: t, details: details.trim() || null })) { setTopic(''); setDetails(''); toast('Added for Wylie'); }
            }}>
              <input type="text" className="big" placeholder="What do you need to go over?" aria-label="Topic" value={topic} onChange={e => setTopic(e.target.value)} style={{ fontSize: 16, padding: '11px 12px' }} />
              <div className="toolbar" style={{ margin: 0 }}>
                <input type="text" placeholder="Details (optional)" aria-label="Details" value={details} onChange={e => setDetails(e.target.value)} style={{ flex: 1 }} />
                <button className="btn primary">Add</button>
              </div>
            </form>
          </section>

          <section className="panel">
            <div className="panel-h"><h2 className="sec">To go over <span className="n">{open.length}</span></h2></div>
            {!opsReady ? <div className="empty">Loading…</div> : open.length === 0 ? <div className="empty">Nothing on the list. Add things as they come up.</div> :
              <div className="tlist">{open.map((a, i) => (
                <div key={a.id} className="trow" style={{ gridTemplateColumns: '28px minmax(0,1fr) auto' }}>
                  <span className="due" style={{ color: 'var(--accent)', paddingTop: 2 }}>{String(i + 1).padStart(2, '0')}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500 }}>{a.topic}</div>
                    {a.details && <div className="hint" style={{ margin: '2px 0 0' }}>{a.details}</div>}
                    <div className="meta"><span>Added {relDate(dayOf(a.created_at))}</span></div>
                    {closing === a.id && (
                      <form className="toolbar" style={{ margin: '8px 0 0' }} onSubmit={async e => {
                        e.preventDefault();
                        if (await updateAgenda(a.id, { status: 'Discussed', outcome: outcome.trim() || null, discussed_at: new Date().toISOString() })) { setClosing(null); setOutcome(''); toast('Marked discussed'); }
                      }}>
                        <input type="text" autoFocus placeholder="What did Wylie decide?" aria-label="Outcome" value={outcome} onChange={e => setOutcome(e.target.value)} style={{ flex: 1 }} />
                        <button className="btn sm primary">Done</button>
                        <button type="button" className="btn sm ghost" onClick={() => setClosing(null)}>Cancel</button>
                      </form>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button className={`star ${a.priority ? 'on' : ''}`} onClick={() => updateAgenda(a.id, { priority: !a.priority })} title="Put at the top" aria-label="Priority">★</button>
                    {closing !== a.id && <button className="btn sm" onClick={() => { setClosing(a.id); setOutcome(''); }}>Discussed</button>}
                  </div>
                </div>
              ))}</div>}
          </section>
        </div>

        <div className="stack">
          <section className="panel">
            <div className="panel-h"><h2 className="sec">Waiting on Wylie <span className="n">{waiting.length}</span></h2></div>
            {waiting.length ? <div className="tlist">{waiting.map(t => (
              <div key={t.id} className="trow" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
                <button className="ttitle" onClick={() => openTask(t.id)}>{t.title}</button>
              </div>))}</div> : <div className="empty">Nothing waiting on him. Tasks marked “Waiting on Wylie” show here.</div>}
          </section>
          <section className="panel">
            <div className="panel-h"><h2 className="sec">Discussed</h2></div>
            {done.length ? <div className="tlist">{done.slice(0, 15).map(a => (
              <div key={a.id} className="trow" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: 'var(--fg2)' }}>{a.topic}</div>
                  {a.outcome && <div className="meta"><span>→ {a.outcome}</span></div>}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className="due">{a.discussed_at ? fmtDate(dayOf(a.discussed_at)) : ''}</span>
                  <button className="link" onClick={() => updateAgenda(a.id, { status: 'Open', discussed_at: null })}>Reopen</button>
                  <button className="link" onClick={async () => { if (await deleteAgenda(a.id)) toast('Removed'); }}>Remove</button>
                </div>
              </div>))}</div> : <div className="empty">Decisions show here after you mark items discussed.</div>}
          </section>
        </div>
      </div>
    </>
  );
}
