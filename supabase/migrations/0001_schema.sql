-- ALLSTAR Executive Ops — core schema
-- Every row belongs to an owner (auth.users.id). Row-level security restricts
-- each table to its owner. To add teammates later, add a workspace_members
-- table and widen the policies in 0003_security.sql; the column layout stays.

create extension if not exists pgcrypto;

-- ---------- shared helpers ----------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- ---------- people ----------
create table public.users (            -- profile row per auth user
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'executive_assistant',
  timezone text not null default 'America/Chicago',
  theme text check (theme in ('light','dark')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  kind text not null default 'other' check (kind in ('executive','manager','agent','recruit','vendor','tenant','debtor','direct_report','other')),
  email text, phone text, company text, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.managers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  name text not null, email text, phone text,
  active boolean not null default true,
  group_chat_name text,
  max_load int,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- ---------- projects & tasks ----------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  description text,
  owner_name text default 'Me',
  priority text not null default 'Normal' check (priority in ('Critical','High','Normal','Low')),
  status text not null default 'Planned' check (status in ('Planned','In Progress','Waiting','Blocked','Completed','Cancelled')),
  deadline date,
  next_action text,
  dependencies text,
  notes text,
  needs_confirmation text[] not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.project_updates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text,
  department text not null default 'Operations'
    check (department in ('Executive','Recruiting','Finance','Debt','Leads','Advertising','Office','Communications','Operations')),
  priority text not null default 'Normal' check (priority in ('Critical','High','Normal','Low')),
  status text not null default 'To Do' check (status in ('Inbox','To Do','In Progress','Waiting','Blocked','Done')),
  due_date date,
  start_date date,
  recurrence text,                       -- human label for now, e.g. 'Weekly · Friday'; automation_rules drive generation
  owner_name text default 'Me',
  contact_id uuid references public.contacts(id) on delete set null,
  contact_name text,
  project_id uuid references public.projects(id) on delete set null,
  waiting_on text,
  waiting_since date,
  follow_up_date date,
  impact_if_delayed text,
  notes text,
  attachments jsonb not null default '[]',
  is_top_priority boolean not null default false,
  needs_confirmation text[] not null default '{}',
  source_module text,                    -- 'debt','recruiting', etc. when created from a module
  source_id uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index tasks_owner_status_idx on public.tasks(owner_id, status);
create index tasks_owner_due_idx on public.tasks(owner_id, due_date);
create index tasks_project_idx on public.tasks(project_id);

create table public.task_activity (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  body text not null,
  actor text not null default 'user' check (actor in ('user','ai','automation','system')),
  created_at timestamptz not null default now()
);
create index task_activity_task_idx on public.task_activity(task_id, created_at desc);

-- ---------- notes & preferences ----------
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null,
  note_type text not null default 'Quick note'
    check (note_type in ('Quick note','Meeting notes','Call notes','Executive instruction','Procedure','Idea','Follow-up','Project update')),
  department text,
  pinned boolean not null default false,
  task_id uuid references public.tasks(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index notes_owner_idx on public.notes(owner_id, pinned desc, created_at desc);

create table public.executive_preferences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category text not null default 'Scheduling'
    check (category in ('Scheduling','Communication','Meeting priorities','Recurring instruction','Restriction','Decision')),
  permanence text not null default 'Permanent' check (permanence in ('Permanent','Temporary')),
  body text not null,
  effective_until date,
  active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- ---------- my day ----------
create table public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  weekday smallint check (weekday between 0 and 6),   -- null = every weekday
  start_time time not null,
  end_time time not null check (end_time > start_time),
  title text not null,
  description text,
  departments text[] not null default '{}',
  is_protected boolean not null default false,
  is_recap boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.day_block_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  block_id uuid not null references public.schedule_blocks(id) on delete cascade,
  day date not null,
  done boolean not null default false,
  seconds_tracked int not null default 0,
  running_since timestamptz,
  unique (owner_id, block_id, day)
);

create table public.interruptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  body text not null,
  task_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.daily_recaps (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  recap_date date not null,
  kind text not null check (kind in ('executive','detailed','weekly')),
  body text not null,
  created_at timestamptz not null default now()
);
create index daily_recaps_owner_idx on public.daily_recaps(owner_id, recap_date desc);

-- ---------- Phase 2: recruiting ----------
create table public.recruits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null, phone text, email text, source text,
  status text not null default 'New' check (status in ('New','Scheduled','Call Completed','Manager Assigned','Group Chat Created','Handed Off','No Show','Reschedule','Not Interested','Follow-up Needed')),
  manager_id uuid references public.managers(id) on delete set null,
  intro_status text not null default 'Not started' check (intro_status in ('Not started','Drafted','Sent','Confirmed')),
  group_chat_confirmed boolean not null default false,     -- only set manually or by a real integration
  next_action text, follow_up_date date, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.recruiting_appointments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  recruit_id uuid not null references public.recruits(id) on delete cascade,
  starts_at timestamptz not null, ends_at timestamptz not null,
  status text not null default 'Scheduled' check (status in ('Scheduled','Completed','No Show','Rescheduled','Cancelled')),
  external_event_id text,
  created_at timestamptz not null default now()
);
create table public.recruiting_availability (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null, end_time time not null check (end_time > start_time),
  slot_minutes int not null default 30, buffer_minutes int not null default 0, max_bookings int,
  is_proposed boolean not null default true
);
create table public.manager_assignments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  recruit_id uuid not null references public.recruits(id) on delete cascade,
  manager_id uuid not null references public.managers(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  group_chat_confirmed_at timestamptz
);

-- ---------- Phase 2: executive calendar ----------
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  kind text not null default 'Meeting' check (kind in ('Meeting','One-on-one','Recurring','Travel','Event','Podcast','Team lock-in','Personal block')),
  starts_at timestamptz not null, ends_at timestamptz not null,
  attendee_contact_id uuid references public.contacts(id) on delete set null,
  confirmed boolean not null default false,
  wins text, bottlenecks text, notes text,
  external_event_id text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.scheduling_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  requested_by text, purpose text not null,
  priority text not null default 'Normal' check (priority in ('Critical','High','Normal','Low')),
  status text not null default 'Requested' check (status in ('Requested','Awaiting Availability','Proposed','Confirmed','Completed','Declined')),
  proposed_times jsonb not null default '[]',
  calendar_event_id uuid references public.calendar_events(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- ---------- Phase 2: finance ----------
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null, contact_name text, email text, phone text, notes text,
  created_at timestamptz not null default now()
);
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  direction text not null check (direction in ('payable','receivable')),
  category text not null default 'General' check (category in ('General','Office rent','Coffee machine','Advertising','Other')),
  vendor_id uuid references public.vendors(id) on delete set null,
  counterparty text,                     -- tenant or person when not a vendor
  invoice_number text,
  amount numeric(12,2), amount_paid numeric(12,2) not null default 0,
  due_date date, invoice_sent_at date,
  status text not null default 'Open' check (status in ('Draft','Open','Partially Paid','Paid','Overdue','Void')),
  payment_method text,
  autopay_status text not null default 'Off' check (autopay_status in ('Off','Setup pending','Awaiting verification','Active')),
  responsible text, receipt_url text, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.financial_accounts (   -- connection status only. Never credentials.
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null,                    -- e.g. 'Business checking', 'Venmo'
  institution text,
  last4 text check (last4 is null or last4 ~ '^[0-9]{4}$'),
  connection_status text not null default 'Unknown' check (connection_status in ('Connected','Disconnected','Needs reconnect','Unknown')),
  last_verified_at timestamptz,
  notes text
);
create table public.bookkeeping_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source text not null default 'KPA' check (source in ('KPA','QuickBooks','Other')),
  transaction_date date, amount numeric(12,2), merchant text,
  account_id uuid references public.financial_accounts(id) on delete set null,
  category text, description text, missing_documentation text,
  item_type text default 'Categorization' check (item_type in ('Categorization','W-9','Zelle details','Missing info','Other')),
  assigned_to text,
  status text not null default 'Open' check (status in ('Open','Waiting','Answered','Closed')),
  follow_up_date date,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- ---------- Phase 2: debt ----------
create table public.debts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  person_name text not null,
  carrier text,
  original_amount numeric(12,2),          -- null until confirmed; never guessed
  status text not null default 'Identified' check (status in ('Identified','Verified','Contact Required','Contacted','Payment Plan Proposed','Active Payment Plan','Paid','Disputed','Escalated','Closed')),
  last_contact_at date, follow_up_date date, notes text, documents jsonb not null default '[]',
  compensation_action_authorized boolean not null default false,   -- explicit, manual only
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.payment_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  debt_id uuid not null references public.debts(id) on delete cascade,
  installment_amount numeric(12,2), frequency text, start_date date,
  status text not null default 'Proposed' check (status in ('Proposed','Active','Completed','Defaulted','Cancelled')),
  notes text, created_at timestamptz not null default now()
);
create table public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  debt_id uuid not null references public.debts(id) on delete cascade,
  payment_plan_id uuid references public.payment_plans(id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  paid_on date not null, method text, notes text,
  created_at timestamptz not null default now()
);
create view public.debt_balances with (security_invoker = true) as
  select d.id as debt_id, d.owner_id, d.person_name, d.original_amount,
         coalesce(sum(p.amount),0) as recovered,
         case when d.original_amount is null then null else d.original_amount - coalesce(sum(p.amount),0) end as balance,
         max(p.paid_on) as last_payment_on
  from public.debts d left join public.debt_payments p on p.debt_id = d.id
  group by d.id;

