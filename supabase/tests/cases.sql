\set ON_ERROR_STOP on
set client_min_messages to notice;
\t on

create or replace function ok(label text, cond boolean) returns void
language plpgsql as $$
begin
  if cond then raise notice 'PASS  %', label;
  else raise exception 'FAIL  %', label; end if;
end $$;

create or replace function fresh_confirmed_trip() returns uuid
language plpgsql as $$
declare t uuid := gen_random_uuid(); a uuid := gen_random_uuid(); h uuid; p uuid;
begin
  delete from trips; delete from participants; delete from accommodations;
  delete from accommodation_votes; delete from date_responses; delete from preference_responses;
  delete from trip_reopenings;
  insert into participants (trip_id, user_id, nickname, role)
    values (t, '11111111-1111-1111-1111-111111111111', '주최자', 'host') returning id into h;
  insert into participants (trip_id, user_id, nickname, role)
    values (t, '22222222-2222-2222-2222-222222222222', '참여자', 'participant') returning id into p;
  insert into accommodations (id, trip_id) values (a, t);
  insert into accommodation_votes (trip_id, accommodation_id, participant_id) values (t, a, h), (t, a, p);
  insert into date_responses (trip_id) values (t), (t);
  insert into preference_responses (trip_id) values (t), (t);
  insert into trips (id, title, confirmed_start_date, confirmed_end_date,
                     confirmed_participant_count, final_accommodation_id, status, confirmed_at)
    values (t, '제주', '2026-10-17', '2026-10-19', 2, a, 'confirmed', now());
  return t;
end $$;

