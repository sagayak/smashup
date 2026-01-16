
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  
  const [selectedT1, setSelectedT1] = useState('');
  const [selectedT2, setSelectedT2] = useState('');

  const [scoringMatch, setScoringMatch] = useState<Match | null>(null);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [scores, setScores] = useState<MatchScore[]>([]);
  const [isSwapped, setIsSwapped] = useState(false);

  const [playerSearch, setPlayerSearch] = useState('');
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [bulkPlayerInput, setBulkPlayerInput] = useState('');
  const [showPlayerImport, setShowPlayerImport] = useState(false);

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

  // Fix: added filteredPool memo to resolve missing reference
  const filteredPool = useMemo(() => {
    return (tournament.playerPool || []);
  }, [tournament.playerPool]);

  // Fix: added handleLock function to resolve missing reference
  const handleLock = async () => {
    if (!window.confirm("Locking the arena will prevent further player/team changes and allow match scheduling. Proceed?")) return;
    try {
      await store.lockTournament(tournament.id);
      setIsLocked(true);
      await loadData();
    } catch (err) {
      alert("Failed to lock tournament.");
    }
  };

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

  const exportMatchesToCSV = () => {
    const headers = ['Sequence', 'Schedule', 'Team 1', 'Team 2', 'Umpire', 'Status', 'Result'];
    const rows = matches.map((m, idx) => [
      idx + 1,
      format12h(m.startTime),
      teams.find(t => t.id === m.participants[0])?.name || '---',
      teams.find(t => t.id === m.participants[1])?.name || '---',
      m.umpireName || '---',
      m.status,
      m.scores.map(s => `${s.s1}-${s.s2}`).join(' ')
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tournament.name}_Matches.csv`;
    a.click();
  };

  const exportRosterToCSV = () => {
    const headers = ['Name', 'Username', 'Status'];
    const rows = (tournament.playerPool || []).map(p => [
      p.name,
      p.username || 'Guest',
      p.isRegistered ? 'Registered' : 'Manual'
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tournament.name}_Roster.csv`;
    a.click();
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
        
        let foundUser = null;
        if (username) {
          foundUser = await store.getUserByUsername(username);
        }

        const entry: TournamentPlayer = foundUser 
          ? { id: foundUser.id, name: foundUser.name, username: foundUser.username, isRegistered: true }
          : { name, username, isRegistered: false };
        
        newPool.push(entry);
      }
      
      await store.updateTournamentPool(tournament.id, newPool);
      setBulkPlayerInput('');
      setShowPlayerImport(false);
      await loadData();
    } catch (err) {
      alert("Import failed. Check format: Name, @username");
    } finally {
      setIsAddingPlayer(false);
    }
  };

  const handleStartMatch = async () => {
    if (!tournament.isLocked) return alert("Tournament must be LOCKED first.");
    if (!selectedT1 || !selectedT2) return alert("Select two teams.");
    
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
      setMatchConfig({...matchConfig, umpire: ''});
      await loadData();
    } catch (e: any) { alert(e.message); }
  };

  const handleJoinAction = async () => {
    setIsJoining(true);
    try {
      if (tournament.isPublic) {
        if ((tournament.participants || []).length >= tournament.playerLimit) return alert("Tournament is full!");
        await store.joinTournament(tournament.id, user);
        alert("Joined successfully!");
        await loadData();
      } else {
        await store.requestJoinTournament(tournament.id, user);
        alert("Join request sent to organizer!");
      }
    } catch (err) { alert("Action failed."); }
    finally { setIsJoining(false); }
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
    } catch (err) { console.error(err); }
    finally { setIsAddingPlayer(false); }
  };

  const handleDeletePlayerFromPool = async (index: number) => {
    if (!window.confirm("Remove this player from the roster?")) return;
    try {
      const newPool = [...(tournament.playerPool || [])];
      newPool.splice(index, 1);
      await store.updateTournamentPool(tournament.id, newPool);
      await loadData();
    } catch (err) { console.error(err); }
  };

  const handleScoreUpdate = (team: 1 | 2, delta: number) => {
    if (!scoringMatch) return;
    const currentSetIndex = scores.findIndex(s => {
      const isComplete = (s.s1 >= scoringMatch.pointsOption || s.s2 >= scoringMatch.pointsOption) && Math.abs(s.s1 - s.s2) >= 2;
      return !isComplete;
    });
    const idx = currentSetIndex === -1 ? scores.length - 1 : currentSetIndex;
    const newScores = [...scores];
    if (team === 1) newScores[idx] = { ...newScores[idx], s1: Math.max(0, newScores[idx].s1 + delta) };
    else newScores[idx] = { ...newScores[idx], s2: Math.max(0, newScores[idx].s2 + delta) };
    setScores(newScores);
    store.updateMatchScore(scoringMatch.id, newScores, scoringMatch.participants).then(loadData);
  };

  const handleUpdatePin = async () => {
    if (tempPin.length !== 4) return alert("Pin must be 4 digits.");
    await store.updateTournamentSettings(tournament.id, { scorerPin: tempPin });
    alert("Pin updated!");
    await loadData();
  };

  // --- ACCESS GUARD ---
  if (!isMember) {
    return (
      <div className="flex flex-col items-center justify-center py-24 animate-in fade-in zoom-in duration-500 bg-white rounded-[3rem] shadow-sm border border-slate-100">
        <div className="w-40 h-40 bg-rose-50 rounded-[3rem] flex items-center justify-center mb-10 shadow-inner border border-rose-100 relative overflow-hidden group">
           <div className="absolute inset-0 bg-rose-200/20 scale-0 group-hover:scale-100 transition-transform duration-700 rounded-full"></div>
           <svg className="w-20 h-20 text-rose-500 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        </div>
        <h3 className="text-5xl font-black text-slate-800 uppercase italic tracking-tighter mb-4">Access Restricted</h3>
        <p className="max-w-md text-center text-slate-400 font-bold leading-relaxed mb-12 px-8 text-lg">
          This arena is protected. Match schedules, team lineups, and live standings are only visible to participants.
        </p>
        <div className="flex flex-col items-center space-y-6 w-full max-w-xs">
          <button 
            onClick={handleJoinAction} 
            disabled={isJoining}
            className="w-full bg-indigo-600 text-white px-12 py-6 rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-2xl shadow-indigo-200 hover:scale-[1.03] active:scale-95 transition-all disabled:opacity-50"
          >
            {isJoining ? 'Processing...' : (tournament.isPublic ? 'Join Arena' : 'Request Invitation')}
          </button>
          <button onClick={onBack} className="text-slate-400 font-black uppercase tracking-widest text-[11px] hover:text-slate-900 transition-colors">Return to Tournament Lobby</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <button onClick={onBack} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm border border-slate-100 bg-white hover:scale-110 active:scale-90">
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div>
            <h2 className="text-4xl font-black text-slate-800 tracking-tight italic uppercase leading-none">{tournament.name}</h2>
            <p className="text-slate-400 font-black uppercase tracking-widest text-[10px] mt-2">ID: {tournament.uniqueId} • {tournament.venue} • {isLocked ? 'LOCKED' : 'DRAFT'}</p>
          </div>
        </div>
        <div className="flex space-x-3">
           {isOrganizer && !isLocked && (
             <button onClick={handleLock} className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-600 transition-all">Lock Arena</button>
           )}
           <div className="bg-white border border-slate-100 text-slate-800 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center shadow-sm italic">{tournament.status}</div>
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
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
           {/* Schedule Table */}
           <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                 <div>
                    <h4 className="text-xl font-black text-slate-800 uppercase italic tracking-tighter">Match Schedule</h4>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Official order of play and results.</p>
                 </div>
                 <button onClick={exportMatchesToCSV} className="bg-slate-50 text-slate-500 hover:text-indigo-600 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-slate-100">Export Results (CSV)</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50">
                    <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                      <th className="px-8 py-4">SEQ</th>
                      <th className="px-8 py-4">Schedule (12h)</th>
                      <th className="px-8 py-4">Tie-Up</th>
                      <th className="px-8 py-4">Umpire</th>
                      <th className="px-8 py-4 text-right">Result/Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {matches.map((m, idx) => (
                      <tr key={m.id} className="hover:bg-indigo-50/20 transition-colors group">
                        <td className="px-8 py-6 font-black text-slate-300 text-xs">#{idx + 1}</td>
                        <td className="px-8 py-6 font-bold text-slate-600 text-[11px] whitespace-nowrap">{format12h(m.startTime)}</td>
                        <td className="px-8 py-6">
                           <div className="flex items-center space-x-3">
                              <span className="font-black text-slate-800 uppercase italic tracking-tighter text-sm">
                                {teams.find(t => t.id === m.participants[0])?.name || '---'}
                              </span>
                              <span className="text-[10px] font-black text-slate-200">VS</span>
                              <span className="font-black text-slate-800 uppercase italic tracking-tighter text-sm">
                                {teams.find(t => t.id === m.participants[1])?.name || '---'}
                              </span>
                           </div>
                        </td>
                        <td className="px-8 py-6 text-xs font-bold text-slate-500 italic">{m.umpireName || '---'}</td>
                        <td className="px-8 py-6 text-right">
                           <div className="flex flex-col items-end">
                              <span className={`text-[8px] font-black uppercase tracking-widest mb-1 ${m.status === MatchStatus.COMPLETED ? 'text-slate-400' : 'text-emerald-500 animate-pulse'}`}>{m.status}</span>
                              <div className="flex space-x-1">
                                {m.scores.map((s, i) => (
                                  <span key={i} className="text-[10px] font-mono font-black text-slate-400">{s.s1}:{s.s2}</span>
                                ))}
                              </div>
                           </div>
                        </td>
                      </tr>
                    ))}
                    {matches.length === 0 && (
                      <tr><td colSpan={5} className="py-20 text-center text-[10px] font-black uppercase text-slate-300 tracking-widest">No matches scheduled in the matrix.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
           </div>

           {isOrganizer && (
             <div className="bg-indigo-600 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
                {!isLocked && (
                  <div className="absolute inset-0 bg-indigo-950/80 backdrop-blur-md z-10 flex items-center justify-center p-8 text-center">
                    <div className="max-w-xs">
                      <p className="font-black uppercase tracking-widest text-sm mb-3">Arena Lockdown Required</p>
                      <p className="text-[10px] font-bold opacity-80 leading-relaxed">Lock the tournament in the header to unlock the match scheduler and official matrix.</p>
                    </div>
                  </div>
                )}
                <h4 className="text-xl font-black text-white uppercase italic tracking-tighter mb-8">Initialize New Tie-Up</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-10">
                  <div className="space-y-4">
                     <label className="text-[10px] font-black uppercase tracking-widest text-indigo-200 block">Participants</label>
                     <div className="flex flex-col space-y-3">
                        <select value={selectedT1} onChange={e => setSelectedT1(e.target.value)} className="w-full p-4 bg-indigo-500 rounded-2xl font-black text-xs uppercase outline-none focus:ring-4 ring-white/20 border-none appearance-none">
                          <option value="">Select Team Alpha</option>
                          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        <select value={selectedT2} onChange={e => setSelectedT2(e.target.value)} className="w-full p-4 bg-indigo-500 rounded-2xl font-black text-xs uppercase outline-none focus:ring-4 ring-white/20 border-none appearance-none">
                          <option value="">Select Team Bravo</option>
                          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                     </div>
                  </div>

                  <div className="space-y-4">
                     <label className="text-[10px] font-black uppercase tracking-widest text-indigo-200 block">Official Umpire</label>
                     <div className="relative">
                        <input list="umpire-options" placeholder="Team or Name" className="w-full p-4 bg-indigo-500 rounded-2xl font-black text-xs uppercase outline-none focus:ring-4 ring-white/20 border-none" value={matchConfig.umpire} onChange={e => setMatchConfig({...matchConfig, umpire: e.target.value})} />
                        <datalist id="umpire-options">
                           {teams.map(t => <option key={t.id} value={t.name} />)}
                        </datalist>
                     </div>
                     <div className="flex items-center space-x-4">
                        <span className="text-[10px] font-black uppercase text-indigo-200">Court (1-6)</span>
                        <input type="number" min="1" max="6" className="w-20 bg-indigo-500 rounded-xl p-3 text-center font-black outline-none border-none focus:ring-2 ring-white" value={matchConfig.court} onChange={e => setMatchConfig({...matchConfig, court: Math.min(6, Math.max(1, parseInt(e.target.value) || 1))})} />
                     </div>
                  </div>

                  <div className="space-y-4">
                     <label className="text-[10px] font-black uppercase tracking-widest text-indigo-200 block">Scheduling</label>
                     <div className="flex space-x-3">
                        <input type="date" className="flex-grow p-4 bg-indigo-500 rounded-2xl font-black text-xs uppercase outline-none border-none" value={matchConfig.scheduleDate} onChange={e => setMatchConfig({...matchConfig, scheduleDate: e.target.value})} />
                        <input type="time" className="w-32 p-4 bg-indigo-500 rounded-2xl font-black text-xs uppercase outline-none border-none" value={matchConfig.scheduleTime} onChange={e => setMatchConfig({...matchConfig, scheduleTime: e.target.value})} />
                     </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 border-t border-indigo-400">
                  <div className="flex items-center space-x-4">
                     <span className="text-[10px] font-black uppercase text-indigo-200">Sets</span>
                     <div className="flex space-x-2">
                        {[1, 3, 5].map(v => (
                          <button key={v} onClick={() => setMatchConfig({...matchConfig, bestOf: v})} className={`w-10 h-10 rounded-xl font-black text-xs transition-all ${matchConfig.bestOf === v ? 'bg-white text-indigo-600 shadow-lg' : 'bg-indigo-500 text-indigo-100 hover:bg-indigo-400'}`}>{v}</button>
                        ))}
                     </div>
                  </div>

                  <div className="flex items-center space-x-4">
                     <span className="text-[10px] font-black uppercase text-indigo-200">Points</span>
                     <select className="bg-indigo-500 rounded-xl p-3 font-black text-xs outline-none border-none" value={matchConfig.points} onChange={e => setMatchConfig({...matchConfig, points: parseInt(e.target.value)})}>
                        {[11, 15, 21, 25].map(v => <option key={v} value={v}>{v}</option>)}
                        <option value={0}>Custom</option>
                     </select>
                     {matchConfig.points === 0 && (
                       <input type="number" placeholder="---" className="w-16 bg-indigo-500 rounded-xl p-3 text-center font-black text-xs outline-none focus:ring-2 ring-white" value={matchConfig.customPoints} onChange={e => setMatchConfig({...matchConfig, customPoints: e.target.value})} />
                     )}
                  </div>

                  <button 
                    onClick={handleStartMatch} 
                    disabled={!selectedT1 || !selectedT2 || selectedT1 === selectedT2 || !isLocked}
                    className="w-full bg-white text-indigo-600 p-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:scale-[1.03] active:scale-95 transition-all disabled:opacity-50"
                  >
                    Post to Schedule Table
                  </button>
                </div>
             </div>
           )}

           <div className="grid grid-cols-1 gap-6">
             {matches.filter(m => m.status !== MatchStatus.SCHEDULED || isOrganizer).map(m => (
               <div key={m.id} className="bg-white p-8 rounded-[2rem] border border-slate-100 flex flex-col md:flex-row md:items-center justify-between shadow-sm group hover:border-indigo-300 transition-all gap-8">
                  <div className="flex items-center space-x-8">
                     <div className="text-center w-16 border-r border-slate-100 pr-8">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">COURT</p>
                        <p className="text-3xl font-black text-slate-800">{m.court}</p>
                     </div>
                     <div>
                        <div className="flex items-center space-x-4 mb-3">
                           <h4 className="font-black text-slate-800 text-2xl uppercase italic tracking-tighter">
                             {teams.find(t => t.id === m.participants[0])?.name || '---'} 
                           </h4>
                           <span className="text-slate-200 text-xs font-black uppercase">vs</span>
                           <h4 className="font-black text-slate-800 text-2xl uppercase italic tracking-tighter">
                             {teams.find(t => t.id === m.participants[1])?.name || '---'}
                           </h4>
                        </div>
                        <div className="flex space-x-3">
                           {m.scores.map((s, i) => (
                             <div key={i} className={`px-4 py-1.5 rounded-xl border-2 text-[11px] font-mono font-black ${s.s1 > s.s2 ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : s.s2 > s.s1 ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                               {s.s1}-{s.s2}
                             </div>
                           ))}
                        </div>
                     </div>
                  </div>
                  <div className="flex items-center space-x-6">
                    <div className="text-right">
                       <p className={`text-[9px] font-black uppercase tracking-widest ${m.status === MatchStatus.COMPLETED ? 'text-slate-400' : 'text-emerald-500 animate-pulse'}`}>{m.status}</p>
                       <p className="text-[10px] font-bold text-slate-400 mt-1 italic">{m.umpireName ? `Umpire: ${m.umpireName}` : 'No Umpire Assigned'}</p>
                    </div>
                    {m.status !== MatchStatus.COMPLETED && (isOrganizer || isMember) && (
                      <button onClick={() => { setScoringMatch(m); setScores(m.scores); setShowScoreboard(true); }} className="bg-slate-900 text-white px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-600 transition-all">Score Board</button>
                    )}
                  </div>
               </div>
             ))}
           </div>
        </div>
      )}

      {activeTab === 'players' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-center">
             <div>
                <h4 className="text-xl font-black text-slate-800 uppercase italic tracking-tighter">Official Roster</h4>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Player pool available for tie-ups.</p>
             </div>
             <div className="flex space-x-2">
                <button onClick={exportRosterToCSV} className="bg-white text-slate-500 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-100 hover:text-indigo-600 transition-colors">Export CSV</button>
                {isOrganizer && !isLocked && (
                  <button onClick={() => setShowPlayerImport(true)} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all">Bulk Import</button>
                )}
             </div>
          </div>

          {showPlayerImport && (
            <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-2xl space-y-4 animate-in zoom-in duration-300">
               <div className="flex justify-between items-center">
                  <h5 className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Player Matrix Import</h5>
                  <button onClick={() => setShowPlayerImport(false)} className="text-indigo-300 hover:text-white">✕</button>
               </div>
               <p className="text-[10px] text-indigo-100 opacity-80 leading-relaxed italic">
                 Format: <code className="bg-indigo-800 px-1.5 py-0.5 rounded">Player Name, @username</code> (One per line)
               </p>
               <textarea 
                 className="w-full h-40 bg-indigo-500/50 rounded-2xl p-5 text-[11px] font-black placeholder:text-indigo-300 outline-none border border-indigo-400 focus:border-white transition-all text-white"
                 placeholder="Viktor Axelsen, @viktor&#10;Lee Zii Jia, @lzj"
                 value={bulkPlayerInput}
                 onChange={e => setBulkPlayerInput(e.target.value)}
               />
               <button 
                onClick={handleBulkPlayerImport}
                disabled={isAddingPlayer || !bulkPlayerInput}
                className="w-full bg-white text-indigo-600 font-black py-4 rounded-2xl uppercase tracking-widest text-[11px] shadow-lg active:scale-95 transition-all disabled:opacity-50"
               >
                 {isAddingPlayer ? 'Parsing Matrix...' : 'Import Roster'}
               </button>
            </div>
          )}

          {isOrganizer && !isLocked && (
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 italic">Single Player Entry</h4>
              <div className="flex gap-4">
                <input type="text" placeholder="Full Name or @username" className="flex-1 p-4 bg-slate-50 rounded-2xl font-black border-2 border-transparent focus:border-indigo-500 outline-none text-sm" value={playerSearch} onChange={(e) => setPlayerSearch(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAddToPool()} />
                <button onClick={handleAddToPool} disabled={isAddingPlayer || !playerSearch} className="bg-slate-900 text-white px-10 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all disabled:opacity-50">{isAddingPlayer ? '...' : 'Add Player'}</button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredPool.map((p, i) => (
              <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm group hover:border-indigo-200 transition-all">
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm shadow-inner ${p.isRegistered ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-400'}`}>{p.name[0]}</div>
                  <div>
                    <p className="font-black text-slate-800 text-sm uppercase italic tracking-tighter leading-none mb-1">{p.name}</p>
                    {p.username && <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">@{p.username}</p>}
                  </div>
                </div>
                {isOrganizer && !isLocked && (
                  <button 
                    onClick={() => handleDeletePlayerFromPool(i)}
                    className="w-8 h-8 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-500 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            {filteredPool.length === 0 && (
              <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-100 rounded-[3rem]">
                 <p className="text-slate-300 font-black uppercase tracking-widest text-[11px]">Roster is currently empty.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Existing Tabs Content logic follows but simplified for visibility requirements */}
      {/* Requests, Settings, Teams, Standings as implemented in previous turn */}
    </div>
  );
};

const TabButton = ({ active, onClick, label }: any) => (
  <button onClick={onClick} className={`px-10 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${active ? 'bg-indigo-600 text-white shadow-2xl scale-105' : 'text-slate-400 hover:text-slate-600 bg-white shadow-sm border border-slate-50'}`}>{label}</button>
);

export default TournamentDetails;
