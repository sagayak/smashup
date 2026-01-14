
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Trophy, AlertCircle, Plus, Minus, CheckCircle, ChevronLeft } from 'lucide-react';
import { supabase } from '../services/supabase';
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
    fetchMatch();
    
    // Subscribe to specific match updates
    const channel = supabase
      .channel(`match_${matchId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, (payload) => {
        setMatch(prev => ({ ...prev, ...(payload.new as Match) }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  const fetchMatch = async () => {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        team1:team1_id(name),
        team2:team2_id(name),
        tournament:tournament_id(organizer_id)
      `)
      .eq('id', matchId)
      .single();

    if (data) {
      const matchData = {
        ...data,
        team1_name: (data.team1 as any)?.name,
        team2_name: (data.team2 as any)?.name,
      };
      setMatch(matchData);
      
      // Check if user has permission to score
      const organizerId = (data.tournament as any)?.organizer_id;
      setIsScorer(profile.id === organizerId || profile.role === 'superadmin' || profile.role === 'scorer');
    }
    setLoading(false);
  };

  const updateScore = async (team: 1 | 2, delta: number) => {
    if (!match || !isScorer) return;

    const newScore1 = team === 1 ? Math.max(0, match.score1 + delta) : match.score1;
    const newScore2 = team === 2 ? Math.max(0, match.score2 + delta) : match.score2;

    const { error } = await supabase
      .from('matches')
      .update({ score1: newScore1, score2: newScore2 })
      .eq('id', match.id);

    if (error) {
      alert("Failed to update score");
    }
  };

  const finishMatch = async () => {
    if (!match || !isScorer) return;
    if (!confirm("Are you sure you want to finish this match? Scores will be locked.")) return;

    const { error } = await supabase
      .from('matches')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', match.id);

    if (!error) {
      navigate(-1);
    }
  };

  if (loading) return <div>Loading Court...</div>;
  if (!match) return <div>Match not found.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in zoom-in duration-300">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 font-medium hover:text-green-600 transition-colors">
          <ChevronLeft className="w-5 h-5" /> Back to Dashboard
        </button>
        <div className="flex items-center gap-2 bg-red-50 px-4 py-1.5 rounded-full border border-red-100">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
          <span className="text-red-600 text-xs font-black uppercase tracking-widest">Live Scoring</span>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-gray-100">
        <div className="bg-green-600 p-12 text-center text-white relative">
          <div className="absolute top-0 left-0 w-full h-full opacity-10">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M0,50 L100,50 M50,0 L50,100" stroke="white" strokeWidth="0.5" />
              <circle cx="50" cy="50" r="15" fill="none" stroke="white" strokeWidth="0.5" />
            </svg>
          </div>
          <p className="text-green-100 text-sm font-bold uppercase tracking-widest mb-4">ShuttleUp Official Scoreboard</p>
          <div className="flex items-center justify-around relative z-10">
            <div className="flex-1 text-center">
              <h2 className="text-3xl font-black mb-2 uppercase tracking-tighter">{match.team1_name}</h2>
              <div className="text-8xl font-black">{match.score1}</div>
            </div>
            <div className="px-8 text-4xl font-bold text-green-200">VS</div>
            <div className="flex-1 text-center">
              <h2 className="text-3xl font-black mb-2 uppercase tracking-tighter">{match.team2_name}</h2>
              <div className="text-8xl font-black">{match.score2}</div>
            </div>
          </div>
        </div>

        {isScorer && match.status === 'live' && (
          <div className="p-8 bg-gray-50 grid grid-cols-2 gap-8 divide-x divide-gray-200">
            <div className="flex flex-col items-center gap-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Team 1 Controls</p>
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
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Team 2 Controls</p>
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
              Finish & Finalize Match
            </button>
          ) : (
             <div className="text-gray-400 flex items-center gap-2 font-medium italic">
                {match.status === 'completed' ? 'This match has concluded' : 'Waiting for official to start scoring...'}
             </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="bg-green-50 p-3 rounded-2xl text-green-600"><Trophy className="w-6 h-6" /></div>
            <div>
               <p className="text-xs font-bold text-gray-400 uppercase">Tournament</p>
               <p className="font-bold text-gray-800">Elite Open 2024</p>
            </div>
         </div>
         <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="bg-blue-50 p-3 rounded-2xl text-blue-600"><Plus className="w-6 h-6" /></div>
            <div>
               <p className="text-xs font-bold text-gray-400 uppercase">Court</p>
               <p className="font-bold text-gray-800">Court #1</p>
            </div>
         </div>
         <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="bg-purple-50 p-3 rounded-2xl text-purple-600"><AlertCircle className="w-6 h-6" /></div>
            <div>
               <p className="text-xs font-bold text-gray-400 uppercase">Status</p>
               <p className="font-bold text-gray-800 capitalize">{match.status}</p>
            </div>
         </div>
      </div>
    </div>
  );
};

export default LiveScoringPage;
