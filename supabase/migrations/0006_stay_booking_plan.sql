-- 숙소 후보를 '객실 하나'가 아니라 하나의 숙박 예약안으로 다룬다.
--   whole : 펜션·독채처럼 숙소를 통째로 빌리는 경우
--   rooms : 호텔처럼 객실 여러 개를 잡는 경우 (구성은 rooms jsonb 에)
-- capacity / total_price 는 그대로 '합계' 컬럼으로 남긴다. 투표·결과·확정
-- 화면과 기존 후보가 계산식을 몰라도 되고, 투표 시작 뒤 잠기는 값도 그대로다.
--
-- 앞선 시도가 중간에 실패했어도 그대로 다시 실행할 수 있게 짰다.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'stay_booking_mode') then
    create type stay_booking_mode as enum ('whole', 'rooms');
  end if;
end
$$;

alter table accommodations
  add column if not exists booking_mode stay_booking_mode not null default 'whole';

-- [{"name":"디럭스 트윈","count":2,"capacityPerRoom":2,"pricePerRoom":240000}, ...]
-- whole 이면 null. rooms 면 최소 한 종류는 있어야 한다.
alter table accommodations add column if not exists rooms jsonb;

/* check 제약 안에는 서브쿼리를 쓸 수 없어서(0A000) 검사를 함수로 뺀다.
   jsonb 는 무엇이든 들어올 수 있으므로 형 변환 전에 타입부터 확인하고,
   or 대신 case 를 써서 검사 순서를 보장한다 — 숫자가 아닌 값에 ::numeric 을
   걸면 false 가 아니라 오류가 난다. */
create or replace function accommodation_rooms_valid(
  p_mode stay_booking_mode,
  p_rooms jsonb
) returns boolean
language sql immutable as $$
  -- coalesce: rooms 가 null 이면 비교식이 통째로 null 이 되고, check 는 null 을
  -- 통과시킨다. 판단할 수 없으면 거절하도록 false 로 떨어뜨린다.
  select coalesce(case
    when p_mode = 'whole' then p_rooms is null
    else
      jsonb_typeof(p_rooms) = 'array'
      and jsonb_array_length(p_rooms) >= 1
      and not exists (
        select 1
        from jsonb_array_elements(p_rooms) r
        where case
          when jsonb_typeof(r) <> 'object' then true
          when coalesce(btrim(r->>'name'), '') = '' then true
          -- 키가 아예 없으면 jsonb_typeof 가 null 이라 비교가 null 이 되고
          -- when 이 성립하지 않는다. 없으면 'missing' 으로 바꿔 잡아낸다.
          when coalesce(jsonb_typeof(r->'count'), 'missing') <> 'number' then true
          when coalesce(jsonb_typeof(r->'capacityPerRoom'), 'missing') <> 'number' then true
          when coalesce(jsonb_typeof(r->'pricePerRoom'), 'missing') <> 'number' then true
          when (r->'count')::numeric < 1 then true
          when (r->'capacityPerRoom')::numeric < 1 then true
          when (r->'pricePerRoom')::numeric < 1 then true
          else false
        end
      )
  end, false);
$$;

alter table accommodations drop constraint if exists accommodations_rooms_shape;
alter table accommodations add constraint accommodations_rooms_shape
  check (accommodation_rooms_valid(booking_mode, rooms));
