
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
  const [playerInput, setPlayerInput] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [tempTeamPlayers, setTempTeamPlayers] = useState<{id?: string, name: string}[]>([]);

  // Match Config
  const [matchConfig, setMatchConfig] = useState({ points: 21, bestOf: 3, court: 1 });

  useEffect(() => { loadData(); }, [tournament.id]);

  const loadData = async () => {
    const [m, t, s, u] = await Promise.all([
      store.getMatchesByTournament(tournament.id),
      store.getTeams(tournament.id),
      store.calculateStandings(tournament.id),
      store.getAllUsers()
    ]);
    setMatches(m.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()));
    setTeams(t);
    setStandings(s);
    setAllUsers(u);
  };

  const isOrganizer = user.id === tournament.organizerId || user.role === UserRole.SUPERADMIN;

  const handleAddPlayerByUsername = async () => {
    if (!playerInput) return;
    const found = await store.getUserByUsername(playerInput);
    if (found) {
      setTempTeamPlayers([...tempTeamPlayers, { id: found.id, name: found.name }]);
      setPlayerInput('');
    } else {
      if (window.confirm(`User @${playerInput} not found. Add as custom player name?`)) {
        setTempTeamPlayers([...tempTeamPlayers, { name: playerInput }]);
        setPlayerInput('');
      }
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeamName || tempTeamPlayers.length === 0) return;
    const playerIds = tempTeamPlayers.filter(p => p.id).map(p => p.id!);
    const customNames = tempTeamPlayers.filter(p => !p.id).map(p => p.name);
    
    await store.addTeam({ 
      tournamentId: tournament.id, 
      name: newTeamName, 
      playerIds, 
      customPlayerNames: customNames 
    });
    setNewTeamName('');
    setTempTeamPlayers([]);
    await loadData();
  };

  const handleBulkImport = async () => {
    const lines = bulkInput.split('\n').filter(l => l.trim());
    for (const line of lines) {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length < 2) continue;
      const teamName = parts[0];
      const playerNames = parts.slice(1);
      
      const playerIds: string[] = [];
      const customNames: string[] = [];
      
      for (const name of playerNames) {
        const found = allUsers.find(u => u.username.toLowerCase() === name.toLowerCase() || u.name.toLowerCase() === name.toLowerCase());
        if (found) playerIds.push(found.id);
        else customNames.push(name);
      }
      
      await store.addTeam({ tournamentId: tournament.id, name: teamName, playerIds, customPlayerNames: customNames });
    }
    setBulkInput('');
    setIsBulkOpen(false);
    await loadData();
  };

  const handleLock = async () => {
    if (!window.confirm("WARNING: Teams cannot be edited after lock. Proceed?")) return;
    await store.lockTournament(tournament.id);
    setIsLocked(true);
    await loadData();
  };

  const handleStartMatch = async (t1Id: string, t2Id: string) => {
    if (!isLocked) return alert("Lock tournament first!");
    if (t1Id === t2Id) return alert("Select different teams!");
    
    await store.createMatch({
      tournamentId: tournament.id,
      participants: [t1Id, t2Id],
      scores: Array(matchConfig.bestOf).fill(null).map(() => [0, 0]),
      status: MatchStatus.SCHEDULED,
      court: matchConfig.court,
      startTime: new Date().toISOString(),
      pointsOption: matchConfig.points,
      bestOf: matchConfig.bestOf
    });
    await loadData();
  };

  const handleSaveScore = async () => {
    if (scoringMatch) {
      if (pinInput !== tournament.scorerPin && !isOrganizer) return alert("Invalid Scorer PIN");
      await store.updateMatchScore(scoringMatch.id, scores, scoringMatch.participants);
      setScoringMatch(null);
      setShowPinModal(false);
      setPinInput('');
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
            <h2 className="text-3xl font-black text-slate-800 tracking-tight italic uppercase">{tournament.name}</h2>
            <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">ID: {tournament.uniqueId} • {tournament.venue} • {tournament.isLocked ? 'LOCKED' : 'DRAFT'}</p>
          </div>
        </div>
        <div className="flex space-x-2">
           {isOrganizer && !isLocked && (
             <button onClick={handleLock} className="bg-slate-900 text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">Lock Tournament</button>
           )}
           <div className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center">{tournament.status}</div>
        </div>
      </div>

      <div className="flex space-x-4 overflow-x-auto pb-2 no-scrollbar">
        <TabButton active={activeTab === 'matches'} onClick={() => setActiveTab('matches')} label="Matches" />
        <TabButton active={activeTab === 'teams'} onClick={() => setActiveTab('teams')} label="Teams" />
        <TabButton active={activeTab === 'standings'} onClick={() => setActiveTab('standings')} label="Standings" />
        {isOrganizer && <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} label="Settings" />}
      </div>

      {activeTab === 'matches' && (
        <div className="space-y-6">
           {isOrganizer && isLocked && (
             <div className="bg-indigo-600 p-8 rounded-[2rem] text-white shadow-xl">
                <h4 className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-6">Create Tie-up</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <select id="t1" className="p-4 bg-indigo-500 rounded-2xl font-black text-xs uppercase outline-none focus:ring-2 ring-white">
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <div className="flex items-center justify-center font-black italic text-2xl">VS</div>
                  <select id="t2" className="p-4 bg-indigo-500 rounded-2xl font-black text-xs uppercase outline-none focus:ring-2 ring-white">
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <button 
                    onClick={() => handleStartMatch((document.getElementById('t1') as any).value, (document.getElementById('t2') as any).value)}
                    className="bg-white text-indigo-600 p-4 rounded-2xl font-black text-xs uppercase shadow-lg active:scale-95 transition-all"
                  >Initialize Match</button>
                </div>
                <div className="flex flex-wrap gap-4 pt-4 border-t border-indigo-400">
                  <ConfigItem label="Sets" value={matchConfig.bestOf} onChange={v => setMatchConfig({...matchConfig, bestOf: parseInt(v)})} options={[1,3,5]} />
                  <ConfigItem label="Points" value={matchConfig.points} onChange={v => setMatchConfig({...matchConfig, points: parseInt(v)})} options={[11,15,21,25,30]} />
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Court</span>
                    <input type="number" className="w-12 bg-indigo-500 rounded-lg p-1 text-center font-black" value={matchConfig.court} onChange={e => setMatchConfig({...matchConfig, court: parseInt(e.target.value)})} />
                  </div>
                </div>
             </div>
           )}

           <div className="grid grid-cols-1 gap-4">
             {matches.map(m => (
               <div key={m.id} className="bg-white p-6 rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm group hover:border-indigo-200 transition-all">
                  <div className="flex items-center space-x-6">
                     <div className="text-center w-12 border-r border-slate-100 pr-6">
                        <p className="text-[9px] font-black text-slate-300 uppercase">CRT</p>
                        <p className="text-2xl font-black text-slate-800">{m.court}</p>
                     </div>
                     <div>
                        <div className="flex items-center space-x-3 mb-2">
                          <p className="font-black text-slate-800 text-lg uppercase italic tracking-tighter">
                            {teams.find(t => t.id === m.participants[0])?.name} 
                            <span className="text-slate-200 mx-3 lowercase font-medium not-italic">vs</span> 
                            {teams.find(t => t.id === m.participants[1])?.name}
                          </p>
                          <span className="bg-slate-50 px-2 py-0.5 rounded text-[8px] font-black text-slate-400 uppercase">{m.bestOf} Sets / {m.pointsOption} Pts</span>
                        </div>
                        <div className="flex space-x-2">
                           {m.scores.map((s, i) => <span key={i} className={`text-xs font-mono font-black px-3 py-1 rounded-lg ${s[0] > s[1] ? 'bg-indigo-50 text-indigo-600' : s[1] > s[0] ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'}`}>{s[0]}-{s[1]}</span>)}
                        </div>
                     </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className={`text-[9px] font-black uppercase tracking-widest ${m.status === MatchStatus.COMPLETED ? 'text-slate-400' : 'text-emerald-500 animate-pulse'}`}>{m.status}</span>
                    {m.status !== MatchStatus.COMPLETED && (
                      <button 
                        onClick={() => { setScoringMatch(m); setScores(m.scores); setShowPinModal(true); }}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 active:scale-95 transition-all"
                      >Score Match</button>
                    )}
                  </div>
               </div>
             ))}
             {matches.length === 0 && <div className="text-center py-20 bg-white rounded-[2rem] border border-dashed border-slate-200"><p className="text-slate-400 font-black uppercase tracking-widest text-xs">No active tie-ups.</p></div>}
           </div>
        </div>
      )}

      {activeTab === 'teams' && (
        <div className="space-y-6">
           {isOrganizer && !isLocked && (
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex justify-between">
                     <span>Team Builder</span>
                     <button onClick={() => setIsBulkOpen(!isBulkOpen)} className="text-indigo-600 hover:underline">{isBulkOpen ? 'Switch to Individual' : 'Switch to Bulk Import'}</button>
                   </h4>
                   
                   {!isBulkOpen ? (
                     <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <input type="text" placeholder="Team Name" className="p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} />
                          <div className="flex space-x-2">
                             <input type="text" placeholder="Add by @username or Name" className="flex-1 p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500" value={playerInput} onChange={e => setPlayerInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleAddPlayerByUsername()} />
                             <button onClick={handleAddPlayerByUsername} className="bg-slate-900 text-white px-6 rounded-2xl font-black text-xs uppercase">+</button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                           {tempTeamPlayers.map((p, i) => (
                             <div key={i} className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center space-x-2">
                               <span>{p.name}</span>
                               <button onClick={() => setTempTeamPlayers(tempTeamPlayers.filter((_, idx) => idx !== i))}>×</button>
                             </div>
                           ))}
                        </div>
                        <button onClick={handleCreateTeam} className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-indigo-100">Register Team</button>
                     </div>
                   ) : (
                     <div className="space-y-4">
                        <textarea 
                          placeholder="Format: Team Name, Player 1, Player 2&#10;Ex: Smashers, @pro_player, John Doe&#10;Ex: Eagles, @mike, @sara"
                          className="w-full h-40 p-6 bg-slate-50 rounded-2xl font-mono text-xs border-2 border-transparent focus:border-indigo-500 outline-none"
                          value={bulkInput} onChange={e => setBulkInput(e.target.value)}
                        />
                        <button onClick={handleBulkImport} className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-indigo-100">Process Bulk Import</button>
                     </div>
                   )}
                </div>
                <div className="bg-slate-900 p-8 rounded-[2rem] text-white shadow-xl">
                   <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 italic">Pro Tip</h4>
                   <p className="text-slate-400 text-sm leading-relaxed">
                     You can add registered players by their <span className="text-indigo-400 font-black">@username</span> to track their global stats. For guests, just type their full name.
                   </p>
                </div>
             </div>
           )}

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {teams.map(team => (
               <div key={team.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm group hover:shadow-lg transition-all">
                  <div className="flex justify-between items-start mb-4">
                     <h4 className="font-black text-slate-800 text-lg uppercase italic tracking-tighter">{team.name}</h4>
                     {isOrganizer && !isLocked && (
                       <button onClick={() => store.deleteTeam(team.id).then(loadData)} className="text-slate-300 hover:text-rose-500 transition-colors text-xl">×</button>
                     )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                     {team.playerIds.map(pId => (
                       <span key={pId} className="bg-indigo-50 px-3 py-1 rounded-lg text-[9px] font-black text-indigo-500 uppercase tracking-widest">
                         {allUsers.find(u => u.id === pId)?.name}
                       </span>
                     ))}
                     {team.customPlayerNames?.map((name, i) => (
                       <span key={i} className="bg-slate-100 px-3 py-1 rounded-lg text-[9px] font-black text-slate-500 uppercase tracking-widest">
                         {name} (Guest)
                       </span>
                     ))}
                  </div>
               </div>
             ))}
           </div>
        </div>
      )}

      {activeTab === 'standings' && (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden animate-in zoom-in duration-300">
           <table className="w-full text-left">
              <thead className="bg-slate-50/50">
                 <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="px-10 py-6">Rank</th>
                    <th className="px-4 py-6">Team</th>
                    <th className="px-4 py-6">P</th>
                    <th className="px-4 py-6">W</th>
                    <th className="px-4 py-6">L</th>
                    <th className="px-10 py-6 text-right">Pts</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                 {standings.map((s, idx) => (
                   <tr key={s.id} className={idx < 4 ? 'bg-indigo-50/20' : ''}>
                      <td className="px-10 py-6">
                         <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${idx === 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>{idx + 1}</span>
                      </td>
                      <td className="px-4 py-6 font-black text-slate-800 uppercase italic tracking-tighter">{s.name}</td>
                      <td className="px-4 py-6 font-bold text-slate-400">{s.played}</td>
                      <td className="px-4 py-6 font-black text-emerald-500">{s.won}</td>
                      <td className="px-4 py-6 font-bold text-rose-300">{s.lost}</td>
                      <td className="px-10 py-6 text-right font-black text-indigo-600 text-lg">{s.points}</td>
                   </tr>
                 ))}
              </tbody>
           </table>
        </div>
      )}

      {showPinModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[300] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl">
              <h4 className="text-2xl font-black text-slate-800 text-center mb-8 italic uppercase tracking-tighter">Match Scoring</h4>
              {!isOrganizer && (
                <div className="mb-8">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block text-center">Security PIN Required</label>
                  <input 
                    type="password" placeholder="0000" maxLength={4}
                    className="w-full p-6 bg-slate-50 rounded-3xl text-center text-4xl font-black tracking-[1em] outline-none border-2 border-transparent focus:border-indigo-500"
                    value={pinInput} onChange={e => setPinInput(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-4 mb-10">
                 {scores.map((s, i) => (
                   <div key={i} className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-black text-indigo-400 uppercase italic">Set {i+1}</span>
                      <div className="flex items-center space-x-4">
                         <input 
                           type="number" className="w-16 h-12 text-center font-black text-2xl bg-white rounded-xl shadow-inner outline-none focus:ring-2 ring-indigo-500"
                           value={s[0]} onChange={e => {
                             const ns = [...scores]; ns[i] = [parseInt(e.target.value) || 0, s[1]]; setScores(ns);
                           }}
                         />
                         <span className="font-black text-slate-300">/</span>
                         <input 
                           type="number" className="w-16 h-12 text-center font-black text-2xl bg-white rounded-xl shadow-inner outline-none focus:ring-2 ring-indigo-500"
                           value={s[1]} onChange={e => {
                             const ns = [...scores]; ns[i] = [s[0], parseInt(e.target.value) || 0]; setScores(ns);
                           }}
                         />
                      </div>
                   </div>
                 ))}
              </div>
              <div className="flex space-x-4">
                 <button onClick={handleSaveScore} className="flex-grow bg-indigo-600 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-indigo-100 active:scale-95">Verify & Post Results</button>
                 <button onClick={() => { setShowPinModal(false); setPinInput(''); }} className="px-8 font-black text-slate-400 uppercase tracking-widest text-[10px]">Back</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const TabButton = ({ active, onClick, label }: any) => (
  <button onClick={onClick} className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 scale-105' : 'text-slate-400 hover:text-slate-600 bg-white shadow-sm'}`}>{label}</button>
);

const ConfigItem = ({ label, value, onChange, options }: any) => (
  <div className="flex items-center space-x-2">
    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200">{label}</span>
    <select className="bg-indigo-500 rounded-lg p-1 font-black text-xs outline-none" value={value} onChange={e => onChange(e.target.value)}>
      {options.map((o: any) => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

export default TournamentDetails;
