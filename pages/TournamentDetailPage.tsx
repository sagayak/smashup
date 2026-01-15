
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Trophy, Users, LayoutGrid, PlusCircle, UserPlus, X, Check, UserCheck, Shield, Info, RefreshCw, MapPin, Hash, Play, Calendar, Download, UserCircle, Map as MapIcon } from 'lucide-react';
import { db, dbService } from '../services/firebase';
import { doc, onSnapshot, collection, query, where, getDocs, addDoc, orderBy } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { Tournament, Team, Match, Profile, TournamentParticipant, TeamMember } from '../types';

// Fix: Declare google global variable for Google Maps API to satisfy TypeScript
declare const google: any;

interface TournamentDetailPageProps {
  profile: Profile;
}

const TournamentDetailPage: React.FC<TournamentDetailPageProps> = ({ profile }) => {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [participants, setParticipants] = useState<TournamentParticipant[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'standings' | 'matches' | 'info' | 'admin'>('standings');
  const mapRef = useRef<HTMLDivElement>(null);
  
  const [isRecruiting, setIsRecruiting] = useState(false);
  const [recruitInput, setRecruitInput] = useState('');
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleData, setScheduleData] = useState({ team1Id: '', team2Id: '', time: '' });
  const [isAssigning, setIsAssigning] = useState<TournamentParticipant | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;

    const unsubT = onSnapshot(doc(db, "tournaments", id), (snap) => {
      if (snap.exists()) setTournament(snap.data() as Tournament);
      setLoading(false);
    });

    const qTeams = query(collection(db, "teams"), where("tournament_id", "==", id), orderBy("points", "desc"));
    const unsubTeams = onSnapshot(qTeams, (snap) => {
      setTeams(snap.docs.map(d => d.data() as Team));
    });

    const qMatches = query(collection(db, "matches"), where("tournament_id", "==", id), orderBy("scheduled_at", "desc"));
    const unsubMatches = onSnapshot(qMatches, (snap) => {
      setMatches(snap.docs.map(d => d.data() as Match));
    });

    const qParts = query(collection(db, "tournament_participants"), where("tournament_id", "==", id));
    const unsubParts = onSnapshot(qParts, (snap) => {
      setParticipants(snap.docs.map(d => d.data() as TournamentParticipant));
    });

    const qMembers = query(collection(db, "team_members"), where("tournament_id", "==", id));
    const unsubMembers = onSnapshot(qMembers, (snap) => {
      setTeamMembers(snap.docs.map(d => d.data() as TeamMember));
    });

    return () => { unsubT(); unsubTeams(); unsubMatches(); unsubParts(); unsubMembers(); };
  }, [id]);

  useEffect(() => {
    // Fix: Using the declared 'google' variable to initialize the map
    if (activeTab === 'info' && tournament?.latitude && mapRef.current) {
        const center = { lat: tournament.latitude, lng: tournament.longitude || 0 };
        const map = new google.maps.Map(mapRef.current, { center, zoom: 15, styles: [{ featureType: "all", elementType: "all", stylers: [{ saturation: -100 }] }] });
        new google.maps.Marker({ position: center, map, title: tournament.location_name });
    }
  }, [activeTab, tournament]);

  const isAdmin = tournament && (profile.id === tournament.organizer_id || profile.role === 'superadmin');

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    await dbService.teams.create(id!, newTeamName);
    setNewTeamName('');
    setIsCreatingTeam(false);
  };

  const handleScheduleMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const t1 = teams.find(t => t.id === scheduleData.team1Id);
    const t2 = teams.find(t => t.id === scheduleData.team2Id);
    if (!t1 || !t2 || t1.id === t2.id) return alert("Select two different squads.");
    await dbService.matches.create(id!, t1, t2, new Date(scheduleData.time).toISOString());
    setIsScheduling(false);
    setScheduleData({ team1Id: '', team2Id: '', time: '' });
  };

  const handleAssignToTeam = async (teamId: string) => {
    if (!isAssigning) return;
    await dbService.teams.addMember(teamId, id!, {
        id: isAssigning.user_id,
        full_name: isAssigning.full_name || 'Anonymous',
        username: isAssigning.username || 'unknown'
    });
    setIsAssigning(null);
  };

  const exportToCSV = () => {
    const headers = ["Rank", "Squad Name", "Played", "Wins", "Losses", "Points"];
    const rows = teams.map((t, idx) => [idx + 1, t.name, t.wins + t.losses, t.wins, t.losses, t.points]);
    let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${tournament?.name}_standings.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  if (loading) return <div className="p-20 text-center font-black animate-pulse uppercase">Syncing Cloud Node...</div>;
  if (!tournament) return <div className="p-20 text-center font-black">Arena not found.</div>;

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      <div className="bg-gray-900 rounded-[3rem] p-12 text-white relative overflow-hidden border-b-8 border-green-600 shadow-2xl">
          <div className="flex items-center gap-4 mb-4">
             <span className="bg-green-600 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">ID: {tournament.share_id}</span>
             <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">GCP FIRESTORE NODE</span>
          </div>
          <h1 className="text-6xl font-black italic uppercase tracking-tighter leading-none">{tournament.name}</h1>
          <p className="text-gray-400 mt-4 max-w-xl font-medium">{tournament.description}</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
          {['standings', 'matches', 'info', 'admin'].map(t => (
              (t !== 'admin' || isAdmin) && (
                <button key={t} onClick={() => setActiveTab(t as any)} className={`px-10 py-5 rounded-[2.5rem] font-black italic uppercase tracking-tighter text-sm transition-all shadow-xl ${activeTab === t ? 'bg-gray-900 text-white scale-105' : 'bg-white text-gray-400 hover:text-gray-600'}`}>{t}</button>
              )
          ))}
          <div className="ml-auto flex gap-4">
             <button onClick={exportToCSV} className="bg-white border border-gray-100 text-gray-400 px-6 py-5 rounded-[2.5rem] font-black uppercase italic tracking-tighter text-sm flex items-center gap-2 hover:bg-gray-50 transition-all">
                <Download className="w-4 h-4" /> Export CSV
             </button>
             {isAdmin && (
               <>
                <button onClick={() => setIsScheduling(true)} className="bg-blue-600 text-white px-8 py-5 rounded-[2.5rem] font-black uppercase italic tracking-tighter shadow-xl flex items-center gap-2 hover:bg-blue-700 transition-all"><Calendar className="w-5 h-5" /> Schedule Match</button>
                <button onClick={() => setIsCreatingTeam(true)} className="bg-green-600 text-white px-8 py-5 rounded-[2.5rem] font-black uppercase italic tracking-tighter shadow-xl flex items-center gap-2 hover:bg-green-700 transition-all"><PlusCircle className="w-5 h-5" /> Form Squad</button>
               </>
             )}
          </div>
      </div>

      <div className="bg-white rounded-[4rem] p-12 shadow-2xl border border-gray-100 min-h-[400px]">
          {activeTab === 'standings' && (
              <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 border-b border-gray-50">
                        <th className="px-6 py-4">Squad Name</th>
                        <th className="px-6 py-4 text-center">Played</th>
                        <th className="px-6 py-4 text-center text-green-600">Wins</th>
                        <th className="px-6 py-4 text-center text-red-500">Losses</th>
                        <th className="px-6 py-4 text-right">Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {teams.length === 0 && <tr><td colSpan={5} className="py-20 text-center text-gray-300 font-black italic uppercase">No squads formed yet</td></tr>}
                      {teams.map((team, idx) => (
                        <tr key={team.id} className="group hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-8 flex items-center gap-4">
                            <span className="text-xl font-black text-gray-200">#0{idx+1}</span>
                            <div>
                                <span className="text-2xl font-black italic uppercase tracking-tighter group-hover:text-green-600">{team.name}</span>
                                <div className="flex gap-2 mt-2">
                                  {teamMembers.filter(m => m.team_id === team.id).map(m => (
                                    <span key={m.id} className="text-[9px] font-black uppercase bg-gray-100 px-2 py-1 rounded-md text-gray-500">@{m.username}</span>
                                  ))}
                                </div>
                            </div>
                          </td>
                          <td className="px-6 py-8 text-center font-bold text-gray-600">{team.wins + team.losses}</td>
                          <td className="px-6 py-8 text-center font-black text-green-600">{team.wins}</td>
                          <td className="px-6 py-8 text-center font-black text-red-400">{team.losses}</td>
                          <td className="px-6 py-8 text-right text-4xl font-black italic tracking-tighter text-gray-900">{team.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              </div>
          )}

          {activeTab === 'matches' && (
              <div className="space-y-6">
                  {matches.length === 0 && <div className="py-20 text-center text-gray-300 font-black italic uppercase">No battles scheduled</div>}
                  {matches.map(match => (
                      <Link to={`/scoring/${match.id}`} key={match.id} className="block bg-gray-50 p-10 rounded-[3rem] hover:bg-white border-2 border-transparent hover:border-green-100 transition-all shadow-sm group">
                          <div className="flex items-center justify-between">
                              <div className="flex-1 text-right pr-8">
                                <span className="font-black italic uppercase text-2xl tracking-tighter group-hover:text-green-600 transition-colors">{match.team1_name}</span>
                              </div>
                              <div className="flex flex-col items-center gap-2 px-10 border-x border-gray-200">
                                  <span className="text-5xl font-black italic text-gray-900 tracking-tighter">{match.score1} : {match.score2}</span>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${match.status === 'live' ? 'text-red-500' : 'text-gray-400'}`}>{match.status === 'live' ? 'LIVE NOW' : 'FINISHED'}</span>
                                    {match.status === 'live' && <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" />}
                                  </div>
                                  <span className="text-[9px] font-bold text-gray-300 uppercase">{formatTime(match.scheduled_at)}</span>
                              </div>
                              <div className="flex-1 text-left pl-8">
                                <span className="font-black italic uppercase text-2xl tracking-tighter group-hover:text-green-600 transition-colors">{match.team2_name}</span>
                              </div>
                          </div>
                      </Link>
                  ))}
              </div>
          )}

          {activeTab === 'info' && (
              <div className="grid md:grid-cols-2 gap-12">
                  <div className="space-y-8">
                      <div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-green-600 mb-2">Arena Logistics</h4>
                        <div className="flex items-center gap-4 bg-gray-50 p-6 rounded-3xl">
                            <MapPin className="w-8 h-8 text-gray-400" />
                            <div>
                                <p className="font-black italic uppercase tracking-tighter text-xl">{tournament.location_name}</p>
                                <p className="text-xs text-gray-500 font-medium">Verified Facility Node</p>
                            </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-green-600 mb-2">Deployment Schedule</h4>
                        <div className="flex items-center gap-4 bg-gray-50 p-6 rounded-3xl">
                            <Calendar className="w-8 h-8 text-gray-400" />
                            <div>
                                <p className="font-black italic uppercase tracking-tighter text-xl">{new Date(tournament.start_date!).toLocaleDateString()}</p>
                                <p className="text-xs text-gray-500 font-medium">Standard Launch Window</p>
                            </div>
                        </div>
                      </div>
                  </div>
                  <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-green-600 mb-2">Satellite Visualizer</h4>
                      <div ref={mapRef} className="h-64 bg-gray-100 rounded-[3rem] border border-gray-100 shadow-inner overflow-hidden flex items-center justify-center text-gray-300 italic font-bold">
                          {!tournament.latitude && "Coordinates not set for this arena."}
                      </div>
                  </div>
              </div>
          )}

          {activeTab === 'admin' && (
              <div className="space-y-8">
                  <div className="bg-gray-900 p-12 rounded-[3.5rem] text-white flex justify-between items-center">
                      <div>
                        <h3 className="text-3xl font-black italic uppercase tracking-tighter">Commander Operations</h3>
                        <p className="text-gray-400 font-medium">Manage rosters and participant clearance.</p>
                      </div>
                      <button onClick={() => setIsRecruiting(true)} className="bg-green-600 text-white px-8 py-4 rounded-2xl font-black uppercase italic shadow-lg shadow-green-900/20 active:scale-95 transition-all">Recruit Player</button>
                  </div>
                  <div className="bg-gray-50 p-8 rounded-[3rem]">
                      <h4 className="font-black uppercase tracking-widest text-[10px] mb-6 text-gray-400">Recruitment Pool ({participants.length})</h4>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {participants.map(p => {
                            const isAssigned = teamMembers.some(m => m.user_id === p.user_id);
                            return (
                                <div key={p.id} className="flex justify-between items-center p-5 bg-white rounded-2xl shadow-sm border border-gray-100">
                                    <div>
                                      <p className="font-black italic uppercase tracking-tighter">{p.full_name}</p>
                                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">@{p.username}</p>
                                    </div>
                                    {isAssigned ? (
                                        <span className="text-[9px] font-black uppercase px-3 py-1 bg-green-50 text-green-700 rounded-full border border-green-100">Assigned</span>
                                    ) : (
                                        <button onClick={() => setIsAssigning(p)} className="p-2 bg-gray-50 hover:bg-green-600 hover:text-white rounded-xl transition-all"><UserPlus className="w-4 h-4" /></button>
                                    )}
                                </div>
                            );
                        })}
                      </div>
                  </div>
              </div>
          )}
      </div>

      {/* Modals remained same as before for Schedule, Recruitment, New Squad */}
      {isAssigning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-300">
             <div className="bg-white w-full max-w-lg rounded-[4rem] p-12 shadow-2xl animate-in zoom-in duration-300">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-4xl font-black italic uppercase tracking-tighter">Assign to Squad</h2>
                    <button onClick={() => setIsAssigning(null)} className="p-4 hover:bg-gray-100 rounded-full transition-colors"><X /></button>
                </div>
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
                    {teams.map(team => (
                        <button key={team.id} onClick={() => handleAssignToTeam(team.id)} className="w-full text-left p-6 bg-gray-50 rounded-3xl hover:bg-green-600 hover:text-white transition-all group flex items-center justify-between">
                            <span className="font-black italic uppercase text-xl tracking-tighter">{team.name}</span>
                            <span className="text-[10px] font-black uppercase">{team.member_count || 0} Members</span>
                        </button>
                    ))}
                </div>
             </div>
          </div>
      )}
      
      {isScheduling && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-300">
             <div className="bg-white w-full max-w-2xl rounded-[4rem] p-12 shadow-2xl animate-in zoom-in duration-300 border-t-8 border-blue-600">
                <div className="flex justify-between items-center mb-10">
                    <h2 className="text-4xl font-black italic uppercase tracking-tighter">Plan Battle</h2>
                    <button onClick={() => setIsScheduling(false)} className="p-4 hover:bg-gray-100 rounded-full transition-colors"><X /></button>
                </div>
                <form onSubmit={handleScheduleMatch} className="space-y-8">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Home Squad</label>
                          <select required className="w-full px-6 py-5 bg-gray-50 border rounded-2xl font-black italic text-xl uppercase" value={scheduleData.team1Id} onChange={e => setScheduleData({...scheduleData, team1Id: e.target.value})}>
                            <option value="">Select...</option>
                            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Away Squad</label>
                          <select required className="w-full px-6 py-5 bg-gray-50 border rounded-2xl font-black italic text-xl uppercase" value={scheduleData.team2Id} onChange={e => setScheduleData({...scheduleData, team2Id: e.target.value})}>
                            <option value="">Select...</option>
                            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Launch Time</label>
                        <input type="datetime-local" required className="w-full px-8 py-6 bg-gray-50 border rounded-[2rem] font-black italic text-2xl" onChange={e => setScheduleData({...scheduleData, time: e.target.value})}/>
                    </div>
                    <button type="submit" className="w-full bg-blue-600 text-white py-8 rounded-[2.5rem] font-black italic uppercase text-2xl shadow-xl active:scale-95 transition-all">Initialize Battle</button>
                </form>
             </div>
          </div>
      )}
    </div>
  );
};

export default TournamentDetailPage;
