
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Trophy, Users, Calendar, List, LayoutGrid, PlusCircle, UserPlus, X, Check, UserCheck, ShieldAlert, Search, AlertCircle, RefreshCw, User, Shield, Info, ArrowRight, Settings, MapPin, Hash } from 'lucide-react';
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
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'standings' | 'matches' | 'requests' | 'info' | 'admin'>('standings');
  
  // Recruitment State
  const [isRecruiting, setIsRecruiting] = useState(false);
  const [recruitInput, setRecruitInput] = useState('');
  const [recruitTeamId, setRecruitTeamId] = useState<'pool' | string>('pool');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Team Creation State
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');

  useEffect(() => {
    fetchData();
    const timer = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setError("Sync timeout. The arena node might be offline or empty.");
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('get_tournament_details_advanced', { tournament_id: id });
      if (rpcError) throw rpcError;
      if (data) {
        setTournament(data.tournament);
        setParticipants(data.participants || []);
        setTeams(data.teams || []);
        setMatches(data.matches || []);
      }
    } catch (err: any) {
      console.error("Critical Sync Failure:", err);
      setError(err.message || "Failed to retrieve arena data.");
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = tournament && (profile.id === tournament.organizer_id || profile.role === 'superadmin');

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName) return;
    setIsSubmitting(true);
    try {
        const { error } = await supabase.from('teams').insert({
            tournament_id: id,
            name: newTeamName
        });
        if (error) throw error;
        setNewTeamName('');
        setIsCreatingTeam(false);
        fetchData();
    } catch (err: any) {
        alert(err.message);
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleRecruitPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recruitInput) return;
    setIsSubmitting(true);

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recruitInput);
      
      // 1. Find the player profile by ID or Username
      let query = supabase.from('profiles').select('*');
      if (isUuid) {
          query = query.eq('id', recruitInput);
      } else {
          query = query.eq('username', recruitInput.toLowerCase().replace('@', ''));
      }
      
      const { data: userData, error: userError } = await query.single();

      if (userError || !userData) {
        throw new Error("Target player not found in CockroachDB cluster.");
      }

      // 2. Add to participants if not already there
      const isAlreadyParticipant = participants.some(p => p.user_id === userData.id);
      if (!isAlreadyParticipant) {
        await supabase.from('tournament_participants').insert({
          tournament_id: id,
          user_id: userData.id,
          status: 'approved'
        });
      }

      // 3. Add to team if specified
      if (recruitTeamId !== 'pool') {
        const isAlreadyOnTeam = teams.some(t => t.id === recruitTeamId && t.members.some(m => m.user_id === userData.id));
        if (!isAlreadyOnTeam) {
            await supabase.from('team_members').insert({
                team_id: recruitTeamId,
                user_id: userData.id
            });
        }
      }

      alert(`Successfully recruited ${userData.full_name} to the arena!`);
      setIsRecruiting(false);
      setRecruitInput('');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gray-50">
      <div className="relative">
        <div className="w-24 h-24 border-4 border-green-100 border-t-green-600 rounded-full animate-spin"></div>
        <Trophy className="w-10 h-10 text-green-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      </div>
      <div className="text-center">
        <p className="text-gray-900 font-black uppercase italic tracking-tighter text-2xl">Syncing Arena Data</p>
        <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mt-1">Connecting to Cluster Node...</p>
      </div>
    </div>
  );

  if (error || !tournament) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-12 text-center bg-gray-50">
       <div className="bg-red-50 p-8 rounded-[3rem] border border-red-100 mb-8 max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mb-6 mx-auto" />
          <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-4 text-gray-900">Arena Offline</h2>
          <p className="text-gray-500 font-medium leading-relaxed">{error || "The tournament node you requested does not exist in this database cluster."}</p>
       </div>
       <div className="flex gap-4">
          <button onClick={() => window.location.reload()} className="flex items-center gap-2 bg-white border border-gray-200 text-gray-900 px-8 py-4 rounded-2xl font-black italic uppercase tracking-tighter hover:bg-gray-50 transition-all shadow-sm">
             <RefreshCw className="w-5 h-5" /> Retry Sync
          </button>
          <Link to="/tournaments" className="bg-gray-900 text-white px-10 py-4 rounded-2xl font-black italic uppercase tracking-tighter transition-all active:scale-95 shadow-2xl">Return to Lobby</Link>
       </div>
    </div>
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      {/* Hero Header */}
      <div className="relative h-80 md:h-[450px] rounded-[3.5rem] overflow-hidden shadow-2xl border-b-8 border-green-600">
        <img src={`https://picsum.photos/seed/${id}/1200/600`} className="w-full h-full object-cover grayscale opacity-60" alt="Hero" />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent" />
        <div className="absolute bottom-12 left-12 right-12 text-white">
          <div className="flex flex-wrap items-center gap-4 mb-6">
             <span className="bg-green-600 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-green-900/40">Official Arena</span>
             <span className="bg-white/10 backdrop-blur-md px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 border border-white/20">ID: {tournament.share_id}</span>
             <span className="bg-white/10 backdrop-blur-md px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 border border-white/20"><Calendar className="w-4 h-4 text-green-400" /> {new Date(tournament.start_date!).toLocaleDateString()}</span>
             {isAdmin && <span className="bg-purple-600/50 backdrop-blur-md px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 border border-purple-400/30 shadow-xl"><Shield className="w-4 h-4" /> Commander Access</span>}
          </div>
          <h1 className="text-5xl md:text-8xl font-black italic uppercase tracking-tighter mb-4 leading-none">{tournament.name}</h1>
          <div className="flex items-center gap-4">
            <p className="text-gray-300 font-medium text-lg max-w-2xl line-clamp-2">{tournament.description || 'Welcome to the official ShuttleUp circuit.'}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <div className="bg-white p-3 rounded-[3rem] shadow-xl border border-gray-100 flex-1 w-full lg:max-w-4xl flex overflow-x-auto">
          {[
            { id: 'standings', label: 'Teams', icon: List },
            { id: 'matches', label: 'Battles', icon: LayoutGrid },
            { id: 'requests', label: 'Requests', icon: UserCheck, count: participants.filter(p => p.status === 'pending').length },
            { id: 'info', label: 'Rules', icon: Info },
            ...(isAdmin ? [{ id: 'admin', label: 'Command Center', icon: Settings }] : [])
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-3 py-6 px-4 rounded-[2.5rem] text-xs font-black italic uppercase tracking-tighter transition-all min-w-[120px] relative ${
                activeTab === tab.id ? 'bg-gray-900 text-white shadow-2xl scale-105 z-10' : 'text-gray-400 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="w-4 h-4" /> 
              {tab.label}
              {(tab as any).count ? (
                <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full animate-bounce shadow-lg">{ (tab as any).count }</span>
              ) : null}
            </button>
          ))}
        </div>

        {isAdmin && (
           <div className="flex gap-4">
               <button 
                 onClick={() => setIsCreatingTeam(true)}
                 className="bg-white border-2 border-gray-900 text-gray-900 px-10 py-6 rounded-[3rem] font-black italic uppercase tracking-tighter flex items-center gap-3 shadow-xl hover:bg-gray-50 transition-all active:scale-95 whitespace-nowrap"
               >
                  <PlusCircle className="w-5 h-5" /> Form Squad
               </button>
               <button 
                 onClick={() => { setIsRecruiting(true); setActiveTab('admin'); }}
                 className="bg-green-600 text-white px-10 py-6 rounded-[3rem] font-black italic uppercase tracking-tighter flex items-center gap-3 shadow-2xl shadow-green-100 hover:bg-green-700 transition-all active:scale-95 whitespace-nowrap"
               >
                  <UserPlus className="w-5 h-5" /> Recruit
               </button>
           </div>
        )}
      </div>
      
      {/* Tab Content */}
      <div className="bg-white rounded-[4rem] border border-gray-100 shadow-2xl overflow-hidden min-h-[500px] p-12">
        {activeTab === 'standings' && (
           <div className="space-y-12">
              <div className="flex items-center justify-between px-4">
                 <h3 className="text-3xl font-black italic uppercase tracking-tighter text-gray-900">Arena Standings</h3>
                 <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Synced to Node: {tournament.id.split('-')[0]}</div>
              </div>
              
              {teams.length === 0 ? (
                <div className="text-center py-24 bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-100">
                    <Users className="w-20 h-20 text-gray-200 mx-auto mb-6" />
                    <p className="text-gray-400 font-black uppercase tracking-widest text-sm italic">No teams registered in cluster</p>
                    {isAdmin && (
                        <button 
                            onClick={() => setIsCreatingTeam(true)}
                            className="mt-6 text-green-600 font-black uppercase tracking-tighter italic flex items-center gap-2 mx-auto hover:underline"
                        >
                            <PlusCircle className="w-5 h-5" /> Create First Squad
                        </button>
                    )}
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {teams.map(team => (
                        <div key={team.id} className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-xl hover:shadow-2xl transition-all group">
                            <div className="flex justify-between items-start mb-6">
                                <div className="w-16 h-16 bg-gray-900 text-white rounded-[1.5rem] flex items-center justify-center text-2xl font-black italic border-2 border-green-500 shadow-lg">
                                    {team.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="text-right">
                                    <span className="text-4xl font-black italic tracking-tighter text-green-600">{team.points}</span>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">PTS</p>
                                </div>
                            </div>
                            <h4 className="text-2xl font-black italic uppercase tracking-tighter text-gray-900 mb-6">{team.name}</h4>
                            <div className="space-y-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Squad Members ({team.members?.length || 0})</p>
                                {team.members?.map(member => (
                                    <div key={member.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                                        <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center text-[8px] font-black text-gray-400">@{member.username?.charAt(0)}</div>
                                        <span className="text-sm font-bold text-gray-700">@{member.username}</span>
                                    </div>
                                ))}
                                {(!team.members || team.members.length === 0) && (
                                    <p className="text-xs text-gray-300 italic font-medium">No members assigned yet.</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
              )}
           </div>
        )}

        {activeTab === 'admin' && (
            <div className="space-y-12">
                <div className="grid md:grid-cols-2 gap-8">
                    <div className="bg-gray-900 p-12 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden flex flex-col justify-between">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><Shield className="w-48 h-48" /></div>
                        <div>
                            <h3 className="text-4xl font-black italic uppercase tracking-tighter mb-4 text-green-500">Command Hub</h3>
                            <p className="text-gray-400 font-medium mb-12 leading-relaxed text-lg">Control team structures, manage the recruitment pool, and oversee the global arena status.</p>
                        </div>
                        <div className="flex flex-wrap gap-4">
                            <button 
                                onClick={() => setIsRecruiting(true)}
                                className="bg-green-600 text-white px-8 py-4 rounded-2xl font-black italic uppercase tracking-tighter shadow-xl shadow-green-900/40 hover:bg-green-700 transition-all active:scale-95"
                            >
                                Start Recruitment
                            </button>
                            <button 
                                onClick={() => setIsCreatingTeam(true)}
                                className="bg-white text-gray-900 px-8 py-4 rounded-2xl font-black italic uppercase tracking-tighter shadow-xl hover:bg-gray-100 transition-all active:scale-95"
                            >
                                New Squad
                            </button>
                        </div>
                    </div>

                    <div className="bg-white p-10 rounded-[3.5rem] border border-gray-100 shadow-xl flex flex-col">
                        <h3 className="text-2xl font-black italic uppercase tracking-tighter text-gray-900 mb-6 flex items-center gap-2">
                            <UserCheck className="w-6 h-6 text-green-600" />
                            General Pool ({participants.length})
                        </h3>
                        <div className="space-y-4 flex-1 overflow-y-auto pr-4 max-h-[400px]">
                            {participants.length === 0 ? (
                                <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                                    <p className="text-gray-300 font-black uppercase tracking-widest text-xs italic">Pool is currently empty</p>
                                </div>
                            ) : (
                                participants.map(p => (
                                    <div key={p.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-3xl group border border-transparent hover:border-green-100 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-gray-900 text-white rounded-xl flex items-center justify-center font-black italic">
                                                {p.username?.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900 leading-none mb-1">{p.full_name}</p>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">@{p.username}</p>
                                            </div>
                                        </div>
                                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                            p.status === 'approved' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                                        }`}>
                                            {p.status}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'info' && (
           <div className="grid md:grid-cols-2 gap-12">
              <div className="bg-gray-900 p-12 rounded-[3.5rem] text-white leading-relaxed font-medium shadow-2xl relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-8 opacity-5"><Trophy className="w-48 h-48" /></div>
                 <h3 className="text-3xl font-black italic uppercase tracking-tighter mb-8 text-green-500">Official Rulebook</h3>
                 <p className="text-lg text-gray-300 leading-loose">
                    {tournament.rules_handbook || "Standard ShuttleUp Competitive Rules apply. Matches are 21-point rallies, best of 3 sets. All players must report to their assigned court 15 minutes prior to match start. Late arrivals (10+ min) result in a technical forfeit."}
                 </p>
              </div>
              <div className="space-y-8">
                 <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-xl flex items-center gap-6">
                    <div className="bg-green-50 p-4 rounded-2xl text-green-600"><MapPin className="w-8 h-8" /></div>
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Arena Location</p>
                        <p className="text-xl font-black text-gray-900 italic uppercase tracking-tighter">{tournament.location_name || 'Global Circuit'}</p>
                    </div>
                 </div>
                 <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-xl flex items-center gap-6">
                    <div className="bg-blue-50 p-4 rounded-2xl text-blue-600"><ShieldAlert className="w-8 h-8" /></div>
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tournament Status</p>
                        <p className="text-xl font-black text-gray-900 italic uppercase tracking-tighter text-capitalize">{tournament.status}</p>
                    </div>
                 </div>
              </div>
           </div>
        )}

        {activeTab === 'matches' && (
            <div className="text-center py-24 bg-gray-50 rounded-[4rem] border-2 border-dashed border-gray-100">
                <LayoutGrid className="w-20 h-20 text-gray-200 mx-auto mb-6" />
                <h4 className="text-xl font-black italic uppercase tracking-tighter text-gray-900">Battle Matrix Offline</h4>
                <p className="text-gray-400 font-medium">Matches will be generated once squads are finalized.</p>
            </div>
        )}
      </div>

      {/* Recruitment Modal */}
      {isRecruiting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-300">
             <div className="bg-white w-full max-w-xl rounded-[4rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300 border-t-8 border-green-600">
                <div className="p-12">
                    <div className="flex justify-between items-center mb-10">
                        <div>
                            <h2 className="text-4xl font-black italic uppercase tracking-tighter">Recruit Entity</h2>
                            <p className="text-gray-500 font-medium mt-1">Assign players by @username or UUID.</p>
                        </div>
                        <button onClick={() => setIsRecruiting(false)} className="p-4 hover:bg-gray-100 rounded-full transition-colors"><X className="w-8 h-8 text-gray-300" /></button>
                    </div>

                    <form onSubmit={handleRecruitPlayer} className="space-y-8">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-3">Player Identity (Username or ID)</label>
                            <div className="relative">
                                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-300" />
                                <input 
                                    required
                                    value={recruitInput}
                                    onChange={(e) => setRecruitInput(e.target.value)}
                                    placeholder="e.g. @smashmaster or 550e8400..."
                                    className="w-full pl-16 pr-8 py-6 bg-gray-50 border border-gray-100 rounded-[2.5rem] outline-none focus:ring-4 focus:ring-green-500/10 font-black italic tracking-tighter text-2xl uppercase"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-3">Target Squad</label>
                            <select 
                                value={recruitTeamId}
                                onChange={(e) => setRecruitTeamId(e.target.value)}
                                className="w-full px-8 py-6 bg-gray-50 border border-gray-100 rounded-[2.5rem] outline-none focus:ring-4 focus:ring-green-500/10 font-black italic tracking-tighter text-xl uppercase cursor-pointer appearance-none"
                            >
                                <option value="pool">General Arena Pool</option>
                                <optgroup label="Arena Squads">
                                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </optgroup>
                            </select>
                        </div>

                        <button 
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-gray-900 text-white py-6 rounded-[2.5rem] font-black italic uppercase tracking-tighter text-2xl shadow-2xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-4"
                        >
                            {isSubmitting ? <RefreshCw className="w-6 h-6 animate-spin" /> : <><Check className="w-8 h-8 text-green-400" /> Finalize Recruit</>}
                        </button>
                    </form>
                </div>
             </div>
          </div>
      )}

      {/* Create Team Modal */}
      {isCreatingTeam && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-300">
             <div className="bg-white w-full max-w-lg rounded-[4rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300 border-t-8 border-gray-900">
                <div className="p-12">
                    <div className="flex justify-between items-center mb-10">
                        <div>
                            <h2 className="text-4xl font-black italic uppercase tracking-tighter">Form Squad</h2>
                            <p className="text-gray-500 font-medium mt-1">Initialize a new team node.</p>
                        </div>
                        <button onClick={() => setIsCreatingTeam(false)} className="p-4 hover:bg-gray-100 rounded-full transition-colors"><X className="w-8 h-8 text-gray-300" /></button>
                    </div>

                    <form onSubmit={handleCreateTeam} className="space-y-8">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-3">Squad Designation</label>
                            <input 
                                required
                                value={newTeamName}
                                onChange={(e) => setNewTeamName(e.target.value)}
                                placeholder="e.g. ACE SHUTTLERS"
                                className="w-full px-8 py-6 bg-gray-50 border border-gray-100 rounded-[2.5rem] outline-none focus:ring-4 focus:ring-gray-900/10 font-black italic tracking-tighter text-2xl uppercase"
                            />
                        </div>

                        <button 
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-green-600 text-white py-6 rounded-[2.5rem] font-black italic uppercase tracking-tighter text-2xl shadow-2xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-4"
                        >
                            {isSubmitting ? <RefreshCw className="w-6 h-6 animate-spin" /> : <><PlusCircle className="w-8 h-8 text-white" /> Create Squad</>}
                        </button>
                    </form>
                </div>
             </div>
          </div>
      )}
    </div>
  );
};

export default TournamentDetailPage;
