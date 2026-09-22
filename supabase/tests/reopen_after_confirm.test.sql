-- 재개 RPC 의 상태 전환과 권한을 실제 Postgres 에서 확인한다.
-- 실행: supabase/tests/run.sh
--
-- Supabase 전용 조각(auth.uid, RLS 역할)은 최소한으로 흉내 낸다. 검증 대상은
-- 함수 본문의 판단(주최자인가 / 상태가 맞는가 / 무엇을 풀고 무엇을 남기는가)이다.

\set ON_ERROR_STOP on
set client_min_messages to warning;

create schema if not exists auth;
create table if not exists auth.current (uid uuid);
create or replace function auth.uid() returns uuid
  language sql stable as $$ select uid from auth.current limit 1 $$;
create or replace function set_current_user(p uuid) returns void
  language sql as $$ delete from auth.current; insert into auth.current values (p); $$;

create type trip_status as enum (
  'collecting_responses','accommodation_collecting','accommodation_voting','vote_result','confirmed');
create type participant_role as enum ('host','participant');

create table participants (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  user_id uuid not null,
  nickname text not null,
  role participant_role not null
);

create table trips (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  confirmed_start_date date,
  confirmed_end_date date,
  confirmed_participant_count int,
  final_accommodation_id uuid,
  status trip_status not null,
  confirmed_at timestamptz
);

create table accommodations (id uuid primary key default gen_random_uuid(), trip_id uuid not null);
create table accommodation_votes (
  id uuid primary key default gen_random_uuid(), trip_id uuid not null,
  accommodation_id uuid not null, participant_id uuid not null);
create table date_responses (id uuid primary key default gen_random_uuid(), trip_id uuid not null);
create table preference_responses (id uuid primary key default gen_random_uuid(), trip_id uuid not null);

create function is_trip_host(p_trip_id uuid) returns boolean
language sql stable as $$
  select exists (select 1 from participants
    where trip_id = p_trip_id and user_id = auth.uid() and role = 'host');
$$;
create function is_trip_participant(p_trip_id uuid) returns boolean
language sql stable as $$
  select exists (select 1 from participants where trip_id = p_trip_id and user_id = auth.uid());
$$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
end $$;
