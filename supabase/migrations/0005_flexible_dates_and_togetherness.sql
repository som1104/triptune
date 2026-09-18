-- 후보 기간을 60일까지 늘리고(월 경계 무관), 여행 스타일에 '함께 다니는 정도'와
-- 자유 입력 한 줄을 더한다. 자유 입력은 어떤 자동 계산에도 쓰지 않는다.

-- ── 후보 기간 최대 60일 ────────────────────────────────────────
alter table trips drop constraint candidate_range_max_31_days;
alter table trips add constraint candidate_range_max_60_days
  check (candidate_end_date - candidate_start_date <= 59);

-- ── 함께 다니는 정도 ───────────────────────────────────────────
create type togetherness as enum ('mostly_together', 'core_together', 'free_time');

-- 기존 응답은 고른 적이 없는 값이므로 null 로 둔다. 그룹 결과에서도
-- null 은 집계하지 않는다 — 임의의 기본값을 채워 넣으면 없던 의견이 생긴다.
alter table preference_responses add column togetherness togetherness;
alter table preference_responses add column note text
  check (note is null or char_length(note) <= 100);

-- ── save_my_response: 두 항목 추가 ─────────────────────────────
drop function save_my_response(uuid, jsonb, smallint, smallint, smallint, smallint, travel_pace, spending_style);

create function save_my_response(
  p_trip_id uuid,
  p_dates jsonb, -- [{"date":"2026-10-17","availability":"available"}, ...]
  p_nature smallint,
  p_food smallint,
  p_cafe smallint,
  p_activity smallint,
  p_pace travel_pace,
  p_spending_style spending_style,
  p_togetherness togetherness,
  p_note text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_participant_id uuid;
  v_status trip_status;
  v_item jsonb;
  v_note text;
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

  -- 빈 문자열은 '안 썼음'과 같게 저장한다.
  v_note := nullif(btrim(coalesce(p_note, '')), '');
  if char_length(coalesce(v_note, '')) > 100 then
    raise exception 'NOTE_TOO_LONG' using errcode = 'P0001';
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
    trip_id, participant_id, nature, food, cafe, activity,
    pace, spending_style, togetherness, note
  ) values (
    p_trip_id, v_participant_id, p_nature, p_food, p_cafe, p_activity,
    p_pace, p_spending_style, p_togetherness, v_note
  )
  on conflict (trip_id, participant_id) do update set
    nature = excluded.nature,
    food = excluded.food,
    cafe = excluded.cafe,
    activity = excluded.activity,
    pace = excluded.pace,
    spending_style = excluded.spending_style,
    togetherness = excluded.togetherness,
    note = excluded.note,
    updated_at = now();

  update participants set response_status = 'submitted'
    where id = v_participant_id;
end;
$$;

grant execute on function save_my_response(
  uuid, jsonb, smallint, smallint, smallint, smallint,
  travel_pace, spending_style, togetherness, text
) to authenticated;
