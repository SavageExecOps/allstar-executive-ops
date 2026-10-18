-- ALLSTAR Executive Ops — one-time database setup for a NEW project.
-- Paste this whole file into Supabase → SQL Editor → New query, then click Run.
-- Already set up? Run only the newer files in supabase/migrations instead.

-- ======== 0001_schema.sql ========
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

-- ======== 0002_security.sql ========
-- Row-level security: every table is private to its owner.
alter table public.users enable row level security;
create policy "own profile" on public.users for all
  using (id = auth.uid()) with check (id = auth.uid());

do $$ declare t text; begin
  for t in select c.table_name from information_schema.columns c
           join information_schema.tables tb on tb.table_name=c.table_name and tb.table_schema=c.table_schema
           where c.table_schema='public' and c.column_name='owner_id' and tb.table_type='BASE TABLE'
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "owner only" on public.%I for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t);
    execute format('create index if not exists %I on public.%I(owner_id)', t || '_owner_idx', t);
  end loop;
end $$;

-- Anonymous visitors get nothing.
revoke all on all tables in schema public from anon;

-- Create a profile row automatically when an account is created.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, display_name) values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ======== 0003_seed.sql ========
-- Starting data. The app calls seed_starting_items() once, on first sign-in,
-- so every row belongs to the signed-in user. It does nothing if data exists.
-- Unknown amounts, owners, contacts and deadlines are left empty and listed in
-- needs_confirmation rather than guessed.

