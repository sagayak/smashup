
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
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [selectedT1, setSelectedT1] = useState('');
  const [selectedT2, setSelectedT2] = useState('');

  const [scoringMatch, setScoringMatch] = useState<Match | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [scores, setScores] = useState<MatchScore[]>([]);

  const [playerSearch, setPlayerSearch] = useState('');
  const [rosterFilter, setRosterFilter] = useState('');
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);

  const [newTeamName, setNewTeamName] = useState('');
  const [selectedPoolPlayers, setSelectedPoolPlayers] = useState<TournamentPlayer[]>([]);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
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
    } catch (err) { console.error(err); }
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

  const handleSaveScore = async () => {
    if (scoringMatch) {
      if (pinInput !== tournament.scorerPin && !isOrganizer) return alert("Invalid Scorer PIN");
      try {
        await store.updateMatchScore(scoringMatch.id, scores, scoringMatch.participants);
        setScoringMatch(null);
        setShowPinModal(false);
        setPinInput('');
        await loadData();
      } catch (err) { console.error(err); }
    }
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

  const handleResolveJoin = async (req: JoinRequest, approved: boolean) => {
    await store.resolveJoinRequest(req.id, tournament.id, req.username, approved);
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
        <TabButton active={activeTab === 'matches'} onClick={() => setActiveTab('matches')} label="Matches" />
        <TabButton active={activeTab === 'players'} onClick={() => setActiveTab('players')} label="Roster" />
        <TabButton active={activeTab === 'teams'} onClick={() => setActiveTab('teams')} label="Teams" />
        <TabButton active={activeTab === 'standings'} onClick={() => setActiveTab('standings')} label="Standings" />
        {isOrganizer && <TabButton active={activeTab === 'requests'} onClick={() => setActiveTab('requests')} label="Requests" />}
        {isOrganizer && <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} label="Settings" />}
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
                  <ConfigItem label="Sets" value={matchConfig.bestOf} onChange={v => setMatchConfig({...matchConfig, bestOf: parseInt(v)})} options={[1,3,5]} />
                  <ConfigItem label="Points" value={matchConfig.points} onChange={v => setMatchConfig({...matchConfig, points: parseInt(v)})} options={[11,15,21,30]} />
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
                      <button onClick={() => { setScoringMatch(m); setScores(m.scores); setShowPinModal(true); }} className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">Open Board</button>
                    )}
                  </div>
               </div>
             ))}
           </div>
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

      {showPinModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[300] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl">
              <h4 className="text-2xl font-black text-slate-800 text-center mb-8 italic uppercase tracking-tighter">Live Scoreboard</h4>
              {!isOrganizer && (
                <div className="mb-8">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block text-center">Security PIN Required</label>
                  <input type="password" placeholder="••••" maxLength={4} className="w-full p-6 bg-slate-50 rounded-3xl text-center text-4xl font-black tracking-[1em] outline-none focus:bg-white transition-all" value={pinInput} onChange={e => setPinInput(e.target.value)} />
                </div>
              )}
              <div className="space-y-4 mb-10">
                 {scores.map((s, i) => (
                   <div key={i} className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-black text-indigo-400 uppercase italic">Set {i+1}</span>
                      <div className="flex items-center space-x-4">
                         <input type="number" className="w-16 h-12 text-center font-black text-2xl bg-white rounded-xl outline-none" value={s.s1} onChange={e => { const ns = [...scores]; ns[i] = { s1: parseInt(e.target.value) || 0, s2: s.s2 }; setScores(ns); }} />
                         <span className="font-black text-slate-300">/</span>
                         <input type="number" className="w-16 h-12 text-center font-black text-2xl bg-white rounded-xl outline-none" value={s.s2} onChange={e => { const ns = [...scores]; ns[i] = { s1: s.s1, s2: parseInt(e.target.value) || 0 }; setScores(ns); }} />
                      </div>
                   </div>
                 ))}
              </div>
              <div className="flex space-x-4">
                 <button onClick={handleSaveScore} className="flex-grow bg-indigo-600 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all">Update Scores</button>
                 <button onClick={() => { setShowPinModal(false); setPinInput(''); }} className="px-8 font-black text-slate-400 uppercase tracking-widest text-[10px]">Cancel</button>
              </div>
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
