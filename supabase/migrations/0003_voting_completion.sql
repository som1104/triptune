-- RPC: which participants have voted (completion only — never their choice),
-- for the "who's done" avatar stack on the voting screen.
create function get_voting_completion(p_trip_id uuid)
returns table (participant_id uuid, nickname text)
language sql stable security definer set search_path = public as $$
  select p.id, p.nickname
  from participants p
  where p.trip_id = p_trip_id
    and is_trip_participant(p_trip_id)
    and exists (
      select 1 from accommodation_votes v
      where v.trip_id = p_trip_id and v.participant_id = p.id
    );
$$;

grant execute on function get_voting_completion(uuid) to authenticated;
