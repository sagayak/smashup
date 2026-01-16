
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
  resetRequested?: boolean;
  // Added for auth/signup flow handling in Omit types
  password?: string;
}

export interface Team {
  id: string;
  tournamentId: string;
  name: string;
  playerIds: string[]; // 1 to 20 players per team
}

export interface Tournament {
  id: string;
  uniqueId: string; // Short code for searching
  name: string;
  venue: string;
  startDate: string;
  endDate: string;
  type: TournamentType;
  format: MatchFormat;
  numCourts: number;
  organizerId: string;
  status: 'UPCOMING' | 'ONGOING' | 'FINISHED';
  participants: string[]; // Team IDs
  isLocked: boolean;
  isPublic: boolean;
  playerLimit: number;
  scorerPin: string; // Default "0000"
  pointsOption: number; // 11, 15, 21, 25, 30
  bestOf: number; // 1, 3, 5
  rankingCriteria: string[]; // e.g. ["points", "setsDiff", "pointsDiff"]
}

export interface Match {
  id: string;
  tournamentId: string;
  participants: string[]; // Team IDs
  scores: number[][]; 
  winnerId?: string;
  court: number;
  startTime: string;
  status: MatchStatus;
  umpireName?: string;
}

export interface CreditRequest {
  id: string;
  userId: string;
  username: string;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  timestamp: string;
}

export interface CreditLog {
  id: string;
  userId: string;
  amount: number;
  reason: string;
  timestamp: string;
}