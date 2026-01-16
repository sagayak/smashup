
import React, { useState, useEffect } from 'react';
import { Tournament, Match, User, UserRole, MatchStatus, Team, TournamentPlayer } from '../types';
import { store } from '../services/mockStore';

interface Props {
  tournament: Tournament;
  user: User;
  onBack: () => void;
}

const TournamentDetails: React.FC<Props> = ({ tournament: initialTournament, user, onBack }) => {
  const [activeTab, setActiveTab] = useState<'matches' | 'players' | 'teams' | 'standings' | 'settings'>('matches');
  const [tournament, setTournament] = useState<Tournament>(initialTournament);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [standings, setStandings] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLocked, setIsLocked] = useState(initialTournament.isLocked);
  
  // Tie-up (Match) Selection State
  const [selectedT1, setSelectedT1] = useState('');
  const [selectedT2, setSelectedT2] = useState('');

  // Scorer Modal
  const [scoringMatch, setScoringMatch] = useState<Match | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [scores, setScores] = useState<number[][]>([[0, 0], [0, 0], [0, 0]]);

  // Players Tab State
  const [playerSearch, setPlayerSearch] = useState('');
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);

  // Team Form
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedPoolPlayers, setSelectedPoolPlayers] = useState<TournamentPlayer[]>([]);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkInput, setBulkInput] = useState('');

  // Match Config
  const [matchConfig, setMatchConfig] = useState({ points: 21, bestOf: 3, court: 1 });

  useEffect(() => { loadData(); }, [initialTournament.id]);

  // Sync teams selection when teams list loads
  useEffect(() => {
    if (teams.length >= 2) {
      if (!selectedT1 || !teams.find(t => t.id === selectedT1)) {
        setSelectedT1(teams[0].id);
      }
      if (!selectedT2 || !teams.find(t => t.id === selectedT2)) {
        setSelectedT2(teams[1].id);
      }
    }
  }, [teams]);

  const loadData = async () => {
    try {
      const [m, t, s, u, tourneys] = await Promise.all([
        store.getMatchesByTournament(initialTournament.id),
        store.getTeams(initialTournament.id),
        store.calculateStandings(initialTournament.id),
        store.getAllUsers(),
        store.getTournaments()
      ]);
      const updatedTourney = tourneys.find(x => x.id === initialTournament.id);
      if (updatedTourney) {
        setTournament(updatedTourney);
        setIsLocked(updatedTourney.isLocked);
      }
      setMatches(m.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()));
      setTeams(t);
      setStandings(s);
      setAllUsers(u);
    } catch (err) {
      console.error("Error loading tournament data:", err);
    }
  };

  const isOrganizer = user.id === tournament.organizerId || user.role === UserRole.SUPERADMIN;

  const handleAddToPool = async () => {
    if (!playerSearch) return;
    setIsAddingPlayer(true);
    try {
      const found = await store.getUserByUsername(playerSearch);
      const newEntry: TournamentPlayer = found 
        ? { id: found.id, name: found.name, username: found.username, isRegistered: true }
        : { name: playerSearch, isRegistered: false };
      
      const newPool = [...(tournament.playerPool || []), newEntry];
      await store.updateTournamentPool(tournament.id, newPool);
      setPlayerSearch('');
      await loadData();
    } catch (err) {
      console.error("Error adding to pool:", err);
    } finally {
      setIsAddingPlayer(false);
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeamName || selectedPoolPlayers.length === 0) return;
    
    try {
      const playerIds = selectedPoolPlayers.filter(p => p.id).map(p => p.id!);
      const customNames = selectedPoolPlayers.filter(p => !p.id).map(p => p.name);
      
      await store.addTeam({ 
        tournamentId: tournament.id, 
        name: newTeamName, 
        playerIds, 
        customPlayerNames: customNames 
      });
      setNewTeamName('');
      setSelectedPoolPlayers([]);
      await loadData();
    } catch (err) {
      console.error("Error creating team:", err);
    }
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
        const cleaned = name.replace('@', '').toLowerCase();
        const found = allUsers.find(u => u.username.toLowerCase() === cleaned || u.name.toLowerCase() === name.toLowerCase());
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
    if (!window.confirm("WARNING: Teams and Player Pool cannot be edited after lock. Proceed?")) return;
    try {
      await store.lockTournament(tournament.id);
      await loadData();
    } catch (err) {
      console.error("Error locking tournament:", err);
    }
  };

  const handleStartMatch = async () => {
    if (!selectedT1 || !selectedT2) return alert("Please select two teams for the tie-up.");
    if (selectedT1 === selectedT2) return alert("A team cannot play against itself!");
    
    try {
      const setsCount = Number(matchConfig.bestOf) || 3;
      await store.createMatch({
        tournamentId: tournament.id,
        participants: [selectedT1, selectedT2],
        scores: Array(setsCount).fill(null).map(() => [0, 0]),
        status: MatchStatus.SCHEDULED,
        court: Number(matchConfig.court) || 1,
        startTime: new Date().toISOString(),
        pointsOption: Number(matchConfig.points) || 21,
        bestOf: setsCount
      });
      await loadData();
      alert("Tie-up initialized successfully!");
    } catch (e) {
      console.error("Match creation failed:", e);
      alert("Failed to initialize tie-up. Check console for details.");
    }
  };

  const handleSaveScore = async () => {
    if (scoringMatch) {
      if (pinInput !== tournament.scorerPin && !isOrganizer) return alert("Invalid Scorer PIN");
      try {
        await store.updateMatchScore(scoringMatch.id, scores, scoringMatch.participants);
        setScoringMatch(null);
        setShowPinModal(false);
        setPinInput('');
        await loadData();
      } catch (err) {
        console.error("Error saving score:", err);
      }
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
            <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">ID: {tournament.uniqueId} • {tournament.venue} • {isLocked ? 'LOCKED' : 'DRAFT'}</p>
          </div>
        </div>
        <div className="flex space-x-2">
           {isOrganizer && !isLocked && (
             <button onClick={handleLock} className="bg-slate-900 text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">Lock Tournament</button>
           )}
           <div className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center">{tournament.status}</div>
        </div>
      </div>

      <div className="flex space-x-2 overflow-x-auto pb-2 no-scrollbar">
        <TabButton active={activeTab === 'matches'} onClick={() => setActiveTab('matches')} label="Tie-ups" />
        <TabButton active={activeTab === 'players'} onClick={() => setActiveTab('players')} label="Players" />
        <TabButton active={activeTab === 'teams'} onClick={() => setActiveTab('teams')} label="Teams" />
        <TabButton active={activeTab === 'standings'} onClick={() => setActiveTab('standings')} label="Standings" />
        {isOrganizer && <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} label="Settings" />}
      </div>

      {activeTab === 'matches' && (
        <div className="space-y-6">
           {isOrganizer && (
             <div className="bg-indigo-600 p-8 rounded-[2rem] text-white shadow-xl">
                <h4 className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-6">Create New Tie-up</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <select 
                    value={selectedT1}
                    onChange={(e) => setSelectedT1(e.target.value)}
                    className="p-4 bg-indigo-500 rounded-2xl font-black text-xs uppercase outline-none focus:ring-2 ring-white"
                  >
                    <option value="">Select Team A</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <div className="flex items-center justify-center font-black italic text-2xl">VS</div>
                  <select 
                    value={selectedT2}
                    onChange={(e) => setSelectedT2(e.target.value)}
                    className="p-4 bg-indigo-500 rounded-2xl font-black text-xs uppercase outline-none focus:ring-2 ring-white"
                  >
                    <option value="">Select Team B</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <button 
                    onClick={handleStartMatch}
                    disabled={!selectedT1 || !selectedT2 || selectedT1 === selectedT2}
                    className="bg-white text-indigo-600 p-4 rounded-2xl font-black text-xs uppercase shadow-lg active:scale-95 transition-all disabled:opacity-50"
                  >Initialize Match</button>
                </div>
                <div className="flex flex-wrap gap-6 pt-4 border-t border-indigo-400">
                  <ConfigItem label="Sets" value={matchConfig.bestOf} onChange={v => setMatchConfig({...matchConfig, bestOf: parseInt(v)})} options={[1,3,5]} />
                  <ConfigItem label="Points" value={matchConfig.points} onChange={v => setMatchConfig({...matchConfig, points: parseInt(v)})} options={[11,15,21,25,30]} />
                  <div className="flex items-center space-x-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Court No.</span>
                    <input type="number" className="w-16 bg-indigo-500 rounded-lg p-2 text-center font-black outline-none border border-indigo-400 focus:border-white" value={matchConfig.court} onChange={e => setMatchConfig({...matchConfig, court: parseInt(e.target.value) || 1})} />
                  </div>
                </div>
             </div>
           )}

           <div className="grid grid-cols-1 gap-4">
             {matches.map(m => (
               <div key={m.id} className="bg-white p-6 rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm group hover:border-indigo-200 transition-all">
                  <div className="flex items-center space-x-6">
                     <div className="text-center w-12 border-r border-slate-100 pr-6">
                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">CRT</p>
                        <p className="text-2xl font-black text-slate-800">{m.court}</p>
                     </div>
                     <div>
                        <div className="flex items-center space-x-3 mb-2">
                          <p className="font-black text-slate-800 text-lg uppercase italic tracking-tighter">
                            {teams.find(t => t.id === m.participants[0])?.name || '---'} 
                            <span className="text-slate-200 mx-3 lowercase font-medium not-italic">vs</span> 
                            {teams.find(t => t.id === m.participants[1])?.name || '---'}
                          </p>
                          <span className="bg-slate-50 px-2 py-0.5 rounded text-[8px] font-black text-slate-400 uppercase tracking-widest">{m.bestOf} Sets • {m.pointsOption} Pts</span>
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
                      >Open Scoreboard</button>
                    )}
                  </div>
               </div>
             ))}
             {matches.length === 0 && <div className="text-center py-24 bg-white rounded-[2rem] border border-dashed border-slate-200"><p className="text-slate-400 font-black uppercase tracking-widest text-xs">No active tie-ups found.</p></div>}
           </div>
        </div>
      )}

      {activeTab === 'players' && (
        <div className="space-y-6">
           {isOrganizer && !isLocked && (
             <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Add Player to Tournament Roster</h4>
                <div className="flex gap-4">
                   <input 
                     type="text" 
                     placeholder="Enter @username or Full Name" 
                     className="flex-1 p-4 bg-slate-50 rounded-2xl font-bold border-2 border-transparent focus:border-indigo-500 outline-none"
                     value={playerSearch}
                     onChange={(e) => setPlayerSearch(e.target.value)}
                     onKeyPress={(e) => e.key === 'Enter' && handleAddToPool()}
                   />
                   <button 
                    onClick={handleAddToPool}
                    disabled={isAddingPlayer || !playerSearch}
                    className="bg-slate-900 text-white px-8 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50"
                   >
                     {isAddingPlayer ? 'Adding...' : 'Add to Pool'}
                   </button>
                </div>
                <p className="mt-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest">Players in the pool can be tied to teams in the Teams tab.</p>
             </div>
           )}

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {tournament.playerPool?.map((p, i) => (
                <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm group">
                   <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${p.isRegistered ? 'bg-indigo-50 text-indigo-500' : 'bg-slate-100 text-slate-400'}`}>
                        {p.name[0]}
                      </div>
                      <div>
                        <p className="font-black text-slate-800 text-sm uppercase tracking-tight">{p.name}</p>
                        {p.username && <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">@{p.username}</p>}
                        {!p.isRegistered && <p className="text-[8px] text-orange-400 font-black uppercase tracking-widest">Unregistered Guest</p>}
                      </div>
                   </div>
                </div>
              ))}
              {(!tournament.playerPool || tournament.playerPool.length === 0) && (
                <div className="col-span-full py-12 text-center text-slate-300 font-black uppercase tracking-widest text-xs">No players in roster.</div>
              )}
           </div>
        </div>
      )}

      {activeTab === 'teams' && (
        <div className="space-y-6">
           {isOrganizer && !isLocked && (
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex justify-between">
                     <span>Team Configuration</span>
                     <button onClick={() => setIsBulkOpen(!isBulkOpen)} className="text-indigo-600 hover:underline">{isBulkOpen ? 'Individual Entry' : 'Bulk Import Format'}</button>
                   </h4>
                   
                   {!isBulkOpen ? (
                     <div className="space-y-6">
                        <div className="space-y-4">
                          <Input label="Team Name" value={newTeamName} onChange={setNewTeamName} placeholder="e.g. Red Dragons" />
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Players from Roster</label>
                            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-2xl">
                               {tournament.playerPool?.map((p, i) => {
                                 const isSelected = selectedPoolPlayers.some(sp => sp.name === p.name);
                                 return (
                                   <button 
                                    key={i}
                                    onClick={() => {
                                      if (isSelected) setSelectedPoolPlayers(selectedPoolPlayers.filter(sp => sp.name !== p.name));
                                      else setSelectedPoolPlayers([...selectedPoolPlayers, p]);
                                    }}
                                    className={`p-3 rounded-xl text-left transition-all flex items-center space-x-2 border-2 ${isSelected ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-100 hover:border-indigo-200'}`}
                                   >
                                      <span className="font-bold text-xs">{p.name}</span>
                                   </button>
                                 );
                               })}
                               {(!tournament.playerPool || tournament.playerPool.length === 0) && <p className="col-span-2 text-center text-[10px] py-4 text-slate-400 uppercase font-black">Roster is empty. Add players in Players tab first.</p>}
                            </div>
                          </div>
                        </div>
                        <button onClick={handleCreateTeam} className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all">Create Team</button>
                     </div>
                   ) : (
                     <div className="space-y-4">
                        <textarea 
                          placeholder="Format: Team Name, Player 1, Player 2&#10;Ex: Smashers, @pro_player, John Doe&#10;Ex: Eagles, @mike, @sara"
                          className="w-full h-48 p-6 bg-slate-50 rounded-2xl font-mono text-xs border-2 border-transparent focus:border-indigo-500 outline-none"
                          value={bulkInput} onChange={e => setBulkInput(e.target.value)}
                        />
                        <button onClick={handleBulkImport} className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-indigo-100">Process Bulk Import</button>
                     </div>
                   )}
                </div>
                <div className="bg-slate-900 p-8 rounded-[2rem] text-white shadow-xl">
                   <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 italic">Management Guide</h4>
                   <p className="text-slate-400 text-sm leading-relaxed mb-4">
                     1. <span className="text-white font-black">Pool:</span> Add players to the tournament pool first.
                   </p>
                   <p className="text-slate-400 text-sm leading-relaxed mb-4">
                     2. <span className="text-white font-black">Tie:</span> Tie players from the pool to specific teams.
                   </p>
                   <p className="text-slate-400 text-sm leading-relaxed">
                     3. <span className="text-white font-black">Bulk:</span> Use comma-separated values to add many teams at once.
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
              <h4 className="text-2xl font-black text-slate-800 text-center mb-8 italic uppercase tracking-tighter">Live Scoreboard</h4>
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
                 <button onClick={handleSaveScore} className="flex-grow bg-indigo-600 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-indigo-100 active:scale-95">Post Results</button>
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
    <select className="bg-indigo-500 rounded-lg p-2 font-black text-xs outline-none cursor-pointer border border-indigo-400 hover:border-white transition-colors" value={value} onChange={e => onChange(e.target.value)}>
      {options.map((o: any) => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

const Input = ({ label, value, onChange, placeholder, type = "text" }: any) => (
  <div className="space-y-1">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
    <input 
      type={type} 
      placeholder={placeholder} 
      className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:bg-white outline-none font-bold transition-all"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

export default TournamentDetails;
