-- 내 여행 목록에서 여행 지우기.
--   delete_trip : 주최자만. 여행과 딸린 기록 전부.
--   leave_trip  : 참여자만. 본인 흔적만 지우고 여행에서 빠짐.
-- participants·responses·accommodations 는 trips(id) 에 on delete cascade 가
-- 걸려 있어 trips 한 줄만 지우면 따라 지워진다. 다만 trips.final_accommodation_id
-- 가 accommodations 를 가리키므로 그 연결만 먼저 끊어준다.

create function delete_trip(p_trip_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from participants
    where trip_id = p_trip_id
      and user_id = auth.uid()
      and role = 'host'
  ) then
    raise exception '주최자만 여행을 삭제할 수 있어요.';
  end if;

  update trips set final_accommodation_id = null where id = p_trip_id;
  delete from trips where id = p_trip_id;
end;
$$;

grant execute on function delete_trip(uuid) to authenticated;

-- accommodations.created_by_participant_id 에는 cascade 가 없다. 나가는 사람이
-- 올린 숙소를 먼저 치워야 participants 행이 지워진다 (그 숙소에 달린 표는
-- accommodation_votes 쪽 cascade 가 함께 가져간다).
create function leave_trip(p_trip_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me participants%rowtype;
begin
  select * into v_me
  from participants
  where trip_id = p_trip_id and user_id = auth.uid();

  if not found then
    raise exception '참여 중인 여행이 아니에요.';
  end if;

  if v_me.role = 'host' then
    raise exception '주최자는 여행에서 나갈 수 없어요. 여행을 삭제해 주세요.';
  end if;

  update trips
     set final_accommodation_id = null
   where id = p_trip_id
     and final_accommodation_id in (
       select id from accommodations where created_by_participant_id = v_me.id
     );

  delete from accommodations where created_by_participant_id = v_me.id;
  delete from participants where id = v_me.id;
end;
$$;

grant execute on function leave_trip(uuid) to authenticated;