create or replace function public.seed_starting_items() returns boolean
language plpgsql security invoker set search_path = public as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'America/Chicago')::date;
  next_fri date := today + ((5 - extract(dow from today)::int + 7) % 7);
  p_net uuid; p_fin uuid; p_rec uuid; p_auto uuid; p_ads uuid;
  t uuid;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from tasks where owner_id = me) or exists (select 1 from projects where owner_id = me) then
    return false;
  end if;

  insert into projects (name, description, priority, status, next_action, dependencies, needs_confirmation) values
    ('Office internet upgrade','New office internet/network system that supports many people working at once.','High','Waiting','Follow up on the vendor quote expected Mon, Oct 19, 2026','Vendor quote; Wylie approval','{"Vendor name","Deadline"}') returning id into p_net;
  insert into projects (name, description, priority, status, next_action, dependencies, needs_confirmation) values
    ('Financial account reconnections','Reconnect business bank accounts and Venmo to QuickBooks Online.','High','Waiting','Follow up with Wylie','Wylie must reconnect the accounts himself','{"Which accounts","Deadline"}') returning id into p_fin;
  insert into projects (name, description, priority, status, next_action, needs_confirmation) values
    ('Recruiting calendar optimization','Protect Mon–Wed; open more recruiting availability Thu and Fri.','Normal','Planned','Apply proposed weekly availability; keep existing appointments','{"Deadline"}') returning id into p_rec;
  insert into projects (name, description, priority, status, next_action, needs_confirmation) values
    ('Recurring payment automation','Autopay for coffee machine invoices, verified before marking active.','Normal','Planned','Set up autopay with the vendor','{"Vendor","Payment method"}') returning id into p_auto;
  insert into projects (name, description, priority, status, next_action, needs_confirmation) values
    ('Agent advertising rollout','Coordinate advertising for multiple agents.','Normal','In Progress','List which agents are waiting and their blockers','{"Agent list"}') returning id into p_ads;

  insert into tasks (title, department, project_id, priority, notes, needs_confirmation) values
    ('Adjust recruiting calendar to prioritize Thursday and Friday','Recruiting',p_rec,'High',
     'Proposed availability (CT): Mon 1–2, Tue 1–2:30, Wed 1–3, Thu 10–12 & 1–4, Fri 10–12 & 1–3. Existing appointments stay until explicitly changed.','{"Deadline"}');
  insert into tasks (title, department, project_id, priority, status, waiting_on, waiting_since, impact_if_delayed, is_top_priority, needs_confirmation) values
    ('Follow up with Wylie to reconnect business bank accounts and Venmo','Finance',p_fin,'High','Waiting','Wylie',today,'QuickBooks can''t sync transactions until reconnected',true,'{"Deadline"}');
  insert into tasks (title, department, project_id, notes, needs_confirmation) values
    ('Configure autopay for coffee machine invoices','Finance',p_auto,'Verify the first autopay charge before marking autopay active.','{"Vendor","Amount"}');
  insert into tasks (title, department, priority, status, waiting_on, contact_name, impact_if_delayed, is_top_priority, needs_confirmation) values
    ('Follow up with Jonathan about outstanding payment','Debt','High','Waiting','Jonathan','Jonathan','Outstanding balance owed to Wylie',true,'{"Amount","Contact info","Follow-up date"}');
  insert into tasks (title, department, needs_confirmation) values
    ('Review debt balances and payment plans','Debt','{"Deadline"}'),
    ('Review office supply levels','Office','{"Deadline"}');
  insert into tasks (title, department, project_id, needs_confirmation) values
    ('Coordinate advertising for agents','Advertising',p_ads,'{"Agents","Deadline"}');
  insert into tasks (title, department, priority, due_date, recurrence, notes, is_top_priority, needs_confirmation) values
    ('Confirm volume leads for both groups are ready for Monday','Leads','High',next_fri,'Weekly · Friday','Two supported groups. Lead counts not entered yet.',true,'{"Group names","Required volume"}');
  insert into tasks (title, department, project_id, status, waiting_on, waiting_since, due_date, follow_up_date, impact_if_delayed, notes, needs_confirmation) values
    ('Follow up on internet system quote','Office',p_net,'Waiting','Internet vendor',today,'2026-10-19','2026-10-19','Network upgrade can''t be approved without the quote','Quote expected Monday, October 19, 2026.','{"Vendor name"}');
  insert into tasks (title, department, description, due_date) values
    ('Establish three daily communications windows','Communications','9:00–9:30 AM, ~3:00 PM, 6:00–7:00 PM Central.',today),
    ('Implement end-of-day recaps','Operations','Detailed internal recap plus short update for Wylie.',today);
  insert into tasks (title, department, recurrence, needs_confirmation) values
    ('Maintain Wylie''s executive scheduling queue','Executive','Ongoing','{"Deadline"}');

  insert into task_activity (task_id, body, actor)
    select id, 'Created from initial active items', 'system' from tasks where owner_id = me;

  insert into executive_preferences (category, permanence, body) values
    ('Restriction','Temporary','Friday one-on-ones are currently restricted.'),
    ('Scheduling','Permanent','Do not book meetings for Wylie without his approval. Protect his time; group one-on-ones in back-to-back 30-minute slots.');
  insert into notes (body, note_type, department) values
    ('Debt: compensation-related action only with Wylie''s explicit authorization. Never automate.','Procedure','Debt'),
    ('ATM free leads: never remove an agent or their leads based only on an unverified closed-deal notice.','Procedure','Leads');

  insert into schedule_blocks (start_time, end_time, title, description, departments, is_protected, is_recap, sort_order) values
    ('09:00','09:30','Morning communications sweep','My email, Wylie''s email, DMs, urgent requests, anything needing action.','{Communications}',false,false,1),
    ('09:30','10:00','Quick admin','KPA, QuickBooks, ATM lead requests, invoice notifications.','{Finance,Leads}',false,false,2),
    ('10:00','12:00','Priority operations','Executive calendar, recruiting coordination, debt, financial tasks, active projects.','{Executive,Debt,Finance}',false,false,3),
    ('12:00','12:30','Lunch','Personal break.','{}',true,false,4),
    ('12:30','15:00','Recruiting & execution','Scheduled calls, manager introductions, agent support, outstanding work.','{Recruiting,Operations}',false,false,5),
    ('15:00','15:30','Midday communications sweep','Both inboxes, DMs, pending replies, new requests.','{Communications}',false,false,6),
    ('15:30','18:00','Execution & follow-ups','Debt, leads, advertising, office projects, recruiting, executive requests.','{Leads,Advertising,Office}',false,false,7),
    ('18:00','19:00','Final sweep & daily recap','Last inbox pass, then generate the recap.','{}',false,true,8);

  -- Proposed recruiting availability (Phase 2 module reads this). Not appointments.
  insert into recruiting_availability (weekday, start_time, end_time) values
    (1,'13:00','14:00'),(2,'13:00','14:30'),(3,'13:00','15:00'),
    (4,'10:00','12:00'),(4,'13:00','16:00'),(5,'10:00','12:00'),(5,'13:00','15:00');

  insert into contacts (name, kind) values ('Wylie','executive'), ('Jonathan','debtor');
  insert into debts (person_name, status, notes) values
    ('Jonathan','Contact Required','Outstanding payment. Amount not yet confirmed.');
  insert into financial_accounts (label, connection_status, notes) values
    ('Business bank accounts','Needs reconnect','Wylie to reconnect in QuickBooks. Which accounts: needs confirmation.'),
    ('Venmo','Needs reconnect','Wylie to reconnect in QuickBooks.');
  insert into lead_groups (name, notes) values ('Group 1 (name needed)','Rename once confirmed'), ('Group 2 (name needed)','Rename once confirmed');
  return true;
