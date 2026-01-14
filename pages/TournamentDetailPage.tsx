
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Trophy, Users, Calendar, MapPin, List, LayoutGrid, PlayCircle, PlusCircle, Share2, Download, FileText, ChevronRight, UserPlus, Upload, FileJson, X, Check, Send, UserCheck, ShieldAlert, Plus, Clock, FileDown, Search } from 'lucide-react';
import { supabase } from '../services/supabase';
import { Tournament, Team, Match, Profile, TournamentParticipant, TeamMember } from '../types';

interface TournamentDetailPageProps {
  profile: Profile;
}

const TournamentDetailPage: React.FC<TournamentDetailPageProps> = ({ profile }) => {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<(Team & { members: TeamMember[] })[]>([]);
  const [participants, setParticipants] = useState<TournamentParticipant[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'standings' | 'matches' | 'requests' | 'info'>('standings');
  
  // Modals
  const [showBulkImportPlayers, setShowBulkImportPlayers] = useState(false);
  const [showScheduleTieUp, setShowScheduleTieUp] = useState(false);
  const [showAddMember, setShowAddMember] = useState<{ teamId: string, teamName: string } | null>(null);
  
  // Forms
  const [bulkUsernames, setBulkUsernames] = useState('');
  const [searchRequest, setSearchRequest] = useState('');
  const [tieUpForm, setTieUpForm] = useState({
    team1_id: '',
    team2_id: '',
    scheduled_at: new Date().toISOString().slice(0, 16)
  });

  const isOrganizer = tournament?.organizer_id === profile.id || profile.role === 'superadmin';
  const myParticipantStatus = participants.find(p => p.user_id === profile.id)?.status;

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    const { data, error } = await supabase.rpc('get_tournament_details_advanced', { tournament_id: id });
    if (data) {
      setTournament(data.tournament);
      setParticipants(data.participants);
      setTeams(data.teams);
      setMatches(data.matches);
    }
    setLoading(false);
  };

  const handleJoinRequest = async () => {
    const { error } = await supabase.from('tournament_participants').insert({
      tournament_id: id,
      user_id: profile.id,
      status: 'pending'
    });
    if (!error) {
      alert("Join request transmitted to organizer.");
      fetchData();
    } else {
      alert("You have already sent a request or are already in the pool.");
    }
  };

  const updateParticipantStatus = async (participantId: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase.from('tournament_participants').update({ status }).eq('id', participantId);
    if (!error) fetchData();
  };

  const handleBulkImportPlayers = async () => {
    const usernames = bulkUsernames.split(/[,\n]/).map(u => u.trim()).filter(u => u.length > 0);
    if (usernames.length === 0) return;

    const { data, error } = await supabase.rpc('bulk_import_participants_by_username', {
      tournament_id: id,
      usernames: usernames
    });

    if (!error) {
      const msg = `Import Results:\nAdded: ${data.added.length}\nNot Found: ${data.notFound.length}\n${data.notFound.length > 0 ? 'Users not found: ' + data.notFound.join(', ') : ''}`;
      alert(msg);
      setBulkUsernames('');
      setShowBulkImportPlayers(false);
      fetchData();
    }
  };

  const handleScheduleTieUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tieUpForm.team1_id || !tieUpForm.team2_id) {
      alert("Please select both squads.");
      return;
    }
    if (tieUpForm.team1_id === tieUpForm.team2_id) {
      alert("A squad cannot battle itself.");
      return;
    }

    const { error } = await supabase.from('matches').insert({
      tournament_id: id,
      team1_id: tieUpForm.team1_id,
      team2_id: tieUpForm.team2_id,
      scheduled_at: tieUpForm.scheduled_at,
      status: 'pending'
    });

    if (!error) {
      setShowScheduleTieUp(false);
      fetchData();
      alert("Tie-up scheduled successfully.");
    } else {
      alert("Failed to schedule tie-up.");
    }
  };

  const exportPlayerRoster = () => {
    const usernames = participants
      .filter(p => p.status === 'approved')
      .map(p => p.username)
      .join('\n');
    
    const blob = new Blob([usernames], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tournament?.name}_roster.txt`;
    link.click();
  };

  const handleAddMember = async (userId: string) => {
    if (!showAddMember) return;
    const { error } = await supabase.from('team_members').insert({
      team_id: showAddMember.teamId,
      user_id: userId
    });
    if (!error) {
      setShowAddMember(null);
      fetchData();
    } else {
      alert("User already in this team or member limit reached.");
    }
  };

  const addTeam = async () => {
    const teamName = prompt("Enter team name:");
    if (!teamName) return;
    const { error } = await supabase.from('teams').insert({
      tournament_id: id,
      name: teamName
    });
    if (!error) fetchData();
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const publicPool = participants.filter(p => 
    p.status === 'approved' && 
    !teams.some(t => t.members.some(m => m.user_id === p.user_id))
  );

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Trophy className="w-16 h-16 text-green-600 animate-bounce" />
      <p className="text-gray-400 font-black uppercase italic tracking-tighter">Syncing Arena Data...</p>
    </div>
  );
  if (!tournament) return <div>Tournament not found.</div>;

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* Hero Header */}
      <div className="relative h-80 md:h-[400px] rounded-[3.5rem] overflow-hidden shadow-2xl border-b-8 border-green-600">
        <img src={`https://picsum.photos/seed/${id}/1200/600`} className="w-full h-full object-cover grayscale opacity-60" alt="Hero" />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent" />
        
        <div className="absolute top-10 right-10 flex gap-3">
           {!isOrganizer && !myParticipantStatus && (
             <button onClick={handleJoinRequest} className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-[2rem] font-black italic uppercase tracking-tighter flex items-center gap-3 shadow-2xl transition-all active:scale-95">
                <Send className="w-5 h-5" /> Request to Join
             </button>
           )}
           {myParticipantStatus === 'pending' && (
             <div className="bg-yellow-500/90 backdrop-blur px-8 py-4 rounded-[2rem] text-white font-black italic uppercase tracking-tighter flex items-center gap-3 border border-yellow-400/50">
                <Clock className="w-5 h-5" /> Join Pending
             </div>
           )}
           {myParticipantStatus === 'approved' && (
             <div className="bg-green-500/90 backdrop-blur px-8 py-4 rounded-[2rem] text-white font-black italic uppercase tracking-tighter flex items-center gap-3 border border-green-400/50">
                <UserCheck className="w-5 h-5" /> Pool Member
             </div>
           )}
           {isOrganizer && (
              <button onClick={exportPlayerRoster} className="bg-white/10 hover:bg-white/20 backdrop-blur-xl p-4 rounded-[1.5rem] text-white transition-all shadow-xl border border-white/20 flex items-center gap-3">
                 <FileDown className="w-5 h-5" />
                 <span className="text-[10px] font-black uppercase tracking-widest hidden md:block">Export Roster</span>
              </button>
           )}
        </div>

        <div className="absolute bottom-12 left-12 text-white max-w-4xl">
          <div className="flex flex-wrap items-center gap-4 mb-6">
             <span className="bg-green-600 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-green-900/40">Official Arena</span>
             <span className="bg-white/10 backdrop-blur-md px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 border border-white/20">ID: {tournament.share_id}</span>
             <span className="bg-white/10 backdrop-blur-md px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 border border-white/20"><Calendar className="w-4 h-4 text-green-400" /> {new Date(tournament.start_date!).toLocaleDateString()}</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter mb-4 leading-none">{tournament.name}</h1>
          <p className="text-gray-300 font-medium text-lg leading-relaxed line-clamp-2">{tournament.description || 'Welcome to the official ShuttleUp circuit.'}</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-10">
        <div className="flex-1 space-y-8">
          <div className="flex bg-white p-3 rounded-[2.5rem] shadow-xl border border-gray-100 max-w-2xl">
             {[
               { id: 'standings', label: 'Teams', icon: List },
               { id: 'matches', label: 'Battles', icon: LayoutGrid },
               { id: 'requests', label: 'Requests', icon: UserCheck, count: participants.filter(p => p.status === 'pending').length },
               { id: 'info', label: 'Rules', icon: Trophy }
             ].map(tab => (
               <button 
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id as any)}
                 className={`flex-1 flex items-center justify-center gap-3 py-5 rounded-[2rem] text-xs font-black italic uppercase tracking-tighter transition-all relative ${
                   activeTab === tab.id ? 'bg-gray-900 text-white shadow-2xl scale-105' : 'text-gray-400 hover:bg-gray-50'
                 }`}
               >
                 <tab.icon className="w-4 h-4" /> 
                 {tab.label}
                 {tab.count ? (
                   <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[9px] flex items-center justify-center rounded-full animate-bounce">{tab.count}</span>
                 ) : null}
               </button>
             ))}
          </div>

          <div className="bg-white rounded-[3.5rem] border border-gray-100 shadow-2xl overflow-hidden min-h-[600px]">
            {activeTab === 'standings' && (
              <div className="p-12 animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
                  <h3 className="text-4xl font-black italic uppercase tracking-tighter text-gray-900">Battle Squads</h3>
                  {isOrganizer && (
                    <div className="flex gap-3">
                       <button onClick={() => setShowBulkImportPlayers(true)} className="bg-white border border-gray-200 text-gray-900 px-6 py-4 rounded-2xl font-black italic uppercase tracking-tighter flex items-center gap-3 hover:bg-gray-50 transition-all shadow-sm text-sm">
                          <UserPlus className="w-4 h-4" /> Bulk Players
                       </button>
                       <button onClick={addTeam} className="bg-green-600 text-white px-8 py-4 rounded-2xl font-black italic uppercase tracking-tighter flex items-center gap-3 hover:bg-green-700 transition-all shadow-xl text-sm">
                          <Plus className="w-4 h-4" /> New Team
                       </button>
                    </div>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  {teams.length === 0 ? (
                    <div className="col-span-full py-20 text-center border-2 border-dashed border-gray-100 rounded-[3rem] text-gray-300 font-black italic uppercase">No squads created.</div>
                  ) : teams.map((team) => (
                    <div key={team.id} className="bg-gray-50 p-10 rounded-[3rem] border border-gray-100 group hover:border-green-400 transition-all">
                      <div className="flex justify-between items-start mb-6">
                         <div>
                            <h4 className="text-3xl font-black italic uppercase tracking-tighter text-gray-900 leading-none">{team.name}</h4>
                            <p className="text-[10px] font-black text-gray-400 mt-2 uppercase tracking-widest">{team.member_count || 0}/10 Members</p>
                         </div>
                         <div className="bg-white px-4 py-2 rounded-2xl text-green-600 font-black italic tracking-tighter border border-gray-100">{team.points}pts</div>
                      </div>
                      
                      <div className="space-y-3 mb-8">
                        {team.members.map(member => (
                          <div key={member.id} className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-gray-50">
                             <div className="w-8 h-8 bg-gray-900 text-white rounded-lg flex items-center justify-center text-[10px] font-black italic border-2 border-green-500">{member.username?.charAt(0).toUpperCase()}</div>
                             <span className="text-sm font-black text-gray-700 uppercase italic tracking-tighter">{member.full_name}</span>
                          </div>
                        ))}
                        {team.members.length === 0 && <p className="text-xs text-gray-400 font-bold uppercase italic tracking-widest text-center py-4">Squad empty</p>}
                      </div>

                      {isOrganizer && (
                        <button 
                          onClick={() => setShowAddMember({ teamId: team.id, teamName: team.name })}
                          className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black uppercase italic tracking-tighter text-sm flex items-center justify-center gap-3 hover:bg-black transition-all"
                        >
                          <UserPlus className="w-4 h-4" /> Recruit Member
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-16 pt-16 border-t border-gray-100">
                   <h4 className="text-2xl font-black italic uppercase tracking-tighter text-gray-400 mb-8">Participant Pool (Unassigned)</h4>
                   <div className="flex flex-wrap gap-4">
                     {publicPool.map(p => (
                       <div key={p.id} className="bg-gray-100 px-6 py-4 rounded-[1.5rem] flex items-center gap-3 border border-gray-200">
                          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center font-black text-green-600 border border-gray-200 shadow-sm">{p.username?.charAt(0).toUpperCase()}</div>
                          <div className="flex flex-col">
                            <span className="text-xs font-black uppercase tracking-tighter italic">{p.full_name}</span>
                            <span className="text-[10px] text-gray-400 font-black tracking-widest uppercase italic">@{p.username}</span>
                          </div>
                       </div>
                     ))}
                     {publicPool.length === 0 && <p className="text-gray-400 font-bold uppercase italic text-xs tracking-widest">Pool currently dry.</p>}
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'requests' && (
              <div className="p-12 animate-in slide-in-from-bottom-4 duration-500">
                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                   <h3 className="text-4xl font-black italic uppercase tracking-tighter text-gray-900">Entry Requests</h3>
                   <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                      <input 
                        type="text" 
                        placeholder="Search username..." 
                        className="pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:bg-white transition-all w-64"
                        value={searchRequest}
                        onChange={(e) => setSearchRequest(e.target.value)}
                      />
                   </div>
                 </div>
                 
                 {isOrganizer ? (
                   <div className="space-y-4">
                     {participants
                      .filter(p => p.status === 'pending')
                      .filter(p => p.username?.toLowerCase().includes(searchRequest.toLowerCase()) || p.full_name?.toLowerCase().includes(searchRequest.toLowerCase()))
                      .map(p => (
                       <div key={p.id} className="bg-gray-50 p-8 rounded-[3rem] flex items-center justify-between border border-gray-100 shadow-sm">
                          <div className="flex items-center gap-6">
                             <div className="w-16 h-16 bg-gray-900 text-white rounded-[1.5rem] flex items-center justify-center text-2xl font-black italic border-4 border-green-500">{p.username?.charAt(0).toUpperCase()}</div>
                             <div>
                                <p className="text-2xl font-black italic uppercase tracking-tighter text-gray-900 leading-none">{p.full_name}</p>
                                <p className="text-xs font-black text-gray-400 mt-2 uppercase tracking-widest">@{p.username} • ID: {p.user_id.split('-')[0]}</p>
                             </div>
                          </div>
                          <div className="flex gap-4">
                             <button onClick={() => updateParticipantStatus(p.id, 'rejected')} className="px-8 py-4 bg-white border border-red-100 text-red-500 font-black uppercase italic tracking-tighter rounded-2xl hover:bg-red-50 transition-all">Deny</button>
                             <button onClick={() => updateParticipantStatus(p.id, 'approved')} className="px-10 py-4 bg-green-600 text-white font-black uppercase italic tracking-tighter rounded-2xl shadow-xl shadow-green-100 hover:bg-green-700 transition-all flex items-center gap-2">
                                <Check className="w-5 h-5" /> Approve
                             </button>
                          </div>
                       </div>
                     ))}
                     {participants.filter(p => p.status === 'pending').length === 0 && (
                       <div className="py-20 text-center text-gray-300 font-black uppercase italic tracking-widest">No pending applications.</div>
                     )}
                   </div>
                 ) : (
                   <div className="flex flex-col items-center justify-center py-20 text-center gap-6">
                      <ShieldAlert className="w-16 h-16 text-red-100" />
                      <p className="text-gray-400 font-black uppercase italic tracking-widest text-sm">Access Denied: Organizer Level Security Only</p>
                   </div>
                 )}
              </div>
            )}

            {activeTab === 'matches' && (
              <div className="p-12 animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between mb-12">
                  <h3 className="text-4xl font-black italic uppercase tracking-tighter text-gray-900">Battle Log</h3>
                  {isOrganizer && (
                    <button 
                      onClick={() => setShowScheduleTieUp(true)}
                      className="bg-green-600 text-white px-10 py-4 rounded-2xl font-black italic uppercase tracking-tighter flex items-center gap-3 hover:bg-green-700 transition-all shadow-2xl shadow-green-100"
                    >
                      <PlusCircle className="w-5 h-5" /> Schedule a tie-up
                    </button>
                  )}
                </div>
                <div className="grid gap-8">
                  {matches.length === 0 ? (
                    <div className="py-32 text-center bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-100 text-gray-300 italic font-black uppercase tracking-widest">No battles scheduled.</div>
                  ) : (
                    matches.map(m => (
                      <div key={m.id} className="bg-gray-50 p-10 rounded-[3rem] border border-gray-100 flex flex-col md:flex-row items-center justify-between group hover:border-green-400 transition-all hover:shadow-2xl hover:-translate-y-1 relative">
                        <div className="flex-1 text-center md:text-left space-y-2">
                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Team A</p>
                            <p className="text-3xl font-black uppercase tracking-tighter text-gray-900 italic leading-none">{m.team1_name}</p>
                            <p className="text-6xl font-black mt-4 text-gray-900">{m.score1}</p>
                        </div>
                        <div className="px-12 flex flex-col items-center my-8 md:my-0">
                            <span className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl border-b-4 ${m.status === 'live' ? 'bg-red-600 text-white animate-pulse border-red-800' : m.status === 'completed' ? 'bg-gray-900 text-white border-black' : 'bg-white text-gray-400 border-gray-100'}`}>
                              {m.status}
                            </span>
                            <div className="text-gray-200 font-black italic text-4xl my-6">VS</div>
                            <div className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                               <Clock className="w-3 h-3 text-green-500" /> {formatTime(m.scheduled_at)}
                            </div>
                            <Link to={`/scoring/${m.id}`} className="bg-gray-900 text-white text-xs font-black uppercase tracking-widest flex items-center gap-3 hover:bg-black px-8 py-3 rounded-full transition-all shadow-xl">
                              <PlayCircle className="w-4 h-4" /> Spectate
                            </Link>
                        </div>
                        <div className="flex-1 text-center md:text-right space-y-2">
                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Team B</p>
                            <p className="text-3xl font-black uppercase tracking-tighter text-gray-900 italic leading-none">{m.team2_name}</p>
                            <p className="text-6xl font-black mt-4 text-gray-900">{m.score2}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            
            {activeTab === 'info' && (
              <div className="p-16 space-y-12 animate-in fade-in duration-500">
                 <div>
                    <h4 className="text-3xl font-black italic uppercase tracking-tighter text-gray-900 mb-8 border-b-4 border-green-600 pb-4 inline-block">Official Protocol</h4>
                    <div className="bg-gray-900 p-10 rounded-[3rem] text-white leading-relaxed font-medium shadow-2xl relative overflow-hidden">
                       <p className="relative z-10 text-lg">{tournament.rules_handbook || "The organizer hasn't uploaded specific protocols for this arena. Standard ShuttleUp Competitive Rules apply. Matches are 21-point rallies, best of 3 sets. Sharp play is expected."}</p>
                    </div>
                 </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Schedule Tie-up Modal */}
      {showScheduleTieUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300 border-t-8 border-green-600">
              <div className="p-12">
                 <div className="flex justify-between items-center mb-8">
                    <h2 className="text-3xl font-black italic uppercase tracking-tighter">Schedule Tie-Up</h2>
                    <button onClick={() => setShowScheduleTieUp(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X className="w-8 h-8"/></button>
                 </div>
                 <form onSubmit={handleScheduleTieUp} className="space-y-6">
                    <div>
                       <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2">Select Squad A</label>
                       <select 
                        required
                        className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-xl font-bold outline-none"
                        value={tieUpForm.team1_id}
                        onChange={(e) => setTieUpForm({...tieUpForm, team1_id: e.target.value})}
                       >
                         <option value="">Choose Team...</option>
                         {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                       </select>
                    </div>
                    <div>
                       <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2">Select Squad B</label>
                       <select 
                        required
                        className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-xl font-bold outline-none"
                        value={tieUpForm.team2_id}
                        onChange={(e) => setTieUpForm({...tieUpForm, team2_id: e.target.value})}
                       >
                         <option value="">Choose Team...</option>
                         {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                       </select>
                    </div>
                    <div>
                       <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2">Kickoff Time</label>
                       <input 
                        type="datetime-local"
                        required
                        className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-xl font-black italic uppercase tracking-tighter outline-none"
                        value={tieUpForm.scheduled_at}
                        onChange={(e) => setTieUpForm({...tieUpForm, scheduled_at: e.target.value})}
                       />
                    </div>
                    <button 
                      type="submit"
                      className="w-full py-5 bg-gray-900 text-white font-black uppercase italic tracking-tighter text-xl rounded-2xl hover:bg-black transition-all shadow-2xl active:scale-95 flex items-center justify-center gap-3"
                    >
                       <Calendar className="w-5 h-5" /> Confirm Match
                    </button>
                 </form>
              </div>
           </div>
        </div>
      )}

      {/* Bulk Player Import Modal */}
      {showBulkImportPlayers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300 border-t-8 border-green-600">
             <div className="p-12">
                <div className="flex justify-between items-center mb-8">
                   <div>
                      <h2 className="text-3xl font-black italic uppercase tracking-tighter text-gray-900">Import Athletes</h2>
                      <p className="text-gray-500 font-medium text-xs uppercase tracking-widest mt-1">Paste usernames to inject them into the pool.</p>
                   </div>
                   <button onClick={() => setShowBulkImportPlayers(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X className="w-8 h-8"/></button>
                </div>
                
                <div className="space-y-6">
                   <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-3">Usernames (Comma or Newline)</label>
                      <textarea 
                        value={bulkUsernames}
                        onChange={(e) => setBulkUsernames(e.target.value)}
                        placeholder="smash_king_01, net_ninja, shuttle_pro_88..."
                        className="w-full px-8 py-6 bg-gray-50 border border-gray-100 rounded-[2rem] outline-none focus:ring-4 focus:ring-green-500/10 min-h-[220px] font-black italic tracking-tighter text-xl uppercase leading-relaxed"
                      />
                   </div>
                   <button 
                     onClick={handleBulkImportPlayers}
                     className="w-full py-5 bg-gray-900 text-white font-black uppercase italic tracking-tighter text-xl rounded-2xl hover:bg-black transition-all shadow-2xl active:scale-95 flex items-center justify-center gap-3"
                   >
                     <Upload className="w-6 h-6" /> Inject Into Pool
                   </button>
                   <p className="text-[10px] text-center text-gray-400 font-bold uppercase tracking-widest italic">Only registered ShuttleUp profiles can be imported.</p>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Recuit Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300 border-t-8 border-green-600">
             <div className="p-12">
                <div className="flex justify-between items-center mb-8">
                   <div>
                      <h2 className="text-3xl font-black italic uppercase tracking-tighter">Recruit for {showAddMember.teamName}</h2>
                      <p className="text-gray-500 font-medium text-xs uppercase tracking-widest mt-1">Select an approved athlete from the pool.</p>
                   </div>
                   <button onClick={() => setShowAddMember(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X className="w-8 h-8"/></button>
                </div>
                
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                   {publicPool.map(p => (
                     <button 
                      key={p.id}
                      onClick={() => handleAddMember(p.user_id)}
                      className="w-full bg-gray-50 p-6 rounded-3xl flex items-center justify-between border border-gray-100 hover:border-green-400 hover:bg-green-50 transition-all group"
                     >
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 bg-gray-900 text-white rounded-xl flex items-center justify-center font-black italic border-2 border-green-500 group-hover:scale-110 transition-transform">{p.username?.charAt(0).toUpperCase()}</div>
                           <div className="text-left">
                              <p className="font-black text-gray-900 uppercase italic tracking-tighter">{p.full_name}</p>
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">@{p.username} • ID: {p.user_id.split('-')[0]}</p>
                           </div>
                        </div>
                        <div className="bg-white p-3 rounded-xl text-green-600 border border-green-100 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                           <UserPlus className="w-5 h-5" />
                        </div>
                     </button>
                   ))}
                   {publicPool.length === 0 && (
                     <div className="py-12 text-center text-gray-300 font-black italic uppercase tracking-widest border-2 border-dashed border-gray-100 rounded-[2rem]">Public pool empty.</div>
                   )}
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentDetailPage;
