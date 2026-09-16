-- TRIPTUNE initial schema: enums, tables, RLS policies, triggers, RPC functions.
-- Run this once in the Supabase SQL Editor (Dashboard > SQL Editor > New query).

-- ============================================================
-- ENUMS
-- ============================================================
create type trip_status as enum (
  'collecting_responses',
  'accommodation_collecting',
  'accommodation_voting',
  'vote_result',
  'confirmed'
);

create type participant_role as enum ('host', 'participant');

create type response_status as enum ('not_started', 'in_progress', 'submitted');

create type date_availability as enum ('available', 'tentative', 'unavailable');

create type travel_pace as enum ('relaxed', 'balanced', 'packed');

create type spending_style as enum ('value', 'balanced', 'experience');

-- ============================================================
-- TABLES
-- ============================================================
create table trips (
  id uuid primary key default gen_random_uuid(),
  host_user_id uuid not null references auth.users(id),
  title text not null check (char_length(title) between 2 and 30),
  destination text not null check (char_length(destination) between 2 and 30),
  candidate_start_date date not null,
  candidate_end_date date not null,
  trip_days int not null check (trip_days >= 1),
  expected_participant_count int not null check (expected_participant_count between 2 and 10),
  confirmed_start_date date,
  confirmed_end_date date,
  confirmed_participant_count int,
  final_accommodation_id uuid,
  invite_token text not null unique,
  status trip_status not null default 'collecting_responses',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  constraint candidate_range_valid check (candidate_end_date > candidate_start_date),
  constraint candidate_range_max_31_days check (candidate_end_date - candidate_start_date <= 30),
  constraint trip_days_within_candidate_range check (trip_days <= (candidate_end_date - candidate_start_date + 1))
);

create table participants (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  nickname text not null,
  role participant_role not null default 'participant',
  response_status response_status not null default 'not_started',
  joined_at timestamptz not null default now(),
  constraint nickname_length check (char_length(trim(nickname)) between 2 and 12),
  constraint nickname_not_blank check (trim(nickname) ~ '[^[:space:][:punct:]]'),
  unique (trip_id, user_id)
);
create unique index participants_trip_nickname_ci on participants (trip_id, lower(trim(nickname)));
create index participants_trip_id_idx on participants (trip_id);

create table date_responses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  date date not null,
  availability date_availability not null,
  updated_at timestamptz not null default now(),
  unique (participant_id, date)
);
create index date_responses_trip_id_idx on date_responses (trip_id);

create table preference_responses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  nature smallint not null check (nature between -2 and 2),
  food smallint not null check (food between -2 and 2),
  cafe smallint not null check (cafe between -2 and 2),
  activity smallint not null check (activity between -2 and 2),
  pace travel_pace not null,
  spending_style spending_style not null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, participant_id)
);
create index preference_responses_trip_id_idx on preference_responses (trip_id);

create table consensus_snapshots (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  selected_start_date date not null,
  selected_end_date date not null,
  preference_summary jsonb not null,
  conflict_summary jsonb not null,
  participant_count int not null,
  created_at timestamptz not null default now()
);
create index consensus_snapshots_trip_id_idx on consensus_snapshots (trip_id);

create table accommodations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  created_by_participant_id uuid not null references participants(id),
  url text not null check (url ~* '^https?://'),
  name text not null check (char_length(name) between 2 and 50),
  image_url text,
  location text not null check (char_length(trim(location)) > 0),
  total_price int not null check (total_price > 0),
  capacity int not null check (capacity >= 1),
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index accommodations_trip_id_idx on accommodations (trip_id);

create table accommodation_votes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  accommodation_id uuid not null references accommodations(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, participant_id)
);
create index accommodation_votes_trip_id_idx on accommodation_votes (trip_id);
create index accommodation_votes_accommodation_id_idx on accommodation_votes (accommodation_id);

alter table trips
  add constraint trips_final_accommodation_fk
  foreign key (final_accommodation_id) references accommodations(id);

