'use client';

import Link from 'next/link';
import { ModuleHead, RecordBoard, StatusPill, type Field } from '@/components/RecordBoard';
import { useData } from '@/components/DataProvider';
import { useTable, type Row } from '@/lib/useTable';
import { isOpen } from '@/lib/tasks';

type Item = Row & { item: string; category: string | null; level: string; reorder_threshold: string | null; last_restock: string | null; next_restock: string | null; notes: string | null };

const fields: Field[] = [
  { key: 'item', label: 'Item', required: true, placeholder: 'Coffee pods, paper towels…' },
  { key: 'category', label: 'Category', type: 'select', options: ['Consumables', 'Kitchen', 'Cleaning', 'Office supplies', 'Equipment', 'Other'] },
  { key: 'level', label: 'Level', type: 'select', options: ['Stocked', 'Low', 'Out', 'Unknown'], required: true },
  { key: 'reorder_threshold', label: 'Reorder when', placeholder: 'Down to 1 box' },
  { key: 'last_restock', label: 'Last restocked', type: 'date' },
  { key: 'next_restock', label: 'Next restock', type: 'date' },
  { key: 'notes', label: 'Where to buy / notes', type: 'textarea' },
];
const rank: Record<string, number> = { Out: 0, Low: 1, Unknown: 2, Stocked: 3 };

export default function Office() {
  const inv = useTable<Item>('office_inventory', { col: 'item', asc: true });
  const { projects, tasks } = useData();
  const officeProjects = projects.filter(p => !['Completed', 'Cancelled'].includes(p.status) && /internet|wi-?fi|office|supplies|lease/i.test(p.name));
  const officeTasks = tasks.filter(t => isOpen(t) && t.department === 'Office');
  return (
    <>
      <ModuleHead eyebrow="Operations" title="Office Operations"
        sub="Supplies that need restocking, plus the office projects and tasks in flight."
        stats={[
          { n: inv.rows.filter(i => i.level === 'Out').length, l: 'Out', tone: 'crit' },
          { n: inv.rows.filter(i => i.level === 'Low').length, l: 'Running low', tone: 'warn' },
          { n: officeProjects.length, l: 'Office projects open' },
          { n: officeTasks.length, l: 'Office tasks open' },
        ]} />
      <div className="grid2">
        <section className="panel">
          <div className="panel-h"><h2 className="sec">Supplies</h2></div>
          <RecordBoard t={inv} noun="item" fields={fields} titleOf={i => i.item}
            defaults={{ level: 'Stocked', category: 'Consumables' } as Partial<Item>}
            groups={[{ label: 'Needs restock', filter: i => i.level === 'Low' || i.level === 'Out' }, { label: 'Everything', filter: () => true }]}
            sort={(a, b) => (rank[a.level] ?? 9) - (rank[b.level] ?? 9) || a.item.localeCompare(b.item)}
            columns={[
              { label: 'Item', key: 'item' },
              { label: 'Level', render: i => <StatusPill s={i.level} /> },
              { label: 'Reorder when', key: 'reorder_threshold' },
              { label: 'Next restock', key: 'next_restock' },
            ]}
            empty="Nothing needs restocking." />
        </section>
        <section className="panel">
          <div className="panel-h"><h2 className="sec">Office projects</h2><Link className="link" href="/projects">All projects</Link></div>
          {officeProjects.length === 0 ? <div className="empty">No open office projects. Projects with internet, Wi-Fi, office or supplies in the name show here.</div> : (
            <div className="stack" style={{ gap: 10 }}>
              {officeProjects.map(p => (
                <div key={p.id}><div className="bhead"><span className="bt">{p.name}</span><StatusPill s={p.status} /></div>{p.next_action && <p className="bdesc">Next: {p.next_action}</p>}</div>
              ))}
            </div>
          )}
          <div className="panel-h" style={{ marginTop: 18 }}><h2 className="sec">Office tasks</h2><Link className="link" href="/tasks">All tasks</Link></div>
          {officeTasks.length === 0 ? <div className="empty">No open office tasks.</div> : officeTasks.slice(0, 8).map(t => <div key={t.id} className="bdesc" style={{ padding: '4px 0' }}>• {t.title}</div>)}
        </section>
      </div>
    </>
  );
}
