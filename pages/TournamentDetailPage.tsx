
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Trophy, Users, Calendar, MapPin, List, LayoutGrid, PlayCircle, PlusCircle, Share2, Download, FileText, ChevronRight } from 'lucide-react';
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

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const addTeam = async () => {
    const name = prompt("Enter team name:");
    if (!name) return;
    const { error } = await supabase.from('teams').insert({ tournament_id: id, name });
    if (!error) fetchData();
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

  const exportCSV = () => {
    const headers = ["Rank", "Team", "Wins", "Losses", "Points"];
    const rows = teams.map((t, i) => [i + 1, t.name, t.wins, t.losses, t.points]);
    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${tournament?.name}_standings.csv`);
    document.body.appendChild(link);
    link.click();
  };

  if (loading) return <div className="p-20 text-center font-bold text-green-600 animate-pulse">Loading Arena...</div>;
  if (!tournament) return <div>Tournament not found.</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Hero Header */}
      <div className="relative h-64 md:h-96 rounded-[3.5rem] overflow-hidden shadow-2xl border-4 border-white">
        <img src={`https://picsum.photos/seed/${id}/1200/600`} className="w-full h-full object-cover" alt="Hero" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
        <div className="absolute bottom-12 left-12 text-white">
          <div className="flex items-center gap-3 mb-4">
             <span className="bg-green-600 px-5 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-lg">Live Competition</span>
             <span className="bg-white/20 backdrop-blur px-5 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 border border-white/30"><MapPin className="w-4 h-4" /> {tournament.location_name || 'ShuttleUp Arena'}</span>
          </div>
          <h1 className="text-6xl font-black italic uppercase tracking-tighter mb-2 leading-none">{tournament.name}</h1>
          <p className="text-gray-300 font-medium max-w-2xl text-lg leading-relaxed">{tournament.description || 'Join the official ShuttleUp tournament circuit.'}</p>
        </div>
        <div className="absolute top-10 right-10 flex gap-4">
           <button onClick={exportCSV} className="bg-white/20 hover:bg-white/30 backdrop-blur p-5 rounded-[2rem] text-white transition-all shadow-xl border border-white/20 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              <span className="text-xs font-black uppercase tracking-widest">CSV</span>
           </button>
           <button className="bg-green-600 hover:bg-green-700 p-5 rounded-[2rem] text-white transition-all shadow-xl shadow-green-900/40">
              <Share2 className="w-5 h-5" />
           </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 space-y-6">
          {/* Navigation Tabs */}
          <div className="flex bg-white p-2.5 rounded-[2rem] shadow-sm border border-gray-100 max-w-md">
             {[
               { id: 'standings', label: 'Standings', icon: List },
               { id: 'matches', label: 'Match Hub', icon: LayoutGrid },
               { id: 'info', label: 'Rules', icon: Trophy }
             ].map(tab => (
               <button 
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id as any)}
                 className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-[1.5rem] text-sm font-black italic uppercase tracking-tighter transition-all ${
                   activeTab === tab.id ? 'bg-gray-900 text-white shadow-xl' : 'text-gray-400 hover:bg-gray-50'
                 }`}
               >
                 <tab.icon className="w-4 h-4" /> {tab.label}
               </button>
             ))}
          </div>

          <div className="bg-white rounded-[3rem] border border-gray-100 shadow-xl overflow-hidden min-h-[500px]">
            {activeTab === 'standings' && (
              <div className="p-10">
                <div className="flex items-center justify-between mb-10">
                  <h3 className="text-3xl font-black italic uppercase tracking-tighter text-gray-900">Leaderboard</h3>
                  {isOrganizer && (
                    <button onClick={addTeam} className="bg-green-600 text-white px-8 py-3 rounded-2xl font-black italic uppercase tracking-tighter flex items-center gap-2 hover:bg-green-700 transition-all shadow-lg shadow-green-100">
                      <PlusCircle className="w-4 h-4" /> Add Team
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto">
                   <table className="w-full text-left">
                      <thead>
                        <tr className="border-b-2 border-gray-50">
                          <th className="pb-6 px-4 text-[11px] font-black uppercase text-gray-400 tracking-widest">Rank</th>
                          <th className="pb-6 px-4 text-[11px] font-black uppercase text-gray-400 tracking-widest">Team Name</th>
                          <th className="pb-6 px-4 text-[11px] font-black uppercase text-gray-400 tracking-widest">W</th>
                          <th className="pb-6 px-4 text-[11px] font-black uppercase text-gray-400 tracking-widest">L</th>
                          <th className="pb-6 px-4 text-[11px] font-black uppercase text-gray-400 tracking-widest text-right">Points</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {teams.map((team, idx) => (
                          <tr key={team.id} className="group hover:bg-green-50/40 transition-colors">
                            <td className="py-8 px-4">
                               <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg ${
                                 idx === 0 ? 'bg-yellow-400 text-white rotate-3 shadow-lg' : 
                                 idx === 1 ? 'bg-gray-300 text-white -rotate-3' : 
                                 'bg-orange-100 text-orange-700'
                               }`}>
                                  {idx + 1}
                               </div>
                            </td>
                            <td className="py-8 px-4 font-black text-xl text-gray-900 uppercase tracking-tighter italic">{team.name}</td>
                            <td className="py-8 px-4 text-gray-500 font-bold text-lg">{team.wins}</td>
                            <td className="py-8 px-4 text-gray-500 font-bold text-lg">{team.losses}</td>
                            <td className="py-8 px-4 text-right font-black text-3xl text-green-600 italic tracking-tighter">{team.points}</td>
                          </tr>
                        ))}
                      </tbody>
                   </table>
                </div>
              </div>
            )}

            {activeTab === 'matches' && (
              <div className="p-10">
                <div className="flex items-center justify-between mb-10">
                  <h3 className="text-3xl font-black italic uppercase tracking-tighter text-gray-900">Match Schedule</h3>
                  {isOrganizer && (
                    <button onClick={addMatch} className="bg-gray-900 text-white px-8 py-3 rounded-2xl font-black italic uppercase tracking-tighter flex items-center gap-2 hover:bg-black transition-all shadow-xl">
                      <PlusCircle className="w-4 h-4" /> New Match
                    </button>
                  )}
                </div>
                <div className="grid gap-6">
                  {matches.length === 0 ? (
                    <div className="py-20 text-center text-gray-300 italic font-medium">No matches scheduled yet.</div>
                  ) : (
                    matches.map(m => (
                      <div key={m.id} className="bg-gray-50 p-8 rounded-[2.5rem] border border-gray-100 flex items-center justify-between group hover:border-green-300 transition-all hover:shadow-lg">
                        <div className="flex-1 text-center">
                            <p className="text-lg font-black uppercase tracking-tighter text-gray-900 italic">{m.team1_name}</p>
                            <p className="text-5xl font-black mt-2 text-gray-800">{m.score1}</p>
                        </div>
                        <div className="px-12 flex flex-col items-center">
                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${
                              m.status === 'live' ? 'bg-red-600 text-white animate-pulse' : 
                              m.status === 'completed' ? 'bg-gray-900 text-white' : 'bg-white text-gray-400 border border-gray-100'
                            }`}>
                              {m.status}
                            </span>
                            <div className="text-gray-300 font-black italic text-2xl my-4">VS</div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase mb-4">{formatTime(m.scheduled_at)}</div>
                            
                            {m.status === 'pending' && isOrganizer ? (
                              <button onClick={() => startMatch(m.id)} className="bg-green-600 text-white px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest hover:bg-green-700 transition-all shadow-lg shadow-green-100">Start Match</button>
                            ) : (
                              <Link to={`/scoring/${m.id}`} className="text-green-600 text-sm font-black uppercase tracking-widest flex items-center gap-2 hover:bg-green-50 px-4 py-2 rounded-full transition-all border border-green-100">
                                <PlayCircle className="w-4 h-4" /> View Live
                              </Link>
                            )}
                        </div>
                        <div className="flex-1 text-center">
                            <p className="text-lg font-black uppercase tracking-tighter text-gray-900 italic">{m.team2_name}</p>
                            <p className="text-5xl font-black mt-2 text-gray-800">{m.score2}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'info' && (
              <div className="p-12 space-y-10">
                 <div>
                    <h4 className="text-2xl font-black italic uppercase tracking-tighter text-gray-900 mb-6">Handbook & Tournament Rules</h4>
                    <div className="bg-gray-50 p-8 rounded-[2rem] border-l-8 border-green-600 text-gray-700 leading-relaxed font-medium">
                       <p>{tournament.rules_handbook || "The organizer hasn't uploaded official rules yet. Standard Badminton World Federation (BWF) rules apply. Sets are played to 21 points, best of 3."}</p>
                    </div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-blue-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-blue-100">
                       <h4 className="font-black italic uppercase tracking-tighter text-xl mb-4 flex items-center gap-2">
                          <LayoutGrid className="w-6 h-6" /> Match Format
                       </h4>
                       <p className="text-blue-50 font-medium text-sm leading-relaxed">Rally point system. Standard singles/doubles lines. Service faults will be strictly called by the official scorer.</p>
                    </div>
                    <div className="bg-gray-900 p-8 rounded-[2.5rem] text-white shadow-xl">
                       <h4 className="font-black italic uppercase tracking-tighter text-xl mb-4 flex items-center gap-2">
                          <Users className="w-6 h-6" /> Code of Conduct
                       </h4>
                       <p className="text-gray-400 font-medium text-sm leading-relaxed">Fair play is mandatory. Any form of dissent towards scorers or opponents will lead to immediate disqualification.</p>
                    </div>
                 </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="w-full lg:w-96 space-y-6">
           <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-xl">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-8 border-b pb-4">Tournament Intelligence</h3>
              <div className="space-y-8">
                 <div>
                    <p className="text-xs font-black text-gray-400 uppercase mb-2">Competing Squads</p>
                    <div className="flex items-center gap-4">
                       <div className="bg-green-50 p-3 rounded-2xl text-green-600"><Users className="w-6 h-6" /></div>
                       <span className="text-4xl font-black italic tracking-tighter">{teams.length}</span>
                    </div>
                 </div>
                 <div>
                    <p className="text-xs font-black text-gray-400 uppercase mb-2">Matches Completed</p>
                    <div className="flex items-center gap-4">
                       <div className="bg-blue-50 p-3 rounded-2xl text-blue-600"><Trophy className="w-6 h-6" /></div>
                       <span className="text-4xl font-black italic tracking-tighter">{matches.filter(m => m.status === 'completed').length}</span>
                    </div>
                 </div>
                 <div>
                    <p className="text-xs font-black text-gray-400 uppercase mb-2">Scheduled Date</p>
                    <div className="flex items-center gap-4">
                       <div className="bg-orange-50 p-3 rounded-2xl text-orange-600"><Calendar className="w-6 h-6" /></div>
                       <span className="text