
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

  // Teams Tab State
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedPoolPlayers, setSelectedPoolPlayers] = useState<string[]>([]);
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [bulkTeamInput, setBulkTeamInput] = useState('');

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
        let foundUser = username ? await store.getUserByUsername(username) : null;
        newPool.push(foundUser 
          ? { id: foundUser.id, name: foundUser.name, username: foundUser.username, isRegistered: true }
          : { name, username, isRegistered: false });
      }
      await store.updateTournamentPool(tournament.id, newPool);
      setBulkPlayerInput('');
      setShowPlayerImport(false);
      await loadData();
    } catch (err) { alert("Import failed."); }
    finally { setIsAddingPlayer(false); }
  };

  const handleLock = async () => {
    if (!window.confirm("Locking the arena will allow match scheduling. Proceed?")) return;
    await store.lockTournament(tournament.id);
    setIsLocked(true);
    await loadData();
  };

  const handleStartMatch = async () => {
    if (!tournament.isLocked) return alert("Tournament must be LOCKED first.");
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

  const handleJoinAction = async () => {
    setIsJoining(true);
    try {
      if (tournament.isPublic) {
        await store.joinTournament(tournament.id, user);
        alert("Joined!");
      } else {
        await store.requestJoinTournament(tournament.id, user);
        alert("Request sent!");
      }
      await loadData();
    } finally { setIsJoining(false); }
  };

  const handleResolveJoinRequest = async (id: string, username: string, approved: boolean) => {
    await store.resolveJoinRequest(id, tournament.id, username, approved);
    await loadData();
  };

  const moveRankingCriterion = (index: number, direction: 'up' | 'down') => {
    const order = [...(tournament.rankingCriteriaOrder || ['MATCHES_WON', 'SETS_WON', 'POINTS_DIFF', 'HEAD_TO_HEAD'])];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    store.updateTournamentSettings(tournament.id, { rankingCriteriaOrder: order }).then(loadData);
  };

  const handleCreateTeam = async () => {
    await store.addTeam({ tournamentId: tournament.id, name: newTeamName, playerIds: [], customPlayerNames: selectedPoolPlayers });
    setNewTeamName('');
    setSelectedPoolPlayers([]);
    await loadData();
  };

  // Fix: Added missing handleDeletePlayerFromPool function to remove a player from the tournament roster
  const handleDeletePlayerFromPool = async (index: number) => {
    if (!window.confirm("Remove player from roster?")) return;
    const newPool = [...(tournament.playerPool || [])];
    newPool.splice(index, 1);
    try {
      await store.updateTournamentPool(tournament.id, newPool);
      await loadData();
    } catch (err) {
      alert("Failed to delete player.");
    }
  };

  // Fix: Added missing handleUpdatePin function to update the tournament scorer PIN
  const handleUpdatePin = async () => {
    try {
      await store.updateTournamentSettings(tournament.id, { scorerPin: tempPin });
      alert("PIN updated successfully.");
      await loadData();
    } catch (err) {
      alert("Failed to update PIN.");
    }
  };

  // --- ACCESS GUARD ---
  if (!isMember) {
    return (
      <div className="flex flex-col items-center justify-center py-24 animate-in fade-in zoom-in duration-500 bg-white rounded-[3rem] shadow-sm border border-slate-100">
        <div className="w-40 h-40 bg-rose-50 rounded-[3rem] flex items-center justify-center mb-10 shadow-inner border border-rose-100 relative overflow-hidden group">
           <svg className="w-20 h-20 text-rose-500 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        </div>
        <h3 className="text-5xl font-black text-slate-800 uppercase italic tracking-tighter mb-4 text-center px-4">Access Restricted</h3>
        <p className="max-w-md text-center text-slate-400 font-bold leading-relaxed mb-12 px-8 text-lg">Match schedules and rosters are internal. Request access to join this arena.</p>
        <button onClick={handleJoinAction} disabled={isJoining} className="bg-indigo-600 text-white px-12 py-6 rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-2xl shadow-indigo-200 hover:scale-[1.03] active:scale-95 transition-all">
          {isJoining ? 'Processing...' : (tournament.isPublic ? 'Join Arena' : 'Request Invitation')}
        </button>
        <button onClick={onBack} className="mt-6 text-slate-400 font-black uppercase tracking-widest text-[11px]">Back to Lobby</button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <button onClick={onBack} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm border border-slate-100 bg-white hover:scale-110 active:scale-90"><svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></button>
          <div>
            <h2 className="text-4xl font-black text-slate-800 tracking-tight italic uppercase leading-none">{tournament.name}</h2>
            <p className="text-slate-400 font-black uppercase tracking-widest text-[10px] mt-2">ID: {tournament.uniqueId} • {tournament.venue} • {isLocked ? 'LOCKED' : 'DRAFT'}</p>
          </div>
        </div>
        <div className="flex space-x-3">
          {isOrganizer && !isLocked && <button onClick={handleLock} className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl">Lock Arena</button>}
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
            <table className="w-full text-left">
              <thead className="bg-slate-50/50">
                <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-8 py-4">SEQ</th>
                  <th className="px-8 py-4">Schedule (12h)</th>
                  <th className="px-8 py-4">Tie-Up</th>
                  <th className="px-8 py-4">Umpire</th>
                  <th className="px-8 py-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {matches.map((m, idx) => (
                  <tr key={m.id} className="hover:bg-indigo-50/20">
                    <td className="px-8 py-6 font-black text-slate-300">#{idx+1}</td>
                    <td className="px-8 py-6 font-bold text-slate-600 text-[11px]">{format12h(m.startTime)}</td>
                    <td className="px-8 py-6 font-black text-slate-800 uppercase italic text-sm">
                      {teams.find(t => t.id === m.participants[0])?.name} vs {teams.find(t => t.id === m.participants[1])?.name}
                    </td>
                    <td className="px-8 py-6 text-xs font-bold text-slate-500">{m.umpireName || '---'}</td>
                    <td className="px-8 py-6 text-right font-black uppercase text-[10px] text-slate-400">{m.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {isOrganizer && (
            <div className="bg-indigo-600 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
              {!isLocked && <div className="absolute inset-0 bg-indigo-950/80 backdrop-blur-md z-10 flex items-center justify-center p-8 text-center"><p className="font-black uppercase tracking-widest text-sm">Arena Lockdown Required to Schedule</p></div>}
              <h4 className="text-xl font-black uppercase italic tracking-tighter mb-8">Schedule Tie-Up</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-3">
                  <select value={selectedT1} onChange={e => setSelectedT1(e.target.value)} className="w-full p-4 bg-indigo-500 rounded-2xl font-black text-xs uppercase outline-none">{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                  <select value={selectedT2} onChange={e => setSelectedT2(e.target.value)} className="w-full p-4 bg-indigo-500 rounded-2xl font-black text-xs uppercase outline-none">{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                </div>
                <div className="space-y-3">
                  <input list="umpire-options" placeholder="Umpire (Team or Name)" className="w-full p-4 bg-indigo-500 rounded-2xl font-black text-xs uppercase outline-none" value={matchConfig.umpire} onChange={e => setMatchConfig({...matchConfig, umpire: e.target.value})} />
                  <div className="flex items-center space-x-3"><span className="text-[10px] font-black uppercase text-indigo-200">Court (1-6)</span><input type="number" min="1" max="6" className="w-20 bg-indigo-500 rounded-xl p-3 text-center font-black outline-none" value={matchConfig.court} onChange={e => setMatchConfig({...matchConfig, court: Math.min(6, Math.max(1, parseInt(e.target.value) || 1))})} /></div>
                </div>
                <div className="space-y-3">
                  <input type="date" className="w-full p-4 bg-indigo-500 rounded-2xl font-black text-xs outline-none" value={matchConfig.scheduleDate} onChange={e => setMatchConfig({...matchConfig, scheduleDate: e.target.value})} />
                  <input type="time" className="w-full p-4 bg-indigo-500 rounded-2xl font-black text-xs outline-none" value={matchConfig.scheduleTime} onChange={e => setMatchConfig({...matchConfig, scheduleTime: e.target.value})} />
                </div>
              </div>
              <button onClick={handleStartMatch} disabled={!isLocked} className="mt-8 w-full bg-white text-indigo-600 p-4 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all disabled:opacity-50">Post to Schedule</button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'players' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4">
          <div className="flex justify-between items-center">
            <h4 className="text-xl font-black text-slate-800 uppercase italic">Official Roster</h4>
            <div className="flex space-x-2">
              <button onClick={exportRosterToCSV} className="bg-white text-slate-500 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase border border-slate-100">Export CSV</button>
              {isOrganizer && !isLocked && <button onClick={() => setShowPlayerImport(true)} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg">Bulk Import</button>}
            </div>
          </div>
          {showPlayerImport && (
            <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-2xl space-y-4 animate-in zoom-in">
              <textarea className="w-full h-32 bg-indigo-500/50 rounded-2xl p-5 text-[11px] font-black outline-none text-white" placeholder="Name, @username" value={bulkPlayerInput} onChange={e => setBulkPlayerInput(e.target.value)} />
              <button onClick={handleBulkPlayerImport} className="w-full bg-white text-indigo-600 font-black py-4 rounded-2xl uppercase text-[11px]">Import Matrix</button>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {filteredPool.map((p, i) => (
              <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 flex items-center justify-between group">
                <div className="flex items-center space-x-4"><div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center font-black text-slate-400">{p.name[0]}</div><div><p className="font-black text-slate-800 text-sm italic">{p.name}</p></div></div>
                {isOrganizer && !isLocked && <button onClick={() => handleDeletePlayerFromPool(i)} className="text-rose-400 font-black text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">DELETE</button>}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'teams' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4">
          {isOrganizer && !isLocked && (
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
              <input type="text" placeholder="Team Name" className="w-full p-4 bg-slate-50 rounded-2xl font-black outline-none border-2 border-transparent focus:border-indigo-500" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} />
              <button onClick={handleCreateTeam} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px]">Create Team</button>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {teams.map(t => (
              <div key={t.id} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm group hover:border-indigo-400 transition-all text-left">
                <h5 className="font-black text-slate-800 uppercase italic text-2xl mb-2">{t.name}</h5>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'standings' && (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden animate-in zoom-in">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50">
              <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest"><th className="px-10 py-6">Rank</th><th className="px-4 py-6">Team</th><th className="px-4 py-6 text-center">Played</th><th className="px-4 py-6 text-center">W-L</th><th className="px-4 py-6 text-center">Pts</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {standings.map((s, idx) => (
                <tr key={s.id}>
                  <td className="px-10 py-6 font-black text-slate-800">{idx+1}</td>
                  <td className="px-4 py-6 font-black text-slate-800 uppercase italic">{s.name}</td>
                  <td className="px-4 py-6 text-center font-bold text-slate-400">{s.played}</td>
                  <td className="px-4 py-6 text-center font-black text-emerald-500">{s.matchesWon}-{s.played-s.matchesWon}</td>
                  <td className="px-4 py-6 text-center font-black text-indigo-600">{s.pointsScored - s.pointsConceded}</td>
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
              <div className="flex space-x-3"><button onClick={() => handleResolveJoinRequest(req.id, req.username, true)} className="bg-indigo-600 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase">Accept</button><button onClick={() => handleResolveJoinRequest(req.id, req.username, false)} className="bg-slate-100 text-slate-400 px-8 py-3 rounded-xl text-[10px] font-black uppercase">Decline</button></div>
            </div>
          ))}
          {joinRequests.length === 0 && <p className="p-20 text-center text-[10px] font-black uppercase text-slate-300">No pending requests.</p>}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-bottom-4">
          <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 italic">Ranking Criteria Order</h4>
            <div className="space-y-2">
              {(tournament.rankingCriteriaOrder || ['MATCHES_WON', 'SETS_WON', 'POINTS_DIFF', 'HEAD_TO_HEAD']).map((rule, idx) => (
                <div key={rule} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-700">{idx+1}. {rule.replace(/_/g, ' ')}</span>
                  <div className="flex space-x-1">
                    <button onClick={() => moveRankingCriterion(idx, 'up')} className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 disabled:opacity-20" disabled={idx === 0}>↑</button>
                    <button onClick={() => moveRankingCriterion(idx, 'down')} className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 disabled:opacity-20" disabled={idx === 3}>↓</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic mb-6">Security & Privacy</h4>
            <div className="flex space-x-2">
              <input type="password" placeholder="PIN" className="flex-1 p-4 bg-slate-50 rounded-2xl text-center text-xl font-black outline-none focus:bg-white" value={tempPin} onChange={e => setTempPin(e.target.value)} />
              <button onClick={handleUpdatePin} className="bg-slate-900 text-white px-6 rounded-2xl font-black uppercase text-[10px]">Update</button>
            </div>
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
