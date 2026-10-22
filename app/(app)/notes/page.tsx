'use client';

import { useState } from 'react';
import { useData } from '@/components/DataProvider';
import { useUI } from '@/components/UI';
import { PaymentMethods } from '@/components/PaymentMethods';
import { NOTE_TYPES, type Preference } from '@/lib/types';
import { fmtDate, fmtStamp } from '@/lib/time';

function PrefList({ items }: { items: Preference[] }) {
  const { updatePreference, deletePreference, toast } = useData();
  if (!items.length) return <div className="empty">None right now.</div>;
  return (
    <div>
      {items.map(p => (
        <div key={p.id} className="pref-row">
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0 }}>{p.body}</p>
            <div className="meta"><span>{p.category}</span>{p.effective_until && <span>Until {fmtDate(p.effective_until)}</span>}</div>
          </div>
          <div className="qa" style={{ flex: 'none' }}>
            <button className="link" onClick={async () => { if (await updatePreference(p.id, { active: false })) toast('Archived'); }}>Archive</button>
            <button className="link" onClick={async () => { if (await deletePreference(p.id)) toast('Deleted'); }}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Notes() {
  const { notes, preferences, updateNote, deleteNote, toast } = useData();
  const { quickAdd } = useUI();
  const [type, setType] = useState('');
  const active = preferences.filter(p => p.active);
  const list = notes.filter(n => !type || n.note_type === type).sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || b.created_at.localeCompare(a.created_at));

  return (
    <>
      <div className="ph">
        <div>
          <div className="eyebrow">Knowledge base</div>
          <h1>Notes &amp; Preferences</h1>
          <p className="sub">Capture anything. Pin what matters. Wylie’s standing preferences are kept separate from temporary rules.</p>
        </div>
        <div className="qa"><button className="btn primary" onClick={() => quickAdd('note')}>New note</button></div>
      </div>

      <PaymentMethods />

      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-h"><h2 className="sec">Wylie executive preferences</h2></div>
        <div className="row2">
          <div><div className="eyebrow">Permanent</div><PrefList items={active.filter(p => p.permanence === 'Permanent')} /></div>
          <div><div className="eyebrow">Temporary rules</div><PrefList items={active.filter(p => p.permanence === 'Temporary')} /></div>
        </div>
      </section>

      <div className="toolbar">
        <select aria-label="Note type" value={type} onChange={e => setType(e.target.value)}>
          <option value="">All notes</option>{NOTE_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="notes">
        {list.length === 0 && <div className="empty">No notes yet. Use “New note” or press N.</div>}
        {list.map(n => (
          <div key={n.id} className={`note ${n.pinned ? 'pinned' : ''}`}>
            <div className="meta" style={{ margin: 0 }}><span className={`pill ${n.pinned ? 'gold' : ''}`}>{n.note_type}</span>{n.department && <span>{n.department}</span>}</div>
            <p>{n.body}</p>
            <div className="meta" style={{ justifyContent: 'space-between' }}>
              <span>{fmtStamp(n.created_at)}</span>
              <span>
                <button className="link" onClick={() => updateNote(n.id, { pinned: !n.pinned })}>{n.pinned ? 'Unpin' : 'Pin'}</button>
                {' · '}
                <button className="link" onClick={async () => { if (await deleteNote(n.id)) toast('Note deleted'); }}>Delete</button>
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
