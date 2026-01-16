
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
  limit
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { db, auth } from './firebase.ts';
import { User, Tournament, Match, UserRole, TournamentType, MatchFormat, MatchStatus, Team } from '../types';

const SHADOW_DOMAIN = "@smashpro.local";

class DataService {
  // Auth methods
  async login(username: string, password: string): Promise<User | null> {
    try {
      const email = username.toLowerCase() + SHADOW_DOMAIN;
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
      return userDoc.exists() ? (userDoc.data() as User) : null;
    } catch (error) {
      console.error("Login Error:", error);
      throw error;
    }
  }

  async signup(userData: Omit<User, 'id' | 'credits'>): Promise<User | null> {
    try {
      // Check if this is the first user ever
      const usersSnap = await getDocs(query(collection(db, "users"), limit(1)));
      const isFirstUser = usersSnap.empty;

      const email = userData.username.toLowerCase() + SHADOW_DOMAIN;
      const userCredential = await createUserWithEmailAndPassword(auth, email, userData.password || "");
      
      const newUser: User = {
        ...userData,
        id: userCredential.user.uid,
        credits: 0,
        resetRequested: false,
        role: isFirstUser ? UserRole.SUPERADMIN : userData.role // Bootstrap first user as SuperAdmin
      };
      
      // Remove password before saving to Firestore
      const { password, ...firestoreData } = newUser;

      await setDoc(doc(db, "users", newUser.id), firestoreData);
      return newUser;
    } catch (error) {
      console.error("Signup Error:", error);
      throw error;
    }
  }

  async logout() {
    await signOut(auth);
  }

  async requestReset(username: string): Promise<boolean> {
    const q = query(collection(db, "users"), where("username", "==", username.toLowerCase()));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      await updateDoc(doc(db, "users", userDoc.id), { resetRequested: true });
      return true;
    }
    return false;
  }

  // User methods
  async getUser(id: string): Promise<User | null> {
    const userDoc = await getDoc(doc(db, "users", id));
    return userDoc.exists() ? (userDoc.data() as User) : null;
  }

  async getAllUsers(): Promise<User[]> {
    const snapshot = await getDocs(collection(db, "users"));
    return snapshot.docs.map(doc => doc.data() as User);
  }

  // Tournament methods
  async getTournaments(): Promise<Tournament[]> {
    const snapshot = await getDocs(collection(db, "tournaments"));
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Tournament));
  }

  async addTournament(tournament: Omit<Tournament, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, "tournaments"), tournament);
    return docRef.id;
  }

  async joinTournament(tournamentId: string, userId: string): Promise<void> {
    await updateDoc(doc(db, "tournaments", tournamentId), {
      participants: arrayUnion(userId)
    });
    // Deduct entry fee? Let's just award 10 credits for joining for now
    await this.adjustCredits(userId, 10, `Joined tournament ${tournamentId}`);
  }

  // Match methods
  async getMatchesByTournament(tournamentId: string): Promise<Match[]> {
    const q = query(collection(db, "matches"), where("tournamentId", "==", tournamentId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Match));
  }

  async getMatchesForUser(userId: string): Promise<Match[]> {
    const q = query(collection(db, "matches"), where("participants", "array-contains", userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Match));
  }

  async updateMatchScore(matchId: string, scores: number[][], participants: string[]) {
    let p1Sets = 0;
    let p2Sets = 0;
    scores.forEach(set => {
      if (set[0] > set[1]) p1Sets++;
      else if (set[1] > set[0]) p2Sets++;
    });

    const winnerId = p1Sets > p2Sets ? participants[0] : participants[1];
    
    await updateDoc(doc(db, "matches", matchId), {
      scores,
      winnerId,
      status: MatchStatus.COMPLETED
    });

    await this.adjustCredits(winnerId, 50, `Win in match ${matchId}`);
  }

  async adjustCredits(userId: string, amount: number, reason: string) {
    await updateDoc(doc(db, "users", userId), {
      credits: increment(amount)
    });
    await addDoc(collection(db, "creditLogs"), {
      userId,
      amount,
      reason,
      timestamp: new Date().toISOString()
    });
  }

  async calculateStandings(tournamentId: string) {
    const matches = await this.getMatchesByTournament(tournamentId);
    const completedMatches = matches.filter(m => m.status === MatchStatus.COMPLETED);
    
    const tournamentDoc = await getDoc(doc(db, "tournaments", tournamentId));
    if (!tournamentDoc.exists()) return [];
    const tournament = tournamentDoc.data() as Tournament;

    const standingsMap = new Map();
    tournament.participants.forEach(pId => {
      standingsMap.set(pId, { id: pId, played: 0, won: 0, lost: 0, points: 0, setsWon: 0, setsLost: 0 });
    });

    completedMatches.forEach(m => {
      const p1 = m.participants[0];
      const p2 = m.participants[1];
      const s1 = standingsMap.get(p1);
      const s2 = standingsMap.get(p2);

      if (s1 && s2) {
        s1.played++;
        s2.played++;
        let p1S = 0, p2S = 0;
        m.scores.forEach(set => {
          s1.setsWon += set[0]; s1.setsLost += set[1];
          s2.setsWon += set[1]; s2.setsLost += set[0];
          if (set[0] > set[1]) p1S++; else p2S++;
        });
        if (p1S > p2S) { s1.won++; s1.points += 2; s2.lost++; }
        else { s2.won++; s2.points += 2; s1.lost++; }
      }
    });

    return Array.from(standingsMap.values()).sort((a: any, b: any) => b.points - a.points || (b.setsWon - b.setsLost) - (a.setsWon - a.setsLost));
  }
}

export const store = new DataService();