-- ---------- Phase 2: leads ----------
create table public.atm_enrollments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  agent_contact_id uuid references public.contacts(id) on delete set null,
  agent_name text not null,
  status text not null default 'Request Received' check (status in ('Request Received','Reviewed','Added','Active','Deal Closed','Removal Required','Completed')),
  requested_at date, added_at date,
  closed_deal_verified boolean not null default false,   -- removal requires verification
  notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.lead_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null, responsible_contact text, notes text
);
create table public.lead_allocations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  enrollment_id uuid references public.atm_enrollments(id) on delete cascade,
  lead_group_id uuid references public.lead_groups(id) on delete cascade,
  quantity int, allocated_on date, removed_on date, notes text
);
create table public.weekly_lead_readiness (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lead_group_id uuid not null references public.lead_groups(id) on delete cascade,
  week_of date not null,                  -- the Monday the leads are for
  required_volume int, confirmed_volume int,  -- null until confirmed; never guessed
  status text not null default 'Not Started' check (status in ('Not Started','In Progress','Awaiting Confirmation','Ready','At Risk')),
  outstanding_issues text, confirmed_at timestamptz, notes text,
  unique (owner_id, lead_group_id, week_of)
);

-- ---------- Phase 2: advertising & office ----------
create table public.advertising_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  agent_name text not null, request text, campaign_type text, responsible text,
  payment_required boolean, payment_status text default 'Unknown',
  creative_status text default 'Not started',
  status text not null default 'Requested' check (status in ('Requested','Payment Pending','Preparation','Ready','Active','Paused','Completed')),
  launch_date date, follow_up_date date, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.office_inventory (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item text not null, category text default 'Consumables',
  level text not null default 'Unknown' check (level in ('Stocked','Low','Out','Unknown')),
  reorder_threshold text, vendor_id uuid references public.vendors(id) on delete set null,
  last_restock date, next_restock date, notes text
);

