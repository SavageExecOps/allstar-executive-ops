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