end $$;

grant execute on function public.seed_starting_items() to authenticated;

-- ======== 0004_home.sql ========
-- Home page: the name in "Good morning, ___." Editable in Settings.
alter table public.users add column if not exists home_name text not null default 'Savage';

-- ======== 0005_recruiting.sql ========
-- Phase 2: Recruiting (two-stack round robin) + For Wylie one-on-one list.
-- Safe to run once in Supabase → SQL Editor.

-- Managers: location and whether they're in the round-robin rotation.
alter table public.managers add column if not exists location text;
alter table public.managers add column if not exists in_rotation boolean not null default true;
alter table public.managers add column if not exists specialty text;   -- e.g. "Recruits over 30"
alter table public.managers add column if not exists sort_order int not null default 0;

-- Recruits: details that drive the pairing decision.
alter table public.recruits add column if not exists location text;
alter table public.recruits add column if not exists age int check (age is null or (age between 16 and 100));
alter table public.recruits add column if not exists licensed text not null default 'Unknown'
  check (licensed in ('Licensed','Not licensed','In progress','Unknown'));
alter table public.recruits add column if not exists appointment_at timestamptz;
alter table public.recruits add column if not exists handed_off_at timestamptz;
alter table public.recruits drop constraint if exists recruits_status_check;
alter table public.recruits add constraint recruits_status_check check (status in
  ('New','Scheduled','Call Completed','Manager Assigned','Group Chat Created','Handed Off',
   'No Show','Reschedule','Not Interested','Not Qualified','Follow-up Needed'));
create index if not exists recruits_owner_status_idx on public.recruits(owner_id, status);

-- Why a recruit went to someone other than who was up next.
alter table public.manager_assignments add column if not exists reason text not null default 'Round robin';
alter table public.manager_assignments add column if not exists was_up_next boolean not null default true;
create index if not exists manager_assignments_mgr_idx on public.manager_assignments(manager_id, assigned_at desc);

