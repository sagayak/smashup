
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  query, 
  where,
  increment,
  arrayUnion,
  arrayRemove,
  limit,
  deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { db, auth } from './firebase.ts';
import { User, Tournament, Match, UserRole, TournamentType, MatchFormat, MatchStatus, Team, CreditRequest } from '../types.ts';

const SHADOW_DOMAIN = "@smashpro.local";

class DataService {
  // --- AUTH & USER ---
  async login(username: string, password: string): Promise<User | null> {
    try {
      const email = username.toLowerCase().trim() + SHADOW_DOMAIN;
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
      return userDoc.exists() ? (userDoc.data() as User) : null;
    } catch (error) {
      console.error("Login Error:", error);
      throw error;
    }
  }

  // Fixed: userData now correctly includes password from the updated User interface
  async signup(userData: Omit<User, 'id' | 'credits'>): Promise<User | null> {
    try {
      const email = userData.username.toLowerCase().trim() + SHADOW_DOMAIN;
      const userCredential = await createUserWithEmailAndPassword(auth, email, userData.password || "");
      const uid = userCredential.user.uid;

      const usersSnap = await getDocs(query(collection(db, "users"), limit(1)));
      const isFirstUser = usersSnap.empty;

      const newUser: User = {
        name: userData.name,
        username: userData.username.toLowerCase().trim(),
        email: email,
        id: uid,
        credits: isFirstUser ? 1000 : 0,
        role: isFirstUser ? UserRole.SUPERADMIN : userData.role
      };
      
      await setDoc(doc(db, "users", uid), newUser);
      return newUser;
    } catch (error) { throw error; }
  }

  async logout() { await signOut(auth); }

  async getAllUsers(): Promise<User[]> {
    const snapshot = await getDocs(collection(db, "users"));
    return snapshot.docs.map(doc => doc.data() as User);
  }

  // Added: requestReset method used in App.tsx
  async requestReset(username: string): Promise<boolean> {
    const q = query(collection(db, "users"), where("username", "==", username.toLowerCase().trim()));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return false;
    const userDoc = snapshot.docs[0];
    await updateDoc(doc(db, "users", userDoc.id), { resetRequested: true });
    return true;
  }

  // --- CREDITS & REQUESTS ---
  async requestCredits(userId: string, username: string, amount: number) {
    await addDoc(collection(db, "creditRequests"), {
      userId, username, amount, status: 'PENDING', timestamp: new Date().toISOString()
    });
  }

  async getCreditRequests(): Promise<CreditRequest[]> {
    const q = query(collection(db, "creditRequests"), where("status", "==", "PENDING"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as CreditRequest));
  }

  async resolveCreditRequest(requestId: string, approved: boolean) {
    const reqDoc = await getDoc(doc(db, "creditRequests", requestId));
    if (!reqDoc.exists()) return;
    const reqData = reqDoc.data();

    if (approved) {
      await this.adjustCredits(reqData.userId, reqData.amount, "Approved Credit Request");
    }
    await updateDoc(doc(db, "creditRequests", requestId), { status: approved ? 'APPROVED' : 'REJECTED' });
  }

  async adjustCredits(userId: string, amount: number, reason: string) {
    await updateDoc(doc(db, "users", userId), { credits: increment(amount) });
    await addDoc(collection(db, "creditLogs"), {
      userId, amount, reason, timestamp: new Date().toISOString()
    });
  }

  // --- TOURNAMENTS ---
  async generateUniqueId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  async addTournament(t: Omit<Tournament, 'id' | 'uniqueId'>): Promise<string> {
    const userDoc = await getDoc(doc(db, "users", t.organizerId));
    const userData = userDoc.data() as User;
    
    if (userData.credits < 200) throw new Error("Insufficient credits. Cost: 200");

    const uniqueId = await this.generateUniqueId();
    const newT = { ...t, uniqueId, isLocked: false, scorerPin: '0000' };
    
    const docRef = await addDoc(collection(db, "tournaments"), newT);
    await this.adjustCredits(t.organizerId, -200, `Created Tournament: ${t.name}`);
    return docRef.id;
  }

  async getTournaments(): Promise<Tournament[]> {
    const snapshot = await getDocs(collection(db, "tournaments"));
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Tournament));
  }

  async searchTournamentById(uniqueId: string): Promise<Tournament | null> {
    const q = query(collection(db, "tournaments"), where("uniqueId", "==", uniqueId.toUpperCase()));
    const snapshot = await getDocs(q);
    return snapshot.empty ? null : ({ ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as Tournament);
  }

  async lockTournament(tournamentId: string) {
    await updateDoc(doc(db, "tournaments", tournamentId), { isLocked: true, status: 'ONGOING' });
  }

  // --- TEAMS ---
  async addTeam(team: Omit<Team, 'id'>) {
    await addDoc(collection(db, "teams"), team);
  }

  async deleteTeam(teamId: string) {
    await deleteDoc(doc(db, "teams", teamId));
  }

  async getTeams(tournamentId: string): Promise<Team[]> {
    const q = query(collection(db, "teams"), where("tournamentId", "==", tournamentId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Team));
  }

  // --- MATCHES ---
  async createMatch(match: Omit<Match, 'id'>) {
    await addDoc(collection(db, "matches"), match);
  }

  async updateMatchScore(matchId: string, scores: number[][], participants: string[]) {
    let p1Sets = 0; let p2Sets = 0;
    scores.forEach(set => { if (set[0] > set[1]) p1Sets++; else if (set[1] > set[0]) p2Sets++; });
    const winnerId = p1Sets > p2Sets ? participants[0] : participants[1];
    
    await updateDoc(doc(db, "matches", matchId), { scores, winnerId, status: MatchStatus.COMPLETED });
  }

  async getMatchesByTournament(tournamentId: string): Promise<Match[]> {
    const q = query(collection(db, "matches"), where("tournamentId", "==", tournamentId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Match));
  }

  // Added: getMatchesForUser method used in Dashboard.tsx
  async getMatchesForUser(userId: string): Promise<Match[]> {
    const teamsQuery = query(collection(db, "teams"), where("playerIds", "array-contains", userId));
    const teamsSnap = await getDocs(teamsQuery);
    const teamIds = teamsSnap.docs.map(doc => doc.id);
    
    if (teamIds.length === 0) return [];

    const snapshot = await getDocs(collection(db, "matches"));
    const allMatches = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Match));
    
    return allMatches.filter(m => m.participants.some(pId => teamIds.includes(pId)));
  }

  async calculateStandings(tournamentId: string) {
    const matches = await this.getMatchesByTournament(tournamentId);
    const teams = await this.getTeams(tournamentId);
    const completedMatches = matches.filter(m => m.status === MatchStatus.COMPLETED);
    
    const standingsMap = new Map();
    teams.forEach(team => {
      standingsMap.set(team.id, { id: team.id, name: team.name, played: 0, won: 0, lost: 0, points: 0 });
    });

    completedMatches.forEach(m => {
      const s1 = standingsMap.get(m.participants[0]);
      const s2 = standingsMap.get(m.participants[1]);
      if (s1 && s2) {
        s1.played++; s2.played++;
        if (m.winnerId === m.participants[0]) { s1.won++; s1.points += 2; s2.lost++; }
        else { s2.won++; s2.points += 2; s1.lost++; }
      }
    });

    return Array.from(standingsMap.values()).sort((a: any, b: any) => b.points - a.points);
  }
}

export const store = new DataService();