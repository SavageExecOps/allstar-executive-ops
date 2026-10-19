-- Agent Support: teams and emails, plus the current Team 1 and Team 2 (Oath) rosters.
-- Safe to run more than once (agents already on the list are skipped by email).

alter table public.agent_support add column if not exists team text;
alter table public.agent_support add column if not exists email text;
-- Lead type is filled in later per agent, so it can start blank.
alter table public.agent_support alter column lead_type drop not null;
alter table public.agent_support alter column lead_type drop default;

-- The roster goes to the account that owns your Executive Ops data (sign-ups are off).
insert into public.agent_support (owner_id, team, agent_name, email, lead_spend, spend_period, status)
select u.id, v.team, v.name, v.email, v.spend, 'Total', 'Active'
from (select coalesce((select owner_id from public.tasks limit 1), (select id from auth.users limit 1)) as id) u
cross join (values
  ('Team 1', 'Manny', 'juniorparada1234@gmail.com', 909.09),
  ('Team 1', 'Shane Rivera', 'shane5557@icloud.com', 909.09),
  ('Team 1', 'Keegan', 'keegancordova2@gmail.com', 909.09),
  ('Team 1', 'Edwin Yahir Guillen', 'edwinguillen004@gmail.com', 909.09),
  ('Team 1', 'Josiah Magana', 'josiah_627@icloud.com', 909.09),
  ('Team 1', 'Alexandro Valdivia', 'valdiviaalex914@gmail.com', 909.09),
  ('Team 1', 'Chase Cortez', 'chasercortez@gmail.com', 909.09),
  ('Team 1', 'Josiah Munoz', 'josiahmunoz110@gmail.com', 909.09),
  ('Team 1', 'Quentin Peterson', 'quintin.peterson360@gmail.com', 909.09),
  ('Team 1', 'Alex Barrera', 'barreraalex039@gmail.com', 909.09),
  ('Team 1', 'Leon Rios', 'riosleonides2006@gmail.com', 909.09),
  ('Team 2 (Oath)', 'Diego Camino', 'dcamino.az@gmail.com', 833.33),
  ('Team 2 (Oath)', 'Alexander McCain', 'apmccain2@gmail.com', 833.33),
  ('Team 2 (Oath)', 'Alexander Vrbas', 'alexvrbas3@gmail.com', 833.33),
  ('Team 2 (Oath)', 'Ethan Palagonia', 'ethanpalagonia@gmail.com', 833.33),
  ('Team 2 (Oath)', 'Tristen Garcia', 'solitudeconnections@gmail.com', 833.33),
  ('Team 2 (Oath)', 'Bryant Cliff', 'bryant.cliff00@gmail.com', 833.33),
  ('Team 2 (Oath)', 'Matthew McClure', 'matt.mcclure.ins@gmail.com', 833.33),
  ('Team 2 (Oath)', 'Chase Conrad', 'chaseconrad.ins@gmail.com', 833.33)
) as v(team, name, email, spend)
where not exists (select 1 from public.agent_support a where a.owner_id = u.id and lower(a.email) = lower(v.email));