do $$
declare t uuid; r record; n int;
begin
  -- ── 옵션 A: 숙소 투표만 ──────────────────────────────────────
  t := fresh_confirmed_trip();
  perform set_current_user('11111111-1111-1111-1111-111111111111');
  perform reopen_after_confirm(t, 'stay_vote', '확정한 숙소 예약이 어려워졌어요.');
  select * into r from trips where id = t;
  perform ok('A: 상태가 숙소 투표로', r.status = 'accommodation_voting');
  perform ok('A: 확정 날짜 유지', r.confirmed_start_date = '2026-10-17' and r.confirmed_end_date = '2026-10-19');
  perform ok('A: 확정 인원 유지', r.confirmed_participant_count = 2);
  perform ok('A: 숙소 확정만 해제', r.final_accommodation_id is null);
  perform ok('A: 재개 범위 기록', r.reopened_scope = 'stay_vote');
  perform ok('A: 사유 기록', r.reopened_reason = '확정한 숙소 예약이 어려워졌어요.');
  perform ok('A: 재개자 기록', r.reopened_by_participant_id is not null);
  select count(*) into n from accommodation_votes where trip_id = t;
  perform ok('A: 기존 투표 유지', n = 2);
  select count(*) into n from accommodations where trip_id = t;
  perform ok('A: 숙소 후보 유지', n = 1);
  select count(*) into n from trip_reopenings where trip_id = t;
  perform ok('A: 이력 1건', n = 1);

  -- 같은 요청이 한 번 더 와도 꼬이지 않는다
  perform reopen_after_confirm(t, 'stay_vote', '두 번째');
  select count(*) into n from trip_reopenings where trip_id = t;
  perform ok('A: 중복 호출은 무시 (이력 그대로)', n = 1);
  select * into r from trips where id = t;
  perform ok('A: 중복 호출 후에도 상태 동일', r.status = 'accommodation_voting');

  -- ── 옵션 B: 날짜·취향부터 ────────────────────────────────────
  t := fresh_confirmed_trip();
  perform set_current_user('11111111-1111-1111-1111-111111111111');
  perform reopen_after_confirm(t, 'group_direction', null);
  select * into r from trips where id = t;
  perform ok('B: 상태가 날짜·취향 수집으로', r.status = 'collecting_responses');
  perform ok('B: 날짜 확정 해제', r.confirmed_start_date is null and r.confirmed_end_date is null);
  perform ok('B: 확정 인원 해제', r.confirmed_participant_count is null);
  perform ok('B: 숙소 확정 해제', r.final_accommodation_id is null);
  perform ok('B: 사유 없이도 가능', r.reopened_reason is null);
  select count(*) into n from date_responses where trip_id = t;
  perform ok('B: 날짜 응답 유지', n = 2);
  select count(*) into n from preference_responses where trip_id = t;
  perform ok('B: 취향 응답 유지', n = 2);
  select count(*) into n from accommodations where trip_id = t;
  perform ok('B: 숙소 후보 유지', n = 1);
  select count(*) into n from accommodation_votes where trip_id = t;
  perform ok('B: 기존 투표 유지', n = 2);

  -- ── 권한 ─────────────────────────────────────────────────────
  t := fresh_confirmed_trip();
  perform set_current_user('22222222-2222-2222-2222-222222222222');
  begin
    perform reopen_after_confirm(t, 'stay_vote', null);
    perform ok('권한: 참여자는 재개 불가', false);
  exception when sqlstate 'P0001' then
    perform ok('권한: 참여자는 재개 불가', sqlerrm = 'NOT_HOST');
  end;

  perform set_current_user('99999999-9999-9999-9999-999999999999');
  begin
    perform reopen_after_confirm(t, 'stay_vote', null);
    perform ok('권한: 무관한 사용자는 재개 불가', false);
  exception when sqlstate 'P0001' then
    perform ok('권한: 무관한 사용자는 재개 불가', sqlerrm = 'NOT_HOST');
  end;

  -- 다른 여행의 주최자
  insert into participants (trip_id, user_id, nickname, role)
    values (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', '남의 주최자', 'host');
  perform set_current_user('33333333-3333-3333-3333-333333333333');
  begin
    perform reopen_after_confirm(t, 'stay_vote', null);
    perform ok('권한: 다른 여행 주최자는 재개 불가', false);
  exception when sqlstate 'P0001' then
    perform ok('권한: 다른 여행 주최자는 재개 불가', sqlerrm = 'NOT_HOST');
  end;

  select * into r from trips where id = t;
  perform ok('권한: 거부된 뒤에도 확정 상태 그대로', r.status = 'confirmed' and r.final_accommodation_id is not null);

  -- 익명 주최자(= 익명 세션의 uid 를 가진 주최자)도 자기 여행은 연다
  perform set_current_user('11111111-1111-1111-1111-111111111111');
  perform reopen_after_confirm(t, 'stay_vote', null);
  select * into r from trips where id = t;
  perform ok('권한: 익명 주최자는 자기 여행 재개 가능', r.status = 'accommodation_voting');

  -- ── 잘못된 상태 ──────────────────────────────────────────────
  t := fresh_confirmed_trip();
  update trips set status = 'accommodation_collecting' where id = t;
  perform set_current_user('11111111-1111-1111-1111-111111111111');
  begin
    perform reopen_after_confirm(t, 'stay_vote', null);
    perform ok('상태: 확정 전 여행은 재개 불가', false);
  exception when sqlstate 'P0001' then
    perform ok('상태: 확정 전 여행은 재개 불가', sqlerrm = 'INVALID_STATE');
  end;

  -- ── 다시 확정하면 재개 표시가 사라진다 ───────────────────────
  t := fresh_confirmed_trip();
  perform set_current_user('11111111-1111-1111-1111-111111111111');
  perform reopen_after_confirm(t, 'stay_vote', '인원이 바뀌었어요.');
  update trips set status = 'vote_result' where id = t;
  perform confirm_final_accommodation(t, (select id from accommodations where trip_id = t limit 1));
  select * into r from trips where id = t;
  perform ok('재확정: 상태 confirmed', r.status = 'confirmed');
  perform ok('재확정: 재개 표시 해제', r.reopened_scope is null and r.reopened_at is null
             and r.reopened_reason is null and r.reopened_by_participant_id is null);
  select count(*) into n from trip_reopenings where trip_id = t;
  perform ok('재확정: 이력은 남는다', n = 1);

  raise notice '--- 모든 케이스 통과 ---';
end $$;
