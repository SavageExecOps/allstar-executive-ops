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
