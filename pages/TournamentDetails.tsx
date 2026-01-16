import React, { useState, useEffect, useMemo } from 'react';
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
  const [isJoining, setIsJoining] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  
  // Scoring State
  const [scoringMatch, setScoringMatch] = useState<Match | null>(null);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [currentScores, setCurrentScores] = useState<MatchScore[]>([]);
  const [activeSetIndex, setActiveSetIndex] = useState(0);
  const [isSwapped, setIsSwapped] = useState(false);
  const [pinEntry, setPinEntry] = useState('');

  // Form State
  const [selectedT1, setSelectedT1] = useState('');
  const [selectedT2, setSelectedT2] = useState('');
  const [playerSearch, setPlayerSearch] = useState('');
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [bulkPlayerInput, setBulkPlayerInput] = useState('');
  const [showPlayerImport, setShowPlayerImport] = useState(false);

  // Teams Tab State
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedPoolPlayers, setSelectedPoolPlayers] = useState<string[]>([]);
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);

  // Match Form State
  const [matchConfig, setMatchConfig] = useState({ 
    points: 21, 
    customPoints: '',
    bestOf: 3, 
    court: 1, 
    umpire: '',
    scheduleDate: new Date().toISOString().split('T')[0],
    scheduleTime: '12:00'
  });
  
  const [tempPin, setTempPin] = useState(initialTournament.scorerPin || '0000');

  useEffect(() => { 
    if (initialTournament?.id) { loadData(); }
  }, [initialTournament?.id]);

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
      setMatches(m.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
      setTeams(t);
      setStandings(s);
      setAllUsers(u);
      setJoinRequests(jr);
    } catch (err) {
      console.error("Error loading tournament data:", err);
    }
  };

  const isMember = (tournament.participants || []).includes(user.username) || tournament.organizerId === user.id || user.role === UserRole.SUPERADMIN;
  const isOrganizer = user.id === tournament.organizerId || user.role === UserRole.SUPERADMIN;
  const filteredPool = useMemo(() => tournament.playerPool || [], [tournament.playerPool]);

  const format12h = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', { 
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true 
    });
  };

  // --- SCORING LOGIC ---
  const handleOpenScoreboard = (match: Match) => {
    setScoringMatch(match);
    setCurrentScores(match.scores.length > 0 ? [...match.scores] : Array.from({ length: match.bestOf }, () => ({ s1: 0, s2: 0 })));
    setActiveSetIndex(0);
    setShowScoreboard(true);
    setPinEntry('');
  };

  const handleUpdateScore = (setIdx: number, side: 1 | 2, delta: number) => {
    const newScores = [...currentScores];
    if (side === 1) newScores[setIdx].s1 = Math.max(0, newScores[setIdx].s1 + delta);
    else newScores[setIdx].s2 = Math.max(0, newScores[setIdx].s2 + delta);
    setCurrentScores(newScores);
  };

  const handleUndoScore = () => {
    alert("Undo action recorded.");
  };

  const handleSaveScore = async () => {
    if (!scoringMatch) return;
    const isOwner = user.id === tournament.organizerId || user.role === UserRole.SUPERADMIN;
    if (!isOwner && pinEntry !== tournament.scorerPin) {
      return alert("Invalid Scorer PIN. Access Denied.");
    }

    try {
      await store.updateMatchScore(scoringMatch.id, currentScores, scoringMatch.participants);
      setShowScoreboard(false);
      await loadData();
    } catch (err) { alert("Failed to save scores."); }
  };

  // --- ROSTER LOGIC ---
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
    } catch (err) { alert("Failed to add player."); }
    finally { setIsAddingPlayer(false); }
  };

  const handleBulkPlayerImport = async () => {
    if (!bulkPlayerInput) return;
    setIsAddingPlayer(true);
    try {
      const lines = bulkPlayerInput.split('\n').filter(l => l.trim());
      const newPool = [...(tournament.playerPool || [])];
      for (const line of lines) {
        const parts = line.split(',').map(p => p.trim());
        const name = parts[0];
        const username = parts[1]?.replace('@', '');
        let foundUser = username ? await store.getUserByUsername(username) : null;
        newPool.push(foundUser 
          ? { id: foundUser.id, name: foundUser.name, username: foundUser.username, isRegistered: true }
          : { name, username, isRegistered: false });
      }
      await store.updateTournamentPool(tournament.id, newPool);
      setBulkPlayerInput(''); setShowPlayerImport(false); await loadData();
    } catch (err) { alert("Import failed."); }
    finally { setIsAddingPlayer(false); }
  };

  const handleDeletePlayerFromPool = async (index: number) => {
    if (!window.confirm("Remove player from roster?")) return;
    const newPool = [...(tournament.playerPool || [])];
    newPool.splice(index, 1);
    await store.updateTournamentPool(tournament.id, newPool);
    await loadData();
  };

  const exportRosterToCSV = () => {
    const headers = ['Name', 'Username', 'Status'];
    const rows = filteredPool.map(p => [p.name, p.username || 'Guest', p.isRegistered ? 'Registered' : 'Manual']);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${tournament.name}_Roster.csv`; a.click();
  };

  const exportRosterToTXT = () => {
    const content = filteredPool.map(p => `${p.name} (@${p.username || 'guest'})`).join("\n");
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${tournament.name}_Roster.txt`; a.click();
  };

  // --- TEAM LOGIC ---
  const handleCreateTeam = async () => {
    if (!newTeamName) return alert("Team name required.");
    setIsCreatingTeam(true);
    try {
      await store.addTeam({ 
        tournamentId: tournament.id, 
        name: newTeamName, 
        playerIds: [], 
        customPlayerNames: selectedPoolPlayers 
      });
      setNewTeamName(''); setSelectedPoolPlayers([]); await loadData();
    } finally { setIsCreatingTeam(false); }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!window.confirm("Delete this team permanently?")) return;
    await store.deleteTeam(teamId);
    setActiveTeamId(null);
    await loadData();
  };

  const handleLock = async () => {
    if (!window.confirm("Locking the arena will allow match scheduling. Proceed?")) return;
    await store.lockTournament(tournament.id);
    setIsLocked(true); await loadData();
  };

  const handleStartMatch = async () => {
    if (!tournament.isLocked) return alert("Tournament must be LOCKED first.");
    if (!selectedT1 || !selectedT2 || selectedT1 === selectedT2) return alert("Select two different teams.");
    const finalPoints = matchConfig.points === 0 ? parseInt(matchConfig.customPoints) : matchConfig.points;
    if (isNaN(finalPoints)) return alert("Invalid points configuration.");

    const scheduledDateTime = new Date(`${matchConfig.scheduleDate}T${matchConfig.scheduleTime}`).toISOString();
    try {
      await store.createMatch({
        tournamentId: tournament.id,
        participants: [selectedT1, selectedT2],
        scores: Array.from({ length: matchConfig.bestOf }, () => ({ s1: 0, s2: 0 })),
        status: MatchStatus.SCHEDULED,
        court: matchConfig.court,
        startTime: scheduledDateTime,
        pointsOption: finalPoints,
        bestOf: matchConfig.bestOf,
        umpireName: matchConfig.umpire
      });
      alert("Match Posted to Schedule!");
      setSelectedT1('');
      setSelectedT2('');
      await loadData();
    } catch (e: any) { alert(e.message); }
  };

  const handleUpdatePin = async () => {
    if (tempPin.length !== 4) return alert("PIN must be 4 digits.");
    await store.updateTournamentSettings(tournament.id, { scorerPin: tempPin });
    alert("PIN updated successfully.");
    await loadData();
  };

  const handleReorderCriteria = async (index: number, direction: 'up' | 'down') => {
    const newCriteria = [...(tournament.rankingCriteriaOrder || ['MATCHES_WON', 'SETS_WON', 'POINTS_DIFF', 'HEAD_TO_HEAD'])];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newCriteria.length) return;
    
    [newCriteria[index], newCriteria[targetIndex]] = [newCriteria[targetIndex], newCriteria[index]];
    await store.updateTournamentSettings(tournament.id, { rankingCriteriaOrder: newCriteria as RankingCriterion[] });
    await loadData();
  };

  const handleDeleteArena = async () => {
    if (!window.confirm("PERMANENT ACTION: Delete this tournament and all its data?")) return;
    await store.deleteTournament(tournament.id);
    onBack();
  };

  const handleResolveJoinRequest = async (id: string, username: string, approved: boolean) => {
    setProcessingRequestId(id);
    try {
      await store.resolveJoinRequest(id, tournament.id, username, approved);
      await loadData();
    } catch (err) {
      alert("Action failed. Try again.");
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleJoinAction = async () => {
    setIsJoining(true);
    try {
      if (tournament.isPublic) { 
        await store.joinTournament(tournament.id, user); 
        alert("Joined Arena!"); 
      }
      else { 
        await store.requestJoinTournament(tournament.id, user); 
        alert("Join Request Sent!"); 
      }
      await loadData();
    } catch (e: any) {
      alert(e.message);
    } finally { 
      setIsJoining(false); 
    }
  };

  // --- ACCESS GUARD ---
  if (!isMember) {
    return (
      <div className="flex flex-col items-center justify-center py-24 animate-in fade-in zoom-in bg-white rounded-[3rem] shadow-sm border border-slate-100">
        <div className="w-40 h-40 bg-rose-50 rounded-[3rem] flex items-center justify-center mb-10 shadow-inner border border-rose-100">
           <svg className="w-20 h-20 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        </div>
        <h3 className="text-5xl font-black text-slate-800 uppercase italic tracking-tighter mb-4 text-center px-4">Arena Protected</h3>
        <p className="max-w-md text-center text-slate-400 font-bold leading-relaxed mb-12 px-8 text-lg">Join this arena to see match results and standings.</p>
        <button onClick={handleJoinAction} disabled={isJoining} className="bg-indigo-600 text-white px-12 py-6 rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-2xl hover:scale-[1.03] transition-all">
          {isJoining ? 'Processing...' : (tournament.isPublic ? 'Join Arena' : 'Request Entry')}
        </button>
        <button onClick={onBack} className="mt-6 text-slate-400 font-black uppercase tracking-widest text-[11px]">Back to Lobby</button>
      </div>
    );
  }

  const selectedTeam = teams.find(t => t.id === activeTeamId);
  const selectedTeamMatches = activeTeamId ? matches.filter(m => m.participants.includes(activeTeamId)) : [];
  const selectedTeamUpcoming = selectedTeamMatches.filter(m => m.status !== MatchStatus.COMPLETED);
  const selectedTeamHistory = selectedTeamMatches.filter(m => m.status === MatchStatus.COMPLETED);

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <button onClick={onBack} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm border border-slate-100 bg-white hover:scale-110 active:scale-90"><svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></button>
          <div>
            <h2 className="text-4xl font-black text-slate-800 tracking-tight italic uppercase leading-none">{tournament.name}</h2>
            <p className="text-slate-400 font-black uppercase tracking-widest text-[10px] mt-2 italic">ID: {tournament.uniqueId} • {tournament.venue}</p>
          </div>
        </div>
        <div className="flex space-x-3">
          {isOrganizer && !isLocked && <button onClick={handleLock} className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl">Lock Arena</button>}
          <div className="bg-white border border-slate-100 text-slate-800 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm italic">{tournament.status}</div>
        </div>
      </div>

      <div className="flex space-x-2 overflow-x-auto pb-2 no-scrollbar scroll-smooth">
        <TabButton active={activeTab === 'matches'} onClick={() => setActiveTab('matches')} label="Matches" />
        <TabButton active={activeTab === 'players'} onClick={() => setActiveTab('players')} label="Roster" />
        <TabButton active={activeTab === 'teams'} onClick={() => setActiveTab('teams')} label="Teams" />
        <TabButton active={activeTab === 'standings'} onClick={() => setActiveTab('standings')} label="Standings" />
        {isOrganizer && <TabButton active={activeTab === 'requests'} onClick={() => setActiveTab('requests')} label="Requests" />}
        {isOrganizer && <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} label="Settings" />}
      </div>

      {activeTab === 'matches' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4">
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center">
              <h4 className="text-xl font-black text-slate-800 uppercase italic">Match Schedule</h4>
              <button onClick={() => {}} className="bg-slate-50 text-slate-500 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase border border-slate-100">Export Results</button>
            </div>
            <table className="w-full text-left">
              <thead className="bg-slate-50/50">
                <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-8 py-4">SEQ</th>
                  <th className="px-8 py-4">Schedule (12h)</th>
                  <th className="px-8 py-4">Tie-Up</th>
                  <th className="px-8 py-4">Umpire</th>
                  <th className="px-8 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {matches.map((m, idx) => (
                  <tr key={m.id} className="hover:bg-indigo-50/20">
                    <td className="px-8 py-6 font-black text-slate-300">#{idx+1}</td>
                    <td className="px-8 py-6 font-bold text-slate-600 text-[11px] whitespace-nowrap">{format12h(m.startTime)}</td>
                    <td className="px-8 py-6 font-black text-slate-800 uppercase italic text-sm">
                      {teams.find(t => t.id === m.participants[0])?.name} vs {teams.find(t => t.id === m.participants[1])?.name}
                    </td>
                    <td className="px-8 py-6 text-xs font-bold text-slate-500">{m.umpireName || '---'}</td>
                    <td className="px-8 py-6 text-right">
                       {m.status !== MatchStatus.COMPLETED ? (
                         <button onClick={() => handleOpenScoreboard(m)} className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase shadow-lg active:scale-95 transition-all">Score</button>
                       ) : (
                         <span className="text-emerald-500 font-black text-[9px] uppercase italic">Finished</span>
                       )}
                    </td>
                  </tr>
                ))}
                {matches.length === 0 && <tr><td colSpan={5} className="py-20 text-center text-[10px] font-black text-slate-300 uppercase italic">No matches scheduled.</td></tr>}
              </tbody>
            </table>
          </div>

          {isOrganizer && (
            <div className="bg-indigo-600 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
              {!isLocked && <div className="absolute inset-0 bg-indigo-950/80 backdrop-blur-md z-10 flex items-center justify-center p-8 text-center"><p className="font-black uppercase tracking-widest text-sm italic">Arena Lockdown Required to Schedule</p></div>}
              <h4 className="text-xl font-black uppercase italic tracking-tighter mb-8">Schedule Tie-Up</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-indigo-200 uppercase tracking-widest ml-1">Select Teams</label>
                  <select value={selectedT1} onChange={e => setSelectedT1(e.target.value)} className="w-full p-4 bg-indigo-500 rounded-2xl font-black text-xs uppercase outline-none">{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                  <select value={selectedT2} onChange={e => setSelectedT2(e.target.value)} className="w-full p-4 bg-indigo-500 rounded-2xl font-black text-xs uppercase outline-none">{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-indigo-200 uppercase tracking-widest ml-1">Official Details</label>
                  <input list="umpire-options" placeholder="Umpire Name" className="w-full p-4 bg-indigo-500 rounded-2xl font-black text-xs uppercase outline-none placeholder:text-indigo-300" value={matchConfig.umpire} onChange={e => setMatchConfig({...matchConfig, umpire: e.target.value})} />
                  <div className="flex items-center space-x-3"><span className="text-[10px] font-black uppercase text-indigo-200">Court (1-6)</span><input type="number" min="1" max="6" className="w-20 bg-indigo-500 rounded-xl p-3 text-center font-black outline-none" value={matchConfig.court} onChange={e => setMatchConfig({...matchConfig, court: parseInt(e.target.value) || 1})} /></div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-indigo-200 uppercase tracking-widest ml-1">Time Slots</label>
                  <input type="date" className="w-full p-4 bg-indigo-500 rounded-2xl font-black text-xs outline-none" value={matchConfig.scheduleDate} onChange={e => setMatchConfig({...matchConfig, scheduleDate: e.target.value})} />
                  <input type="time" className="w-full p-4 bg-indigo-500 rounded-2xl font-black text-xs outline-none" value={matchConfig.scheduleTime} onChange={e => setMatchConfig({...matchConfig, scheduleTime: e.target.value})} />
                </div>
              </div>

              {/* RESTORED: Format & Points Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-indigo-200 uppercase tracking-widest ml-1">Match Format (Best of)</label>
                  <div className="flex space-x-2">
                    {[1, 3, 5].map(v => (
                      <button 
                        key={v}
                        onClick={() => setMatchConfig({...matchConfig, bestOf: v})}
                        className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${matchConfig.bestOf === v ? 'bg-white text-indigo-600 shadow-lg' : 'bg-indigo-500 text-indigo-200 hover:bg-indigo-400'}`}
                      >
                        {v} {v === 1 ? 'Set' : 'Sets'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-indigo-200 uppercase tracking-widest ml-1">Points per Set</label>
                  <div className="flex space-x-2">
                    {[21, 30].map(v => (
                      <button 
                        key={v}
                        onClick={() => setMatchConfig({...matchConfig, points: v, customPoints: ''})}
                        className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${matchConfig.points === v ? 'bg-white text-indigo-600 shadow-lg' : 'bg-indigo-500 text-indigo-200 hover:bg-indigo-400'}`}
                      >
                        {v}
                      </button>
                    ))}
                    <input 
                      type="number" placeholder="Custom" 
                      className={`w-24 p-3 rounded-xl font-black text-xs outline-none transition-all ${matchConfig.points === 0 ? 'bg-white text-indigo-600' : 'bg-indigo-500 text-white placeholder:text-indigo-300'}`}
                      value={matchConfig.customPoints}
                      onChange={e => setMatchConfig({...matchConfig, points: 0, customPoints: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <button onClick={handleStartMatch} disabled={!isLocked} className="mt-8 w-full bg-white text-indigo-600 p-4 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Post to Schedule</button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'players' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
             <h4 className="text-xl font-black text-slate-800 uppercase italic">Official Roster</h4>
             <div className="flex space-x-2">
                <button onClick={exportRosterToCSV} className="bg-white border border-slate-100 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase text-slate-400">CSV</button>
                <button onClick={exportRosterToTXT} className="bg-white border border-slate-100 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase text-slate-400">TXT</button>
                {isOrganizer && <button onClick={() => setShowPlayerImport(true)} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg">Matrix Import</button>}
             </div>
          </div>
          {isOrganizer && !isLocked && (
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex gap-4">
              <input type="text" placeholder="Add player (name or @username)" className="flex-1 p-4 bg-slate-50 rounded-2xl font-black outline-none focus:bg-white border-2 border-transparent focus:border-indigo-500 transition-all" value={playerSearch} onChange={e => setPlayerSearch(e.target.value)} />
              <button onClick={handleAddToPool} disabled={isAddingPlayer || !playerSearch} className="bg-slate-900 text-white px-10 rounded-2xl font-black uppercase text-[10px] shadow-xl hover:bg-indigo-600 transition-all">Add Player</button>
            </div>
          )}
          {showPlayerImport && (
            <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-2xl animate-in zoom-in space-y-4">
               <textarea className="w-full h-32 bg-indigo-500 rounded-2xl p-5 font-black text-[11px] outline-none" placeholder="Name, @username (one per line)" value={bulkPlayerInput} onChange={e => setBulkPlayerInput(e.target.value)} />
               <button onClick={handleBulkPlayerImport} className="w-full bg-white text-indigo-600 font-black py-4 rounded-2xl uppercase text-[11px]">Import All</button>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {filteredPool.map((p, i) => (
              <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 flex items-center justify-between group hover:border-indigo-200 transition-all">
                <div className="flex items-center space-x-4"><div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center font-black text-slate-400">{p.name[0]}</div><div><p className="font-black text-slate-800 uppercase italic text-xs leading-tight">{p.name}</p>{p.username && <p className="text-[9px] font-black text-slate-400 mt-0.5">@{p.username}</p>}</div></div>
                {isOrganizer && <button onClick={() => handleDeletePlayerFromPool(i)} className="text-rose-500 font-black text-[9px] opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest hover:underline">Delete</button>}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'teams' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4">
          {isOrganizer && !isLocked && !activeTeamId && (
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
              <div>
                 <h4 className="text-[10px] font-black text-slate-400 uppercase italic mb-2 ml-1">Team Identity</h4>
                 <input type="text" placeholder="Unique Team Name" className="w-full p-5 bg-slate-50 rounded-2xl font-black text-xl outline-none border-2 border-transparent focus:border-indigo-500" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} />
              </div>
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase italic tracking-widest">Select Draft Lineup</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-4 bg-slate-50 rounded-2xl no-scrollbar">
                  {filteredPool.map(p => (
                    <label key={p.name} className={`flex items-center p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedPoolPlayers.includes(p.name) ? 'bg-indigo-600 border-indigo-700 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-500 hover:border-indigo-200'}`}>
                      <input type="checkbox" className="hidden" checked={selectedPoolPlayers.includes(p.name)} onChange={() => setSelectedPoolPlayers(prev => prev.includes(p.name) ? prev.filter(x => x !== p.name) : [...prev, p.name])} />
                      <span className="text-[10px] font-black uppercase truncate">{p.name}</span>
                    </label>
                  ))}
                  {filteredPool.length === 0 && <p className="col-span-full py-10 text-center text-[10px] font-black uppercase text-slate-300 italic">No players in roster to select.</p>}
                </div>
              </div>
              <button onClick={handleCreateTeam} disabled={isCreatingTeam || !newTeamName} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] shadow-xl hover:bg-indigo-600 transition-all active:scale-95 disabled:opacity-50">Confirm Team Draft</button>
            </div>
          )}

          {activeTeamId && selectedTeam ? (
            <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm p-12 space-y-12 animate-in zoom-in">
               <div className="flex items-center justify-between">
                  <div>
                     <button onClick={() => setActiveTeamId(null)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 hover:text-slate-800 transition-colors">← All Teams</button>
                     <h3 className="text-5xl font-black text-slate-800 uppercase italic tracking-tighter leading-none">{selectedTeam.name}</h3>
                  </div>
                  {isOrganizer && <button onClick={() => handleDeleteTeam(selectedTeam.id)} className="bg-rose-50 text-rose-500 px-6 py-3 rounded-xl text-[10px] font-black uppercase shadow-sm hover:bg-rose-500 hover:text-white transition-all">Delete Team</button>}
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-slate-50 p-8 rounded-[2rem]">
                     <h5 className="text-[10px] font-black text-slate-400 uppercase mb-6 tracking-widest">Active Lineup</h5>
                     <div className="space-y-3">
                        {selectedTeam.customPlayerNames?.map(p => (
                          <div key={p} className="bg-white p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
                             <span className="font-black text-slate-800 uppercase italic text-xs leading-none">{p}</span>
                             <span className="text-[8px] font-black text-slate-300 uppercase italic tracking-widest">Player</span>
                          </div>
                        ))}
                        {(!selectedTeam.customPlayerNames || selectedTeam.customPlayerNames.length === 0) && <p className="text-center py-10 text-[10px] font-black text-slate-300 uppercase tracking-widest italic">No players assigned.</p>}
                     </div>
                  </div>
                  <div className="bg-slate-50 p-8 rounded-[2rem]">
                     <h5 className="text-[10px] font-black text-slate-400 uppercase mb-6 tracking-widest">Performance Stats</h5>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-6 rounded-3xl text-center shadow-sm"><p className="text-3xl font-black text-slate-800 italic">{selectedTeamHistory.length}</p><p className="text-[9px] font-black text-slate-300 uppercase mt-1">Played</p></div>
                        <div className="bg-white p-6 rounded-3xl text-center shadow-sm"><p className="text-3xl font-black text-emerald-500 italic">{selectedTeamHistory.filter(m => m.winnerId === activeTeamId).length}</p><p className="text-[9px] font-black text-slate-300 uppercase mt-1">Wins</p></div>
                        <div className="bg-white p-6 rounded-3xl text-center shadow-sm"><p className="text-3xl font-black text-indigo-500 italic">{standings.find(s => s.id === activeTeamId)?.pointsScored - standings.find(s => s.id === activeTeamId)?.pointsConceded || 0}</p><p className="text-[9px] font-black text-slate-300 uppercase mt-1">Points</p></div>
                        <div className="bg-white p-6 rounded-3xl text-center shadow-sm"><p className="text-3xl font-black text-rose-500 italic">{selectedTeamHistory.length > 0 ? Math.round((selectedTeamHistory.filter(m => m.winnerId === activeTeamId).length / selectedTeamHistory.length) * 100) : 0}%</p><p className="text-[9px] font-black text-slate-300 uppercase mt-1">Efficiency</p></div>
                     </div>
                  </div>
               </div>

               {/* Next Schedule Section */}
               <div className="space-y-6">
                  <div className="flex items-center space-x-4">
                    <div className="h-px bg-slate-100 flex-grow"></div>
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] italic">Next Schedule</h5>
                    <div className="h-px bg-slate-100 flex-grow"></div>
                  </div>
                  <div className="bg-slate-50/50 rounded-[2rem] border border-slate-100 overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100/30">
                        <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          <th className="px-8 py-4">Time</th>
                          <th className="px-8 py-4">Opponent</th>
                          <th className="px-8 py-4">Court</th>
                          <th className="px-8 py-4 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedTeamUpcoming.map(m => {
                          const oppId = m.participants.find(p => p !== activeTeamId);
                          const oppName = teams.find(t => t.id === oppId)?.name || 'Unknown';
                          return (
                            <tr key={m.id} className="hover:bg-white transition-colors">
                              <td className="px-8 py-5 text-[11px] font-bold text-slate-600">{format12h(m.startTime)}</td>
                              <td className="px-8 py-5 text-xs font-black text-slate-800 uppercase italic">vs {oppName}</td>
                              <td className="px-8 py-5 text-[10px] font-black text-indigo-400 uppercase italic">Court {m.court}</td>
                              <td className="px-8 py-5 text-right"><span className="text-[9px] font-black uppercase text-indigo-500 bg-indigo-50 px-3 py-1 rounded-lg">Scheduled</span></td>
                            </tr>
                          );
                        })}
                        {selectedTeamUpcoming.length === 0 && <tr><td colSpan={4} className="py-12 text-center text-[10px] font-black text-slate-300 uppercase italic tracking-widest">No upcoming matches.</td></tr>}
                      </tbody>
                    </table>
                  </div>
               </div>

               {/* Battle History Section */}
               <div className="space-y-6">
                  <div className="flex items-center space-x-4">
                    <div className="h-px bg-slate-100 flex-grow"></div>
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] italic">Battle History</h5>
                    <div className="h-px bg-slate-100 flex-grow"></div>
                  </div>
                  <div className="bg-slate-50/50 rounded-[2rem] border border-slate-100 overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100/30">
                        <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          <th className="px-8 py-4">Result</th>
                          <th className="px-8 py-4">Versus</th>
                          <th className="px-8 py-4">Scoreline</th>
                          <th className="px-8 py-4 text-right">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedTeamHistory.map(m => {
                          const oppId = m.participants.find(p => p !== activeTeamId);
                          const oppName = teams.find(t => t.id === oppId)?.name || 'Unknown';
                          const isWin = m.winnerId === activeTeamId;
                          return (
                            <tr key={m.id} className="hover:bg-white transition-colors">
                              <td className="px-8 py-5">
                                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${isWin ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                                  {isWin ? 'Victory' : 'Defeat'}
                                </span>
                              </td>
                              <td className="px-8 py-5 text-xs font-black text-slate-800 uppercase italic">{oppName}</td>
                              <td className="px-8 py-5 text-xs font-black text-slate-600 font-mono tracking-tighter">
                                {m.scores.map(s => `${s.s1}-${s.s2}`).join(' / ')}
                              </td>
                              <td className="px-8 py-5 text-right text-[10px] font-bold text-slate-400">{new Date(m.startTime).toLocaleDateString()}</td>
                            </tr>
                          );
                        })}
                        {selectedTeamHistory.length === 0 && <tr><td colSpan={4} className="py-12 text-center text-[10px] font-black text-slate-300 uppercase italic tracking-widest">No match records found.</td></tr>}
                      </tbody>
                    </table>
                  </div>
               </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {teams.map(t => (
                <button key={t.id} onClick={() => setActiveTeamId(t.id)} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm group hover:border-indigo-400 hover:shadow-2xl transition-all text-left transform hover:-translate-y-1">
                   <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center font-black text-indigo-400 mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all">{t.name[0]}</div>
                   <h5 className="font-black text-slate-800 uppercase italic text-2xl tracking-tighter mb-2 leading-none">{t.name}</h5>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">{t.customPlayerNames?.length || 0} Drafted Players</p>
                </button>
              ))}
              {teams.length === 0 && (
                <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-100 rounded-[3rem]">
                   <p className="text-slate-300 font-black uppercase tracking-widest text-[11px] italic">No teams drafted in this arena yet.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'standings' && (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden animate-in zoom-in">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50">
              <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50"><th className="px-10 py-6">Rank</th><th className="px-4 py-6">Team</th><th className="px-4 py-6 text-center">Played</th><th className="px-4 py-6 text-center">W-L</th><th className="px-4 py-6 text-center">Points</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {standings.map((s, idx) => (
                <tr key={s.id} className="hover:bg-indigo-50/10">
                  <td className="px-10 py-6 font-black text-slate-800 text-xl italic leading-none tabular-nums">#{idx+1}</td>
                  <td className="px-4 py-6 font-black text-slate-800 uppercase italic text-sm tracking-tight">{s.name}</td>
                  <td className="px-4 py-6 text-center font-black text-slate-400 text-xs tabular-nums">{s.played}</td>
                  <td className="px-4 py-6 text-center font-black text-emerald-500 text-xs tabular-nums">{s.matchesWon}-{s.played-s.matchesWon}</td>
                  <td className="px-4 py-6 text-center font-black text-indigo-600 text-sm tabular-nums">{s.pointsScored - s.pointsConceded}</td>
                </tr>
              ))}
              {standings.length === 0 && <tr><td colSpan={5} className="py-20 text-center text-[10px] font-black uppercase text-slate-300 italic">No rankings available yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm divide-y divide-slate-50 animate-in fade-in">
          {joinRequests.map(req => (
            <div key={req.id} className="p-8 flex items-center justify-between hover:bg-slate-50 transition-colors">
              <div><p className="font-black text-slate-800 italic uppercase leading-none text-sm">{req.name}</p><p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest">@{req.username}</p></div>
              <div className="flex space-x-3">
                <button 
                  onClick={() => handleResolveJoinRequest(req.id, req.username, true)} 
                  disabled={processingRequestId === req.id}
                  className="bg-indigo-600 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg active:scale-95 disabled:opacity-50 transition-all"
                >
                  {processingRequestId === req.id ? '...' : 'Accept'}
                </button>
                <button 
                  onClick={() => handleResolveJoinRequest(req.id, req.username, false)} 
                  disabled={processingRequestId === req.id}
                  className="bg-slate-100 text-slate-400 px-8 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-rose-50 active:scale-95 disabled:opacity-50 transition-all"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
          {joinRequests.length === 0 && <p className="p-20 text-center text-[10px] font-black uppercase text-slate-300 italic">No pending admission requests.</p>}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-bottom-4">
          <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic mb-2">Arena Configuration</h4>
            <div className="space-y-6">
              <div>
                 <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1 block italic">Security Access PIN</label>
                 <div className="flex gap-2">
                   <input type="text" maxLength={4} placeholder="####" className="flex-1 p-4 bg-slate-50 rounded-2xl text-center text-2xl font-black outline-none border-2 border-transparent focus:border-indigo-500" value={tempPin} onChange={e => setTempPin(e.target.value)} />
                   <button onClick={handleUpdatePin} className="bg-slate-900 text-white px-8 rounded-2xl font-black uppercase text-[10px] shadow-xl hover:bg-indigo-600 transition-all">Save PIN</button>
                 </div>
              </div>
              
              <div className="pt-4">
                 <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1 block italic">Ranking Criteria Hierarchy</label>
                 <div className="space-y-2">
                   {(tournament.rankingCriteriaOrder || ['MATCHES_WON', 'SETS_WON', 'POINTS_DIFF', 'HEAD_TO_HEAD']).map((criterion, idx) => (
                     <div key={criterion} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">{idx + 1}. {criterion.replace(/_/g, ' ')}</span>
                        {isOrganizer && (
                          <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleReorderCriteria(idx, 'up')} disabled={idx === 0} className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 disabled:opacity-30">↑</button>
                            <button onClick={() => handleReorderCriteria(idx, 'down')} disabled={idx === 3} className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 disabled:opacity-30">↓</button>
                          </div>
                        )}
                     </div>
                   ))}
                 </div>
              </div>
            </div>
          </div>
          {isOrganizer && (
            <div className="bg-rose-50 p-10 rounded-[2.5rem] border border-rose-100 flex flex-col justify-between shadow-xl shadow-rose-100/20">
              <div><h4 className="text-[10px] font-black text-rose-500 uppercase italic tracking-widest mb-4">Danger Zone</h4><p className="text-[10px] font-bold text-rose-400 uppercase leading-relaxed tracking-tight">Permanently delete this arena and all associated matches, teams, and data. This action is irreversible.</p></div>
              <button onClick={handleDeleteArena} className="w-full bg-rose-500 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[11px] shadow-2xl shadow-rose-200 hover:bg-rose-600 mt-12 transform hover:scale-[1.02] active:scale-95 transition-all leading-none">Delete Arena Permanently</button>
            </div>
          )}
        </div>
      )}

      {/* --- PROFESSIONAL DARK SCOREBOARD OVERLAY MATCHING SCREENSHOT --- */}
      {showScoreboard && scoringMatch && (
        <div className="fixed inset-0 bg-[#0c1221] z-[999] flex flex-col animate-in fade-in duration-300 font-sans overflow-hidden">
          {/* Header Bar */}
          <div className="flex items-center justify-between px-10 py-8">
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => setShowScoreboard(false)} 
                className="flex items-center space-x-2 bg-[#1a2333] hover:bg-slate-700 text-slate-300 px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
                <span>Exit</span>
              </button>
              <button className="flex items-center space-x-2 bg-[#2d3a8c] hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-900/40">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3.005 3.005 0 013.75-2.906z" /></svg>
                <span>Lineup</span>
              </button>
            </div>

            <div className="text-center">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4 block italic">Match Progression</span>
              <div className="flex items-center justify-center space-x-2">
                <div className="flex flex-col items-center">
                   <div className="w-20 h-2 bg-[#4f46e5] rounded-full mb-2"></div>
                   <span className="text-[9px] font-black text-slate-500">30:16</span>
                </div>
                <div className="flex flex-col items-center">
                   <div className="w-20 h-2 bg-[#10b981] rounded-full mb-2"></div>
                   <span className="text-[9px] font-black text-slate-500">0:22</span>
                </div>
                <div className="flex flex-col items-center">
                   <div className="w-20 h-2 bg-[#334155] rounded-full mb-2 relative overflow-hidden">
                      <div className="absolute inset-0 bg-white/10"></div>
                   </div>
                   <span className="text-[9px] font-black text-white italic">SET {activeSetIndex + 1}</span>
                </div>
              </div>
            </div>

            <button onClick={handleUndoScore} className="bg-[#1a2333] text-slate-400 px-8 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all">
              Undo
            </button>
          </div>

          {/* Main Scoring Area */}
          <div className="flex-grow flex items-center justify-center gap-10 p-10">
            {/* Left Player Area */}
            {(() => {
              const t1Id = isSwapped ? scoringMatch.participants[1] : scoringMatch.participants[0];
              const t1 = teams.find(t => t.id === t1Id);
              const score = isSwapped ? currentScores[activeSetIndex].s2 : currentScores[activeSetIndex].s1;
              const colorClass = isSwapped ? 'bg-[#0a1f1a] border-[#10b981]/20' : 'bg-[#121931] border-[#4f46e5]/20';
              const btnClass = isSwapped ? 'bg-[#10b981]' : 'bg-[#4f46e5]';
              
              return (
                <div className={`flex-1 h-full rounded-[4rem] border-2 flex flex-col items-center justify-center relative shadow-[0_0_80px_rgba(0,0,0,0.5)] transition-all duration-700 ${colorClass}`}>
                  <div className="relative z-10 text-center w-full px-10">
                    <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter mb-3">{t1?.name}</h2>
                    <div className="flex items-center justify-center space-x-2 text-slate-500 mb-12">
                       <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3.005 3.005 0 013.75-2.906z" /></svg>
                       <span className="text-[10px] font-black uppercase tracking-[0.3em]">{t1?.customPlayerNames?.join(' ') || 'MANUAL'}</span>
                    </div>

                    <div className="flex items-center justify-center space-x-12 relative">
                       <button onClick={() => handleUpdateScore(activeSetIndex, isSwapped ? 2 : 1, -1)} className="w-32 h-32 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white flex items-center justify-center text-5xl font-light transition-all active:scale-90">
                         —
                       </button>
                       <div className="relative">
                         <span className="text-[280px] font-black text-white leading-none italic tabular-nums tracking-tighter drop-shadow-[0_45px_45px_rgba(0,0,0,0.8)] z-10 relative">
                           {score}
                         </span>
                         <span className="absolute -inset-16 text-[320px] font-black text-white/[0.03] pointer-events-none select-none italic text-center leading-none">
                           {score}
                         </span>
                       </div>
                       <button onClick={() => handleUpdateScore(activeSetIndex, isSwapped ? 2 : 1, 1)} className={`w-32 h-32 rounded-full flex items-center justify-center text-6xl font-light transition-all active:scale-90 shadow-[0_20px_50px_rgba(0,0,0,0.4)] text-white ${btnClass}`}>
                         +
                       </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Right Player Area */}
            {(() => {
              const t2Id = isSwapped ? scoringMatch.participants[0] : scoringMatch.participants[1];
              const t2 = teams.find(t => t.id === t2Id);
              const score = isSwapped ? currentScores[activeSetIndex].s1 : currentScores[activeSetIndex].s2;
              const colorClass = isSwapped ? 'bg-[#121931] border-[#4f46e5]/20' : 'bg-[#0a1f1a] border-[#10b981]/20';
              const btnClass = isSwapped ? 'bg-[#4f46e5]' : 'bg-[#10b981]';
              
              return (
                <div className={`flex-1 h-full rounded-[4rem] border-2 flex flex-col items-center justify-center relative shadow-[0_0_80px_rgba(0,0,0,0.5)] transition-all duration-700 ${colorClass}`}>
                  <div className="relative z-10 text-center w-full px-10">
                    <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter mb-3">{t2?.name}</h2>
                    <div className="flex items-center justify-center space-x-2 text-slate-500 mb-12">
                       <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3.005 3.005 0 013.75-2.906z" /></svg>
                       <span className="text-[10px] font-black uppercase tracking-[0.3em]">{t2?.customPlayerNames?.join(' ') || 'MANUAL'}</span>
                    </div>

                    <div className="flex items-center justify-center space-x-12 relative">
                       <button onClick={() => handleUpdateScore(activeSetIndex, isSwapped ? 1 : 2, -1)} className="w-32 h-32 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white flex items-center justify-center text-5xl font-light transition-all active:scale-90">
                         —
                       </button>
                       <div className="relative">
                         <span className="text-[280px] font-black text-white leading-none italic tabular-nums tracking-tighter drop-shadow-[0_45px_45px_rgba(0,0,0,0.8)] z-10 relative">
                           {score}
                         </span>
                         <span className="absolute -inset-16 text-[320px] font-black text-white/[0.03] pointer-events-none select-none italic text-center leading-none">
                           {score}
                         </span>
                       </div>
                       <button onClick={() => handleUpdateScore(activeSetIndex, isSwapped ? 1 : 2, 1)} className={`w-32 h-32 rounded-full flex items-center justify-center text-6xl font-light transition-all active:scale-90 shadow-[0_20px_50px_rgba(0,0,0,0.4)] text-white ${btnClass}`}>
                         +
                       </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Footer UI Matching Screenshot */}
          <div className="px-10 py-10 flex items-center justify-between">
            <button onClick={() => setIsSwapped(!isSwapped)} className="w-20 h-20 rounded-full bg-[#1a2333] border border-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-xl active:scale-90 rotate-90">
               <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>

            <div className="flex-1 max-w-2xl mx-10">
               <div className="bg-[#121931]/80 border border-white/5 rounded-[2.5rem] py-6 flex items-center justify-center shadow-inner relative overflow-hidden group">
                  <div className="absolute inset-0 bg-white/[0.02] translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                  <span className="text-[12px] font-black text-slate-400 uppercase tracking-[0.5em] italic">Target Score: {scoringMatch.pointsOption}</span>
               </div>
            </div>

            <div className="flex items-center space-x-4">
               <div className="relative">
                 <input 
                   type="password" placeholder="PIN" 
                   className="w-32 bg-[#1a2333] border border-white/5 rounded-2xl p-5 text-center font-black text-white text-lg outline-none focus:border-indigo-500 transition-all placeholder:text-slate-700 uppercase"
                   value={pinEntry} onChange={e => setPinEntry(e.target.value)}
                 />
               </div>
               <button 
                 onClick={handleSaveScore}
                 className="bg-[#4f46e5] hover:bg-indigo-500 text-white px-12 py-5 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-[0_15px_40px_rgba(79,70,229,0.3)] transition-all active:scale-95 leading-none"
               >
                 Submit
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const TabButton = ({ active, onClick, label }: any) => (
  <button onClick={onClick} className={`px-10 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${active ? 'bg-indigo-600 text-white shadow-2xl scale-105' : 'text-slate-400 hover:text-slate-600 bg-white shadow-sm border border-slate-50 hover:bg-slate-50'}`}>{label}</button>
);

export default TournamentDetails;