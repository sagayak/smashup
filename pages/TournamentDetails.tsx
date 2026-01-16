
import React, { useState, useEffect } from 'react';
import { Tournament, Match, User, UserRole, MatchStatus, Team, TournamentPlayer, MatchScore, JoinRequest, RankingCriterion } from '../types';
import { store } from '../services/mockStore';

interface Props {
  tournament: Tournament;
  user: User;
  onBack: () => void;
}

const TournamentDetails: React.FC<Props> = ({ tournament: initialTournament, user, onBack }) => {
  const [activeTab, setActiveTab] = useState<'matches' | 'players' | 'teams' | 'standings' | 'settings' | 'requests'>('matches');
  const [tournament, setTournament] = useState<Tournament>(initialTournament);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [standings, setStandings] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [isLocked, setIsLocked] = useState(initialTournament.isLocked);
  
  // Tie-up (Match) Selection State
  const [selectedT1, setSelectedT1] = useState('');
  const [selectedT2, setSelectedT2] = useState('');

  // Scorer Modal
  const [scoringMatch, setScoringMatch] = useState<Match | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [scores, setScores] = useState<MatchScore[]>([]);

  // Players Tab State
  const [playerSearch, setPlayerSearch] = useState('');
  const [rosterFilter, setRosterFilter] = useState('');
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);

  // Team Form
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedPoolPlayers, setSelectedPoolPlayers] = useState<TournamentPlayer[]>([]);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkInput, setBulkInput] = useState('');

  // Match Config
  const [matchConfig, setMatchConfig] = useState({ points: 21, bestOf: 3, court: 1, umpire: '' });

  // Settings State
  const [tempPin, setTempPin] = useState(initialTournament.scorerPin || '0000');

  useEffect(() => { 
    if (initialTournament?.id) {
      loadData(); 
    }
  }, [initialTournament?.id]);

  useEffect(() => {
    if (teams.length >= 2) {
      const t1StillExists = teams.some(t => t.id === selectedT1);
      const t2StillExists = teams.some(t => t.id === selectedT2);
      
      if (!selectedT1 || !t1StillExists) {
        setSelectedT1(teams[0].id);
      }
      if (!selectedT2 || !t2StillExists) {
        setSelectedT2(teams[1].id);
      }
    }
  }, [teams]);

  const loadData = async () => {
    if (!initialTournament?.id) return;
    try {
      const [m, t, s, u, tourneys, jr] = await Promise.all([
        store.getMatchesByTournament(initialTournament.id),
        store.getTeams(initialTournament.id),
        store.calculateStandings(initialTournament.id),
        store.getAllUsers(),
        store.getTournaments(),
        store.getJoinRequests(initialTournament.id)
      ]);
      const updatedTourney = tourneys.find(x => x.id === initialTournament.id);
      if (updatedTourney) {
        setTournament(updatedTourney);
        setIsLocked(updatedTourney.isLocked);
        setTempPin(updatedTourney.scorerPin);
      }
      setMatches(m.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()));
      setTeams(t);
      setStandings(s);
      setAllUsers(u);
      setJoinRequests(jr);
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
    if (!tournament.isLocked) {
      alert("Tournament must be LOCKED before initializing tie-ups.");
      return;
    }
    if (!selectedT1 || !selectedT2) return alert("Please select two teams.");
    if (selectedT1 === selectedT2) return alert("A team cannot play against itself!");
    try {
      const setsCount = Math.max(1, Number(matchConfig.bestOf) || 3);
      const pointsPerSet = Number(matchConfig.points) || 21;
      const courtNumber = Number(matchConfig.court) || 1;
      const matchData: Omit<Match, 'id'> = {
        tournamentId: tournament.id,
        participants: [selectedT1, selectedT2],
        scores: Array.from({ length: setsCount }, () => ({ s1: 0, s2: 0 })),
        status: MatchStatus.SCHEDULED,
        court: courtNumber,
        startTime: new Date().toISOString(),
        pointsOption: pointsPerSet,
        bestOf: setsCount,
        umpireName: matchConfig.umpire
      };
      await store.createMatch(matchData);
      setMatchConfig({...matchConfig, umpire: ''});
      await loadData();
      alert("Tie-up initialized!");
    } catch (e: any) {
      alert(`Failed to initialize: ${e.message}`);
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

  const handleExportCSV = () => {
    if (!tournament.playerPool || tournament.playerPool.length === 0) {
      return alert("Roster is empty.");
    }
    const headers = ["Name", "Username", "Registration Status"];
    const rows = tournament.playerPool.map(p => [p.name, p.username || "N/A", p.isRegistered ? "Registered" : "Guest"]);
    const csvContent = [headers.join(","), ...rows.map(row => row.map(cell => `"${cell}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${tournament.name.replace(/\s+/g, '_')}_PlayerList.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const moveRankingCriterion = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...(tournament.rankingCriteriaOrder || [])];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    store.updateTournamentSettings(tournament.id, { rankingCriteriaOrder: newOrder }).then(loadData);
  };

  const handleUpdatePin = async () => {
    if (tempPin.length !== 4) return alert("Pin must be 4 digits.");
    await store.updateTournamentSettings(tournament.id, { scorerPin: tempPin });
    alert("Scorer Pin updated!");
    await loadData();
  };

  const handleResolveJoin = async (req: JoinRequest, approved: boolean) => {
    await store.resolveJoinRequest(req.id, tournament.id, req.username, approved);
    await loadData();
  };

  const filteredPool = tournament.playerPool?.filter(p => 
    p.name.toLowerCase().includes(rosterFilter.toLowerCase()) || 
    p.username?.toLowerCase().includes(rosterFilter.toLowerCase())
  ) || [];

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
           {isOrganizer && joinRequests.length > 0 && (
             <button onClick={() => setActiveTab('requests')} className="bg-rose-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest animate-pulse">
               {joinRequests.length} Pending Joins
             </button>
           )}
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
        {isOrganizer && <TabButton active={activeTab === 'requests'} onClick={() => setActiveTab('requests')} label="Join Requests" />}
        {isOrganizer && <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} label="Settings" />}
      </div>

      {activeTab === 'matches' && (
        <div className="space-y-6">
           {isOrganizer && (
             <div className="bg-indigo-600 p-8 rounded-[2rem] text-white shadow-xl relative overflow-hidden">
                {!isLocked && (
                  <div className="absolute inset-0 bg-indigo-900/60 backdrop-blur-[2px] z-10 flex items-center justify-center p-6 text-center">
                    <div className="bg-white/10 p-6 rounded-3xl border border-white/20">
                      <p className="font-black uppercase tracking-widest text-xs mb-2">Tie-ups Disabled</p>
                      <p className="text-[10px] font-bold opacity-80 max-w-[200px]">You must Lock the tournament (above) before matches can be initialized.</p>
                    </div>
                  </div>
                )}
                <h4 className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-6">Initialize Tie-up</h4>
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
                    disabled={!selectedT1 || !selectedT2 || selectedT1 === selectedT2 || !isLocked}
                    className="bg-white text-indigo-600 p-4 rounded-2xl font-black text-xs uppercase shadow-lg active:scale-95 transition-all disabled:opacity-50"
                  >Post Match</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-6 border-t border-indigo-400">
                  <ConfigItem label="Sets" value={matchConfig.bestOf} onChange={v => setMatchConfig({...matchConfig, bestOf: parseInt(v)})} options={[1,3,5]} />
                  <ConfigItem label="Points" value={matchConfig.points} onChange={v => setMatchConfig({...matchConfig, points: parseInt(v)})} options={[11,15,21,25,30]} />
                  <div className="flex items-center space-x-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Court</span>
                    <input type="number" className="w-12 bg-indigo-500 rounded-lg p-2 text-center font-black outline-none border border-indigo-400 focus:border-white" value={matchConfig.court} onChange={e => setMatchConfig({...matchConfig, court: parseInt(e.target.value) || 1})} />
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Umpire</span>
                    <input type="text" placeholder="Name" className="flex-1 bg-indigo-500 rounded-lg p-2 font-bold text-xs outline-none border border-indigo-400 focus:border-white" value={matchConfig.umpire} onChange={e => setMatchConfig({...matchConfig, umpire: e.target.value})} />
                  </div>
                </div>
             </div>
           )}

           <div className="grid grid-cols-1 gap-4">
             {matches.map(m => (
               <div key={m.id} className="bg-white p-6 rounded-3xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between shadow-sm group hover:border-indigo-200 transition-all gap-4">
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
                           {m.scores.map((s, i) => (
                             <div key={i} className={`flex flex-col items-center px-3 py-1 rounded-lg border ${s.s1 > s.s2 ? 'bg-emerald-50 border-emerald-100' : s.s2 > s.s1 ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                               <span className="text-[7px] font-black uppercase tracking-tighter text-slate-400 mb-0.5">SET {i+1}</span>
                               <span className="text-xs font-mono font-black">{s.s1}-{s.s2}</span>
                             </div>
                           ))}
                        </div>
                     </div>
                  </div>
                  <div className="flex items-center space-x-4 border-t md:border-t-0 pt-4 md:pt-0">
                    <div className="text-right">
                      <span className={`text-[9px] font-black uppercase tracking-widest block ${m.status === MatchStatus.COMPLETED ? 'text-slate-400' : 'text-emerald-500 animate-pulse'}`}>{m.status}</span>
                      {m.umpireName && <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Umpire: {m.umpireName}</span>}
                    </div>
                    {m.status !== MatchStatus.COMPLETED && (
                      <button 
                        onClick={() => { setScoringMatch(m); setScores(m.scores); setShowPinModal(true); }}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 active:scale-95 transition-all"
                      >Open Board</button>
                    )}
                  </div>
               </div>
             ))}
             {matches.length === 0 && <div className="text-center py-24 bg-white rounded-[2rem] border border-dashed border-slate-200"><p className="text-slate-400 font-black uppercase tracking-widest text-xs">No active tie-ups found.</p></div>}
           </div>
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {joinRequests.map(req => (
             <div key={req.id} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm animate-in zoom-in">
                <div className="flex justify-between items-start mb-6">
                   <div>
                      <h4 className="font-black text-slate-800 uppercase tracking-tighter italic">{req.name}</h4>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">@{req.username}</p>
                   </div>
                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(req.timestamp).toLocaleDateString()}</div>
                </div>
                <div className="flex space-x-3">
                   <button onClick={() => handleResolveJoin(req, true)} className="flex-1 bg-emerald-500 text-white font-black py-3 rounded-xl uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-100">Approve</button>
                   <button onClick={() => handleResolveJoin(req, false)} className="flex-1 bg-rose-50 text-rose-500 font-black py-3 rounded-xl uppercase tracking-widest text-[10px]">Reject</button>
                </div>
             </div>
           ))}
           {joinRequests.length === 0 && <div className="col-span-full py-20 text-center text-slate-300 font-black uppercase tracking-widest text-xs bg-white rounded-[2rem] border border-dashed border-slate-200">No pending join requests.</div>}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Ranking Criteria Order</h4>
              <p className="text-[10px] text-slate-400 mb-6 italic">Determines standings placement in case of ties. Top is highest priority.</p>
              <div className="space-y-2">
                 {(tournament.rankingCriteriaOrder || []).map((criterion, idx) => (
                   <div key={criterion} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center space-x-3">
                         <span className="w-6 h-6 bg-indigo-600 text-white flex items-center justify-center rounded-lg font-black text-[10px]">{idx + 1}</span>
                         <span className="text-[11px] font-black uppercase tracking-widest text-slate-700">{criterion.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="flex space-x-1">
                         <button onClick={() => moveRankingCriterion(idx, 'up')} className="p-2 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-30" disabled={idx === 0}>↑</button>
                         <button onClick={() => moveRankingCriterion(idx, 'down')} className="p-2 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-30" disabled={idx === (tournament.rankingCriteriaOrder?.length || 0) - 1}>↓</button>
                      </div>
                   </div>
                 ))}
              </div>
           </div>

           <div className="space-y-6">
              <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Security & Privacy</h4>
                 <div className="space-y-6">
                    <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Active Scorer PIN</label>
                       <div className="flex space-x-2">
                          <input 
                            type="password" maxLength={4}
                            className="flex-1 p-4 bg-slate-50 rounded-2xl text-center text-2xl font-black tracking-[0.5em] outline-none border-2 border-transparent focus:border-indigo-500"
                            value={tempPin} onChange={e => setTempPin(e.target.value)}
                          />
                          <button onClick={handleUpdatePin} className="bg-slate-900 text-white px-6 rounded-2xl font-black uppercase text-[10px]">Update</button>
                       </div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                       <span className="text-[10px] font-black uppercase text-indigo-600">Privacy Status</span>
                       <select 
                         className="bg-transparent font-black uppercase text-[10px] outline-none text-indigo-700"
                         value={tournament.isPublic ? 'true' : 'false'}
                         onChange={e => store.updateTournamentSettings(tournament.id, { isPublic: e.target.value === 'true' }).then(loadData)}
                       >
                         <option value="true">PUBLIC</option>
                         <option value="false">PROTECTED</option>
                       </select>
                    </div>
                 </div>
              </div>
              <div className="bg-rose-50 p-8 rounded-[2rem] border border-rose-100">
                 <h4 className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-4 italic">Danger Zone</h4>
                 <button 
                  onClick={() => window.confirm("Delete tournament?") && store.updateTournamentSettings(tournament.id, { status: 'FINISHED' }).then(onBack)}
                  className="w-full bg-white text-rose-500 border border-rose-200 font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] shadow-sm hover:bg-rose-500 hover:text-white transition-all"
                 >Delete Arena Forever</button>
              </div>
           </div>
        </div>
      )}

      {/* Existing Players and Teams Tabs ... Keep their functionality intact but adjust UI if needed */}
      {activeTab === 'players' && (
        <div className="space-y-6">
           {isOrganizer && !isLocked && (
             <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Add Player to Roster</h4>
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
             </div>
           )}

           <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/50 p-4 rounded-[2rem] border border-slate-100">
             <div className="px-4 flex items-center space-x-6">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Roster List ({filteredPool.length})</h4>
               <button 
                onClick={handleExportCSV}
                className="text-[9px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest flex items-center space-x-1 border border-indigo-200 bg-indigo-50/50 px-3 py-1.5 rounded-lg transition-colors"
               >
                 <span>Export CSV</span>
               </button>
             </div>
             <div className="relative w-full md:w-80">
               <input 
                 type="text" 
                 placeholder="Search roster..." 
                 className="w-full p-4 pl-12 bg-white border border-slate-200 rounded-2xl shadow-sm outline-none focus:border-indigo-500 font-bold text-xs"
                 value={rosterFilter}
                 onChange={(e) => setRosterFilter(e.target.value)}
               />
               <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
             </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredPool.map((p, i) => (
                <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm group hover:border-indigo-200 transition-all animate-in fade-in slide-in-from-bottom-2">
                   <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${p.isRegistered ? 'bg-indigo-50 text-indigo-500' : 'bg-slate-100 text-slate-400'}`}>
                        {p.name[0]}
                      </div>
                      <div>
                        <p className="font-black text-slate-800 text-sm uppercase tracking-tight">{p.name}</p>
                        {p.username && <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">@{p.username}</p>}
                      </div>
                   </div>
                </div>
              ))}
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
                     <button onClick={() => setIsBulkOpen(!isBulkOpen)} className="text-indigo-600 hover:underline">{isBulkOpen ? 'Individual Entry' : 'Bulk Import'}</button>
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
                            </div>
                          </div>
                        </div>
                        <button onClick={handleCreateTeam} className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all">Create Team</button>
                     </div>
                   ) : (
                     <div className="space-y-4">
                        <textarea 
                          placeholder="Team Name, Player 1, Player 2"
                          className="w-full h-48 p-6 bg-slate-50 rounded-2xl font-mono text-xs border-2 border-transparent focus:border-indigo-500 outline-none"
                          value={bulkInput} onChange={e => setBulkInput(e.target.value)}
                        />
                        <button onClick={handleBulkImport} className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-indigo-100">Process Bulk Import</button>
                     </div>
                   )}
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
                    <th className="px-4 py-6 text-center">Played</th>
                    <th className="px-4 py-6 text-center">W-L</th>
                    <th className="px-4 py-6 text-center">Sets</th>
                    <th className="px-4 py-6 text-center">+/- Pts</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                 {standings.map((s, idx) => (
                   <tr key={s.id} className={idx < 4 ? 'bg-indigo-50/20' : ''}>
                      <td className="px-10 py-6">
                         <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${idx === 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>{idx + 1}</span>
                      </td>
                      <td className="px-4 py-6 font-black text-slate-800 uppercase italic tracking-tighter">{s.name}</td>
                      <td className="px-4 py-6 text-center font-bold text-slate-400">{s.played}</td>
                      <td className="px-4 py-6 text-center font-black text-emerald-500">{s.matchesWon}-{s.played - s.matchesWon}</td>
                      <td className="px-4 py-6 text-center font-bold text-slate-400">{s.setsWon}</td>
                      <td className="px-4 py-6 text-center font-black text-indigo-600">{s.pointsScored - s.pointsConceded}</td>
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
                  <p className="text-[8px] text-center text-slate-400 mb-4 font-bold uppercase tracking-widest italic animate-pulse">Hint: Check with Organizer for the 4-digit code</p>
                  <input 
                    type="password" placeholder="••••" maxLength={4}
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
                           type="number" className={`w-16 h-12 text-center font-black text-2xl bg-white rounded-xl shadow-inner outline-none focus:ring-2 ring-indigo-500 ${s.s1 > s.s2 ? 'border-2 border-emerald-500' : ''}`}
                           value={s.s1} onChange={e => {
                             const ns = [...scores]; ns[i] = { s1: parseInt(e.target.value) || 0, s2: s.s2 }; setScores(ns);
                           }}
                         />
                         <span className="font-black text-slate-300">/</span>
                         <input 
                           type="number" className={`w-16 h-12 text-center font-black text-2xl bg-white rounded-xl shadow-inner outline-none focus:ring-2 ring-indigo-500 ${s.s2 > s.s1 ? 'border-2 border-emerald-500' : ''}`}
                           value={s.s2} onChange={e => {
                             const ns = [...scores]; ns[i] = { s1: s.s1, s2: parseInt(e.target.value) || 0 }; setScores(ns);
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

const Input = ({ label, value, onChange, placeholder, type = "text", maxLength }: any) => (
  <div className="space-y-1">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
    <input 
      type={type} 
      maxLength={maxLength}
      placeholder={placeholder} 
      className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:bg-white outline-none font-bold transition-all"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

export default TournamentDetails;
