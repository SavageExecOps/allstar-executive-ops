export const DEPARTMENTS = ['Executive','Recruiting','Finance','Debt','Leads','Advertising','Office','Communications','Operations'] as const;
export const PRIORITIES = ['Critical','High','Normal','Low'] as const;
export const TASK_STATUSES = ['Inbox','To Do','In Progress','Waiting','Blocked','Done'] as const;
export const PROJECT_STATUSES = ['Planned','In Progress','Waiting','Blocked','Completed','Cancelled'] as const;
export const NOTE_TYPES = ['Quick note','Meeting notes','Call notes','Executive instruction','Procedure','Idea','Follow-up','Project update'] as const;
export const PREF_CATEGORIES = ['Scheduling','Communication','Meeting priorities','Recurring instruction','Restriction','Decision'] as const;

export type Department = typeof DEPARTMENTS[number];
export type Priority = typeof PRIORITIES[number];
export type TaskStatus = typeof TASK_STATUSES[number];
export type ProjectStatus = typeof PROJECT_STATUSES[number];
export type NoteType = typeof NOTE_TYPES[number];

export interface Task {
  id: string;
  title: string;
  description: string | null;
  department: Department;
  priority: Priority;
  status: TaskStatus;
  due_date: string | null;
  start_date: string | null;
  recurrence: string | null;
  owner_name: string | null;
  contact_name: string | null;
  project_id: string | null;
  waiting_on: string | null;
  waiting_since: string | null;
  follow_up_date: string | null;
  impact_if_delayed: string | null;
  notes: string | null;
  is_top_priority: boolean;
  needs_confirmation: string[];
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskActivity { id: string; task_id: string; body: string; actor: string; created_at: string }

export interface Project {
  id: string;
  name: string;
  description: string | null;
  owner_name: string | null;
  priority: Priority;
  status: ProjectStatus;
  deadline: string | null;
  next_action: string | null;
  dependencies: string | null;
  notes: string | null;
  needs_confirmation: string[];
  created_at: string;
}

export interface ProjectUpdate { id: string; project_id: string; body: string; created_at: string }

export interface Note {
  id: string;
  body: string;
  note_type: NoteType;
  department: string | null;
  pinned: boolean;
  created_at: string;
}

export interface Preference {
  id: string;
  category: typeof PREF_CATEGORIES[number];
  permanence: 'Permanent' | 'Temporary';
  body: string;
  effective_until: string | null;
  active: boolean;
  created_at: string;
}

export interface ScheduleBlock {
  id: string;
  weekday: number | null;
  start_time: string; // HH:MM:SS
  end_time: string;
  title: string;
  description: string | null;
  departments: string[];
  is_protected: boolean;
  is_recap: boolean;
  sort_order: number;
}

export interface BlockLog { id: string; block_id: string; day: string; done: boolean; seconds_tracked: number; running_since: string | null }
export interface Interruption { id: string; day: string; body: string; task_id: string | null; created_at: string }
export interface Recap { id: string; recap_date: string; kind: 'executive' | 'detailed' | 'weekly'; body: string; created_at: string }
