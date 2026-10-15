'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '@/components/DataProvider';
import { useOps } from '@/components/OpsData';
import { dayOf, today } from '@/lib/time';
import { buildRecap } from '@/lib/tasks';
import { fmtDate } from '@/lib/time';

type Mode = 'executive' | 'detailed';

export default function Recaps() {
  const { tasks, interruptions, recaps, saveRecap, toast } = useData();
  const [mode, setMode] = useState<Mode>('executive');
  const ops = useOps();
  const built = useMemo(() => {
    const t = today();
    return buildRecap(tasks, interruptions, {
      agenda: ops.agenda.filter(a => a.status === 'Open').map(a => a.topic),
      assignedToday: ops.assignments.filter(a => dayOf(a.assigned_at) === t).map(a => ({
        recruit: ops.recruits.find(r => r.id === a.recruit_id)?.name ?? 'Recruit',
        manager: ops.managers.find(m => m.id === a.manager_id)?.name ?? 'Manager' })),
      handedOffToday: ops.recruits.filter(r => r.handed_off_at && dayOf(r.handed_off_at) === t).length,
    });
  }, [tasks, interruptions, ops.agenda, ops.assignments, ops.recruits, ops.managers]);
  const [text, setText] = useState(built[mode]);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setText(built[mode]); }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  async function copy() {
    try { await navigator.clipboard.writeText(text); toast('Copied'); }
    catch { ref.current?.select(); toast('Selected. Press Ctrl/⌘+C to copy'); }
  }

  return (
    <>
      <div className="ph">
        <div>
          <div className="eyebrow">End of day</div>
          <h1>Daily Recap</h1>
          <p className="sub">Built from what’s actually in the system: completed tasks, open items, waiting-ons and tomorrow’s priorities. Edit before you send.</p>
        </div>
      </div>
      <div className="grid2">
        <section className="panel">
          <div className="panel-h" style={{ flexWrap: 'wrap' }}>
            <div className="seg" role="tablist">
              <button role="tab" aria-selected={mode === 'executive'} className={mode === 'executive' ? 'on' : ''} onClick={() => setMode('executive')}>Update for Wylie</button>
              <button role="tab" aria-selected={mode === 'detailed'} className={mode === 'detailed' ? 'on' : ''} onClick={() => setMode('detailed')}>Detailed internal</button>
            </div>
            <div className="qa">
              <button className="btn sm" onClick={() => setText(built[mode])}>Regenerate</button>
              <button className="btn sm" onClick={copy}>Copy</button>
              <button className="btn sm primary" onClick={async () => { if (await saveRecap(mode, text)) toast('Recap saved'); }}>Save</button>
            </div>
          </div>
          <textarea ref={ref} className="recap-out" rows={16} aria-label="Recap text" value={text} onChange={e => setText(e.target.value)} />
          <p className="hint">Nothing is sent automatically. Copy it into a text or email yourself.</p>
        </section>
        <section className="panel">
          <div className="panel-h"><h2 className="sec">Saved recaps <span className="n">{recaps.length}</span></h2></div>
          {recaps.length ? recaps.map((r, i) => (
            <details key={r.id} style={{ borderTop: i ? '1px solid var(--line)' : 0, padding: '10px 0' }}>
              <summary style={{ cursor: 'pointer' }}><b>{fmtDate(r.recap_date, { weekday: 'short' })}</b> · <span style={{ color: 'var(--fg3)' }}>{r.kind === 'executive' ? 'Wylie update' : r.kind === 'weekly' ? 'Weekly' : 'Detailed'}</span></summary>
              <pre className="recap-out" style={{ marginTop: 8, fontSize: 12.5 }}>{r.body}</pre>
            </details>
          )) : <div className="empty">No saved recaps yet. Save today’s and it’ll be here tomorrow.</div>}
          <p className="hint">The weekly recap arrives with Phase 2, once recruiting, debt and finance data exist to summarize.</p>
        </section>
      </div>
    </>
  );
}