-- Conversation notes on a recruit (dictated or typed).
create table if not exists public.recruit_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  recruit_id uuid not null references public.recruits(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists recruit_notes_recruit_idx on public.recruit_notes(recruit_id, created_at desc);

-- Things to go over with Wylie at the next one-on-one.
create table if not exists public.wylie_agenda (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  topic text not null,
  details text,
  priority boolean not null default false,
  status text not null default 'Open' check (status in ('Open','Discussed')),
  outcome text,
  discussed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists wylie_agenda_owner_idx on public.wylie_agenda(owner_id, status, created_at desc);
drop trigger if exists wylie_agenda_updated on public.wylie_agenda;
create trigger wylie_agenda_updated before update on public.wylie_agenda for each row execute function public.set_updated_at();

-- Security: owner-only, same as every other table.
alter table public.recruit_notes enable row level security;
alter table public.wylie_agenda enable row level security;
drop policy if exists "owner only" on public.recruit_notes;
drop policy if exists "owner only" on public.wylie_agenda;
create policy "owner only" on public.recruit_notes for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner only" on public.wylie_agenda for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
grant select, insert, update, delete on public.recruit_notes, public.wylie_agenda to authenticated;
revoke all on public.recruit_notes, public.wylie_agenda from anon;

-- Starting roster and agenda for each existing account (skipped if already there).
insert into public.managers (owner_id, name, location, in_rotation, specialty, sort_order)
select u.id, m.name, m.location, m.in_rotation, m.specialty, m.sort_order
from auth.users u
cross join (values
  ('Nathan Shinoda',   null,                true,  null,                1),
  ('Jackson Rappaport','Austin, TX',        true,  null,                2),
  ('Luke Rappaport',   null,                true,  null,                3),
  ('David Layton',     null,                true,  null,                4),
  ('Brian Turner',     null,                true,  null,                5),
  ('Dom',              null,                false, 'Recruits over 30',  6)
) as m(name, location, in_rotation, specialty, sort_order)
where not exists (select 1 from public.managers x where x.owner_id = u.id);

insert into public.wylie_agenda (owner_id, topic, details, priority)
select u.id, a.topic, a.details, a.priority
from auth.users u
cross join (values
  ('Manager roster for recruiting', 'Keep stacking Nathan, Jackson, Luke, David and Brian? Add anyone? Dom stays on 30+.', true)
) as a(topic, details, priority)
where not exists (select 1 from public.wylie_agenda x where x.owner_id = u.id);

-- ======== 0006_qualify_intake.sql ========
-- Recruit qualification + iClosed (via Zapier) intake.
-- Safe to run once in Supabase → SQL Editor.

alter table public.recruits add column if not exists us_based text not null default 'Unknown'
  check (us_based in ('Unknown','Yes','No'));
alter table public.recruits add column if not exists other_agency text not null default 'Unknown'
  check (other_agency in ('Unknown','Yes','No'));
alter table public.recruits add column if not exists other_agency_name text;
alter table public.recruits add column if not exists disqualify_reason text;
alter table public.recruits add column if not exists external_id text;          -- iClosed contact/event id
alter table public.recruits add column if not exists form_answers jsonb not null default '{}';
create unique index if not exists recruits_owner_external_idx on public.recruits(owner_id, external_id) where external_id is not null;
create index if not exists recruits_owner_email_idx on public.recruits(owner_id, lower(email));

-- The intake endpoint runs on the server with the secret key; it needs to find
-- the workspace owner's account id from their email. Only the server key can call this.
create or replace function public.owner_id_for_email(p_email text) returns uuid
language sql stable security definer set search_path = public, auth as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1
$$;
revoke all on function public.owner_id_for_email(text) from public, anon, authenticated;
grant execute on function public.owner_id_for_email(text) to service_role;


-- Phase 2: DM tracker, Wins log, and recruit outcomes for the scorecard.
-- Safe to run more than once.

create table if not exists public.dm_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  sent int not null default 0 check (sent >= 0),
  replies int not null default 0 check (replies >= 0),
  booked int not null default 0 check (booked >= 0),
  notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (owner_id, day)
);

create table if not exists public.wins (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  happened_on date not null default current_date,
  title text not null,
  category text not null default 'Operations' check (category in ('Recruiting','Money recovered','Money saved','Time saved','Operations','Project shipped')),
  value numeric(12,2),             -- dollars, when there is a real number; never guessed
  notes text,
  created_at timestamptz not null default now()
);

alter table public.recruits add column if not exists contracted_at date;
alter table public.recruits add column if not exists producing_at date;

do $$ declare t text; begin
  foreach t in array array['dm_logs','wins'] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='owner only') then
      execute format('create policy "owner only" on public.%I for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t);
    end if;
    execute format('create index if not exists %I on public.%I(owner_id)', t || '_owner_idx', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
  if not exists (select 1 from pg_trigger where tgname = 'dm_logs_updated') then
    create trigger dm_logs_updated before update on public.dm_logs for each row execute function public.set_updated_at();
  end if;
end $$;

revoke all on public.dm_logs, public.wins from anon;
grant select on public.debt_balances to authenticated;

-- Agent Support list and Google Calendar sync for Wylie's calendar.
-- Safe to run more than once.

create table if not exists public.agent_support (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  agent_name text not null,
  lead_type text not null default 'Final Expense' check (lead_type in ('Final Expense','Veterans','Truckers','Mortgage Protection','Other')),
  lead_type_other text,
  states text,                              -- e.g. "TX, OK, FL"
  lead_spend numeric(12,2),                 -- never guessed; blank until known
  spend_period text not null default 'Weekly' check (spend_period in ('Weekly','Monthly','Total')),
  support_start date,
  support_end date,                         -- when they're cut from support
  status text not null default 'Active' check (status in ('Active','Ended')),
  notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- Calendar sync: one row per Google event, matched by its id.
alter table public.calendar_events add column if not exists source text not null default 'manual';
alter table public.calendar_events add column if not exists all_day boolean not null default false;
alter table public.calendar_events add column if not exists location text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'calendar_events_owner_external_key') then
    alter table public.calendar_events add constraint calendar_events_owner_external_key unique (owner_id, external_event_id);
  end if;
end $$;

do $$ begin
  alter table public.agent_support enable row level security;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='agent_support' and policyname='owner only') then
    create policy "owner only" on public.agent_support for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'agent_support_updated') then
    create trigger agent_support_updated before update on public.agent_support for each row execute function public.set_updated_at();
  end if;
end $$;
create index if not exists agent_support_owner_idx on public.agent_support(owner_id);
grant select, insert, update, delete on public.agent_support to authenticated;
revoke all on public.agent_support from anon;
