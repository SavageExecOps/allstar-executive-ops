'use client';

import { ModuleHead, RecordBoard, StatusPill, type Field } from '@/components/RecordBoard';
import { useTable, type Row } from '@/lib/useTable';
import { today } from '@/lib/time';

type Ad = Row & { agent_name: string; request: string | null; campaign_type: string | null; responsible: string | null; payment_required: boolean | null; payment_status: string | null; creative_status: string | null; status: string; launch_date: string | null; follow_up_date: string | null; notes: string | null };

const STATUS = ['Requested', 'Payment Pending', 'Preparation', 'Ready', 'Active', 'Paused', 'Completed'] as const;
const fields: Field[] = [
  { key: 'agent_name', label: 'Agent', required: true },
  { key: 'campaign_type', label: 'Campaign', placeholder: 'Facebook leads, IG, mailers…' },
  { key: 'request', label: 'What they asked for', type: 'textarea' },
  { key: 'status', label: 'Stage', type: 'select', options: STATUS, required: true },
  { key: 'responsible', label: 'Who’s building it' },
  { key: 'payment_required', label: 'Payment required before launch', type: 'bool' },
  { key: 'payment_status', label: 'Payment', type: 'select', options: ['Unknown', 'Not needed', 'Waiting', 'Paid'] },
  { key: 'creative_status', label: 'Creative', type: 'select', options: ['Not started', 'In progress', 'Needs approval', 'Approved'] },
  { key: 'launch_date', label: 'Launch', type: 'date' },
  { key: 'follow_up_date', label: 'Follow up', type: 'date' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];
const LIVE = ['Active', 'Paused', 'Completed'];
/** Plain-words reason an ad isn't live yet. */
const blocker = (a: Ad) => LIVE.includes(a.status) ? null
  : a.payment_required && a.payment_status !== 'Paid' ? 'Waiting on payment'
  : a.creative_status && a.creative_status !== 'Approved' ? `Creative: ${a.creative_status.toLowerCase()}`
  : a.status === 'Ready' ? 'Ready to launch' : null;

export default function Advertising() {
  const ads = useTable<Ad>('advertising_requests');
  const t = today();
  const waiting = ads.rows.filter(a => !LIVE.includes(a.status));
  return (
    <>
      <ModuleHead eyebrow="Operations" title="Advertising"
        sub="Every agent’s ad request from ask to live, and what’s holding each one up."
        stats={[
          { n: waiting.length, l: 'Waiting to launch' },
          { n: waiting.filter(a => a.payment_required && a.payment_status !== 'Paid').length, l: 'Blocked on payment', tone: 'warn' },
          { n: ads.rows.filter(a => a.status === 'Ready').length, l: 'Ready to launch', tone: 'gold' },
          { n: ads.rows.filter(a => a.status === 'Active').length, l: 'Live', tone: 'ok' },
          { n: waiting.filter(a => a.follow_up_date && a.follow_up_date <= t).length, l: 'Follow-ups due', tone: 'crit' },
        ]} />
      <section className="panel">
        <RecordBoard t={ads} noun="ad request" fields={fields} titleOf={a => a.agent_name}
          defaults={{ status: 'Requested', payment_status: 'Unknown', creative_status: 'Not started', payment_required: false } as Partial<Ad>}
          validate={n => n.status === 'Active' && n.payment_required && n.payment_status !== 'Paid' ? 'Payment isn’t marked paid yet, so this can’t go live.' : null}
          groups={[
            { label: 'In progress', filter: a => !LIVE.includes(a.status) },
            { label: 'Live', filter: a => a.status === 'Active' || a.status === 'Paused' },
            { label: 'Done', filter: a => a.status === 'Completed' },
          ]}
          sort={(a, b) => STATUS.indexOf(b.status as typeof STATUS[number]) - STATUS.indexOf(a.status as typeof STATUS[number])}
          columns={[
            { label: 'Agent', key: 'agent_name' },
            { label: 'Campaign', key: 'campaign_type' },
            { label: 'Stage', render: a => <StatusPill s={a.status} /> },
            { label: 'Holding it up', render: a => blocker(a) ?? '—' },
            { label: 'Launch', key: 'launch_date' },
          ]}
          empty="No ad requests in this stage." />
      </section>
    </>
  );
}
