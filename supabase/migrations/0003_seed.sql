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
