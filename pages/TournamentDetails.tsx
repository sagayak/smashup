
import React, { useState, useEffect } from 'react';
import { Tournament, Match, User, UserRole, MatchStatus, Team } from '../types';
import { store } from '../services/mockStore';

interface Props {
  tournament: Tournament;
  user: User;
  onBack: () => void;
}

const TournamentDetails: React.FC<Props> = ({ tournament, user, onBack }) => {
  const [activeTab, setActiveTab] = useState<'matches' | 'teams' | 'standings' | 'settings'>('matches');
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [standings, setStandings] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLocked, setIsLocked] = useState(tournament.isLocked);
  
  // Scorer
  const [scoringMatch, setScoringMatch] = useState<Match | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [scores, setScores] = useState<number[][]>([[0, 0], [0, 0], [0, 0]]);

  // Team Form
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  useEffect(() => { loadData(); }, [tournament.id]);

  const loadData = async () => {
    const [m, t, s, u] = await Promise.all([
      store.getMatchesByTournament(tournament.id),
      store.getTeams(tournament.id),
      store.calculateStandings(tournament.id),
      store.getAllUsers()
    ]);
    setMatches(m);
    setTeams(t);
    setStandings(s);
    setAllUsers(u);
  };

  const isOrganizer = user.id === tournament.organizerId || user.role === UserRole.SUPERADMIN;

  const handleCreateTeam = async () => {
    if (!newTeamName || selectedUserIds.length === 0) return;
    await store.addTeam({ tournamentId: tournament.id, name: newTeamName, playerIds: selectedUserIds });
    setNewTeamName('');
    setSelectedUserIds([]);
    await loadData();
  };

  const handleLock = async () => {
    if (!window.confirm("WARNING: After locking, teams cannot be edited and matches can begin. Proceed?")) return;
    await store.lockTournament(tournament.id);
    setIsLocked(true);
    await loadData();
  };

  const handleStartMatch = async (t1Id: string, t2Id: string) => {
    if (!isLocked) return alert("Lock tournament first!");
    await store.createMatch({
      tournamentId: tournament.id,
      participants: [t1Id, t2Id],
      scores: Array(tournament.bestOf).fill([0, 0]),
      status: MatchStatus.SCHEDULED,
      court: 1,
      startTime: new Date().toISOString()
    });
    await loadData();
  };

  const handleSaveScore = async () => {
    if (scoringMatch) {
      if (pinInput !== tournament.scorerPin && !isOrganizer) return alert("Invalid Scorer PIN");
      await store.updateMatchScore(scoringMatch.id, scores, scoringMatch.participants);
      setScoringMatch(null);
      setShowPinModal(false);
      await loadData();
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <button onClick={onBack} className="p-2 hover:bg-white rounded-full transition-colors shadow-sm">
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">{tournament.name} <span className="text-indigo-600">#{tournament.uniqueId}</span></h2>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">{tournament.venue} • {tournament.format} • {tournament.isLocked ? 'LOCKED' : 'DRAFT'}</p>
          </div>
        </div>

        <div className="flex space-x-2">
           {isOrganizer && !isLocked && (
             <button onClick={handleLock} className="bg-slate-900 text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl">Lock Tournament</button>
           )}
           <div className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center">{tournament.status}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 overflow-x-auto pb-2">
        <TabButton active={activeTab === 'matches'} onClick={() => setActiveTab('matches')} label="Matches" />
        <TabButton active={activeTab === 'teams'} onClick={() => setActiveTab('teams')} label="Teams" />
        <TabButton active={activeTab === 'standings'} onClick={() => setActiveTab('standings')} label="Standings" />
        {isOrganizer && <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} label="Settings" />}
      </div>

      {/* Matches Content */}
      {activeTab === 'matches' && (
        <div className="space-y-4">
           {isOrganizer && isLocked && (
             <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 mb-6">
                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4">Quick Tie-up</h4>
                <div className="flex gap-4">
                  <select id="t1" className="p-3 bg-white rounded-xl font-bold flex-1">
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <span className="self-center font-black text-indigo-300">VS</span>
                  <select id="t2" className="p-3 bg-white rounded-xl font-bold flex-1">
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <button 
                    onClick={() => handleStartMatch((document.getElementById('t1') as any).value, (document.getElementById('t2') as any).value)}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest"
                  >Create Match</button>
                </div>
             </div>
           )}

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {matches.map(m => (
               <div key={m.id} className="bg-white p-6 rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm">
                  <div className="flex items-center space-x-6">
                     <div className="text-center w-10 border-r border-slate-50 pr-4">
                        <p className="text-[9px] font-black text-slate-300 uppercase">CRT</p>
                        <p className="text-xl font-black text-indigo-600">{m.court}</p>
                     </div>
                     <div className="space-y-1">
                        <p className="font-black text-slate-800 text-sm">{teams.find(t => t.id === m.participants[0])?.name} <span className="text-slate-200 mx-2">VS</span> {teams.find(t => t.id === m.participants[1])?.name}</p>
                        <div className="flex space-x-2">
                           {m.scores.map((s, i) => <span key={i} className="text-[10px] font-mono font-bold bg-slate-50 px-2 rounded">{s[0]}-{s[1]}</span>)}
                        </div>
                     </div>
                  </div>
                  {m.status !== MatchStatus.COMPLETED && (
                    <button 
                      onClick={() => { setScoringMatch(m); setShowPinModal(true); }}
                      className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all"
                    >Score</button>
                  )}
               </div>
             ))}
             {matches.length === 0 && <p className="text-slate-300 font-bold text-center py-10 col-span-2">No matches scheduled.</p>}
           </div>
        </div>
      )}

      {/* Teams Content */}
      {activeTab === 'teams' && (
        <div className="space-y-6">
           {isOrganizer && !isLocked && (
             <div className="bg-white p-8 rounded-3xl border-2 border-slate-100 shadow-sm">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Create New Team</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Team Name</label>
                      <input 
                        type="text" className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-2 border-slate-50 focus:border-indigo-500 outline-none"
                        value={newTeamName} onChange={e => setNewTeamName(e.target.value)}
                      />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Add Players (Multi-select)</label>
                      <select 
                        multiple className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-2 border-slate-50 focus:border-indigo-500 outline-none h-32"
                        onChange={e => {
                          const values = Array.from(e.target.selectedOptions, option => option.value);
                          setSelectedUserIds(values);
                        }}
                      >
                         {allUsers.map(u => <option key={u.id} value={u.id}>{u.name} (@{u.username})</option>)}
                      </select>
                   </div>
                </div>
                <button onClick={handleCreateTeam} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl mt-6 uppercase tracking-widest text-xs">Register Team</button>
             </div>
           )}

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {teams.map(team => (
               <div key={team.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm group">
                  <div className="flex justify-between items-start mb-4">
                     <h4 className="font-black text-slate-800 text-lg uppercase italic tracking-tighter">{team.name}</h4>
                     {isOrganizer && !isLocked && (
                       <button onClick={() => store.deleteTeam(team.id).then(loadData)} className="text-rose-300 hover:text-rose-500">×</button>
                     )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                     {team.playerIds.map(pId => (
                       <span key={pId} className="bg-slate-50 px-3 py-1 rounded-lg text-[9px] font-black text-slate-500 uppercase tracking-widest">
                         {allUsers.find(u => u.id === pId)?.name.split(' ')[0]}
                       </span>
                     ))}
                  </div>
               </div>
             ))}
           </div>
        </div>
      )}

      {/* Standings Content */}
      {activeTab === 'standings' && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
           <table className="w-full text-left">
              <thead className="bg-slate-50/50">
                 <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="px-8 py-5">Team</th>
                    <th className="px-4 py-5">P</th>
                    <th className="px-4 py-5">W</th>
                    <th className="px-4 py-5">L</th>
                    <th className="px-8 py-5 text-right">Pts</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                 {standings.map((s, idx) => (
                   <tr key={s.id} className={idx < 4 ? 'bg-indigo-50/20' : ''}>
                      <td className="px-8 py-5 font-bold text-slate-700">{s.name}</td>
                      <td className="px-4 py-5 font-bold text-slate-400">{s.played}</td>
                      <td className="px-4 py-5 font-black text-emerald-500">{s.won}</td>
                      <td className="px-4 py-5 font-bold text-rose-300">{s.lost}</td>
                      <td className="px-8 py-5 text-right font-black text-indigo-600">{s.points}</td>
                   </tr>
                 ))}
              </tbody>
           </table>
        </div>
      )}

      {/* Scorer PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[300] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl">
              <h4 className="text-2xl font-black text-slate-800 text-center mb-8 italic uppercase italic tracking-tighter">Enter Scorer PIN</h4>
              {!isOrganizer && (
                <input 
                  type="password" placeholder="0000" maxLength={4}
                  className="w-full p-6 bg-slate-50 rounded-3xl text-center text-4xl font-black tracking-[1em] mb-8 outline-none focus:border-indigo-500 border-2 border-slate-50"
                  value={pinInput} onChange={e => setPinInput(e.target.value)}
                />
              )}
              <div className="space-y-4 mb-8">
                 {[...Array(tournament.bestOf)].map((_, i) => (
                   <div key={i} className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl">
                      <span className="text-[10px] font-black text-slate-400 uppercase">Set {i+1}</span>
                      <div className="flex items-center space-x-4">
                         <input 
                           type="number" className="w-16 h-12 text-center font-black text-xl rounded-xl"
                           value={scores[i]?.[0] || 0} onChange={e => {
                             const ns = [...scores]; ns[i][0] = parseInt(e.target.value) || 0; setScores(ns);
                           }}
                         />
                         <span className="font-black text-slate-200">:</span>
                         <input 
                           type="number" className="w-16 h-12 text-center font-black text-xl rounded-xl"
                           value={scores[i]?.[1] || 0} onChange={e => {
                             const ns = [...scores]; ns[i][1] = parseInt(e.target.value) || 0; setScores(ns);
                           }}
                         />
                      </div>
                   </div>
                 ))}
              </div>
              <div className="flex space-x-4">
                 <button onClick={handleSaveScore} className="flex-grow bg-indigo-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs">Submit Score</button>
                 <button onClick={() => { setShowPinModal(false); setPinInput(''); }} className="px-8 font-black text-slate-400 uppercase tracking-widest text-xs">Cancel</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const TabButton = ({ active, onClick, label }: any) => (
  <button 
    onClick={onClick}
    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
  >
    {label}
  </button>
);

export default TournamentDetails;
