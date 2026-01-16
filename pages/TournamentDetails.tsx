
import React, { useState, useEffect } from 'react';
import { Tournament, Match, User, UserRole, MatchStatus } from '../types';
import { store } from '../services/mockStore';

interface Props {
  tournament: Tournament;
  user: User;
  onBack: () => void;
}

const TournamentDetails: React.FC<Props> = ({ tournament, user, onBack }) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [standings, setStandings] = useState<any[]>([]);
  const [playersMap, setPlayersMap] = useState<Record<string, User>>({});
  const [scoringMatch, setScoringMatch] = useState<Match | null>(null);
  const [scores, setScores] = useState<number[][]>([[0, 0], [0, 0], [0, 0]]);
  const [isJoining, setIsJoining] = useState(false);
  const [currentTourney, setCurrentTourney] = useState(tournament);

  useEffect(() => {
    refreshData();
  }, [currentTourney.id]);

  const refreshData = async () => {
    const [m, s, u, updatedT] = await Promise.all([
      store.getMatchesByTournament(currentTourney.id),
      store.calculateStandings(currentTourney.id),
      store.getAllUsers(),
      store.getTournaments().then(list => list.find(it => it.id === currentTourney.id))
    ]);
    if (updatedT) setCurrentTourney(updatedT);
    setMatches(m);
    setStandings(s);
    const map: Record<string, User> = {};
    u.forEach(user => { map[user.id] = user; });
    setPlayersMap(map);
  };

  const handleJoin = async () => {
    setIsJoining(true);
    try {
      await store.joinTournament(currentTourney.id, user.id);
      await refreshData();
    } catch (err) {
      alert("Failed to join tournament");
    } finally {
      setIsJoining(false);
    }
  };

  const handleSaveScore = async () => {
    if (scoringMatch) {
      await store.updateMatchScore(scoringMatch.id, scores, scoringMatch.participants);
      setScoringMatch(null);
      setScores([[0, 0], [0, 0], [0, 0]]);
      await refreshData();
    }
  };

  const isParticipant = currentTourney.participants.includes(user.id);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <button onClick={onBack} className="p-2 hover:bg-white rounded-full transition-colors shadow-sm">
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">{currentTourney.name}</h2>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">{currentTourney.venue} • {currentTourney.format} • {currentTourney.type}</p>
          </div>
        </div>

        {!isParticipant && user.role === UserRole.PLAYER && (
          <button 
            onClick={handleJoin}
            disabled={isJoining}
            className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
          >
            {isJoining ? 'Joining...' : 'Join Tournament'}
          </button>
        )}
        {isParticipant && user.role === UserRole.PLAYER && (
          <span className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-emerald-100 flex items-center space-x-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
            <span>Joined</span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Matches List */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-black text-slate-400 uppercase tracking-widest text-[10px] ml-2">Match Schedule</h3>
          </div>
          <div className="space-y-3">
            {matches.length > 0 ? matches.map(match => (
              <div key={match.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-6">
                  <div className="text-center w-12 border-r border-slate-50 pr-6">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Crt</p>
                    <p className="text-2xl font-black text-indigo-600">{match.court}</p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right w-24">
                      <p className="font-black text-slate-700 truncate text-sm">{playersMap[match.participants[0]]?.name || '...'}</p>
                    </div>
                    <div className="px-3 py-1 bg-slate-50 rounded-lg text-[10px] font-black text-slate-300">VS</div>
                    <div className="text-left w-24">
                      <p className="font-black text-slate-700 truncate text-sm">{playersMap[match.participants[1]]?.name || '...'}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end space-x-6">
                  {match.status === MatchStatus.COMPLETED ? (
                    <div className="flex space-x-3 font-mono text-sm font-black text-slate-400">
                      {match.scores.map((s, i) => (
                        <span key={i} className={`bg-slate-50 px-2 py-1 rounded-lg ${s[0] === 0 && s[1] === 0 ? 'hidden' : ''}`}>{s[0]}-{s[1]}</span>
                      ))}
                    </div>
                  ) : (
                    user.role !== UserRole.PLAYER && (
                      <button 
                        onClick={() => setScoringMatch(match)}
                        className="bg-indigo-50 text-indigo-600 px-5 py-2 rounded-2xl font-black hover:bg-indigo-600 hover:text-white transition-all text-xs uppercase tracking-widest"
                      >
                        Record Score
                      </button>
                    )
                  )}
                  <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${match.status === MatchStatus.COMPLETED ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
                    {match.status}
                  </span>
                </div>
              </div>
            )) : (
              <div className="p-12 bg-white rounded-3xl border border-dashed border-slate-200 text-center">
                <p className="text-slate-400 font-bold">No matches scheduled yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* Standings */}
        <div className="space-y-4">
          <h3 className="font-black text-slate-400 uppercase tracking-widest text-[10px] ml-2">Standings</h3>
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/50">
                <tr className="text-slate-400 text-[9px] font-black uppercase tracking-widest">
                  <th className="px-6 py-4">Player</th>
                  <th className="px-2 py-4">P</th>
                  <th className="px-2 py-4">W</th>
                  <th className="px-6 py-4 text-right">Pts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {standings.map((row, idx) => (
                  <tr key={row.id} className={idx === 0 ? 'bg-indigo-50/20' : ''}>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <span className={`text-[10px] font-black w-5 h-5 flex items-center justify-center rounded ${idx === 0 ? 'bg-amber-100 text-amber-600' : 'text-slate-300'}`}>{idx + 1}</span>
                        <span className="font-bold text-slate-700">{playersMap[row.id]?.name.split(' ')[0] || '...'}</span>
                      </div>
                    </td>
                    <td className="px-2 py-4 text-slate-400 font-bold">{row.played}</td>
                    <td className="px-2 py-4 font-black text-emerald-500">{row.won}</td>
                    <td className="px-6 py-4 text-right font-black text-indigo-600">{row.points}</td>
                  </tr>
                ))}
                {standings.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-slate-300 font-bold uppercase text-[10px] tracking-widest">Waiting for results</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Score Modal */}
      {scoringMatch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="text-center mb-8">
               <h4 className="text-2xl font-black text-slate-800 tracking-tighter">Record Results</h4>
               <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1">Court {scoringMatch.court} • Best of 3</p>
            </div>
            
            <div className="grid grid-cols-3 gap-6 mb-10">
              <div className="text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-3xl mx-auto flex items-center justify-center text-3xl mb-3 shadow-inner">🏸</div>
                <p className="font-black text-slate-700 text-xs truncate uppercase tracking-wider">{playersMap[scoringMatch.participants[0]]?.name}</p>
              </div>
              <div className="flex items-center justify-center">
                <span className="text-5xl font-black text-slate-100 italic">VS</span>
              </div>
              <div className="text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-3xl mx-auto flex items-center justify-center text-3xl mb-3 shadow-inner">🏸</div>
                <p className="font-black text-slate-700 text-xs truncate uppercase tracking-wider">{playersMap[scoringMatch.participants[1]]?.name}</p>
              </div>
            </div>

            <div className="space-y-4 mb-10">
              {[0, 1, 2].map(setIdx => (
                <div key={setIdx} className="flex items-center justify-between bg-slate-50 p-5 rounded-[1.5rem] border border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Set {setIdx + 1}</span>
                  <div className="flex items-center space-x-6">
                    <input 
                      type="number" className="w-16 h-16 text-center font-black text-2xl bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 transition-all"
                      value={scores[setIdx][0]} onChange={e => {
                        const newScores = [...scores];
                        newScores[setIdx][0] = parseInt(e.target.value) || 0;
                        setScores(newScores);
                      }}
                    />
                    <span className="text-slate-200 font-black text-3xl">:</span>
                    <input 
                      type="number" className="w-16 h-16 text-center font-black text-2xl bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 transition-all"
                      value={scores[setIdx][1]} onChange={e => {
                        const newScores = [...scores];
                        newScores[setIdx][1] = parseInt(e.target.value) || 0;
                        setScores(newScores);
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col space-y-3">
              <button onClick={handleSaveScore} className="w-full bg-indigo-600 text-white font-black py-5 rounded-[1.5rem] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 uppercase tracking-widest text-sm">Submit Match Scores</button>
              <button onClick={() => setScoringMatch(null)} className="w-full py-4 font-black text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest text-xs">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentDetails;
