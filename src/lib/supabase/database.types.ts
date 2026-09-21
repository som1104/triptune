export type TripStatus =
  | "collecting_responses"
  | "accommodation_collecting"
  | "accommodation_voting"
  | "vote_result"
  | "confirmed";

export type ParticipantRole = "host" | "participant";

export type ResponseStatus = "not_started" | "in_progress" | "submitted";

export type DateAvailability = "available" | "tentative" | "unavailable";

export type TravelPace = "relaxed" | "balanced" | "packed";

export type SpendingStyle = "value" | "balanced" | "experience";

export type Togetherness = "mostly_together" | "core_together" | "free_time";

/** 숙소를 통째로 빌리는지, 객실을 여러 개 잡는지 */
export type StayBookingMode = "whole" | "rooms";

// NOTE: these row shapes must be `type` aliases, not `interface`s.
// Interfaces don't get TypeScript's implicit index-signature compatibility,
// so they silently fail the `extends Record<string, unknown>` check that
// supabase-js's generics rely on — every `.from()`/`.rpc()` call type then
// falls back to `never` with no visible error at the type's declaration site.

export type Trip = {
  id: string;
  host_user_id: string;
  title: string;
  destination: string;
  candidate_start_date: string;
  candidate_end_date: string;
  trip_days: number;
  expected_participant_count: number;
  confirmed_start_date: string | null;
  confirmed_end_date: string | null;
  confirmed_participant_count: number | null;
  final_accommodation_id: string | null;
  invite_token: string;
  status: TripStatus;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
};

export type Participant = {
  id: string;
  trip_id: string;
  user_id: string;
  nickname: string;
  role: ParticipantRole;
  response_status: ResponseStatus;
  joined_at: string;
};

export type DateResponse = {
  id: string;
  trip_id: string;
  participant_id: string;
  date: string;
  availability: DateAvailability;
  updated_at: string;
};

export type PreferenceResponse = {
  id: string;
  trip_id: string;
  participant_id: string;
  nature: number;
  food: number;
  cafe: number;
  activity: number;
  pace: TravelPace;
  spending_style: SpendingStyle;
  /** null on responses saved before 함께 다니는 정도 existed */
  togetherness: Togetherness | null;
  /** 꼭 반영할 점 — free text, never fed into any score */
  note: string | null;
  submitted_at: string;
  updated_at: string;
};

export type ConsensusSnapshot = {
  id: string;
  trip_id: string;
  selected_start_date: string;
  selected_end_date: string;
  preference_summary: Record<string, unknown>;
  conflict_summary: Record<string, unknown>;
  participant_count: number;
  created_at: string;
};

export type Accommodation = {
  id: string;
  trip_id: string;
  created_by_participant_id: string;
  url: string;
  name: string;
  image_url: string | null;
  location: string;
  booking_mode: StayBookingMode;
  /** rooms 모드일 때의 객실 구성. whole 이면 null. @see lib/trip/stay */
  rooms: unknown;
  /** 두 모드 모두 '합계' — 객실 구성에서 계산해 저장한다 */
  total_price: number;
  capacity: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type AccommodationVote = {
  id: string;
  trip_id: string;
  accommodation_id: string;
  participant_id: string;
  created_at: string;
  updated_at: string;
};

export type TripInviteInfo = {
  trip_id: string;
  title: string;
  destination: string;
  candidate_start_date: string;
  candidate_end_date: string;
  trip_days: number;
  expected_participant_count: number;
  status: TripStatus;
  host_nickname: string;
  current_participant_count: number;
  already_joined: boolean;
};

export type VotingProgress = {
  expected: number | null;
  voted: number;
  my_vote_accommodation_id: string | null;
};

type TableDef<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      trips: TableDef<Trip>;
      participants: TableDef<Participant>;
      date_responses: TableDef<DateResponse>;
      preference_responses: TableDef<PreferenceResponse>;
      consensus_snapshots: TableDef<ConsensusSnapshot>;
      accommodations: TableDef<Accommodation>;
      accommodation_votes: TableDef<AccommodationVote>;
    };
    Views: Record<string, never>;
    Functions: {
      get_trip_invite_info: {
        Args: { p_invite_token: string };
        Returns: TripInviteInfo[];
      };
      create_trip: {
        Args: {
          p_title: string;
          p_destination: string;
          p_candidate_start_date: string;
          p_candidate_end_date: string;
          p_trip_days: number;
          p_expected_participant_count: number;
          p_host_nickname: string;
        };
        Returns: Trip;
      };
      join_trip: {
        Args: { p_invite_token: string; p_nickname: string };
        Returns: Participant;
      };
      save_my_response: {
        Args: {
          p_trip_id: string;
          p_dates: { date: string; availability: DateAvailability }[];
          p_nature: number;
          p_food: number;
          p_cafe: number;
          p_activity: number;
          p_pace: TravelPace;
          p_spending_style: SpendingStyle;
          p_togetherness: Togetherness;
          p_note: string | null;
        };
        Returns: void;
      };
      mark_response_in_progress: {
        Args: { p_trip_id: string };
        Returns: void;
      };
      confirm_group_direction: {
        Args: {
          p_trip_id: string;
          p_selected_start_date: string;
          p_selected_end_date: string;
          p_preference_summary: Record<string, unknown>;
          p_conflict_summary: Record<string, unknown>;
          p_participant_count: number;
        };
        Returns: void;
      };
      reopen_group_direction: {
        Args: { p_trip_id: string };
        Returns: void;
      };
      start_voting: {
        Args: { p_trip_id: string };
        Returns: void;
      };
      cast_vote: {
        Args: { p_trip_id: string; p_accommodation_id: string };
        Returns: void;
      };
      end_voting_early: {
        Args: { p_trip_id: string };
        Returns: void;
      };
      get_voting_progress: {
        Args: { p_trip_id: string };
        Returns: VotingProgress[];
      };
      get_voting_completion: {
        Args: { p_trip_id: string };
        Returns: { participant_id: string; nickname: string }[];
      };
      confirm_final_accommodation: {
        Args: { p_trip_id: string; p_accommodation_id: string };
        Returns: void;
      };
      delete_trip: {
        Args: { p_trip_id: string };
        Returns: void;
      };
      reopen_voting: {
        Args: { p_trip_id: string };
        Returns: void;
      };
      reopen_stay_candidates: {
        Args: { p_trip_id: string };
        Returns: void;
      };
      leave_trip: {
        Args: { p_trip_id: string };
        Returns: void;
      };
    };
    Enums: {
      trip_status: TripStatus;
      participant_role: ParticipantRole;
      response_status: ResponseStatus;
      date_availability: DateAvailability;
      travel_pace: TravelPace;
      spending_style: SpendingStyle;
      togetherness: Togetherness;
      stay_booking_mode: StayBookingMode;
    };
  };
};
