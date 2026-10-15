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
