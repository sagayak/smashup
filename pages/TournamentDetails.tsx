
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
  const [scoringMatch, setScoringMatch] = useState<Match | null>(null);
  const [scores, setScores] = useState<number[][]>([[0, 0], [0, 0], [0, 0]]);

  useEffect(() => {
    refreshData();
  }, [tournament.id]);

  const refreshData = () => {
    setMatches(store.getMatchesByTournament(tournament.id));
    setStandings(store.calculateStandings(tournament.id));
  };

  const handleSaveScore = () => {
    if (scoringMatch) {
      store.updateMatchScore(scoringMatch.id, scores);
      setScoringMatch(null);
      setScores([[0, 0], [0, 0], [0, 0]]);
      refreshData();
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center space-x-4">
        <button onClick={onBack} className="p-2 hover:bg-white rounded-full transition-colors">
          <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <div>
          <h2 className="text-3xl font-bold text-slate-800">{tournament.name}</h2>
          <p className="text-slate-500 font-medium">{tournament.venue} • {tournament.format} • {tournament.type}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Matches List */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-slate-700 uppercase tracking-wider text-sm">Match Schedule</h3>
            {user.role !== UserRole.PLAYER && (
              <button className="text-indigo-600 font-bold text-sm">+ Add Match</button>
            )}
          </div>
          <div className="space-y-3">
            {matches.map(match => (
              <div key={match.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div className="flex items-center space-x-6">
                  <div className="text-center w-12 border-r border-slate-100 pr-4">
                    <p className="text-xs font-bold text-slate-400 uppercase">Crt</p>
                    <p className="text-xl font-black text-indigo-600">{match.court}</p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right w-24">
                      <p className="font-bold text-slate-700 truncate">{store.getUser(match.participants[0])?.name}</p>
                    </div>
                    <div className="px-3 py-1 bg-slate-50 rounded-lg text-xs font-black text-slate-300">VS</div>
                    <div className="text-left w-24">
                      <p className="font-bold text-slate-700 truncate">{store.getUser(match.participants[1])?.name}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  {match.status === MatchStatus.COMPLETED ? (
                    <div className="flex space-x-2 font-mono text-sm font-bold text-slate-500">
                      {match.scores.map((s, i) => (
                        <span key={i} className={s[0] === 0 && s[1] === 0 ? 'hidden' : ''}>{s[0]}-{s[1]}</span>
                      ))}
                    </div>
                  ) : (
                    user.role !== UserRole.PLAYER && (
                      <button 
                        onClick={() => setScoringMatch(match)}
                        className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl font-bold hover:bg-indigo-600 hover:text-white transition-all text-sm"
                      >
                        Record Score
                      </button>
                    )
                  )}
                  <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${match.status === MatchStatus.COMPLETED ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                    {match.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Standings */}
        <div className="space-y-4">
          <h3 className="font-bold text-slate-700 uppercase tracking-wider text-sm">Standings</h3>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr className="text-slate-400 text-[10px] font-bold uppercase">
                  <th className="px-4 py-3">Player</th>
                  <th className="px-2 py-3">P</th>
                  <th className="px-2 py-3">W</th>
                  <th className="px-4 py-3 text-right">Pts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {standings.map((row, idx) => (
                  <tr key={row.id} className={idx === 0 ? 'bg-indigo-50/30' : ''}>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-300 font-mono w-4">{idx + 1}</span>
                        <span className="font-bold text-slate-700">{store.getUser(row.id)?.name.split(' ')[0]}</span>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-slate-500">{row.played}</td>
                    <td className="px-2 py-3 font-medium text-green-600">{row.won}</td>
                    <td className="px-4 py-3 text-right font-black text-indigo-600">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Score Modal */}
      {scoringMatch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <h4 className="text-2xl font-bold text-slate-800 mb-6 text-center">Match Scoreboard</h4>
            
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl mx-auto flex items-center justify-center text-2xl mb-2">🏸</div>
                <p className="font-bold text-slate-700 text-sm truncate">{store.getUser(scoringMatch.participants[0])?.name}</p>
              </div>
              <div className="flex items-center justify-center">
                <span className="text-4xl font-black text-slate-200">VS</span>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl mx-auto flex items-center justify-center text-2xl mb-2">🏸</div>
                <p className="font-bold text-slate-700 text-sm truncate">{store.getUser(scoringMatch.participants[1])?.name}</p>
              </div>
            </div>

            <div className="space-y-4">
              {[0, 1, 2].map(setIdx => (
                <div key={setIdx} className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl">
                  <span className="text-xs font-bold text-slate-400 uppercase">Set {setIdx + 1}</span>
                  <div className="flex items-center space-x-4">
                    <input 
                      type="number" className="w-16 p-2 text-center font-bold text-xl bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      value={scores[setIdx][0]} onChange={e => {
                        const newScores = [...scores];
                        newScores[setIdx][0] = parseInt(e.target.value) || 0;
                        setScores(newScores);
                      }}
                    />
                    <span className="text-slate-300 font-bold">:</span>
                    <input 
                      type="number" className="w-16 p-2 text-center font-bold text-xl bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
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

            <div className="flex space-x-4 mt-8">
              <button onClick={handleSaveScore} className="flex-grow bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">Finalize Match</button>
              <button onClick={() => setScoringMatch(null)} className="px-8 py-4 font-bold text-slate-400 hover:text-slate-600 transition-colors">Discard</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentDetails;
