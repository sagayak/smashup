
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Trophy, Plus, Minus, CheckCircle, ChevronLeft, Zap } from 'lucide-react';
import { supabase, dbService } from '../services/supabase';
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

    const fetchMatch = async () => {
      const { data } = await supabase.from('matches').select('*').eq('id', matchId).single();
      if (data) {
        setMatch(data as Match);
        const { data: tourney } = await supabase.from('tournaments').select('organizer_id').eq('id', data.tournament_id).single();
        setIsScorer(profile.id === tourney?.organizer_id || profile.role === 'superadmin' || profile.role === 'scorer');
      }
      setLoading(false);
    };

    fetchMatch();

    const channel = supabase.channel(`match-${matchId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, (payload) => {
        setMatch(payload.new as Match);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [matchId, profile]);

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
    if (!confirm("Finalize match results? Points will be updated atomically.")) return;
    
    try {
      await dbService.matches.complete(match);
      alert("Match finalized!");
      navigate(-1);
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (loading) return (
    <div className="min-h-[400px] flex items-center justify-center">
      <Zap className="w-12 h-12 text-green-600 animate-bounce" />
    </div>
  );

  if (!match) return <div className="p-20 text-center font-bold">Match node not found.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 font-bold uppercase italic text-xs tracking-widest hover:text-green-600">
          <ChevronLeft className="w-5 h-5" /> Return
        </button>
        <div className="flex items-center gap-2 bg-red-50 px-4 py-1.5 rounded-full border border-red-100">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
          <span className="text-red-600 text-[10px] font-black uppercase tracking-widest">Postgres Live</span>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-gray-100">
        <div className="bg-green-600 p-16 text-center text-white relative">
          <div className="absolute inset-0 opacity-5 flex items-center justify-center font-black text-[15vw] pointer-events-none italic">ARENA</div>
          <div className="flex items-center justify-around relative z-10">
            <div className="flex-1">
              <h2 className="text-3xl font-black mb-4 uppercase italic tracking-tighter leading-none">{match.team1_name}</h2>
              <div className="text-9xl font-black italic tracking-tighter">{match.score1}</div>
            </div>
            <div className="px-10 text-4xl font-black text-green-300 italic opacity-50">VS</div>
            <div className="flex-1">
              <h2 className="text-3xl font-black mb-4 uppercase italic tracking-tighter leading-none">{match.team2_name}</h2>
              <div className="text-9xl font-black italic tracking-tighter">{match.score2}</div>
            </div>
          </div>
        </div>

        {isScorer && match.status === 'live' && (
          <div className="p-10 bg-gray-50 grid grid-cols-2 gap-10">
            <div className="flex justify-center gap-4">
              <button onClick={() => updateScore(1, -1)} className="p-6 bg-white border-2 rounded-2xl text-gray-400 hover:text-red-500 hover:border-red-200 transition-all active:scale-90"><Minus className="w-8 h-8" /></button>
              <button onClick={() => updateScore(1, 1)} className="p-6 bg-gray-900 text-white rounded-2xl shadow-xl hover:bg-black transition-all active:scale-90"><Plus className="w-8 h-8" /></button>
            </div>
            <div className="flex justify-center gap-4">
              <button onClick={() => updateScore(2, -1)} className="p-6 bg-white border-2 rounded-2xl text-gray-400 hover:text-red-500 hover:border-red-200 transition-all active:scale-90"><Minus className="w-8 h-8" /></button>
              <button onClick={() => updateScore(2, 1)} className="p-6 bg-gray-900 text-white rounded-2xl shadow-xl hover:bg-black transition-all active:scale-90"><Plus className="w-8 h-8" /></button>
            </div>
          </div>
        )}

        <div className="p-10 flex justify-center border-t border-gray-100 bg-white">
          {isScorer && match.status === 'live' ? (
            <button onClick={finishMatch} className="bg-green-600 hover:bg-green-700 text-white px-12 py-5 rounded-2xl font-black italic uppercase text-xl shadow-xl active:scale-95 transition-all flex items-center gap-3">
              <CheckCircle className="w-6 h-6" /> Finalize Scores
            </button>
          ) : (
             <div className="text-gray-400 font-black uppercase italic tracking-widest text-sm">
                {match.status === 'completed' ? 'Battle Concluded' : 'Viewing Arena'}
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveScoringPage;
