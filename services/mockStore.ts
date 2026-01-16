
import { User, Tournament, Match, UserRole, TournamentType, MatchFormat, MatchStatus, CreditLog, Team } from '../types';

const INITIAL_USERS: User[] = [
  { id: '1', name: 'Admin Lee', username: 'adminlee', email: 'admin@smashtourney.com', role: UserRole.SUPERADMIN, credits: 1000 },
  { id: '2', name: 'Viktor Axelsen', username: 'viktor', email: 'viktor@badminton.dk', role: UserRole.PLAYER, credits: 500 },
  { id: '3', name: 'Tai Tzu-ying', username: 'taitzu', email: 'tai@badminton.tw', role: UserRole.PLAYER, credits: 450 },
  { id: '4', name: 'Organizer Sam', username: 'sam_org', email: 'sam@events.com', role: UserRole.ORGANIZER, credits: 200 },
];

const INITIAL_TOURNAMENTS: Tournament[] = [
  {
    id: 't1',
    name: 'Summer Smash 2024',
    venue: 'Royal Arena',
    startDate: '2024-07-01',
    endDate: '2024-07-05',
    type: TournamentType.LEAGUE,
    format: MatchFormat.SINGLES,
    numCourts: 4,
    organizerId: '4',
    status: 'ONGOING',
    participants: ['2', '3']
  }
];

class MockStore {
  users: User[] = [...INITIAL_USERS];
  tournaments: Tournament[] = [...INITIAL_TOURNAMENTS];
  matches: Match[] = [
    {
      id: 'm1',
      tournamentId: 't1',
      participants: ['2', '3'],
      scores: [[21, 15], [18, 21], [21, 19]],
      winnerId: '2',
      court: 1,
      startTime: '2024-07-02T10:00:00Z',
      status: MatchStatus.COMPLETED
    }
  ];
  teams: Team[] = [];

  getUser(id: string) { return this.users.find(u => u.id === id); }
  getTournaments() { return this.tournaments; }
  getTournament(id: string) { return this.tournaments.find(t => t.id === id); }
  
  // Fix: Added missing addTournament method to handle new tournament creation
  addTournament(tournament: Tournament) {
    const newT = { ...tournament, id: `t${this.tournaments.length + 1}` };
    this.tournaments.push(newT);
    return newT;
  }

  getMatchesByTournament(tId: string) { 
    return this.matches.filter(m => m.tournamentId === tId); 
  }

  updateMatchScore(matchId: string, scores: number[][]) {
    const match = this.matches.find(m => m.id === matchId);
    if (!match) return;

    let p1Sets = 0;
    let p2Sets = 0;
    scores.forEach(set => {
      if (set[0] > set[1]) p1Sets++;
      else if (set[1] > set[0]) p2Sets++;
    });

    const winnerId = p1Sets > p2Sets ? match.participants[0] : match.participants[1];
    
    this.matches = this.matches.map(m => m.id === matchId ? {
      ...m,
      scores,
      winnerId,
      status: MatchStatus.COMPLETED
    } : m);

    // Award credits to winner
    this.adjustCredits(winnerId, 50, `Win in match ${matchId}`);
  }

  adjustCredits(userId: string, amount: number, reason: string) {
    this.users = this.users.map(u => u.id === userId ? { ...u, credits: u.credits + amount } : u);
  }

  calculateStandings(tournamentId: string) {
    const tournamentMatches = this.matches.filter(m => m.tournamentId === tournamentId && m.status === MatchStatus.COMPLETED);
    const tournament = this.getTournament(tournamentId);
    if (!tournament) return [];

    const standingsMap = new Map();

    tournament.participants.forEach(pId => {
      standingsMap.set(pId, { id: pId, played: 0, won: 0, lost: 0, points: 0, setsWon: 0, setsLost: 0 });
    });

    tournamentMatches.forEach(m => {
      const p1 = m.participants[0];
      const p2 = m.participants[1];
      
      const s1 = standingsMap.get(p1);
      const s2 = standingsMap.get(p2);

      if (s1 && s2) {
        s1.played++;
        s2.played++;

        let p1Sets = 0;
        let p2Sets = 0;
        m.scores.forEach(set => {
          s1.setsWon += set[0];
          s1.setsLost += set[1];
          s2.setsWon += set[1];
          s2.setsLost += set[0];
          if (set[0] > set[1]) p1Sets++; else p2Sets++;
        });

        if (p1Sets > p2Sets) {
          s1.won++;
          s1.points += 2;
          s2.lost++;
        } else {
          s2.won++;
          s2.points += 2;
          s1.lost++;
        }
      }
    });

    return Array.from(standingsMap.values()).sort((a, b) => b.points - a.points || (b.setsWon - b.setsLost) - (a.setsWon - a.setsLost));
  }
}

export const store = new MockStore();
