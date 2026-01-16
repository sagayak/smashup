
export enum UserRole {
  PLAYER = 'PLAYER',
  ORGANIZER = 'ORGANIZER',
  SUPERADMIN = 'SUPERADMIN'
}

export enum TournamentType {
  LEAGUE = 'LEAGUE',
  KNOCKOUT = 'KNOCKOUT'
}

export enum MatchFormat {
  SINGLES = 'SINGLES',
  DOUBLES = 'DOUBLES'
}

export enum MatchStatus {
  SCHEDULED = 'SCHEDULED',
  LIVE = 'LIVE',
  COMPLETED = 'COMPLETED'
}

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  credits: number;
  avatar?: string;
}

export interface Team {
  id: string;
  name: string;
  playerIds: string[];
}

export interface Tournament {
  id: string;
  name: string;
  venue: string;
  startDate: string;
  endDate: string;
  type: TournamentType;
  format: MatchFormat;
  numCourts: number;
  organizerId: string;
  status: 'UPCOMING' | 'ONGOING' | 'FINISHED';
  participants: string[]; // User IDs for singles, Team IDs for doubles
}

export interface Match {
  id: string;
  tournamentId: string;
  participants: string[]; // User IDs or Team IDs
  scores: number[][]; // e.g., [[21, 19], [18, 21], [21, 15]]
  winnerId?: string;
  court: number;
  startTime: string;
  status: MatchStatus;
}

export interface CreditLog {
  id: string;
  userId: string;
  amount: number;
  reason: string;
  timestamp: string;
}
