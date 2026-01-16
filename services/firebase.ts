
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  runTransaction,
  increment
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { Profile, Tournament, Team, Match } from '../types';

const firebaseConfig = {
  apiKey: "AIzaSyBceqpT8fKseYI2MKapeFb7XN80YoOdCFU",
  authDomain: "sanbadm-c0577.firebaseapp.com",
  projectId: "sanbadm-c0577",
  storageBucket: "sanbadm-c0577.firebasestorage.app",
  messagingSenderId: "635145173370",
  appId: "1:635145173370:web:f9be48df68592ed8bdfec3",
  measurementId: "G-LN2BQ1X1CG"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const mapUsernameToEmail = (username: string) => `${username.toLowerCase().trim()}@shuttleup.local`;

export const dbService = {
  auth: {
    signUp: async (username: string, fullName: string, role: string, password?: string) => {
      const email = mapUsernameToEmail(username);
      
      // Username uniqueness check
      const q = query(collection(db, "profiles"), where("username", "==", username.toLowerCase()));
      const snap = await getDocs(q);
      if (!snap.empty) throw new Error("Username already taken in the Arena.");

      const userCred = await createUserWithEmailAndPassword(auth, email, password || "shuttleup123");
      const profileData: Profile = {
        id: userCred.user.uid,
        username: username.toLowerCase(),
        full_name: fullName,
        role: role as any,
        credits: 500,
        created_at: new Date().toISOString()
      };

      await setDoc(doc(db, "profiles", userCred.user.uid), profileData);
      return profileData;
    },
    signIn: async (username: string, password?: string) => {
      const email = mapUsernameToEmail(username);
      const userCred = await signInWithEmailAndPassword(auth, email, password || "shuttleup123");
      const profileSnap = await getDoc(doc(db, "profiles", userCred.user.uid));
      if (!profileSnap.exists()) throw new Error("Arena profile missing.");
      return profileSnap.data() as Profile;
    },
    signOut: () => signOut(auth)
  },

  profiles: {
    updateCredits: async (userId: string, amount: number, desc: string, action: string) => {
      await runTransaction(db, async (transaction) => {
        const profileRef = doc(db, "profiles", userId);
        const profileSnap = await transaction.get(profileRef);
        if (!profileSnap.exists()) throw "Profile not found";
        
        transaction.update(profileRef, { credits: increment(amount) });
        const logRef = doc(collection(db, "credit_logs"));
        transaction.set(logRef, {
          id: logRef.id,
          user_id: userId,
          amount,
          action_type: action,
          description: desc,
          created_at: new Date().toISOString()
        });
      });
    }
  },

  tournaments: {
    create: async (data: Partial<Tournament>, organizerId: string) => {
      const tRef = doc(collection(db, "tournaments"));
      const tournament: Tournament = {
        id: tRef.id,
        share_id: `SHTL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        name: data.name!,
        description: data.description || '',
        organizer_id: organizerId,
        status: 'published',
        cost_to_host: 200,
        is_locked: false,
        location_name: data.location_name || '',
        start_date: data.start_date || new Date().toISOString(),
        latitude: data.latitude || 0,
        longitude: data.longitude || 0,
        created_at: new Date().toISOString()
      };
      
      await runTransaction(db, async (transaction) => {
        const profileRef = doc(db, "profiles", organizerId);
        const profileSnap = await transaction.get(profileRef);
        if (!profileSnap.exists()) throw "Organizer node not found";
        if (profileSnap.data().credits < 200) throw "Insufficient Arena Credits (200c required)";
        
        transaction.update(profileRef, { credits: increment(-200) });
        transaction.set(tRef, tournament);

        // Initial credit log
        const logRef = doc(collection(db, "credit_logs"));
        transaction.set(logRef, {
          id: logRef.id,
          user_id: organizerId,
          amount: -200,
          action_type: 'deduct',
          description: `Hosted Arena: ${tournament.name}`,
          created_at: new Date().toISOString()
        });
      });
      return tournament;
    }
  },

  teams: {
    create: async (tournamentId: string, name: string) => {
      const teamRef = doc(collection(db, "teams"));
      const team: Team = {
        id: teamRef.id,
        tournament_id: tournamentId,
        name: name,
        points: 0,
        wins: 0,
        losses: 0
      };
      await setDoc(teamRef, team);
      return team;
    }
  },

  matches: {
    create: async (tournamentId: string, team1: Team, team2: Team, scheduledAt: string) => {
        const mRef = doc(collection(db, "matches"));
        const match: Match = {
            id: mRef.id,
            tournament_id: tournamentId,
            team1_id: team1.id,
            team2_id: team2.id,
            team1_name: team1.name,
            team2_name: team2.name,
            score1: 0,
            score2: 0,
            status: 'live',
            scheduled_at: scheduledAt || new Date().toISOString()
        };
        await setDoc(mRef, match);
        return match;
    },
    updateScore: async (id: string, s1: number, s2: number) => {
      await updateDoc(doc(db, "matches", id), { score1: s1, score2: s2 });
    },
    complete: async (match: Match) => {
      await runTransaction(db, async (transaction) => {
        const matchRef = doc(db, "matches", match.id);
        const team1Ref = doc(db, "teams", match.team1_id);
        const team2Ref = doc(db, "teams", match.team2_id);

        const winner = match.score1 > match.score2 ? 1 : 2;

        transaction.update(matchRef, { 
          status: 'completed', 
          completed_at: new Date().toISOString() 
        });

        if (winner === 1) {
          transaction.update(team1Ref, { points: increment(2), wins: increment(1) });
          transaction.update(team2Ref, { losses: increment(1) });
        } else {
          transaction.update(team2Ref, { points: increment(2), wins: increment(1) });
          transaction.update(team1Ref, { losses: increment(1) });
        }
      });
    }
  }
};
