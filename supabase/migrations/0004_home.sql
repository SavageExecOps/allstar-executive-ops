-- Home page: the name in "Good morning, ___." Editable in Settings.
alter table public.users add column if not exists home_name text not null default 'Savage';
