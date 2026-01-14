
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Trophy, Users, Calendar, MapPin, List, LayoutGrid, PlayCircle, PlusCircle, Share2, Download, FileText, ChevronRight, UserPlus, Upload, FileJson, X } from 'lucide-react';
import { supabase } from '../services/supabase';
import { Tournament, Team, Match, Profile } from '../types';

interface TournamentDetailPageProps {
  profile: Profile;
}

const TournamentDetailPage: React.FC<TournamentDetailPageProps> = ({ profile }) => {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'standings' | 'matches' | 'info'>('standings');
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkNames, setBulkNames] = useState('');

  const isOrganizer = tournament?.organizer_id === profile.id || profile.role === 'superadmin';

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    const { data: tour } = await supabase.from('tournaments').select('*').eq('id', id).single();
    const { data: teamData } = await supabase.from('teams').select('*').eq('tournament_id', id).order('points', { ascending: false });
    const { data: matchData } = await supabase.from('matches').select(`
      *,
      team1:team1_id(name),
      team2:team2_id(name)
    `).eq('tournament_id', id).order('scheduled_at', { ascending: true });

    if (tour) setTournament(tour);
    if (teamData) setTeams(teamData);
    if (matchData) {
      setMatches(matchData.map(m => ({
        ...m,
        team1_name: (m.team1 as any)?.name,
        team2_name: (m.team2 as any)?.name,
      })));
    }
    setLoading(false);
  };

  const handleBulkAdd = async () => {
    const names = bulkNames.split(',').map(n => n.trim()).filter(n => n.length > 0);
    if (names.length === 0) return;

    const { error } = await supabase.rpc('bulk_add_teams', {
      tournament_id: id,
      team_names: names
    });

    if (!error) {
      alert(`Bulk imported ${names.length} teams.`);
      setBulkNames('');
      setShowBulkAdd(false);
      fetchData();
    }
  };

  const exportFullReport = (format: 'csv' | 'json') => {
    const data = teams.map((t, i) => ({
      Rank: i + 1,
      UserID: t.id.split('-')[0],
      FullID: t.id,
      TeamName: t.name,
      Wins: t.wins,
      Losses: t.losses,
      Points: t.points,
      MatchesPlayed: t.wins + t.losses
    }));

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${tournament?.name}_report.json`;
      link.click();
    } else {
      const headers = Object.keys(data[0]);
      const csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n"
        + data.map(row => Object.values(row).join(",")).join("\n");
      const link = document.createElement("a");
      link.href = encodeURI(csvContent);
      link.download = `${tournament?.name}_report.csv`;
      link.click();
    }
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const addMatch = async () => {
    if (teams.length < 2) {
      alert("At least 2 teams required to create a match.");
      return;
    }
    const { error } = await supabase.from('matches').insert({
      tournament_id: id,
      team1_id: teams[0].id,
      team2_id: teams[1].id,
      status: 'pending',
      scheduled_at: new Date().toISOString()
    });
    if (!error) fetchData();
  };

  const startMatch = async (matchId: string) => {
    const { error } = await supabase.from('matches').update({ status: 'live' }).eq('id', matchId);
    if (!error) fetchData();
  };

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
           <button onClick={() => exportFullReport('csv')} className="bg-white/10 hover:bg-white/20 backdrop-blur-xl p-5 rounded-3xl text-white transition-all shadow-xl border border-white/20 flex items-center gap-3">
              <FileText className="w-5 h-5" />
              <span className="text-xs font-black uppercase tracking-widest hidden md:block">Export CSV</span>
           </button>
           <button onClick={() => exportFullReport('json')} className="bg-white/10 hover:bg-white/20 backdrop-blur-xl p-5 rounded-3xl text-white transition-all shadow-xl border border-white/20 flex items-center gap-3">
              <FileJson className="w-5 h-5" />
              <span className="text-xs font-black uppercase tracking-widest hidden md:block">Export JSON</span>
           </button>
        </div>

        <div className="absolute bottom-12 left-12 text-white max-w-4xl">
          <div className="flex flex-wrap items-center gap-4 mb-6">
             <span className="bg-green-600 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-green-900/40">Official Arena</span>
             <span className="bg-white/10 backdrop-blur-md px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 border border-white/20"><MapPin className="w-4 h-4 text-green-400" /> {tournament.location_name || 'ShuttleUp Arena'}</span>
             <span className="bg-white/10 backdrop-blur-md px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 border border-white/20"><Calendar className="w-4 h-4 text-green-400" /> {new Date(tournament.start_date!).toLocaleDateString()}</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter mb-4 leading-none">{tournament.name}</h1>
          <p className="text-gray-300 font-medium text-lg leading-relaxed line-clamp-2">{tournament.description || 'Welcome to the official ShuttleUp circuit.'}</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-10">
        <div className="flex-1 space-y-8">
          {/* Navigation Tabs */}
          <div className="flex bg-white p-3 rounded-[2.5rem] shadow-xl border border-gray-100 max-w-md">
             {[
               { id: 'standings', label: 'Rankings', icon: List },
               { id: 'matches', label: 'Live Hub', icon: LayoutGrid },
               { id: 'info', label: 'Rules', icon: Trophy }
             ].map(tab => (
               <button 
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id as any)}
                 className={`flex-1 flex items-center justify-center gap-3 py-5 rounded-[2rem] text-xs font-black italic uppercase tracking-tighter transition-all ${
                   activeTab === tab.id ? 'bg-gray-900 text-white shadow-2xl scale-105' : 'text-gray-400 hover:bg-gray-50'
                 }`}
               >
                 <tab.icon className="w-4 h-4" /> {tab.label}
               </button>
             ))}
          </div>

          <div className="bg-white rounded-[3.5rem] border border-gray-100 shadow-2xl overflow-hidden min-h-[600px]">
            {activeTab === 'standings' && (
              <div className="p-12 animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
                  <h3 className="text-4xl font-black italic uppercase tracking-tighter text-gray-900">Arena Rankings</h3>
                  {isOrganizer && (
                    <div className="flex gap-3">
                       <button onClick={() => setShowBulkAdd(true)} className="bg-gray-900 text-white px-8 py-4 rounded-2xl font-black italic uppercase tracking-tighter flex items-center gap-3 hover:bg-black transition-all shadow-xl text-sm">
                          <Upload className="w-4 h-4" /> Bulk Add
                       </button>
                    </div>
                  )}
                </div>
                <div className="overflow-x-auto">
                   <table className="w-full text-left">
                      <thead>
                        <tr className="border-b-4 border-gray-50">
                          <th className="pb-8 px-6 text-[10px] font-black uppercase text-gray-400 tracking-widest">Rank</th>
                          <th className="pb-8 px-6 text-[10px] font-black uppercase text-gray-400 tracking-widest">Participant / ID</th>
                          <th className="pb-8 px-6 text-[10px] font-black uppercase text-gray-400 tracking-widest">W/L</th>
                          <th className="pb-8 px-6 text-[10px] font-black uppercase text-gray-400 tracking-widest text-right">Points</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {teams.length === 0 ? (
                           <tr>
                              <td colSpan={4} className="py-20 text-center text-gray-300 font-black uppercase italic tracking-widest">No participants registered</td>
                           </tr>
                        ) : teams.map((team, idx) => (
                          <tr key={team.id} className="group hover:bg-green-50/50 transition-all">
                            <td className="py-8 px-6">
                               <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl italic shadow-xl transition-transform group-hover:scale-110 ${
                                 idx === 0 ? 'bg-yellow-400 text-white rotate-6' : 
                                 idx === 1 ? 'bg-gray-300 text-white -rotate-6' : 
                                 idx === 2 ? 'bg-orange-400 text-white rotate-3' : 
                                 'bg-gray-100 text-gray-400'
                               }`}>
                                  {idx + 1}
                               </div>
                            </td>
                            <td className="py-8 px-6">
                               <p className="font-black text-2xl text-gray-900 uppercase tracking-tighter italic leading-none">{team.name}</p>
                               <p className="text-[10px] font-black text-gray-400 mt-2 uppercase tracking-widest">UID: {team.id.split('-')[0]}</p>
                            </td>
                            <td className="py-8 px-6">
                               <div className="flex items-center gap-3">
                                  <span className="text-green-600 font-black text-lg">{team.wins}W</span>
                                  <span className="text-gray-300">/</span>
                                  <span className="text-red-500 font-black text-lg">{team.losses}L</span>
                                </div>
                            </td>
                            <td className="py-8 px-6 text-right font-black text-4xl text-green-600 italic tracking-tighter group-hover:scale-110 transition-transform">{team.points}</td>
                          </tr>
                        ))}
                      </tbody>
                   </table>
                </div>
              </div>
            )}

            {activeTab === 'matches' && (
              <div className="p-12 animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between mb-12">
                  <h3 className="text-4xl font-black italic uppercase tracking-tighter text-gray-900">Battle Log</h3>
                  {isOrganizer && (
                    <button onClick={addMatch} className="bg-green-600 text-white px-10 py-4 rounded-2xl font-black italic uppercase tracking-tighter flex items-center gap-3 hover:bg-green-700 transition-all shadow-2xl shadow-green-100">
                      <PlusCircle className="w-5 h-5" /> Schedule Fight
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
                            <span className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl border-b-4 ${
                              m.status === 'live' ? 'bg-red-600 text-white animate-pulse border-red-800' : 
                              m.status === 'completed' ? 'bg-gray-900 text-white border-black' : 'bg-white text-gray-400 border-gray-100'
                            }`}>
                              {m.status}
                            </span>
                            <div className="text-gray-200 font-black italic text-4xl my-6">VS</div>
                            <div className="text-[10px] font-black text-gray-400 uppercase mb-6 flex items-center gap-2"><Calendar className="w-3 h-3"/> {formatTime(m.scheduled_at)}</div>
                            
                            {m.status === 'pending' && isOrganizer ? (
                              <button onClick={() => startMatch(m.id)} className="bg-green-600 text-white px-8 py-3 rounded-full text-xs font-black uppercase tracking-widest hover:bg-green-700 transition-all shadow-xl shadow-green-100 active:scale-95">Initiate Battle</button>
                            ) : (
                              <Link to={`/scoring/${m.id}`} className="bg-gray-900 text-white text-xs font-black uppercase tracking-widest flex items-center gap-3 hover:bg-black px-8 py-3 rounded-full transition-all shadow-xl">
                                <PlayCircle className="w-4 h-4" /> Spectate
                              </Link>
                            )}
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
                       <div className="absolute bottom-0 right-0 p-8 opacity-5">
                          <Trophy className="w-64 h-64" />
                       </div>
                       <p className="relative z-10 text-lg">{tournament.rules_handbook || "The organizer hasn't uploaded specific protocols for this arena. Standard ShuttleUp Competitive Rules apply. Matches are 21-point rallies, best of 3 sets. Sharp play is expected."}</p>
                    </div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-green-50 p-10 rounded-[3rem] border border-green-100 shadow-xl shadow-green-50/50">
                       <h4 className="font-black italic uppercase tracking-tighter text-2xl mb-6 flex items-center gap-3 text-green-700">
                          <LayoutGrid className="w-8 h-8" /> Scoring Logic
                       </h4>
                       <p className="text-green-800 font-bold text-sm leading-relaxed">Rally point system. Standard singles/doubles lines. Service faults will be strictly enforced by official scorers using our live dashboard.</p>
                    </div>
                    <div className="bg-gray-50 p-10 rounded-[3rem] border border-gray-100 shadow-xl">
                       <h4 className="font-black italic uppercase tracking-tighter text-2xl mb-6 flex items-center gap-3 text-gray-800">
                          <Users className="w-8 h-8" /> Code of Honor
                       </h4>
                       <p className="text-gray-500 font-bold text-sm leading-relaxed">Respect the arena. Any dissent towards organizers or system officials will trigger immediate profile disqualification and credit forfeiture.</p>
                    </div>
                 </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="w-full lg:w-[400px] space-y-8">
           <div className="bg-white p-12 rounded-[3.5rem] border border-gray-100 shadow-2xl">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 mb-10 border-b-2 border-gray-50 pb-6">Arena Intelligence</h3>
              <div className="space-y-10">
                 <div className="group">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-3 tracking-widest group-hover:text-green-600 transition-colors">Squad Statistics</p>
                    <div className="flex items-center gap-5">
                       <div className="bg-green-50 p-4 rounded-[1.5rem] text-green-600 group-hover:bg-green-600 group-hover:text-white transition-all"><Users className="w-8 h-8" /></div>
                       <span className="text-5xl font-black italic tracking-tighter text-gray-900">{teams.length}</span>
                    </div>
                 </div>
                 <div className="group">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-3 tracking-widest group-hover:text-blue-600 transition-colors">Concluded Battles</p>
                    <div className="flex items-center gap-5">
                       <div className="bg-blue-50 p-4 rounded-[1.5rem] text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all"><Trophy className="w-8 h-8" /></div>
                       <span className="text-5xl font-black italic tracking-tighter text-gray-900">{matches.filter(m => m.status === 'completed').length}</span>
                    </div>
                 </div>
                 <div className="group">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-3 tracking-widest group-hover:text-orange-600 transition-colors">Arena Launch Date</p>
                    <div className="flex items-center gap-5">
                       <div className="bg-orange-50 p-4 rounded-[1.5rem] text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-all"><Calendar className="w-8 h-8" /></div>
                       <span className="text-2xl font-black uppercase italic tracking-tighter text-gray-900 leading-none">{new Date(tournament.start_date!).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                 </div>
              </div>
           </div>

           <div className="bg-gray-900 p-12 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden border border-gray-800">
              <div className="absolute top-0 right-0 w-48 h-48 bg-green-600/20 -mr-24 -mt-24 rounded-full blur-3xl" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-8">System Authority</h3>
              <div className="flex items-center gap-6">
                 <div className="w-20 h-20 bg-gray-800 rounded-[2rem] flex items-center justify-center border-2 border-green-500 shadow-2xl">
                    <Trophy className="w-10 h-10 text-green-500" />
                 </div>
                 <div>
                    <p className="font-black text-3xl italic uppercase tracking-tighter text-white">Elite Sports</p>
                    <div className="flex items-center gap-2 mt-2">
                       <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                       <p className="text-[10px] font-black uppercase tracking-widest text-green-400">Verified Arena Node</p>
                    </div>
                 </div>
              </div>
              <button className="w-full mt-10 bg-green-600 text-white py-5 rounded-2xl font-black italic uppercase tracking-tighter text-sm flex items-center justify-center gap-3 hover:bg-green-700 transition-all shadow-xl shadow-green-900/40 active:scale-95">
                 Communicate with Host <ChevronRight className="w-5 h-5" />
              </button>
           </div>
        </div>
      </div>

      {/* Bulk Add Modal */}
      {showBulkAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300 border-t-8 border-gray-900">
             <div className="p-12">
                <div className="flex justify-between items-center mb-8">
                   <div>
                      <h2 className="text-4xl font-black italic uppercase tracking-tighter">Bulk Import</h2>
                      <p className="text-gray-500 font-medium">Add multiple squads at once.</p>
                   </div>
                   <button onClick={() => setShowBulkAdd(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X className="w-8 h-8"/></button>
                </div>
                
                <div className="space-y-6">
                   <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-3">Team Names (Comma Separated)</label>
                      <textarea 
                        value={bulkNames}
                        onChange={(e) => setBulkNames(e.target.value)}
                        placeholder="Smashers, Red Hawks, Blue Eagles, Net Masters..."
                        className="w-full px-8 py-6 bg-gray-50 border border-gray-100 rounded-[2rem] outline-none focus:ring-4 focus:ring-gray-900/10 min-h-[180px] font-black italic tracking-tighter text-xl uppercase"
                      />
                   </div>
                   <button 
                     onClick={handleBulkAdd}
                     className="w-full py-5 bg-gray-900 text-white font-black uppercase italic tracking-tighter text-xl rounded-2xl hover:bg-black transition-all shadow-2xl active:scale-95"
                   >
                     Inject Participants
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentDetailPage;