-- ============================================================
-- updated_at helper trigger
-- ============================================================
create function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trips_set_updated_at before update on trips
  for each row execute function set_updated_at();
create trigger date_responses_set_updated_at before update on date_responses
  for each row execute function set_updated_at();
create trigger preference_responses_set_updated_at before update on preference_responses
  for each row execute function set_updated_at();
create trigger accommodations_set_updated_at before update on accommodations
  for each row execute function set_updated_at();
create trigger accommodation_votes_set_updated_at before update on accommodation_votes
  for each row execute function set_updated_at();

-- ============================================================
-- Permission helper functions (SECURITY DEFINER to avoid RLS recursion)
-- ============================================================
create function is_trip_participant(p_trip_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from participants
    where trip_id = p_trip_id and user_id = auth.uid()
  );
$$;

create function is_trip_host(p_trip_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from participants
    where trip_id = p_trip_id and user_id = auth.uid() and role = 'host'
  );
$$;

create function my_participant_id(p_trip_id uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from participants
  where trip_id = p_trip_id and user_id = auth.uid();
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table trips enable row level security;
alter table participants enable row level security;
alter table date_responses enable row level security;
alter table preference_responses enable row level security;
alter table consensus_snapshots enable row level security;
alter table accommodations enable row level security;
alter table accommodation_votes enable row level security;

-- trips: only participants (incl. host) can read the raw row directly.
-- Pre-join invite-landing lookups go through get_trip_invite_info() below.
create policy trips_select on trips for select
  using (is_trip_participant(id));
-- All writes to trips go through SECURITY DEFINER RPC functions below.

-- participants: any trip participant can see the roster.
create policy participants_select on participants for select
  using (is_trip_participant(trip_id));
-- All writes go through create_trip()/join_trip().

-- date_responses: any trip participant can read (needed for consensus calc);
-- only the owner can write, and only while the trip accepts edits.
create policy date_responses_select on date_responses for select
  using (is_trip_participant(trip_id));
create policy date_responses_insert on date_responses for insert
  with check (
    participant_id = my_participant_id(trip_id)
    and exists (select 1 from trips t where t.id = trip_id and t.status = 'collecting_responses')
  );
create policy date_responses_update on date_responses for update
  using (participant_id = my_participant_id(trip_id))
  with check (
    participant_id = my_participant_id(trip_id)
    and exists (select 1 from trips t where t.id = trip_id and t.status = 'collecting_responses')
  );
create policy date_responses_delete on date_responses for delete
  using (
    participant_id = my_participant_id(trip_id)
    and exists (select 1 from trips t where t.id = trip_id and t.status = 'collecting_responses')
  );

-- preference_responses: same shape as date_responses.
create policy preference_responses_select on preference_responses for select
  using (is_trip_participant(trip_id));
create policy preference_responses_insert on preference_responses for insert
  with check (
    participant_id = my_participant_id(trip_id)
    and exists (select 1 from trips t where t.id = trip_id and t.status = 'collecting_responses')
  );
create policy preference_responses_update on preference_responses for update
  using (participant_id = my_participant_id(trip_id))
  with check (
    participant_id = my_participant_id(trip_id)
    and exists (select 1 from trips t where t.id = trip_id and t.status = 'collecting_responses')
  );

-- consensus_snapshots: readable by trip participants; written only via RPC.
create policy consensus_snapshots_select on consensus_snapshots for select
  using (is_trip_participant(trip_id));

-- accommodations: any participant can read; creator can write while
-- candidates are still being collected; creator or host can delete.
create policy accommodations_select on accommodations for select
  using (is_trip_participant(trip_id));
create policy accommodations_insert on accommodations for insert
  with check (
    created_by_participant_id = my_participant_id(trip_id)
    and exists (select 1 from trips t where t.id = trip_id and t.status = 'accommodation_collecting')
  );
create policy accommodations_update on accommodations for update
  using (created_by_participant_id = my_participant_id(trip_id))
  with check (
    created_by_participant_id = my_participant_id(trip_id)
    and exists (select 1 from trips t where t.id = trip_id and t.status = 'accommodation_collecting')
  );
create policy accommodations_delete on accommodations for delete
  using (
    (created_by_participant_id = my_participant_id(trip_id) or is_trip_host(trip_id))
    and exists (select 1 from trips t where t.id = trip_id and t.status = 'accommodation_collecting')
  );

-- accommodation_votes: an owner can only ever see/manage their own vote row
-- while voting is active (no interim tallies); once results are public,
-- any trip participant can read every vote.
create policy accommodation_votes_select on accommodation_votes for select
  using (
    participant_id = my_participant_id(trip_id)
    or (
      is_trip_participant(trip_id)
      and exists (
        select 1 from trips t
        where t.id = trip_id and t.status in ('vote_result', 'confirmed')
      )
    )
  );
create policy accommodation_votes_insert on accommodation_votes for insert
  with check (
    participant_id = my_participant_id(trip_id)
    and exists (select 1 from trips t where t.id = trip_id and t.status = 'accommodation_voting')
  );
create policy accommodation_votes_update on accommodation_votes for update
  using (participant_id = my_participant_id(trip_id))
  with check (
    participant_id = my_participant_id(trip_id)
    and exists (select 1 from trips t where t.id = trip_id and t.status = 'accommodation_voting')
  );

-- ============================================================
-- Accommodation candidate-count guard (trigger; RLS can't do aggregate
-- counts safely across concurrent inserts as reliably as a locking trigger)
-- ============================================================
create function enforce_accommodation_limits() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_total int;
  v_mine int;
begin
  perform 1 from trips where id = new.trip_id for update;

  select count(*) into v_total from accommodations where trip_id = new.trip_id;
  if v_total >= 5 then
    raise exception 'ACCOMMODATION_LIMIT_TOTAL' using errcode = 'P0001';
  end if;

  select count(*) into v_mine from accommodations
    where trip_id = new.trip_id and created_by_participant_id = new.created_by_participant_id;
  if v_mine >= 2 then
    raise exception 'ACCOMMODATION_LIMIT_PER_PARTICIPANT' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger accommodations_enforce_limits
  before insert on accommodations
  for each row execute function enforce_accommodation_limits();

-- ============================================================
-- Auto-close voting once everyone has voted
-- ============================================================
create function close_voting_locked(p_trip_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update trips
    set status = 'vote_result'
    where id = p_trip_id and status = 'accommodation_voting';
end;
$$;

create function maybe_auto_close_voting() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_expected int;
  v_voted int;
begin
  perform 1 from trips where id = new.trip_id for update;

  select confirmed_participant_count into v_expected from trips where id = new.trip_id;
  select count(distinct participant_id) into v_voted from accommodation_votes where trip_id = new.trip_id;

  if v_expected is not null and v_voted >= v_expected then
    perform close_voting_locked(new.trip_id);
  end if;

  return new;
end;
$$;

create trigger accommodation_votes_maybe_close
  after insert or update on accommodation_votes
  for each row execute function maybe_auto_close_voting();

-- ============================================================
-- RPC: invite-link landing info (pre-join, bypasses row-level trip access)
-- ============================================================
create function get_trip_invite_info(p_invite_token text)
returns table (
  trip_id uuid,
  title text,
  destination text,
  candidate_start_date date,
  candidate_end_date date,
  trip_days int,
  expected_participant_count int,
  status trip_status,
  host_nickname text,
  current_participant_count int,
  already_joined boolean
)
language sql stable security definer set search_path = public as $$
  select
    t.id,
    t.title,
    t.destination,
    t.candidate_start_date,
    t.candidate_end_date,
    t.trip_days,
    t.expected_participant_count,
    t.status,
    (select p.nickname from participants p where p.trip_id = t.id and p.role = 'host' limit 1),
    (select count(*)::int from participants p where p.trip_id = t.id),
    exists (select 1 from participants p where p.trip_id = t.id and p.user_id = auth.uid())
  from trips t
  where t.invite_token = p_invite_token;
$$;

grant execute on function get_trip_invite_info(text) to authenticated;

-- ============================================================
-- RPC: create a trip (+ host participant) atomically
-- ============================================================
create function create_trip(
  p_title text,
  p_destination text,
  p_candidate_start_date date,
  p_candidate_end_date date,
  p_trip_days int,
  p_expected_participant_count int,
  p_host_nickname text
) returns trips
language plpgsql security definer set search_path = public as $$
declare
  v_trip trips;
  v_token text;
begin
  loop
    v_token := translate(encode(gen_random_bytes(9), 'base64'), '+/=', 'xyz');
    exit when not exists (select 1 from trips where invite_token = v_token);
  end loop;

  insert into trips (
    host_user_id, title, destination, candidate_start_date, candidate_end_date,
    trip_days, expected_participant_count, invite_token
  ) values (
    auth.uid(), p_title, p_destination, p_candidate_start_date, p_candidate_end_date,
    p_trip_days, p_expected_participant_count, v_token
  ) returning * into v_trip;

  insert into participants (trip_id, user_id, nickname, role)
  values (v_trip.id, auth.uid(), p_host_nickname, 'host');

  return v_trip;
end;
$$;

grant execute on function create_trip(text, text, date, date, int, int, text) to authenticated;

-- ============================================================
-- RPC: join a trip via invite token (idempotent for a returning browser)
-- ============================================================
create function join_trip(p_invite_token text, p_nickname text)
returns participants
language plpgsql security definer set search_path = public as $$
declare
  v_trip trips;
  v_existing participants;
  v_count int;
  v_participant participants;
begin
  select * into v_trip from trips where invite_token = p_invite_token for update;
  if not found then
    raise exception 'TRIP_NOT_FOUND' using errcode = 'P0001';
  end if;

  select * into v_existing from participants
    where trip_id = v_trip.id and user_id = auth.uid();
  if found then
    return v_existing;
  end if;

  if v_trip.status != 'collecting_responses' then
    raise exception 'JOIN_CLOSED' using errcode = 'P0001';
  end if;

  select count(*) into v_count from participants where trip_id = v_trip.id;
  if v_count >= v_trip.expected_participant_count then
    raise exception 'TRIP_FULL' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from participants
    where trip_id = v_trip.id and lower(trim(nickname)) = lower(trim(p_nickname))
  ) then
    raise exception 'NICKNAME_TAKEN' using errcode = 'P0001';
  end if;

  insert into participants (trip_id, user_id, nickname, role)
  values (v_trip.id, auth.uid(), p_nickname, 'participant')
  returning * into v_participant;

  return v_participant;
end;
$$;

grant execute on function join_trip(text, text) to authenticated;

-- ============================================================
-- RPC: save my date + preference response in one atomic call
-- ============================================================
create function save_my_response(
  p_trip_id uuid,
  p_dates jsonb, -- [{"date":"2026-10-17","availability":"available"}, ...]
  p_nature smallint,
  p_food smallint,
  p_cafe smallint,
  p_activity smallint,
  p_pace travel_pace,
  p_spending_style spending_style
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_participant_id uuid;
  v_status trip_status;
  v_item jsonb;
begin
  select status into v_status from trips where id = p_trip_id;
  if v_status is distinct from 'collecting_responses' then
    raise exception 'TRIP_NOT_ACCEPTING_RESPONSES' using errcode = 'P0001';
  end if;

  select id into v_participant_id from participants
    where trip_id = p_trip_id and user_id = auth.uid();
  if v_participant_id is null then
    raise exception 'NOT_A_PARTICIPANT' using errcode = 'P0001';
  end if;

  delete from date_responses where participant_id = v_participant_id;
  for v_item in select * from jsonb_array_elements(p_dates)
  loop
    insert into date_responses (trip_id, participant_id, date, availability)
    values (
      p_trip_id,
      v_participant_id,
      (v_item->>'date')::date,
      (v_item->>'availability')::date_availability
    );
  end loop;

  insert into preference_responses (
    trip_id, participant_id, nature, food, cafe, activity, pace, spending_style
  ) values (
    p_trip_id, v_participant_id, p_nature, p_food, p_cafe, p_activity, p_pace, p_spending_style
  )
  on conflict (trip_id, participant_id) do update set
    nature = excluded.nature,
    food = excluded.food,
    cafe = excluded.cafe,
    activity = excluded.activity,
    pace = excluded.pace,
    spending_style = excluded.spending_style,
    updated_at = now();

  update participants set response_status = 'submitted'
    where id = v_participant_id;
end;
$$;

grant execute on function save_my_response(uuid, jsonb, smallint, smallint, smallint, smallint, travel_pace, spending_style) to authenticated;

-- ============================================================
-- RPC: mark a participant's response as in-progress (lightweight, called
-- once when they first touch the date/preference form this visit)
-- ============================================================
create function mark_response_in_progress(p_trip_id uuid) returns void
language sql security definer set search_path = public as $$
  update participants set response_status = 'in_progress'
    where trip_id = p_trip_id and user_id = auth.uid() and response_status = 'not_started';
$$;

grant execute on function mark_response_in_progress(uuid) to authenticated;

-- ============================================================
-- RPC: host confirms the group direction (date range) from the consensus
-- screen. The date/preference calculation itself runs in the app layer;
-- this just persists the snapshot and transitions state atomically.
-- ============================================================
create function confirm_group_direction(
  p_trip_id uuid,
  p_selected_start_date date,
  p_selected_end_date date,
  p_preference_summary jsonb,
  p_conflict_summary jsonb,
  p_participant_count int
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_trip_host(p_trip_id) then
    raise exception 'NOT_HOST' using errcode = 'P0001';
  end if;

  if not exists (select 1 from trips where id = p_trip_id and status = 'collecting_responses') then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  insert into consensus_snapshots (
    trip_id, selected_start_date, selected_end_date,
    preference_summary, conflict_summary, participant_count
  ) values (
    p_trip_id, p_selected_start_date, p_selected_end_date,
    p_preference_summary, p_conflict_summary, p_participant_count
  );

  update trips set
    confirmed_start_date = p_selected_start_date,
    confirmed_end_date = p_selected_end_date,
    confirmed_participant_count = p_participant_count,
    status = 'accommodation_collecting'
  where id = p_trip_id;
end;
$$;

grant execute on function confirm_group_direction(uuid, date, date, jsonb, jsonb, int) to authenticated;

-- ============================================================
-- RPC: host reopens the group direction (only before voting starts)
-- ============================================================
create function reopen_group_direction(p_trip_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_trip_host(p_trip_id) then
    raise exception 'NOT_HOST' using errcode = 'P0001';
  end if;

  if not exists (select 1 from trips where id = p_trip_id and status = 'accommodation_collecting') then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  update trips set
    confirmed_start_date = null,
    confirmed_end_date = null,
    confirmed_participant_count = null,
    status = 'collecting_responses'
  where id = p_trip_id;
end;
$$;

grant execute on function reopen_group_direction(uuid) to authenticated;

-- ============================================================
-- RPC: host starts accommodation voting
-- ============================================================
create function start_voting(p_trip_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
  v_participants int;
begin
  if not is_trip_host(p_trip_id) then
    raise exception 'NOT_HOST' using errcode = 'P0001';
  end if;

  if not exists (select 1 from trips where id = p_trip_id and status = 'accommodation_collecting') then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  select count(*) into v_count from accommodations where trip_id = p_trip_id;
  if v_count < 2 or v_count > 5 then
    raise exception 'INVALID_CANDIDATE_COUNT' using errcode = 'P0001';
  end if;

  select confirmed_participant_count into v_participants from trips where id = p_trip_id;
  if v_participants is null or v_participants < 2 then
    raise exception 'INVALID_PARTICIPANT_COUNT' using errcode = 'P0001';
  end if;

  delete from accommodation_votes where trip_id = p_trip_id;

  update trips set status = 'accommodation_voting' where id = p_trip_id;
end;
$$;

grant execute on function start_voting(uuid) to authenticated;

-- ============================================================
-- RPC: cast or change my vote
-- ============================================================
create function cast_vote(p_trip_id uuid, p_accommodation_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_participant_id uuid;
begin
  if not exists (select 1 from trips where id = p_trip_id and status = 'accommodation_voting') then
    raise exception 'VOTING_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  select id into v_participant_id from participants
    where trip_id = p_trip_id and user_id = auth.uid();
  if v_participant_id is null then
    raise exception 'NOT_A_PARTICIPANT' using errcode = 'P0001';
  end if;

  if not exists (select 1 from accommodations where id = p_accommodation_id and trip_id = p_trip_id) then
    raise exception 'INVALID_ACCOMMODATION' using errcode = 'P0001';
  end if;

  insert into accommodation_votes (trip_id, accommodation_id, participant_id)
  values (p_trip_id, p_accommodation_id, v_participant_id)
  on conflict (trip_id, participant_id) do update set
    accommodation_id = excluded.accommodation_id,
    updated_at = now();
end;
$$;

grant execute on function cast_vote(uuid, uuid) to authenticated;

-- ============================================================
-- RPC: host ends voting early
-- ============================================================
create function end_voting_early(p_trip_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_trip_host(p_trip_id) then
    raise exception 'NOT_HOST' using errcode = 'P0001';
  end if;

  if not exists (select 1 from trips where id = p_trip_id and status = 'accommodation_voting') then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  perform close_voting_locked(p_trip_id);
end;
$$;

grant execute on function end_voting_early(uuid) to authenticated;

-- ============================================================
-- RPC: voting progress (aggregate only — never leaks who voted for what)
-- ============================================================
create function get_voting_progress(p_trip_id uuid)
returns table (expected int, voted int, my_vote_accommodation_id uuid)
language sql stable security definer set search_path = public as $$
  select
    (select confirmed_participant_count from trips where id = p_trip_id),
    (select count(distinct participant_id)::int from accommodation_votes where trip_id = p_trip_id),
    (select accommodation_id from accommodation_votes
      where trip_id = p_trip_id and participant_id = my_participant_id(p_trip_id));
$$;

grant execute on function get_voting_progress(uuid) to authenticated;

-- ============================================================
-- RPC: host confirms the final accommodation (must be a top-voted one)
-- ============================================================
create function confirm_final_accommodation(p_trip_id uuid, p_accommodation_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_max_votes int;
  v_this_votes int;
  v_total_votes int;
begin
  if not is_trip_host(p_trip_id) then
    raise exception 'NOT_HOST' using errcode = 'P0001';
  end if;

  if not exists (select 1 from trips where id = p_trip_id and status = 'vote_result') then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  select count(*) into v_total_votes from accommodation_votes where trip_id = p_trip_id;
  if v_total_votes = 0 then
    raise exception 'NO_VOTES' using errcode = 'P0001';
  end if;

  select max(cnt) into v_max_votes from (
    select count(*) as cnt from accommodation_votes
    where trip_id = p_trip_id group by accommodation_id
  ) t;

  select count(*) into v_this_votes from accommodation_votes
    where trip_id = p_trip_id and accommodation_id = p_accommodation_id;

  if v_this_votes != v_max_votes then
    raise exception 'NOT_TOP_VOTED' using errcode = 'P0001';
  end if;

  update trips set
    final_accommodation_id = p_accommodation_id,
    status = 'confirmed',
    confirmed_at = now()
  where id = p_trip_id;
end;
$$;

grant execute on function confirm_final_accommodation(uuid, uuid) to authenticated;

-- ============================================================
-- Realtime: broadcast row changes for the tables the UI subscribes to
-- ============================================================
alter publication supabase_realtime add table trips;
alter publication supabase_realtime add table participants;
alter publication supabase_realtime add table accommodations;
alter publication supabase_realtime add table accommodation_votes;
