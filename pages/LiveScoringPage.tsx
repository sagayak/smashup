
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Trophy, Plus, Minus, CheckCircle, ChevronLeft, Clock } from 'lucide-react';
import { db, dbService } from '../services/firebase';
import { doc, onSnapshot, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { Match, Profile } from '../types';

interface LiveScoringPageProps {
  profile: Profile;
}

const LiveScoringPage: React.FC<LiveScoringPageProps> = ({ profile }) => {
  const { matchId } = useParams<{ matchId: string }>();
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [isScorer, setIsScorer] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!matchId) return;

    const unsub = onSnapshot(doc(db, "matches", matchId), async (snap) => {
      if (snap.exists()) {
        const matchData = snap.data() as Match;
        setMatch(matchData);
        
        // Fetch tournament to verify permissions
        const tSnap = await getDoc(doc(db, "tournaments", matchData.tournament_id));
        const organizerId = tSnap.data()?.organizer_id;
        setIsScorer(profile.id === organizerId || profile.role === 'superadmin' || profile.role === 'scorer');
      }
      setLoading(false);
    });

    return () => unsub();
  }, [matchId, profile.id]);

  const updateScore = async (team: 1 | 2, delta: number) => {
    if (!match || !isScorer) return;
    const newScore1 = team === 1 ? Math.max(0, match.score1 + delta) : match.score1;
    const newScore2 = team === 2 ? Math.max(0, match.score2 + delta) : match.score2;
    await dbService.matches.updateScore(match.id, newScore1, newScore2);
  };

  const finishMatch = async () => {
    if (!match || !isScorer) return;
    if (match.score1 === match.score2) {
      alert("Matches cannot end in a draw in this arena.");
      return;
    }
    if (!confirm("Finish this match? Team standings will be updated atomically.")) return;
    
    try {
      await dbService.matches.complete(match);
      alert("Match finalized! Standings updated.");
      navigate(-1);
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (loading) return (
    <div className="min-h-[400px] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Trophy className="w-12 h-12 text-green-600 animate-bounce" />
        <p className="font-black italic uppercase tracking-tighter text-gray-400">Loading Scoreboard...</p>
      </div>
    </div>
  );

  if (!match) return <div className="p-20 text-center font-bold">Match node not found in cloud.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in zoom-in duration-300">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 font-medium hover:text-green-600 transition-colors">
          <ChevronLeft className="w-5 h-5" /> Back
        </button>
        <div className="flex items-center gap-2 bg-red-50 px-4 py-1.5 rounded-full border border-red-100">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
          <span className="text-red-600 text-xs font-black uppercase tracking-widest">Live Scoring</span>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-gray-100">
        <div className="bg-green-600 p-12 text-center text-white relative">
          <div className="absolute inset-0 opacity-10 flex items-center justify-center font-black text-[20vw] pointer-events-none">FIRESTORE</div>
          <p className="text-green-100 text-sm font-bold uppercase tracking-widest mb-4">ShuttleUp Official Scoreboard</p>
          <div className="flex items-center justify-around relative z-10">
            <div className="flex-1 text-center">
              <h2 className="text-3xl font-black mb-2 uppercase tracking-tighter">{match.team1_name}</h2>
              <div className="text-8xl font-black">{match.score1}</div>
            </div>
            <div className="px-8 text-4xl font-bold text-green-200 italic">VS</div>
            <div className="flex-1 text-center">
              <h2 className="text-3xl font-black mb-2 uppercase tracking-tighter">{match.team2_name}</h2>
              <div className="text-8xl font-black">{match.score2}</div>
            </div>
          </div>
        </div>

        {isScorer && match.status === 'live' && (
          <div className="p-8 bg-gray-50 grid grid-cols-2 gap-8 divide-x divide-gray-200">
            <div className="flex flex-col items-center gap-4">
              <div className="flex gap-4">
                <button onClick={() => updateScore(1, -1)} className="p-6 bg-white border-2 border-gray-200 rounded-2xl text-gray-400 hover:text-red-500 hover:border-red-200 transition-all active:scale-90">
                  <Minus className="w-8 h-8" />
                </button>
                <button onClick={() => updateScore(1, 1)} className="p-6 bg-green-500 rounded-2xl text-white shadow-lg shadow-green-100 hover:bg-green-600 transition-all active:scale-90">
                  <Plus className="w-8 h-8" />
                </button>
              </div>
            </div>
            <div className="flex flex-col items-center gap-4">
              <div className="flex gap-4">
                <button onClick={() => updateScore(2, -1)} className="p-6 bg-white border-2 border-gray-200 rounded-2xl text-gray-400 hover:text-red-500 hover:border-red-200 transition-all active:scale-90">
                  <Minus className="w-8 h-8" />
                </button>
                <button onClick={() => updateScore(2, 1)} className="p-6 bg-green-500 rounded-2xl text-white shadow-lg shadow-green-100 hover:bg-green-600 transition-all active:scale-90">
                  <Plus className="w-8 h-8" />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="p-8 flex justify-center border-t border-gray-100">
          {isScorer && match.status === 'live' ? (
            <button 
              onClick={finishMatch}
              className="bg-gray-900 hover:bg-black text-white px-10 py-4 rounded-2xl font-bold flex items-center gap-2 transition-all active:scale-95 shadow-xl"
            >
              <CheckCircle className="w-5 h-5 text-green-400" />
              Finalize Match
            </button>
          ) : (
             <div className="text-gray-400 flex items-center gap-2 font-medium italic">
                {match.status === 'completed' ? 'This match has concluded' : 'Waiting for official...'}
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveScoringPage;
