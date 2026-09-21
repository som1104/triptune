-- 투표가 끝난 뒤 주최자가 한 단계 되돌릴 수 있게 한다. 아무도 투표하지 않은
-- 채 결과 화면에 도착하면 확정 버튼이 잠겨 있어 빠져나갈 길이 없었다.
--   reopen_voting        : 표를 그대로 두고 다시 투표 중으로
--   reopen_stay_candidates : 표를 지우고 후보 등록 단계로
-- 둘 다 확정(confirmed) 이후에는 동작하지 않는다 — 되돌리기는 확정 전까지만.

create or replace function reopen_voting(p_trip_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_trip_host(p_trip_id) then
    raise exception 'NOT_HOST' using errcode = 'P0001';
  end if;

  if not exists (select 1 from trips where id = p_trip_id and status = 'vote_result') then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  update trips set status = 'accommodation_voting' where id = p_trip_id;
end;
$$;

grant execute on function reopen_voting(uuid) to authenticated;

create or replace function reopen_stay_candidates(p_trip_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_trip_host(p_trip_id) then
    raise exception 'NOT_HOST' using errcode = 'P0001';
  end if;

  -- 투표 중이거나 결과가 나온 상태에서만. 이미 확정된 여행은 손대지 않는다.
  if not exists (
    select 1 from trips
    where id = p_trip_id
      and status in ('accommodation_voting', 'vote_result')
  ) then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  -- 후보를 고칠 수 있게 되므로 이전 표는 뜻을 잃는다. 남겨두면 바뀐 후보에
  -- 옛 표가 붙어버린다.
  delete from accommodation_votes where trip_id = p_trip_id;

  update trips set
    final_accommodation_id = null,
    status = 'accommodation_collecting'
  where id = p_trip_id;
end;
$$;

grant execute on function reopen_stay_candidates(uuid) to authenticated;
