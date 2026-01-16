
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
  limit,
  deleteDoc,
  orderBy
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { db, auth } from './firebase.ts';
import { User, Tournament, Match, UserRole, TournamentType, MatchFormat, MatchStatus, Team, CreditRequest, TournamentPlayer, MatchScore } from '../types.ts';

const SHADOW_DOMAIN = "@smashpro.local";

class DataService {
  async login(username: string, password: string): Promise<User | null> {
    try {
      const email = username.toLowerCase().trim() + SHADOW_DOMAIN;
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
      return userDoc.exists() ? (userDoc.data() as User) : null;
    } catch (error) { throw error; }
  }

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
        credits: 0, // No initial credits for anyone
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

  async getUserByUsername(username: string): Promise<User | null> {
    const q = query(collection(db, "users"), where("username", "==", username.toLowerCase().trim()));
    const snapshot = await getDocs(q);
    return snapshot.empty ? null : (snapshot.docs[0].data() as User);
  }

  async requestReset(username: string): Promise<boolean> {
    const user = await this.getUserByUsername(username);
    if (!user) return false;
    await updateDoc(doc(db, "users", user.id), { resetRequested: true });
    return true;
  }

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
    if (approved) await this.adjustCredits(reqData.userId, reqData.amount, "Approved Credit Request");
    await updateDoc(doc(db, "creditRequests", requestId), { status: approved ? 'APPROVED' : 'REJECTED' });
  }

  async adjustCredits(userId: string, amount: number, reason: string) {
    await updateDoc(doc(db, "users", userId), { credits: increment(amount) });
  }

  async getTournaments(): Promise<Tournament[]> {
    const snapshot = await getDocs(collection(db, "tournaments"));
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Tournament));
  }

  async addTournament(data: Omit<Tournament, 'id' | 'uniqueId'>): Promise<Tournament> {
    const uniqueId = `T-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const docRef = await addDoc(collection(db, "tournaments"), { ...data, uniqueId, isLocked: false });
    // Deduct credits
    await this.adjustCredits(data.organizerId, -200, "Tournament Creation");
    return { ...data, id: docRef.id, uniqueId, isLocked: false } as Tournament;
  }

  async searchTournamentById(uniqueId: string): Promise<Tournament | null> {
    const q = query(collection(db, "tournaments"), where("uniqueId", "==", uniqueId.toUpperCase()));
    const snapshot = await getDocs(q);
    return snapshot.empty ? null : ({ ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as Tournament);
  }

  async updateTournamentPool(id: string, pool: TournamentPlayer[]) {
    await updateDoc(doc(db, "tournaments", id), { playerPool: pool });
  }

  async lockTournament(id: string) {
    await updateDoc(doc(db, "tournaments", id), { isLocked: true });
  }

  async addTeam(data: Omit<Team, 'id'>): Promise<Team> {
    const docRef = await addDoc(collection(db, "teams"), data);
    return { ...data, id: docRef.id } as Team;
  }

  async getTeams(tournamentId: string): Promise<Team[]> {
    const q = query(collection(db, "teams"), where("tournamentId", "==", tournamentId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Team));
  }

  async deleteTeam(id: string) {
    await deleteDoc(doc(db, "teams", id));
  }

  async createMatch(data: Omit<Match, 'id'>): Promise<Match> {
    const docRef = await addDoc(collection(db, "matches"), data);
    return { ...data, id: docRef.id } as Match;
  }

  async getMatchesByTournament(tournamentId: string): Promise<Match[]> {
    const q = query(collection(db, "matches"), where("tournamentId", "==", tournamentId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Match));
  }

  async getMatchesForUser(userId: string): Promise<Match[]> {
    const q = query(collection(db, "matches"), where("participants", "array-contains", userId), orderBy("startTime", "desc"), limit(10));
    try {
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Match));
    } catch (e) {
      // Fallback if index isn't ready
      const snapshot = await getDocs(collection(db, "matches"));
      return snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as Match))
        .filter(m => m.participants.includes(userId))
        .sort((a,b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
        .slice(0, 10);
    }
  }

  async updateMatchScore(matchId: string, scores: MatchScore[], participants: string[]) {
    // Determine winner based on sets won
    let p1Sets = 0;
    let p2Sets = 0;
    scores.forEach(s => {
      if (s.s1 > s.s2) p1Sets++;
      else if (s.s2 > s.s1) p2Sets++;
    });

    const isComplete = p1Sets > scores.length / 2 || p2Sets > scores.length / 2;
    const updateData: any = { scores };
    
    if (isComplete) {
      updateData.status = MatchStatus.COMPLETED;
      updateData.winnerId = p1Sets > p2Sets ? participants[0] : participants[1];
    } else {
      updateData.status = MatchStatus.LIVE;
    }

    await updateDoc(doc(db, "matches", matchId), updateData);
  }

  async calculateStandings(tournamentId: string): Promise<any[]> {
    const teams = await this.getTeams(tournamentId);
    const matches = await this.getMatchesByTournament(tournamentId);
    
    const standings = teams.map(t => ({
      id: t.id,
      name: t.name,
      played: 0,
      won: 0,
      lost: 0,
      points: 0
    }));

    matches.filter(m => m.status === MatchStatus.COMPLETED).forEach(m => {
      const t1 = standings.find(s => s.id === m.participants[0]);
      const t2 = standings.find(s => s.id === m.participants[1]);
      if (t1 && t2) {
        t1.played++;
        t2.played++;
        if (m.winnerId === t1.id) {
          t1.won++;
          t1.points += 2;
          t2.lost++;
        } else {
          t2.won++;
          t2.points += 2;
          t1.lost++;
        }
      }
    });

    return standings.sort((a, b) => b.points - a.points || b.won - a.won);
  }
}

export const store = new DataService();
