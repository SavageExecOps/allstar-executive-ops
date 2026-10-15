'use client';

import { useData } from '@/components/DataProvider';
import { useUI } from '@/components/UI';
import { isWaiting } from '@/lib/tasks';
import { addDays, relDate, today } from '@/lib/time';

const Need = ({ v, label }: { v: string | null; label: string }) => v ? <>{v}</> : <span className="pill conf">{label}</span>;

export default function WaitingOn() {
  const { tasks, updateTask, toast } = useData();
  const { openTask, quickAdd } = useUI();
  const waiting = tasks.filter(isWaiting);
  const groups = new Map<string, typeof waiting>();
  waiting.forEach(t => { const k = t.waiting_on || 'Unassigned'; groups.set(k, [...(groups.get(k) ?? []), t]); });
  const keys = Array.from(groups.keys()).sort((a, b) => (Number(/wylie/i.test(b)) - Number(/wylie/i.test(a))) || a.localeCompare(b));

  async function followedUp(id: string, who: string | null) {
    const next = addDays(today(), 2);
    if (await updateTask(id, { follow_up_date: next }, `Followed up with ${who || 'them'}. Next follow-up ${next}`)) toast('Logged. Next follow-up in 2 days');
  }

  return (
    <>
      <div className="ph">
        <div>
          <div className="eyebrow">Dependencies</div>
          <h1>Waiting On</h1>
          <p className="sub">Who owes a response, what’s needed, when to follow up, and what slips if it’s late.</p>
        </div>
        <div className="qa"><button className="btn primary" onClick={() => quickAdd('followup')}>Add follow-up</button></div>
      </div>
      {keys.length ? (
        <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(320px,100%),1fr))' }}>
          {keys.map(k => (
            <section key={k} className="panel">
              <div className="panel-h"><h2 className="sec">{k} <span className="n">{groups.get(k)!.length}</span></h2></div>
              {groups.get(k)!.map(t => (
                <div key={t.id} className="wcard">
                  <div style={{ minWidth: 0 }}>
                    <button className="ttitle" onClick={() => openTask(t.id)}>{t.title}</button>
                    <dl className="kv">
                      <dt>Requested</dt><dd><Need v={t.waiting_since ? relDate(t.waiting_since) : null} label="Needs date" /></dd>
                      <dt>Follow up</dt><dd><Need v={t.follow_up_date ? relDate(t.follow_up_date) : null} label="Needs date" /></dd>
                      <dt>If delayed</dt><dd><Need v={t.impact_if_delayed} label="Needs impact" /></dd>
                    </dl>
                  </div>
                  <div><button className="btn sm" onClick={() => followedUp(t.id, t.waiting_on)}>Followed up</button></div>
                </div>
              ))}
            </section>
          ))}
        </div>
      ) : <section className="panel"><div className="empty">Not waiting on anyone.</div></section>}
    </>
  );
}
