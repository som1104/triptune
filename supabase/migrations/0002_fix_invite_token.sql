-- Fix: create_trip() used gen_random_bytes() (needs the pgcrypto extension,
-- which lives outside this function's search_path on Supabase) to build the
-- invite token. Switched to gen_random_uuid(), which is built into Postgres
-- core and needs no extension.
create or replace function create_trip(
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
    v_token := replace(gen_random_uuid()::text, '-', '');
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
