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
  const [pinInput, setPinInput] = useState('');
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [scores, setScores] = useState<MatchScore[]>([]);
  const [isSwapped, setIsSwapped] = useState(false);

  const [playerSearch, setPlayerSearch] = useState('');
  const [rosterFilter, setRosterFilter] = useState('');
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);

  // Team Tab State
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedPoolPlayers, setSelectedPoolPlayers] = useState<string[]>([]);
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [bulkInput, setBulkInput] = useState('');

  const [matchConfig, setMatchConfig] = useState({ points: 21, bestOf: 3, court: 1, umpire: '' });
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
      if (!selectedT1 || !t1StillExists) setSelectedT1(teams[0].id);
      if (!selectedT2 || !t2StillExists) setSelectedT2(teams[1].id);
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

  const isMember = (tournament.participants || []).includes(user.username) || tournament.organizerId === user.id || user.role === UserRole.SUPERADMIN;
  const isOrganizer = user.id === tournament.organizerId || user.role === UserRole.SUPERADMIN;

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
    } catch (err) {
      alert("Action failed.");
    } finally {
      setIsJoining(false);
    }
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
    } catch (err) {
      console.error("Error adding to pool:", err);
    } finally {
      setIsAddingPlayer(false);
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeamName || selectedPoolPlayers.length === 0) return alert("Team name and at least one player required.");
    setIsCreatingTeam(true);
    try {
      const playerIds: string[] = [];
      const customPlayerNames: string[] = [];
      
      selectedPoolPlayers.forEach(pName => {
        const poolPlayer = (tournament.playerPool || []).find(pp => pp.name === pName);
        if (poolPlayer?.id) playerIds.push(poolPlayer.id);
        else customPlayerNames.push(pName);
      });

      await store.addTeam({ 
        tournamentId: tournament.id, 
        name: newTeamName, 
        playerIds, 
        customPlayerNames 
      });
      setNewTeamName('');
      setSelectedPoolPlayers([]);
      await loadData();
    } catch (err) { console.error(err); }
    finally { setIsCreatingTeam(false); }
  };

  const handleBulkImport = async () => {
    if (!bulkInput) return;
    setIsCreatingTeam(true);
    try {
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
          const poolPlayer = (tournament.playerPool || []).find(pp => pp.username?.toLowerCase() === cleaned || pp.name.toLowerCase() === name.toLowerCase());
          if (poolPlayer?.id) playerIds.push(poolPlayer.id);
          else customNames.push(name);
        }
        await store.addTeam({ tournamentId: tournament.id, name: teamName, playerIds, customPlayerNames: customNames });
      }
      setBulkInput('');
      setIsCreatingTeam(false);
      await loadData();
    } catch (err) { console.error(err); }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!window.confirm("Remove this team?")) return;
    await store.deleteTeam(teamId);
    if (activeTeamId === teamId) setActiveTeamId(null);
    await loadData();
  };

  const handleLock = async () => {
    if (!window.confirm("WARNING: Teams and Player Pool cannot be edited after lock. Proceed?")) return;
    try {
      await store.lockTournament(tournament.id);
      await loadData();
    } catch (err) { console.error(err); }
  };

  const handleStartMatch = async () => {
    if (!tournament.isLocked) return alert("Tournament must be LOCKED first.");
    if (!selectedT1 || !selectedT2) return alert("Select two teams.");
    try {
      await store.createMatch({
        tournamentId: tournament.id,
        participants: [selectedT1, selectedT2],
        scores: Array.from({ length: matchConfig.bestOf }, () => ({ s1: 0, s2: 0 })),
        status: MatchStatus.SCHEDULED,
        court: matchConfig.court,
        startTime: new Date().toISOString(),
        pointsOption: matchConfig.points,
        bestOf: matchConfig.bestOf,
        umpireName: matchConfig.umpire
      });
      setMatchConfig({...matchConfig, umpire: ''});
      await loadData();
    } catch (e: any) { alert(e.message); }
  };

  const handleSaveScore = async (currentScores: MatchScore[]) => {
    if (scoringMatch) {
      try {
        await store.updateMatchScore(scoringMatch.id, currentScores, scoringMatch.participants);
        await loadData();
      } catch (err) { console.error(err); }
    }
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
    handleSaveScore(newScores);
  };

  const moveRankingCriterion = (index: number, direction: 'up' | 'down') => {
    const currentOrder = tournament.rankingCriteriaOrder || ['MATCHES_WON', 'SETS_WON', 'POINTS_DIFF', 'HEAD_TO_HEAD'];
    const newOrder = [...currentOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    store.updateTournamentSettings(tournament.id, { rankingCriteriaOrder: newOrder }).then(loadData);
  };

  const handleTogglePrivacy = async (isPublic: boolean) => {
    setTournament(prev => ({ ...prev, isPublic }));
    try {
      await store.updateTournamentSettings(tournament.id, { isPublic });
    } catch (err) {
      alert("Update failed");
      await loadData();
    }
  };

  const handleUpdatePin = async () => {
    if (tempPin.length !== 4) return alert("Pin must be 4 digits.");
    await store.updateTournamentSettings(tournament.id, { scorerPin: tempPin });
    alert("Pin updated!");
    await loadData();
  };

  const handleDeleteTournament = async () => {
    if (!window.confirm("CRITICAL: Permanently delete this tournament? This cannot be undone.")) return;
    setIsDeleting(true);
    try {
      await store.deleteTournament(tournament.id);
      alert("Tournament deleted successfully.");
      onBack();
    } catch (err: any) {
      console.error("Deletion error:", err);
      if (err.code === 'permission-denied') {
        alert("Permission Denied: You do not have authority to delete this tournament or its components.");
      } else {
        alert(`Failed to delete tournament: ${err.message}`);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredPool = tournament.playerPool?.filter(p => 
    p.name.toLowerCase().includes(rosterFilter.toLowerCase()) || 
    p.username?.toLowerCase().includes(rosterFilter.toLowerCase())
  ) || [];

  if (showScoreboard && scoringMatch) {
    const t1 = teams.find(t => t.id === scoringMatch.participants[0]);
    const t2 = teams.find(t => t.id === scoringMatch.participants[1]);
    
    const getInitials = (team?: Team) => {
      if (!team) return "";
      const pNames = [...(team.playerIds.map(pid => allUsers.find(u => u.id === pid)?.name || "")), ...(team.customPlayerNames || [])];
      return pNames.map(n => n.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase()).join(' ');
    };

    const currentSetIndex = scores.findIndex(s => {
      const isComplete = (s.s1 >= scoringMatch.pointsOption || s.s2 >= scoringMatch.pointsOption) && Math.abs(s.s1 - s.s2) >= 2;
      return !isComplete;
    });
    const activeIdx = currentSetIndex === -1 ? scores.length - 1 : currentSetIndex;

    const team1UI = (
      <div className={`flex-1 flex flex-col items-center justify-center p-12 relative overflow-hidden transition-all duration-500 rounded-[3rem] m-4 border-4 ${isSwapped ? 'order-last' : 'order-first'} bg-indigo-950/40 border-indigo-500/30 group`}>
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/10 to-transparent pointer-events-none"></div>
        <div className="z-10 text-center">
          <h3 className="text-6xl font-black text-white uppercase italic tracking-tighter mb-2">{t1?.name}</h3>
          <p className="text-slate-400 font-black uppercase tracking-widest text-xs flex items-center justify-center space-x-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg>
            <span>{getInitials(t1)}</span>
          </p>
          <div className="flex space-x-2 mt-4 justify-center">
            {scores.map((s, idx) => (
              <div key={idx} className={`w-10 h-2 rounded-full ${idx < activeIdx ? (s.s1 > s.s2 ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-slate-700') : (idx === activeIdx ? 'bg-indigo-400/50' : 'bg-slate-800')}`}></div>
            ))}
          </div>
          <div className="relative mt-8">
            <span className="absolute inset-0 flex items-center justify-center text-[15rem] font-black text-white/5 pointer-events-none">1</span>
            <div className="text-[14rem] font-black text-white leading-none tabular-nums drop-shadow-2xl">
              {scores[activeIdx]?.s1 ?? 0}
            </div>
          </div>
          <div className="flex items-center space-x-8 mt-4">
            <button onClick={() => handleScoreUpdate(1, -1)} className="w-24 h-24 rounded-full bg-slate-800/80 text-white text-4xl font-light hover:bg-slate-700 flex items-center justify-center transition-all active:scale-90 border border-white/5">—</button>
            <button onClick={() => handleScoreUpdate(1, 1)} className="w-32 h-32 rounded-full bg-indigo-500 text-white text-5xl font-light hover:bg-indigo-400 shadow-[0_0_30px_rgba(99,102,241,0.4)] flex items-center justify-center transition-all active:scale-90">+</button>
          </div>
        </div>
      </div>
    );

    const team2UI = (
      <div className={`flex-1 flex flex-col items-center justify-center p-12 relative overflow-hidden transition-all duration-500 rounded-[3rem] m-4 border-4 bg-emerald-950/40 border-emerald-500/30 group`}>
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/10 to-transparent pointer-events-none"></div>
        <div className="z-10 text-center">
          <h3 className="text-6xl font-black text-white uppercase italic tracking-tighter mb-2">{t2?.name}</h3>
          <p className="text-slate-400 font-black uppercase tracking-widest text-xs flex items-center justify-center space-x-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg>
            <span>{getInitials(t2)}</span>
          </p>
          <div className="flex space-x-2 mt-4 justify-center">
            {scores.map((s, idx) => (
              <div key={idx} className={`w-10 h-2 rounded-full ${idx < activeIdx ? (s.s2 > s.s1 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-700') : (idx === activeIdx ? 'bg-emerald-400/50' : 'bg-slate-800')}`}></div>
            ))}
          </div>
          <div className="relative mt-8">
            <span className="absolute inset-0 flex items-center justify-center text-[15rem] font-black text-white/5 pointer-events-none">2</span>
            <div className="text-[14rem] font-black text-white leading-none tabular-nums drop-shadow-2xl">
              {scores[activeIdx]?.s2 ?? 0}
            </div>
          </div>
          <div className="flex items-center space-x-8 mt-4">
            <button onClick={() => handleScoreUpdate(2, -1)} className="w-24 h-24 rounded-full bg-slate-800/80 text-white text-4xl font-light hover:bg-slate-700 flex items-center justify-center transition-all active:scale-90 border border-white/5">—</button>
            <button onClick={() => handleScoreUpdate(2, 1)} className="w-32 h-32 rounded-full bg-emerald-500 text-white text-5xl font-light hover:bg-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.4)] flex items-center justify-center transition-all active:scale-90">+</button>
          </div>
        </div>
      </div>
    );

    return (
      <div className="fixed inset-0 bg-[#070b14] z-[500] flex flex-col overflow-hidden animate-in fade-in duration-500 select-none">
        {/* Header Controls */}
        <div className="p-6 flex items-center justify-between z-50">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => { setShowScoreboard(false); setScoringMatch(null); setIsPinVerified(false); }} 
              className="bg-slate-800/80 hover:bg-slate-700 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center space-x-2 transition-all border border-white/5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              <span>Exit</span>
            </button>
            <button className="bg-indigo-600/80 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center space-x-2 transition-all border border-indigo-500/20">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
              <span>Lineup</span>
            </button>
          </div>

          <div className="text-center flex-1 mx-20">
            <p className="text-slate-500 font-black text-[10px] uppercase tracking-[0.3em] mb-3">Match Progression</p>
            <div className="flex items-center justify-center space-x-4">
              {scores.map((s, idx) => (
                <div key={idx} className="flex flex-col items-center">
                  <div className={`w-32 h-2 rounded-full overflow-hidden bg-slate-800 flex border border-white/5`}>
                    {idx < activeIdx ? (
                      <div className={`h-full w-full ${s.s1 > s.s2 ? 'bg-indigo-500 shadow-[0_0_10px_indigo]' : 'bg-emerald-500 shadow-[0_0_10px_emerald]'}`}></div>
                    ) : (idx === activeIdx ? (
                      <div className="h-full w-1/2 bg-slate-600 animate-pulse"></div>
                    ) : null)}
                  </div>
                  <p className={`mt-2 text-[10px] font-black uppercase tracking-widest ${idx === activeIdx ? 'text-white' : 'text-slate-500'}`}>
                    {idx === activeIdx ? `Set ${idx + 1}` : (idx < activeIdx ? `${s.s1}:${s.s2}` : `Set ${idx + 1}`)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <button onClick={() => handleScoreUpdate(isSwapped ? 2 : 1, -1)} className="bg-slate-800/80 hover:bg-slate-700 text-slate-300 px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border border-white/5">Undo</button>
        </div>

        {/* Main Score Area */}
        <div className="flex-grow flex p-6 relative">
          {team1UI}
          {team2UI}
        </div>

        {/* Bottom Bar */}
        <div className="p-8 flex items-center justify-between z-50">
          <button 
            onClick={() => setIsSwapped(!isSwapped)} 
            className="w-16 h-16 rounded-2xl bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-all border border-white/5"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
          
          <div className="flex-1 text-center">
            <div className="bg-slate-900/50 border border-white/5 backdrop-blur-xl px-12 py-3 rounded-full inline-block">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Target Score: {scoringMatch.pointsOption}</span>
            </div>
          </div>

          <div className="w-16 h-16"></div> {/* Spacer for balance */}
        </div>
      </div>
    );
  }

  // --- TEAM DASHBOARD VIEW ---
  const TeamDashboard = () => {
    const team = teams.find(t => t.id === activeTeamId);
    if (!team) return null;

    const teamMatches = matches.filter(m => m.participants.includes(team.id));
    const won = teamMatches.filter(m => m.winnerId === team.id).length;
    const lost = teamMatches.filter(m => m.status === MatchStatus.COMPLETED && m.winnerId && m.winnerId !== team.id).length;
    const scheduled = teamMatches.filter(m => m.status === MatchStatus.SCHEDULED).length;
    const umpireDuty = matches.filter(m => m.umpireName === team.name).length;

    // Head-to-Head calculations
    const h2h = useMemo(() => {
      const results: Record<string, { w: number, l: number, name: string }> = {};
      teams.forEach(t => {
        if (t.id === team.id) return;
        results[t.id] = { w: 0, l: 0, name: t.name };
      });
      teamMatches.filter(m => m.status === MatchStatus.COMPLETED).forEach(m => {
        const oppId = m.participants.find(id => id !== team.id);
        if (oppId && results[oppId]) {
          if (m.winnerId === team.id) results[oppId].w++;
          else results[oppId].l++;
        }
      });
      return Object.values(results).filter(r => (r.w + r.l) > 0);
    }, [teamMatches, teams, team.id]);

    return (
      <div className="space-y-8 animate-in slide-in-from-right duration-300">
        <div className="flex items-center space-x-4">
          <button onClick={() => setActiveTeamId(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors bg-white shadow-sm border border-slate-100">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h3 className="text-3xl font-black text-slate-800 uppercase italic tracking-tighter">{team.name} <span className="text-indigo-600">Overview</span></h3>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatMiniCard label="Scheduled" value={scheduled} color="border-indigo-500 text-indigo-500" />
          <StatMiniCard label="Won" value={won} color="border-emerald-500 text-emerald-500" />
          <StatMiniCard label="Loss" value={lost} color="border-rose-500 text-rose-500" />
          <StatMiniCard label="Umpire Duty" value={umpireDuty} color="border-slate-800 text-slate-800" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Tabular Tie-ups */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Tournament Tie-ups</h4>
              </div>
              <table className="w-full text-left">
                <thead className="bg-slate-50/50">
                  <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="px-6 py-4">Opponent</th>
                    <th className="px-6 py-4 text-center">Score</th>
                    <th className="px-6 py-4 text-center">Result</th>
                    <th className="px-6 py-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {teamMatches.map(m => {
                    const oppId = m.participants.find(id => id !== team.id);
                    const oppName = teams.find(t => t.id === oppId)?.name || 'Unknown';
                    const isWin = m.winnerId === team.id;
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-black text-slate-800 text-xs uppercase italic tracking-tighter">{oppName}</td>
                        <td className="px-6 py-4 text-center font-mono text-xs font-black text-slate-500">
                          {m.scores.map(s => `${s.s1}-${s.s2}`).join(' ')}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {m.status === MatchStatus.COMPLETED ? (
                            <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase ${isWin ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{isWin ? 'Win' : 'Loss'}</span>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`text-[8px] font-black uppercase tracking-widest ${m.status === MatchStatus.LIVE ? 'text-indigo-600 animate-pulse' : 'text-slate-400'}`}>{m.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                  {teamMatches.length === 0 && <tr><td colSpan={4} className="p-12 text-center text-[10px] font-black uppercase text-slate-300 tracking-widest">No ties recorded yet.</td></tr>}
                </tbody>
              </table>
            </div>

            {/* Head to Head Rivalry */}
            <div className="bg-slate-900 rounded-[2rem] p-8 text-white">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic mb-6">Head-to-Head Rivalry</h4>
              <div className="space-y-4">
                {h2h.map(record => (
                  <div key={record.name} className="flex items-center justify-between p-4 bg-slate-800 rounded-2xl border border-slate-700">
                    <span className="text-xs font-black uppercase italic tracking-tighter">{record.name}</span>
                    <div className="flex items-center space-x-4">
                      <div className="text-center">
                        <p className="text-[8px] font-black uppercase text-slate-500 mb-1">Win</p>
                        <p className="text-lg font-black text-emerald-400 leading-none">{record.w}</p>
                      </div>
                      <div className="w-px h-6 bg-slate-700"></div>
                      <div className="text-center">
                        <p className="text-[8px] font-black uppercase text-slate-500 mb-1">Loss</p>
                        <p className="text-lg font-black text-rose-400 leading-none">{record.l}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {h2h.length === 0 && <p className="text-center text-[10px] font-black uppercase text-slate-600 tracking-widest">No head-to-head history in this arena.</p>}
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {/* Team Roster */}
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic mb-6">Lineup Roster</h4>
              <div className="space-y-4">
                {team.playerIds.map(pid => {
                  const u = allUsers.find(x => x.id === pid);
                  return (
                    <div key={pid} className="flex items-center space-x-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center font-black text-indigo-500 text-xs">{u?.name[0]}</div>
                      <div>
                        <p className="text-xs font-black uppercase italic tracking-tighter text-slate-800">{u?.name}</p>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">@{u?.username}</p>
                      </div>
                    </div>
                  );
                })}
                {team.customPlayerNames?.map(name => (
                  <div key={name} className="flex items-center space-x-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-400 text-xs">?</div>
                    <div>
                      <p className="text-xs font-black uppercase italic tracking-tighter text-slate-600">{name}</p>
                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest italic">Guest Entry</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Performance */}
            <div className="bg-indigo-600 p-8 rounded-[2rem] text-white shadow-xl">
              <h4 className="text-[10px] font-black text-indigo-200 uppercase tracking-widest italic mb-6">Recent Form</h4>
              <div className="flex space-x-3">
                {teamMatches.filter(m => m.status === MatchStatus.COMPLETED).slice(0, 5).map((m, i) => (
                  <div key={i} className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shadow-lg ${m.winnerId === team.id ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                    {m.winnerId === team.id ? 'W' : 'L'}
                  </div>
                ))}
                {teamMatches.filter(m => m.status === MatchStatus.COMPLETED).length === 0 && <p className="text-[10px] font-black uppercase text-indigo-300">No results yet.</p>}
              </div>
            </div>

            {isOrganizer && !isLocked && (
              <button 
                onClick={() => handleDeleteTeam(team.id)}
                className="w-full bg-rose-50 text-rose-500 font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] border border-rose-100 hover:bg-rose-500 hover:text-white transition-all shadow-sm"
              >
                Delete Team Forever
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const StatMiniCard = ({ label, value, color }: any) => (
    <div className={`bg-white p-6 rounded-3xl border shadow-sm transition-all hover:scale-105 ${color}`}>
      <p className="text-[9px] font-black uppercase tracking-widest mb-1 opacity-60">{label}</p>
      <p className="text-3xl font-black italic tracking-tighter">{value}</p>
    </div>
  );

  // --- ACCESS GUARD ---
  if (!isMember) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in duration-500">
        <div className="w-32 h-32 bg-indigo-50 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-inner border border-indigo-100">
          <svg className="w-16 h-16 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        </div>
        <h3 className="text-4xl font-black text-slate-800 uppercase italic tracking-tighter mb-4">Protected Arena</h3>
        <p className="max-w-md text-center text-slate-400 font-bold leading-relaxed mb-10 px-6">
          Real-time match data, internal team boards, and official rankings are restricted to joined participants.
        </p>
        <div className="flex flex-col items-center space-y-4">
          <button 
            onClick={handleJoinAction} 
            disabled={isJoining}
            className="bg-indigo-600 text-white px-12 py-5 rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-100 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
          >
            {isJoining ? 'Processing...' : (tournament.isPublic ? 'Join Arena Now' : 'Request Access to Join')}
          </button>
          <button onClick={onBack} className="text-slate-400 font-black uppercase tracking-widest text-[10px] hover:text-slate-600">Return to Lobby</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <button onClick={onBack} className="p-2 hover:bg-white rounded-full transition-colors shadow-sm border border-slate-100 bg-white">
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight italic uppercase">{tournament.name}</h2>
            <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">ID: {tournament.uniqueId} • {tournament.venue} • {isLocked ? 'LOCKED' : 'DRAFT'}</p>
          </div>
        </div>
        <div className="flex space-x-2">
           {isOrganizer && !isLocked && (
             <button onClick={handleLock} className="bg-slate-900 text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">Lock Arena</button>
           )}
           <div className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center">{tournament.status}</div>
        </div>
      </div>

      <div className="flex space-x-2 overflow-x-auto pb-2 no-scrollbar">
        <TabButton active={activeTab === 'matches'} onClick={() => { setActiveTab('matches'); setActiveTeamId(null); }} label="Matches" />
        <TabButton active={activeTab === 'players'} onClick={() => { setActiveTab('players'); setActiveTeamId(null); }} label="Roster" />
        <TabButton active={activeTab === 'teams'} onClick={() => setActiveTab('teams')} label="Teams" />
        <TabButton active={activeTab === 'standings'} onClick={() => { setActiveTab('standings'); setActiveTeamId(null); }} label="Standings" />
        {isOrganizer && <TabButton active={activeTab === 'requests'} onClick={() => { setActiveTab('requests'); setActiveTeamId(null); }} label="Requests" />}
        {isOrganizer && <TabButton active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setActiveTeamId(null); }} label="Settings" />}
      </div>

      {activeTab === 'matches' && (
        <div className="space-y-6">
           {isOrganizer && (
             <div className="bg-indigo-600 p-8 rounded-[2rem] text-white shadow-xl relative overflow-hidden">
                {!isLocked && (
                  <div className="absolute inset-0 bg-indigo-900/80 backdrop-blur-[4px] z-10 flex items-center justify-center p-6 text-center">
                    <div className="bg-white/10 p-6 rounded-3xl border border-white/20">
                      <p className="font-black uppercase tracking-widest text-xs mb-2 text-white">Tie-ups Disabled</p>
                      <p className="text-[10px] font-bold opacity-80 text-white">Arena must be LOCKED before scheduling matches.</p>
                    </div>
                  </div>
                )}
                <h4 className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-6 italic">Initialize New Match</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <select value={selectedT1} onChange={e => setSelectedT1(e.target.value)} className="p-4 bg-indigo-500 rounded-2xl font-black text-xs uppercase outline-none focus:ring-2 ring-white">
                    <option value="">Select Team A</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <div className="flex items-center justify-center font-black italic text-2xl">VS</div>
                  <select value={selectedT2} onChange={e => setSelectedT2(e.target.value)} className="p-4 bg-indigo-500 rounded-2xl font-black text-xs uppercase outline-none focus:ring-2 ring-white">
                    <option value="">Select Team B</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <button onClick={handleStartMatch} disabled={!selectedT1 || !selectedT2 || selectedT1 === selectedT2 || !isLocked} className="bg-white text-indigo-600 p-4 rounded-2xl font-black text-xs uppercase shadow-lg active:scale-95 transition-all disabled:opacity-50">Post Match</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-6 border-t border-indigo-400">
                  <ConfigItem label="Sets" value={matchConfig.bestOf} onChange={(v: string) => setMatchConfig({...matchConfig, bestOf: parseInt(v)})} options={[1,3,5]} />
                  <ConfigItem label="Points" value={matchConfig.points} onChange={(v: string) => setMatchConfig({...matchConfig, points: parseInt(v)})} options={[11,15,21,30]} />
                  <div className="flex items-center space-x-3"><span className="text-[10px] font-black uppercase text-indigo-200">Court</span><input type="number" className="w-12 bg-indigo-500 rounded-lg p-2 text-center font-black outline-none border border-indigo-400" value={matchConfig.court} onChange={e => setMatchConfig({...matchConfig, court: parseInt(e.target.value) || 1})} /></div>
                  <div className="flex items-center space-x-3"><span className="text-[10px] font-black uppercase text-indigo-200">Umpire</span><input type="text" placeholder="Name" className="flex-1 bg-indigo-500 rounded-lg p-2 font-bold text-xs outline-none border border-indigo-400" value={matchConfig.umpire} onChange={e => setMatchConfig({...matchConfig, umpire: e.target.value})} /></div>
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
                        <p className="font-black text-slate-800 text-lg uppercase italic tracking-tighter mb-2">
                          {teams.find(t => t.id === m.participants[0])?.name || '---'} 
                          <span className="text-slate-200 mx-3 lowercase font-medium not-italic">vs</span> 
                          {teams.find(t => t.id === m.participants[1])?.name || '---'}
                        </p>
                        <div className="flex space-x-2">
                           {m.scores.map((s, i) => (
                             <div key={i} className={`px-3 py-1 rounded-lg border text-[10px] font-mono font-black ${s.s1 > s.s2 ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : s.s2 > s.s1 ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-slate-50 border-slate-100'}`}>
                               {s.s1}-{s.s2}
                             </div>
                           ))}
                        </div>
                     </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className={`text-[9px] font-black uppercase tracking-widest ${m.status === MatchStatus.COMPLETED ? 'text-slate-400' : 'text-emerald-500 animate-pulse'}`}>{m.status}</span>
                    {m.status !== MatchStatus.COMPLETED && (
                      <button onClick={() => { setScoringMatch(m); setScores(m.scores); setShowScoreboard(true); }} className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">Open Board</button>
                    )}
                  </div>
               </div>
             ))}
           </div>
        </div>
      )}

      {activeTab === 'teams' && (
        <div className="space-y-8">
           {activeTeamId ? (
             <TeamDashboard />
           ) : (
             <>
               {isOrganizer && !isLocked && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Manual Creation */}
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Create Single Team</h4>
                       <Input label="Team Name" value={newTeamName} onChange={setNewTeamName} placeholder="The Aces" />
                       
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Players from Roster</label>
                          <div className="max-h-40 overflow-y-auto border-2 border-slate-50 rounded-2xl p-4 grid grid-cols-2 gap-2">
                             {(tournament.playerPool || []).map(p => (
                               <button 
                                 key={p.name}
                                 onClick={() => setSelectedPoolPlayers(prev => prev.includes(p.name) ? prev.filter(x => x !== p.name) : [...prev, p.name])}
                                 className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase transition-all border ${selectedPoolPlayers.includes(p.name) ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:border-indigo-100'}`}
                               >
                                 {p.name}
                               </button>
                             ))}
                          </div>
                       </div>

                       <button 
                         onClick={handleCreateTeam} 
                         disabled={isCreatingTeam || !newTeamName || selectedPoolPlayers.length === 0}
                         className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-all disabled:opacity-50"
                       >
                         {isCreatingTeam ? 'Deploying...' : 'Deploy Team'}
                       </button>
                    </div>

                    {/* Bulk Import */}
                    <div className="bg-indigo-600 p-8 rounded-[2rem] text-white shadow-xl space-y-4">
                       <h4 className="text-[10px] font-black text-indigo-200 uppercase tracking-widest italic">Bulk Team Matrix</h4>
                       <p className="text-[10px] text-indigo-100 opacity-80 leading-relaxed font-bold">
                         Format: <code className="bg-indigo-700 px-1 rounded">TeamName, @Username, @Username</code><br/>
                         One team per line. If username is not in roster, it creates a custom entry.
                       </p>
                       <textarea 
                         className="w-full h-40 bg-indigo-500/50 rounded-2xl p-4 text-[11px] font-bold placeholder:text-indigo-300 outline-none border border-indigo-400 focus:border-white transition-all text-white"
                         placeholder="Aces, @user1, @user2&#10;Kings, @user3, @user4"
                         value={bulkInput}
                         onChange={e => setBulkInput(e.target.value)}
                       />
                       <button 
                        onClick={handleBulkImport}
                        disabled={isCreatingTeam || !bulkInput}
                        className="w-full bg-white text-indigo-600 font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all disabled:opacity-50"
                       >
                         {isCreatingTeam ? 'Parsing Matrix...' : 'Import Matrix'}
                       </button>
                    </div>
                 </div>
               )}

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {teams.map(t => (
                    <button 
                      key={t.id} 
                      onClick={() => setActiveTeamId(t.id)}
                      className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm relative group hover:border-indigo-400 hover:-translate-y-1 transition-all text-left"
                    >
                       <h5 className="font-black text-slate-800 uppercase italic tracking-tighter text-2xl mb-2">{t.name}</h5>
                       <div className="flex items-center space-x-2 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                         <span>{t.playerIds.length + (t.customPlayerNames?.length || 0)} Players</span>
                         <span>•</span>
                         <span className="text-indigo-600">View Board →</span>
                       </div>
                    </button>
                  ))}
                  {teams.length === 0 && <div className="col-span-full py-20 text-center bg-white rounded-[2rem] border border-dashed border-slate-200"><p className="text-slate-300 font-black uppercase tracking-widest text-xs">No teams drafted yet.</p></div>}
               </div>
             </>
           )}
        </div>
      )}

      {activeTab === 'standings' && (
        <div className="space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden animate-in zoom-in">
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
                        <td className="px-10 py-6"><span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${idx === 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>{idx + 1}</span></td>
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
          <div className="p-6 bg-slate-900 rounded-3xl text-white">
             <h5 className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-4 italic">Ranking Priority (Rules)</h5>
             <p className="text-[8px] text-slate-400 mb-4 italic uppercase tracking-widest">Organizers can adjust these rules in Settings at any time.</p>
             <div className="flex flex-wrap gap-4">
                {(tournament.rankingCriteriaOrder || ['MATCHES_WON', 'SETS_WON', 'POINTS_DIFF', 'HEAD_TO_HEAD']).map((rule, i) => (
                   <div key={rule} className="flex items-center space-x-2">
                      <span className="text-indigo-400 font-black">{i + 1}.</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest">{rule.replace(/_/g, ' ')}</span>
                      {i < (tournament.rankingCriteriaOrder?.length || 4) - 1 && <span className="text-slate-700">→</span>}
                   </div>
                ))}
             </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Ranking Criteria Order</h4>
              <p className="text-[10px] text-indigo-500 mb-6 italic font-bold">These rules can be adjusted even after the arena is locked.</p>
              <div className="space-y-2">
                 {(tournament.rankingCriteriaOrder || ['MATCHES_WON', 'SETS_WON', 'POINTS_DIFF', 'HEAD_TO_HEAD']).map((criterion, idx) => (
                   <div key={criterion} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center space-x-3">
                         <span className="w-6 h-6 bg-indigo-600 text-white flex items-center justify-center rounded-lg font-black text-[10px]">{idx + 1}</span>
                         <span className="text-[11px] font-black uppercase tracking-widest text-slate-700">{criterion.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="flex space-x-1">
                         <button onClick={() => moveRankingCriterion(idx, 'up')} className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-400 hover:text-indigo-600 disabled:opacity-20" disabled={idx === 0}>↑</button>
                         <button onClick={() => moveRankingCriterion(idx, 'down')} className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-400 hover:text-indigo-600 disabled:opacity-20" disabled={idx === (tournament.rankingCriteriaOrder?.length || 4) - 1}>↓</button>
                      </div>
                   </div>
                 ))}
              </div>
           </div>

           <div className="space-y-6">
              <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 italic">Security & Privacy</h4>
                 <div className="space-y-6">
                    <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Scorer Board PIN</label>
                       <div className="flex space-x-2">
                          <input type="password" placeholder="••••" maxLength={4} className="flex-1 p-4 bg-slate-50 rounded-2xl text-center text-2xl font-black tracking-[0.5em] outline-none focus:bg-white focus:border-indigo-100 border border-transparent" value={tempPin} onChange={e => setTempPin(e.target.value)} />
                          <button onClick={handleUpdatePin} className="bg-slate-900 text-white px-6 rounded-2xl font-black uppercase text-[10px] shadow-lg active:scale-95 transition-all">Update</button>
                       </div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                       <span className="text-[10px] font-black uppercase text-indigo-600">Privacy Status</span>
                       <select 
                         className="bg-transparent font-black uppercase text-[10px] outline-none text-indigo-700 cursor-pointer"
                         value={tournament.isPublic ? 'true' : 'false'}
                         onChange={e => handleTogglePrivacy(e.target.value === 'true')}
                       >
                         <option value="true">PUBLIC (OPEN)</option>
                         <option value="false">PROTECTED (APPROVAL)</option>
                       </select>
                    </div>
                 </div>
              </div>
              <div className="bg-rose-50 p-8 rounded-[2rem] border border-rose-100">
                 <h4 className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-4 italic text-center uppercase">Danger Zone</h4>
                 <button 
                  onClick={handleDeleteTournament} 
                  disabled={isDeleting}
                  className="w-full bg-white text-rose-600 border border-rose-200 font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] shadow-sm hover:bg-rose-600 hover:text-white transition-all active:scale-95 disabled:opacity-50"
                 >
                   {isDeleting ? 'Erasing Arena...' : 'Delete Tournament Forever'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'players' && (
        <div className="space-y-6">
          {isOrganizer && !isLocked && (
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Add Player to Roster</h4>
              <div className="flex gap-4">
                <input type="text" placeholder="Enter @username or Full Name" className="flex-1 p-4 bg-slate-50 rounded-2xl font-bold border-2 border-transparent focus:border-indigo-500 outline-none" value={playerSearch} onChange={(e) => setPlayerSearch(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAddToPool()} />
                <button onClick={handleAddToPool} disabled={isAddingPlayer || !playerSearch} className="bg-slate-900 text-white px-8 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg transition-all disabled:opacity-50">{isAddingPlayer ? 'Adding...' : 'Add'}</button>
              </div>
            </div>
          )}
          {isLocked && <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center py-10 italic">Roster is Locked. No new players can be added.</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredPool.map((p, i) => (
              <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 flex items-center space-x-3 shadow-sm">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${p.isRegistered ? 'bg-indigo-50 text-indigo-500' : 'bg-slate-100 text-slate-400'}`}>{p.name[0]}</div>
                <div><p className="font-black text-slate-800 text-sm uppercase tracking-tight">{p.name}</p>{p.username && <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">@{p.username}</p>}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const TabButton = ({ active, onClick, label }: any) => (
  <button onClick={onClick} className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${active ? 'bg-indigo-600 text-white shadow-xl scale-105' : 'text-slate-400 hover:text-slate-600 bg-white'}`}>{label}</button>
);

const ConfigItem = ({ label, value, onChange, options }: any) => (
  <div className="flex items-center space-x-2">
    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200">{label}</span>
    <select className="bg-indigo-500 rounded-lg p-2 font-black text-xs outline-none border border-indigo-400" value={value} onChange={e => onChange(e.target.value)}>
      {options.map((o: any) => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

const Input = ({ label, value, onChange, placeholder, type = "text", maxLength }: any) => (
  <div className="space-y-1">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
    <input type={type} maxLength={maxLength} placeholder={placeholder} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none font-bold transition-all" value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);

export default TournamentDetails;