-- ---------- Phase 3: communications, automation, AI ----------
create table public.communication_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account text not null check (account in ('mine','wylie','dm','other')),
  source text, external_id text, contact text, summary text,
  category text not null default 'Needs Response' check (category in ('Needs Response','Needs Action','Waiting on Someone','Invoice or Payment','Scheduling','Recruiting','Agent Support','FYI','Completed')),
  priority text not null default 'Normal' check (priority in ('Critical','High','Normal','Low')),
  follow_up_date date, draft_response text,
  response_status text not null default 'Not drafted' check (response_status in ('Not drafted','Drafted','Approved','Sent (confirmed)','No reply needed')),
  task_id uuid references public.tasks(id) on delete set null,
  received_at timestamptz, created_at timestamptz not null default now()
);
create table public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null, cadence text not null check (cadence in ('daily','weekly','monthly')),
  weekday smallint, day_of_month smallint, run_time time,
  task_template jsonb not null default '{}',
  active boolean not null default true,
  last_generated_for date,               -- prevents duplicate generation
  created_at timestamptz not null default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null, body text, link text, read_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.ai_activity_log (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  prompt text not null, response text,
  proposed_changes jsonb not null default '[]',
  applied_changes jsonb not null default '[]',   -- only what the database confirmed
  status text not null default 'proposed' check (status in ('proposed','confirmed','applied','rejected','failed')),
  created_at timestamptz not null default now()
);

-- updated_at triggers
do $$ declare t text; begin
  for t in select table_name from information_schema.columns
           where table_schema='public' and column_name='updated_at'
             and table_name in (select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE')
  loop
    execute format('create trigger %I_updated before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;
