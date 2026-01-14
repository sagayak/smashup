
export type UserRole = 'superadmin' | 'admin' | 'player' | 'scorer';

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  email?: string;
  role: UserRole;
  credits: number;
  created_at: string;
}

export interface Tournament {
  id: string;
  share_id: string;
  name: string;
  description: string;
  organizer_id: string;
  status: 'draft' | 'published' | 'finished' | 'cancelled';
  cost_to_host: number;
  is_locked: boolean;
  location_name?: string;
  latitude?: number;
  longitude?: number;
  start_date?: string;
  rules_handbook?: string;
  created_at: string;
}

export interface Team {
  id: string;
  tournament_id: string;
  name: string;
  points: number;
  wins: number;
  losses: number;
  member_count?: number;
}

export interface TournamentParticipant {
  id: string;
  tournament_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  full_name?: string;
  username?: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  full_name?: string;
  username?: string;
}

export interface Match {
  id: string;
  tournament_id: string;
  team1_id: string;
  team2_id: string;
  score1: number;
  score2: number;
  status: 'pending' | 'live' | 'completed';
  scorer_pin?: string;
  scheduled_at: string;
  completed_at?: string;
  team1_name?: string;
  team2_name?: string;
}

export interface CreditLog {
  id: string;
  user_id: string;
  amount: number;
  action_type: string;
  description: string;
  created_at: string;
}
