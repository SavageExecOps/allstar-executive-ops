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
