
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Trophy, PlusCircle, UserPlus, X, Check, MapPin, Hash, Play, Calendar, Download, ChevronLeft, Zap } from 'lucide-react';
import { db, dbService } from '../services/firebase';
import { collection, query, where, onSnapshot, doc, orderBy } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { Tournament, Team, Match, Profile } from '../types';

declare const google: any;

interface TournamentDetailPageProps {
  profile: Profile;
}

const TournamentDetailPage: React.FC<TournamentDetailPageProps> = ({ profile }) => {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'standings' | 'matches' | 'info' | 'admin'>('standings');
  const mapRef = useRef<HTMLDivElement>(null);
  
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleData, setScheduleData] = useState({ team1Id: '', team2Id: '', time: '' });

  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;

    // Tournament Listener
    const unsubTournament = onSnapshot(doc(db, "tournaments", id), (snap) => {
      if (snap.exists()) {
        setTournament({ id: snap.id, ...snap.data() } as Tournament);
      }
    });

    // Teams Listener
    const teamsQuery = query(collection(db, "teams"), where("tournament_id", "==", id), orderBy("points", "desc"));
    const unsubTeams = onSnapshot(teamsQuery, (snap) => {
      const teamData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
      setTeams(teamData);
    });

    // Matches Listener
    const matchesQuery = query(collection(db, "matches"), where("tournament_id", "==", id), orderBy("scheduled_at", "desc"));
    const unsubMatches = onSnapshot(matchesQuery, (snap) => {
      const matchData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match));
      setMatches(matchData);
      setLoading(false);
    });

    return () => {
      unsubTournament();
      unsubTeams();
      unsubMatches();
    };
  }, [id]);

  useEffect(() => {
    if (activeTab === 'info' && tournament?.latitude && mapRef.current && typeof google !== 'undefined') {
        const center = { lat: tournament.latitude, lng: tournament.longitude || 0 };
        const map = new google.maps.Map(mapRef.current, { center, zoom: 15 });
        new google.maps.Marker({ position: center, map, title: tournament.location_name });
    }
  }, [activeTab, tournament]);

  const isAdmin = tournament && (profile.id === tournament.organizer_id || profile.role === 'superadmin');

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      await dbService.teams.create(id, newTeamName);
      setNewTeamName('');
      setIsCreatingTeam(false);
    } catch (err: any) {
      alert(err.message || "Failed to create squad");
    }
  };

  const handleScheduleMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const t1 = teams.find(t => t.id === scheduleData.team1Id);
    const t2 = teams.find(t => t.id === scheduleData.team2Id);
    if (!t1 || !t2 || t1.id === t2.id) return alert("Select two different squads.");
    
    try {
      await dbService.matches.create(id, t1, t2, new Date(scheduleData.time).toISOString());
      setIsScheduling(false);
      setScheduleData({ team1Id: '', team2Id: '', time: '' });
    } catch (err: any) {
      alert(err.message || "Failed to schedule battle");
    }
  };

  const exportToCSV = () => {
    const headers = ["Rank", "Squad Name", "Wins", "Losses", "Points"];
    const rows = teams.map((t, idx) => [idx + 1, t.name, t.wins, t.losses, t.points]);
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

  if (loading) return (
    <div className="p-20 flex flex-col items-center justify-center gap-4">
      <Zap className="w-12 h-12 text-green-600 animate-bounce" />
      <p className="font-black animate-pulse uppercase tracking-tighter italic">Syncing Arena Node...</p>
    </div>
  );

  if (!tournament) return <div className="p-20 text-center font-black">Arena not found in cloud registry.</div>;

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      <div className="bg-gray-900 rounded-[3rem] p-12 text-white relative overflow-hidden border-b-8 border-green-600 shadow-2xl">
          <div className="flex items-center gap-4 mb-4">
             <span className="bg-green-600 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">ID: {tournament.share_id}</span>
             <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">FIREBASE CLOUD NODE</span>
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
                <button onClick={() => setIsScheduling(true)} className="bg-blue-600 text-white px-8 py-5 rounded-[2.5rem] font-black uppercase italic tracking-tighter shadow-xl flex items-center gap-2 hover:bg-blue-700 transition-all"><Calendar className="w-5 h-5" /> Schedule</button>
                <button onClick={() => setIsCreatingTeam(true)} className="bg-green-600 text-white px-8 py-5 rounded-[2.5rem] font-black uppercase italic tracking-tighter shadow-xl flex items-center gap-2 hover:bg-green-700 transition-all"><PlusCircle className="w-5 h-5" /> New Squad</button>
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
                        <th className="px-6 py-4 text-center">Wins</th>
                        <th className="px-6 py-4 text-center text-red-500">Losses</th>
                        <th className="px-6 py-4 text-right">Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {teams.length === 0 && <tr><td colSpan={4} className="py-20 text-center text-gray-300 font-black italic uppercase">No squads formed yet</td></tr>}
                      {teams.map((team, idx) => (
                        <tr key={team.id} className="group hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-8 flex items-center gap-4">
                            <span className="text-xl font-black text-gray-200">#0{idx+1}</span>
                            <span className="text-2xl font-black italic uppercase tracking-tighter group-hover:text-green-600">{team.name}</span>
                          </td>
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
                        <p className="text-gray-400 font-medium">Roster sync and node management.</p>
                      </div>
                  </div>
                  <div className="bg-gray-50 p-8 rounded-[3rem] text-center italic text-gray-400">
                    Squad management is currently handled via the Squads interface.
                  </div>
              </div>
          )}
      </div>

      {isCreatingTeam && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-300">
             <div className="bg-white w-full max-w-lg rounded-[4rem] p-12 shadow-2xl animate-in zoom-in duration-300 border-t-8 border-green-600">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-4xl font-black italic uppercase tracking-tighter">New Squad</h2>
                    <button onClick={() => setIsCreatingTeam(false)} className="p-4 hover:bg-gray-100 rounded-full transition-colors"><X /></button>
                </div>
                <form onSubmit={handleCreateTeam} className="space-y-6">
                    <input required className="w-full px-8 py-6 bg-gray-50 border rounded-2xl font-black italic text-2xl uppercase" placeholder="Squad Name" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} />
                    <button type="submit" className="w-full bg-green-600 text-white py-6 rounded-2xl font-black italic uppercase text-xl shadow-xl active:scale-95 transition-all">Form Squad</button>
                </form>
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
