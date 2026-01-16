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
  
  const [selectedT1, setSelectedT1] = useState('');
  const [selectedT2, setSelectedT2] = useState('');

  const [scoringMatch, setScoringMatch] = useState<Match | null>(null);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [scores, setScores] = useState<MatchScore[]>([]);

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
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
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

  const handleDeletePlayerFromPool = async (index: number) => {
    if (!window.confirm("Remove this player from the roster?")) return;
    const newPool = [...(tournament.playerPool || [])];
    newPool.splice(index, 1);
    await store.updateTournamentPool(tournament.id, newPool);
    await loadData();
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
    if (!window.confirm("Delete this team?")) return;
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
      await loadData();
    } catch (e: any) { alert(e.message); }
  };

  const handleUpdatePin = async () => {
    if (tempPin.length !== 4) return alert("PIN must be 4 digits.");
    await store.updateTournamentSettings(tournament.id, { scorerPin: tempPin });
    alert("PIN updated!");
  };

  const handleDeleteArena = async () => {
    if (!window.confirm("PERMANENT ACTION: Delete this tournament and all its data?")) return;
    await store.deleteTournament(tournament.id);
    onBack();
  };

  const exportMatchesToCSV = () => {
    const headers = ['Sequence', 'Schedule', 'Team 1', 'Team 2', 'Umpire', 'Status', 'Result'];
    const rows = matches.map((m, idx) => [
      idx + 1, format12h(m.startTime),
      teams.find(t => t.id === m.participants[0])?.name || '---',
      teams.find(t => t.id === m.participants[1])?.name || '---',
      m.umpireName || '---', m.status,
      m.scores.map(s => `${s.s1}-${s.s2}`).join(' ')
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${tournament.name}_Matches.csv`; a.click();
  };

  // Add missing handleResolveJoinRequest to process tournament join requests
  const handleResolveJoinRequest = async (requestId: string, username: string, approved: boolean) => {
    try {
      await store.resolveJoinRequest(requestId, tournament.id, username, approved);
      await loadData();
    } catch (err) {
      alert("Failed to resolve request.");
    }
  };

  const handleJoinAction = async () => {
    setIsJoining(true);
    try {
      if (tournament.isPublic) { await store.joinTournament(tournament.id, user); alert("Joined Arena!"); }
      else { await store.requestJoinTournament(tournament.id, user); alert("Join Request Sent!"); }
      await loadData();
    } finally { setIsJoining(false); }
  };

  // --- ACCESS GUARD ---
  if (!isMember) {
    return (
      <div className="flex flex-col items-center justify-center py-24 animate-in fade-in zoom-in duration-500 bg-white rounded-[3rem] shadow-sm border border-slate-100">
        <div className="w-40 h-40 bg-rose-50 rounded-[3rem] flex items-center justify-center mb-10 shadow-inner border border-rose-100 relative overflow-hidden">
           <svg className="w-20 h-20 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        </div>
        <h3 className="text-5xl font-black text-slate-800 uppercase italic tracking-tighter mb-4 text-center px-4">Arena Protected</h3>
        <p className="max-w-md text-center text-slate-400 font-bold leading-relaxed mb-12 px-8 text-lg">Detailed standings, lineups, and match schedules are restricted to members.</p>
        <button onClick={handleJoinAction} disabled={isJoining} className="bg-indigo-600 text-white px-12 py-6 rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-2xl hover:scale-[1.03] transition-all">
          {isJoining ? 'Processing...' : (tournament.isPublic ? 'Join Arena' : 'Request Invitation')}
        </button>
        <button onClick={onBack} className="mt-6 text-slate-400 font-black uppercase tracking-widest text-[11px]">Return to Lobby</button>
      </div>
    );
  }

  const selectedTeam = teams.find(t => t.id === activeTeamId);

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <button onClick={onBack} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm border border-slate-100 bg-white hover:scale-110 active:scale-90"><svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></button>
          <div>
            <h2 className="text-4xl font-black text-slate-800 tracking-tight italic uppercase leading-none">{tournament.name}</h2>
            <p className="text-slate-400 font-black uppercase tracking-widest text-[10px] mt-2">ID: {tournament.uniqueId} • {tournament.venue} • {isLocked ? 'LOCKED' : 'DRAFT'}</p>
          </div>
        </div>
        <div className="flex space-x-3">
          {isOrganizer && !isLocked && <button onClick={handleLock} className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-600 transition-all">Lock Arena</button>}
          <div className="bg-white border border-slate-100 text-slate-800 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm italic">{tournament.status}</div>
        </div>
      </div>

      <div className="flex space-x-2 overflow-x-auto pb-2 no-scrollbar scroll-smooth">
        <TabButton active={activeTab === 'matches'} onClick={() => {setActiveTab('matches'); setActiveTeamId(null);}} label="Matches" />
        <TabButton active={activeTab === 'players'} onClick={() => {setActiveTab('players'); setActiveTeamId(null);}} label="Roster" />
        <TabButton active={activeTab === 'teams'} onClick={() => setActiveTab('teams')} label="Teams" />
        <TabButton active={activeTab === 'standings'} onClick={() => {setActiveTab('standings'); setActiveTeamId(null);}} label="Standings" />
        {isOrganizer && <TabButton active={activeTab === 'requests'} onClick={() => setActiveTab('requests')} label="Requests" />}
        {isOrganizer && <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} label="Settings" />}
      </div>

      {activeTab === 'matches' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4">
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center">
              <h4 className="text-xl font-black text-slate-800 uppercase italic">Match Schedule</h4>
              <button onClick={exportMatchesToCSV} className="bg-slate-50 text-slate-500 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase border border-slate-100">Export Results (CSV)</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50">
                  <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                    <th className="px-8 py-4">SEQ</th>
                    <th className="px-8 py-4">Schedule (12h)</th>
                    <th className="px-8 py-4">Tie-Up</th>
                    <th className="px-8 py-4">Umpire</th>
                    <th className="px-8 py-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {matches.map((m, idx) => (
                    <tr key={m.id} className="hover:bg-indigo-50/20 transition-colors">
                      <td className="px-8 py-6 font-black text-slate-300">#{idx+1}</td>
                      <td className="px-8 py-6 font-bold text-slate-600 text-[11px] whitespace-nowrap">{format12h(m.startTime)}</td>
                      <td className="px-8 py-6">
                        <span className="font-black text-slate-800 uppercase italic text-sm">
                          {teams.find(t => t.id === m.participants[0])?.name || '---'} vs {teams.find(t => t.id === m.participants[1])?.name || '---'}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-xs font-bold text-slate-500 italic">{m.umpireName || '---'}</td>
                      <td className="px-8 py-6 text-right">
                        <span className="font-black uppercase text-[10px] text-slate-400">{m.status}</span>
                      </td>
                    </tr>
                  ))}
                  {matches.length === 0 && (
                    <tr><td colSpan={5} className="py-20 text-center text-[10px] font-black uppercase text-slate-300">No matches scheduled.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {isOrganizer && (
            <div className="bg-indigo-600 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
              {!isLocked && <div className="absolute inset-0 bg-indigo-950/80 backdrop-blur-md z-10 flex items-center justify-center p-8 text-center"><p className="font-black uppercase tracking-widest text-sm italic">Arena Lockdown Required to Schedule Matches</p></div>}
              <h4 className="text-xl font-black uppercase italic tracking-tighter mb-8">Schedule Tie-Up</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-indigo-200">Teams</label>
                  <select value={selectedT1} onChange={e => setSelectedT1(e.target.value)} className="w-full p-4 bg-indigo-500 rounded-2xl font-black text-xs uppercase outline-none focus:ring-4 ring-white/10 appearance-none">
                    <option value="">Select Team A</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <select value={selectedT2} onChange={e => setSelectedT2(e.target.value)} className="w-full p-4 bg-indigo-500 rounded-2xl font-black text-xs uppercase outline-none focus:ring-4 ring-white/10 appearance-none">
                    <option value="">Select Team B</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="space-y-3">
                   <label className="text-[10px] font-black uppercase text-indigo-200">Officials</label>
                   <input list="umpire-options" placeholder="Umpire Name" className="w-full p-4 bg-indigo-500 rounded-2xl font-black text-xs uppercase outline-none border-none" value={matchConfig.umpire} onChange={e => setMatchConfig({...matchConfig, umpire: e.target.value})} />
                   <datalist id="umpire-options">
                      {teams.map(t => <option key={t.id} value={t.name} />)}
                   </datalist>
                   <div className="flex items-center space-x-3"><span className="text-[10px] font-black uppercase text-indigo-200">Court (1-6)</span><input type="number" min="1" max="6" className="w-full bg-indigo-500 rounded-2xl p-4 font-black outline-none border-none text-xs" value={matchConfig.court} onChange={e => setMatchConfig({...matchConfig, court: Math.min(6, Math.max(1, parseInt(e.target.value) || 1))})} /></div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-indigo-200">Time</label>
                  <input type="date" className="w-full p-4 bg-indigo-500 rounded-2xl font-black text-xs outline-none border-none" value={matchConfig.scheduleDate} onChange={e => setMatchConfig({...matchConfig, scheduleDate: e.target.value})} />
                  <input type="time" className="w-full p-4 bg-indigo-500 rounded-2xl font-black text-xs outline-none border-none" value={matchConfig.scheduleTime} onChange={e => setMatchConfig({...matchConfig, scheduleTime: e.target.value})} />
                </div>
              </div>
              <div className="flex flex-col md:flex-row gap-8 items-center border-t border-indigo-400 pt-8">
                 <div className="flex items-center space-x-4">
                    <span className="text-[10px] font-black uppercase text-indigo-200">Sets</span>
                    <div className="flex space-x-2">
                       {[1, 3, 5].map(v => (
                         <button key={v} onClick={() => setMatchConfig({...matchConfig, bestOf: v})} className={`w-10 h-10 rounded-xl font-black text-xs transition-all ${matchConfig.bestOf === v ? 'bg-white text-indigo-600 shadow-lg' : 'bg-indigo-500 text-white'}`}>{v}</button>
                       ))}
                    </div>
                 </div>
                 <div className="flex items-center space-x-4">
                    <span className="text-[10px] font-black uppercase text-indigo-200">Points</span>
                    <select className="bg-indigo-500 rounded-xl p-3 font-black text-xs outline-none border-none" value={matchConfig.points} onChange={e => setMatchConfig({...matchConfig, points: parseInt(e.target.value)})}>
                       {[11, 15, 21, 25].map(v => <option key={v} value={v}>{v}</option>)}
                       <option value={0}>Custom</option>
                    </select>
                    {matchConfig.points === 0 && <input type="number" placeholder="--" className="w-16 bg-indigo-500 rounded-xl p-3 text-center font-black text-xs outline-none" value={matchConfig.customPoints} onChange={e => setMatchConfig({...matchConfig, customPoints: e.target.value})} />}
                 </div>
                 <button onClick={handleStartMatch} disabled={!isLocked} className="flex-1 bg-white text-indigo-600 p-4 rounded-2xl font-black uppercase text-xs shadow-xl hover:scale-[1.03] active:scale-95 transition-all">Post to Schedule</button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'players' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h4 className="text-xl font-black text-slate-800 uppercase italic">Official Roster</h4>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Available players for team drafting and tie-ups.</p>
            </div>
            <div className="flex space-x-2">
              <button onClick={exportRosterToCSV} className="bg-white text-slate-500 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase border border-slate-100 shadow-sm">CSV</button>
              <button onClick={exportRosterToTXT} className="bg-white text-slate-500 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase border border-slate-100 shadow-sm">TXT</button>
              {isOrganizer && !isLocked && <button onClick={() => setShowPlayerImport(true)} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-700 transition-all">Bulk Matrix</button>}
            </div>
          </div>

          {showPlayerImport && (
            <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-2xl space-y-4 animate-in zoom-in">
              <div className="flex justify-between items-center"><h5 className="text-[10px] font-black uppercase tracking-widest text-indigo-200 italic">Format: Name, @username (one per line)</h5><button onClick={() => setShowPlayerImport(false)}>✕</button></div>
              <textarea className="w-full h-32 bg-indigo-500/50 rounded-2xl p-5 text-[11px] font-black outline-none border border-indigo-400 text-white" value={bulkPlayerInput} onChange={e => setBulkPlayerInput(e.target.value)} />
              <button onClick={handleBulkPlayerImport} className="w-full bg-white text-indigo-600 font-black py-4 rounded-2xl uppercase text-[11px] shadow-lg">Import to Pool</button>
            </div>
          )}

          {isOrganizer && !isLocked && (
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
              <div className="flex gap-4">
                <input type="text" placeholder="Add individual player (@username or name)" className="flex-1 p-4 bg-slate-50 rounded-2xl font-black border-2 border-transparent focus:border-indigo-500 outline-none text-sm transition-all" value={playerSearch} onChange={(e) => setPlayerSearch(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAddToPool()} />
                <button onClick={handleAddToPool} disabled={isAddingPlayer || !playerSearch} className="bg-slate-900 text-white px-10 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all disabled:opacity-50">
                  {isAddingPlayer ? '...' : 'Add Player'}
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {filteredPool.map((p, i) => (
              <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 flex items-center justify-between group hover:border-indigo-200 transition-all">
                <div className="flex items-center space-x-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] ${p.isRegistered ? 'bg-indigo-50 text-indigo-500' : 'bg-slate-50 text-slate-400'}`}>{p.name[0]}</div>
                  <div><p className="font-black text-slate-800 text-sm italic leading-tight uppercase tracking-tighter">{p.name}</p>{p.username && <p className="text-[9px] text-slate-400 font-black tracking-widest mt-0.5">@{p.username}</p>}</div>
                </div>
                {isOrganizer && !isLocked && <button onClick={() => handleDeletePlayerFromPool(i)} className="text-rose-500 font-black text-[8px] opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest hover:underline">Delete</button>}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'teams' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4">
          {isOrganizer && !isLocked && !activeTeamId && (
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
              <div className="space-y-4">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Draft New Team</h4>
                 <input type="text" placeholder="Unique Team Name" className="w-full p-5 bg-slate-50 rounded-2xl font-black outline-none border-2 border-transparent focus:border-indigo-500 text-xl" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} />
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Select Players From Roster</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-4 bg-slate-50 rounded-2xl no-scrollbar">
                  {filteredPool.map(p => (
                    <label key={p.name} className={`flex items-center p-3 rounded-xl border-2 transition-all cursor-pointer ${selectedPoolPlayers.includes(p.name) ? 'bg-indigo-600 border-indigo-700 text-white' : 'bg-white border-slate-100 text-slate-500'}`}>
                      <input type="checkbox" className="hidden" checked={selectedPoolPlayers.includes(p.name)} onChange={() => {
                        setSelectedPoolPlayers(prev => prev.includes(p.name) ? prev.filter(x => x !== p.name) : [...prev, p.name]);
                      }} />
                      <span className="text-[10px] font-black uppercase truncate">{p.name}</span>
                    </label>
                  ))}
                  {filteredPool.length === 0 && <p className="col-span-full text-center text-[10px] text-slate-400 uppercase tracking-widest py-8 font-black">Roster is empty. Add players first.</p>}
                </div>
              </div>

              <button onClick={handleCreateTeam} disabled={isCreatingTeam || !newTeamName} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] shadow-xl hover:bg-indigo-600 transition-all disabled:opacity-50">Create Team Dashboard</button>
            </div>
          )}

          {activeTeamId && selectedTeam ? (
            <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm p-10 space-y-8 animate-in zoom-in">
              <div className="flex items-center justify-between">
                <div>
                   <button onClick={() => setActiveTeamId(null)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center hover:text-slate-800 transition-colors">← All Teams</button>
                   <h3 className="text-4xl font-black text-slate-800 uppercase italic tracking-tighter">{selectedTeam.name}</h3>
                </div>
                {isOrganizer && <button onClick={() => handleDeleteTeam(selectedTeam.id)} className="bg-rose-50 text-rose-500 px-6 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-rose-500 hover:text-white transition-all shadow-sm">Delete Team</button>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="bg-slate-50 p-8 rounded-[2rem]">
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Current Roster</h5>
                    <div className="space-y-3">
                      {(selectedTeam.customPlayerNames || []).map(pName => (
                        <div key={pName} className="bg-white p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
                           <span className="font-black text-slate-800 uppercase text-xs italic">{pName}</span>
                           <span className="text-[9px] font-black text-slate-300 uppercase italic tracking-widest">Active</span>
                        </div>
                      ))}
                      {(selectedTeam.customPlayerNames || []).length === 0 && <p className="text-center py-10 text-[10px] font-black text-slate-300 uppercase tracking-widest italic">No players assigned.</p>}
                    </div>
                 </div>
                 <div className="bg-slate-50 p-8 rounded-[2rem]">
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Team Stats</h5>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="bg-white p-6 rounded-2xl text-center"><p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Played</p><p className="text-2xl font-black text-slate-800">0</p></div>
                       <div className="bg-white p-6 rounded-2xl text-center"><p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Wins</p><p className="text-2xl font-black text-emerald-500">0</p></div>
                    </div>
                 </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {teams.map(t => (
                <button key={t.id} onClick={() => setActiveTeamId(t.id)} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm group hover:border-indigo-400 hover:shadow-xl transition-all text-left">
                   <div className="flex justify-between items-start mb-6">
                      <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center font-black text-indigo-400">{t.name[0]}</div>
                      <span className="text-[9px] font-black text-slate-300 italic group-hover:text-indigo-400 transition-colors">DETAILS →</span>
                   </div>
                   <h5 className="font-black text-slate-800 uppercase italic text-2xl tracking-tighter mb-2">{t.name}</h5>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">{(t.customPlayerNames || []).length} Players</p>
                </button>
              ))}
              {teams.length === 0 && (
                <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-100 rounded-[3rem]">
                   <p className="text-slate-300 font-black uppercase tracking-widest text-[11px] italic">No teams drafted for this arena.</p>
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
              <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-10 py-6">Rank</th>
                <th className="px-4 py-6">Team</th>
                <th className="px-4 py-6 text-center">Played</th>
                <th className="px-4 py-6 text-center">W-L</th>
                <th className="px-4 py-6 text-center">Pts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {standings.map((s, idx) => (
                <tr key={s.id} className="hover:bg-indigo-50/10">
                  <td className="px-10 py-6 font-black text-slate-800 text-lg italic">#{idx+1}</td>
                  <td className="px-4 py-6 font-black text-slate-800 uppercase italic text-sm">{s.name}</td>
                  <td className="px-4 py-6 text-center font-bold text-slate-400 text-xs tabular-nums">{s.played}</td>
                  <td className="px-4 py-6 text-center font-black text-emerald-500 text-xs tabular-nums">{s.matchesWon}-{s.played-s.matchesWon}</td>
                  <td className="px-4 py-6 text-center font-black text-indigo-600 text-sm tabular-nums">{s.pointsScored - s.pointsConceded}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm divide-y divide-slate-50 animate-in fade-in">
          {joinRequests.map(req => (
            <div key={req.id} className="p-8 flex items-center justify-between">
              <div><p className="font-black text-slate-800 italic uppercase">{req.name}</p><p className="text-[10px] font-black text-slate-400">@{req.username}</p></div>
              <div className="flex space-x-3">
                <button onClick={() => handleResolveJoinRequest(req.id, req.username, true)} className="bg-indigo-600 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase">Accept</button>
                <button onClick={() => handleResolveJoinRequest(req.id, req.username, false)} className="bg-slate-100 text-slate-400 px-8 py-3 rounded-xl text-[10px] font-black uppercase">Decline</button>
              </div>
            </div>
          ))}
          {joinRequests.length === 0 && <p className="p-20 text-center text-[10px] font-black uppercase text-slate-300 italic">No pending admission requests.</p>}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-bottom-4">
          <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 italic">Ranking Matrix Hierarchy</h4>
            <div className="space-y-2">
              {(tournament.rankingCriteriaOrder || ['MATCHES_WON', 'SETS_WON', 'POINTS_DIFF', 'HEAD_TO_HEAD']).map((rule, idx) => (
                <div key={rule} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-700">{idx+1}. {rule.replace(/_/g, ' ')}</span>
                  <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { /* reorder logic */ }} className="p-2 hover:bg-slate-200 rounded-lg text-slate-400">↑</button>
                    <button onClick={() => { /* reorder logic */ }} className="p-2 hover:bg-slate-200 rounded-lg text-slate-400">↓</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-8">
             <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic mb-6">Security Access PIN</h4>
               <div className="flex space-x-2">
                 <input type="text" placeholder="PIN" className="flex-1 p-4 bg-slate-50 rounded-2xl text-center text-xl font-black outline-none border-2 border-transparent focus:border-indigo-500" value={tempPin} onChange={e => setTempPin(e.target.value)} />
                 <button onClick={handleUpdatePin} className="bg-slate-900 text-white px-6 rounded-2xl font-black uppercase text-[10px] shadow-lg">Update PIN</button>
               </div>
             </div>
             {isOrganizer && (
               <div className="bg-rose-50 p-8 rounded-[2rem] border border-rose-100 space-y-4">
                  <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest italic">Danger Zone</h4>
                  <p className="text-[10px] font-bold text-rose-400 uppercase leading-relaxed">Permanently delete this arena and all associated matches, teams, and data.</p>
                  <button onClick={handleDeleteArena} className="w-full bg-rose-500 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] shadow-xl hover:bg-rose-600 transition-all">Delete Arena Permanently</button>
               </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
};

const TabButton = ({ active, onClick, label }: any) => (
  <button onClick={onClick} className={`px-10 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${active ? 'bg-indigo-600 text-white shadow-2xl scale-105' : 'text-slate-400 hover:text-slate-600 bg-white shadow-sm border border-slate-50'}`}>{label}</button>
);

export default TournamentDetails;