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
