-- 숙소 후보를 '객실 하나'가 아니라 하나의 숙박 예약안으로 다룬다.
--   whole : 펜션·독채처럼 숙소를 통째로 빌리는 경우
--   rooms : 호텔처럼 객실 여러 개를 잡는 경우 (구성은 rooms jsonb 에)
-- capacity / total_price 는 그대로 '합계' 컬럼으로 남긴다. 투표·결과·확정
-- 화면과 기존 후보가 계산식을 몰라도 되고, 투표 시작 뒤 잠기는 값도 그대로다.

create type stay_booking_mode as enum ('whole', 'rooms');

alter table accommodations
  add column booking_mode stay_booking_mode not null default 'whole';

-- [{"name":"디럭스 트윈","count":2,"capacityPerRoom":2,"pricePerRoom":240000}, ...]
-- whole 이면 null. rooms 면 최소 한 종류는 있어야 한다.
alter table accommodations add column rooms jsonb;

alter table accommodations add constraint accommodations_rooms_shape check (
  case
    when booking_mode = 'whole' then rooms is null
    else jsonb_typeof(rooms) = 'array'
     and jsonb_array_length(rooms) >= 1
     and not exists (
       select 1
       from jsonb_array_elements(rooms) r
       where jsonb_typeof(r) <> 'object'
          or coalesce(btrim(r->>'name'), '') = ''
          or coalesce((r->>'count')::int, 0) < 1
          or coalesce((r->>'capacityPerRoom')::int, 0) < 1
          or coalesce((r->>'pricePerRoom')::int, 0) < 1
     )
  end
);
