-- 확정된 여행을 주최자가 다시 열 수 있게 한다.
--
-- 상태값은 새로 만들지 않는다. '재조율 중'은 이미 있는 단계(collecting_responses,
-- accommodation_voting)로 되돌아간 것이고, 처음 진행과 다른 점은 '되돌린 기록이
-- 살아 있다'는 것뿐이다. 그 기록을 trips 에 달아두고, 다시 확정되는 순간 지운다.
--   trips.reopened_*        : 지금 열려 있는 재조율 한 건 (배너·목록 라벨용)
--   trip_reopenings         : 지우지 않는 기록 (누가·언제·어디까지·왜)

do $$
begin
  if not exists (select 1 from pg_type where typname = 'reopen_scope') then
    -- stay_vote        : 숙소 투표만
    -- group_direction  : 날짜·취향부터
    create type reopen_scope as enum ('stay_vote', 'group_direction');
  end if;
end
$$;

alter table trips add column if not exists reopened_scope reopen_scope;
alter table trips add column if not exists reopened_reason text
  check (reopened_reason is null or char_length(reopened_reason) <= 100);
alter table trips add column if not exists reopened_at timestamptz;
-- 닉네임은 참여자 목록에서 찾는다 — 화면이 이미 들고 있는 데이터다.
alter table trips add column if not exists reopened_by_participant_id uuid
  references participants(id) on delete set null;

create table if not exists trip_reopenings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  reopened_by_participant_id uuid references participants(id) on delete set null,
  scope reopen_scope not null,
  reason text check (reason is null or char_length(reason) <= 100),
  created_at timestamptz not null default now()
);
create index if not exists trip_reopenings_trip_id_idx on trip_reopenings (trip_id);

alter table trip_reopenings enable row level security;

-- 참여자는 읽기만. 쓰기는 아래 security definer 함수를 통해서만 이뤄진다.
drop policy if exists trip_reopenings_select on trip_reopenings;
create policy trip_reopenings_select on trip_reopenings for select
  using (is_trip_participant(trip_id));

-- ── 재개 ────────────────────────────────────────────────────────
-- 한 번의 update 로 관련 상태를 모두 바꾼다. 함수 하나가 곧 트랜잭션이라
-- 날짜만 풀리고 숙소는 확정인 채로 남는 중간 상태가 생기지 않는다.
create or replace function reopen_after_confirm(
  p_trip_id uuid,
  p_scope reopen_scope,
  p_reason text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_status trip_status;
  v_me uuid;
  v_reason text;
begin
  if not is_trip_host(p_trip_id) then
    raise exception 'NOT_HOST' using errcode = 'P0001';
  end if;

  select status into v_status from trips where id = p_trip_id;
  if v_status is null then
    raise exception 'TRIP_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- 같은 요청이 두 번 도착해도 두 번 열리지 않는다. 이미 그 범위로 열려 있으면
  -- 조용히 끝낸다 — 오류를 내면 화면이 실패한 것처럼 보이지만 실제로는
  -- 사용자가 원한 상태에 이미 도달해 있다.
  if v_status <> 'confirmed' then
    if exists (
      select 1 from trips
      where id = p_trip_id
        and reopened_scope = p_scope
        and reopened_at is not null
    ) then
      return;
    end if;
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  select id into v_me from participants
    where trip_id = p_trip_id and user_id = auth.uid();

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if char_length(coalesce(v_reason, '')) > 100 then
    raise exception 'REASON_TOO_LONG' using errcode = 'P0001';
  end if;

  if p_scope = 'stay_vote' then
    -- 날짜·취향·합의·후보·투표는 그대로 두고 숙소 확정만 푼다.
    update trips set
      final_accommodation_id = null,
      status = 'accommodation_voting',
      confirmed_at = null,
      reopened_scope = p_scope,
      reopened_reason = v_reason,
      reopened_at = now(),
      reopened_by_participant_id = v_me
    where id = p_trip_id;
  else
    -- 날짜 확정과 숙소 확정을 함께 푼다. 응답·후보·투표는 건드리지 않는다.
    update trips set
      final_accommodation_id = null,
      confirmed_start_date = null,
      confirmed_end_date = null,
      confirmed_participant_count = null,
      status = 'collecting_responses',
      confirmed_at = null,
      reopened_scope = p_scope,
      reopened_reason = v_reason,
      reopened_at = now(),
      reopened_by_participant_id = v_me
    where id = p_trip_id;
  end if;

  insert into trip_reopenings (trip_id, reopened_by_participant_id, scope, reason)
  values (p_trip_id, v_me, p_scope, v_reason);
end;
$$;

revoke all on function reopen_after_confirm(uuid, reopen_scope, text) from public;
grant execute on function reopen_after_confirm(uuid, reopen_scope, text) to authenticated;

-- ── 다시 확정되면 '열려 있음' 표시를 거둔다 ──────────────────────
-- 기록(trip_reopenings)은 남기고 화면에 붙는 배너만 사라진다.
create or replace function confirm_final_accommodation(p_trip_id uuid, p_accommodation_id uuid)
returns void
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
    confirmed_at = now(),
    reopened_scope = null,
    reopened_reason = null,
    reopened_at = null,
    reopened_by_participant_id = null
  where id = p_trip_id;
end;
$$;
