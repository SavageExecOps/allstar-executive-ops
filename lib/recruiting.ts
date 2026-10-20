export interface Manager {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  in_rotation: boolean;
  active: boolean;
  specialty: string | null;
  group_chat_name: string | null;
  sort_order: number;
}

export const RECRUIT_STATUSES = ['New', 'Scheduled', 'Call Completed', 'Manager Assigned', 'Group Chat Created', 'Handed Off',
  'No Show', 'Reschedule', 'Follow-up Needed', 'Not Interested', 'Not Qualified'] as const;
export type RecruitStatus = typeof RECRUIT_STATUSES[number];

/** What each status reads as on screen. */
export const STATUS_LABEL: Record<RecruitStatus, string> = {
  'New': 'New',
  'Scheduled': 'Booked',
  'Call Completed': 'Talked',
  'Manager Assigned': 'Assigned',
  'Group Chat Created': 'In group chat',
  'Handed Off': 'Handed off',
  'No Show': 'No show',
  'Reschedule': 'Reschedule',
  'Follow-up Needed': 'Follow-up needed',
  'Not Interested': 'Not interested',
  'Not Qualified': 'Not qualified',
};

export const LICENSED = ['Unknown', 'Licensed', 'In progress', 'Not licensed'] as const;
export const DISQUALIFY_REASONS = ['Not in the U.S.', 'With another agency', 'Not interested', 'Didn’t show / no response', 'Other'] as const;
export const ASSIGN_REASONS = ['Round robin', 'Location', 'Vibe', 'Age 30+', 'Other'] as const;

export interface Recruit {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  location: string | null;
  age: number | null;
  licensed: typeof LICENSED[number];
  status: RecruitStatus;
  manager_id: string | null;
  group_chat_confirmed: boolean;
  appointment_at: string | null;
  handed_off_at: string | null;
  next_action: string | null;
  follow_up_date: string | null;
  notes: string | null;
  us_based: 'Unknown' | 'Yes' | 'No';
  other_agency: 'Unknown' | 'Yes' | 'No';
  other_agency_name: string | null;
  disqualify_reason: string | null;
  form_answers: Record<string, string> | null;
  contracted_at: string | null;
  producing_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Assignment { id: string; recruit_id: string; manager_id: string; assigned_at: string; reason: string; was_up_next: boolean }
export interface RecruitNote { id: string; recruit_id: string; body: string; created_at: string }

export interface AgendaItem {
  id: string;
  topic: string;
  details: string | null;
  priority: boolean;
  status: 'Open' | 'Discussed';
  outcome: string | null;
  discussed_at: string | null;
  created_at: string;
}

/** Pipeline lanes, left to right. */
export const LANES: { key: string; label: string; statuses: RecruitStatus[] }[] = [
  // Talked-but-not-assigned stays in Booked (flagged) until a manager is picked.
  { key: 'booked', label: 'Booked', statuses: ['New', 'Scheduled', 'Call Completed'] },
  { key: 'assigned', label: 'Assigned', statuses: ['Manager Assigned', 'Group Chat Created'] },
  { key: 'missed', label: 'Didn’t connect', statuses: ['No Show', 'Reschedule', 'Follow-up Needed'] },
];
export const CLOSED: RecruitStatus[] = ['Handed Off', 'Not Interested', 'Not Qualified'];

/**
 * Round robin: the in-rotation manager who has gone longest without a recruit is up next.
 * Overrides still count as a recruit for the manager who received one, so the rotation stays fair.
 */
export function rotation(managers: Manager[], assignments: Assignment[]) {
  const last = new Map<string, string>();
  for (const a of assignments) {
    const prev = last.get(a.manager_id);
    if (!prev || a.assigned_at > prev) last.set(a.manager_id, a.assigned_at);
  }
  return managers
    .filter(m => m.active && m.in_rotation)
    .sort((a, b) => {
      const la = last.get(a.id) ?? '', lb = last.get(b.id) ?? '';
      if (la !== lb) return la < lb ? -1 : 1;           // never assigned sorts first
      return a.sort_order - b.sort_order;
    });
}

/** Who to suggest for this recruit: the 30+ specialist when age says so, otherwise whoever is up next. */
export function suggestFor(recruit: Pick<Recruit, 'age'>, managers: Manager[], assignments: Assignment[]) {
  if (recruit.age != null && recruit.age > 30) {
    const senior = managers.find(m => m.active && /over 30|30\+/i.test(m.specialty ?? ''));
    if (senior) return { manager: senior, reason: 'Age 30+' as const };
  }
  const next = rotation(managers, assignments)[0];
  return next ? { manager: next, reason: 'Round robin' as const } : null;
}

export function introMessage(r: Recruit, m: Manager, latestNote?: string) {
  const first = m.name.split(' ')[0];
  const bits = [
    r.location && `based in ${r.location}`,
    r.age != null && `${r.age} years old`,
    r.licensed !== 'Unknown' && r.licensed.toLowerCase(),
  ].filter(Boolean).join(', ');
  return [
    `${first}, meet ${r.name}${bits ? ` (${bits})` : ''}.`,
    latestNote ? `Quick notes from my call: ${latestNote.trim()}` : '',
    r.phone ? `Best number: ${r.phone}` : '',
    `${r.name.split(' ')[0]}, ${first} is going to take great care of you from here.`,
  ].filter(Boolean).join('\n\n');
}
