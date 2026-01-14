
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Trophy, Users, Calendar, MapPin, List, LayoutGrid, PlayCircle, PlusCircle, Share2, Download } from 'lucide-react';
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
    // Simple logic for choosing teams (In a real app, use a modal)
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

  const exportData = () => {
    const data = { tournament, teams, matches };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tournament_${tournament?.name}.json`;
    link.click();
  };

  if (loading) return <div>Loading Court...</div>;
  if (!tournament) return <div>Tournament not found.</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Hero Header */}
      <div className="relative h-64 md:h-80 rounded-[3rem] overflow-hidden shadow-2xl">
        <img src={`https://picsum.photos/seed/${id}/1200/400`} className="w-full h-full object-cover" alt="Hero" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute bottom-10 left-10 text-white">
          <div className="flex items-center gap-2 mb-3">
             <span className="bg-green-600 px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest">Active Tournament</span>
             <span className="bg-white/20 backdrop-blur px-4 py-1 rounded-full text-xs font-bold flex items-center gap-1"><MapPin className="w-3 h-3" /> {tournament.location_name || 'Global Arena'}</span>
          </div>
          <h1 className="text-5xl font-black italic uppercase tracking-tighter mb-2">{tournament.name}</h1>
          <p className="text-gray-300 font-medium max-w-xl line-clamp-2">{tournament.description || 'Welcome to the official ShuttleUp tournament. May the best players win!'}</p>
        </div>
        <div className="absolute top-8 right-8 flex gap-3">
           <button onClick={exportData} className="bg-white/10 hover:bg-white/20 backdrop-blur p-4 rounded-full text-white transition-all"><Download className="w-5 h-5" /></button>
           <button className="bg-white/10 hover:bg-white/20 backdrop-blur p-4 rounded-full text-white transition-all"><Share2 className="w-5 h-5" /></button>
        </div>
      </div>

      {/* Tabs & Content */}
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 space-y-6">
          <div className="flex bg-white p-2 rounded-3xl shadow-sm border border-gray-100 max-w-md">
             {[
               { id: 'standings', label: 'Standings', icon: List },
               { id: 'matches', label: 'Match Hub', icon: LayoutGrid },
               { id: 'info', label: 'Rules', icon: Trophy }
             ].map(tab => (
               <button 
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id as any)}
                 className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all ${
                   activeTab === tab.id ? 'bg-green-600 text-white shadow-lg shadow-green-100' : 'text-gray-500 hover:bg-gray-50'
                 }`}
               >
                 <tab.icon className="w-4 h-4" /> {tab.label}
               </button>
             ))}
          </div>

          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden min-h-[400px]">
            {activeTab === 'standings' && (
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-black italic uppercase tracking-tighter text-gray-900">Leaderboard</h3>
                  {isOrganizer && (
                    <button onClick={addTeam} className="bg-green-50 text-green-700 px-6 py-2 rounded-2xl font-bold flex items-center gap-2 hover:bg-green-100 transition-colors">
                      <PlusCircle className="w-4 h-4" /> Add Team
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto">
                   <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-gray-50">
                          <th className="pb-4 px-4 text-[10px] font-black uppercase text-gray-400">Rank</th>
                          <th className="pb-4 px-4 text-[10px] font-black uppercase text-gray-400">Team Name</th>
                          <th className="pb-4 px-4 text-[10px] font-black uppercase text-gray-400">W</th>
                          <th className="pb-4 px-4 text-[10px] font-black uppercase text-gray-400">L</th>
                          <th className="pb-4 px-4 text-[10px] font-black uppercase text-gray-400 text-right">Points</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {teams.map((team, idx) => (
                          <tr key={team.id} className="group hover:bg-green-50/30">
                            <td className="py-6 px-4">
                               <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : idx === 1 ? 'bg-gray-100 text-gray-700' : 'bg-orange-50 text-orange-700'}`}>
                                  {idx + 1}
                               </div>
                            </td>
                            <td className="py-6 px-4 font-bold text-gray-900">{team.name}</td>
                            <td className="py-6 px-4 text-gray-600 font-medium">{team.wins}</td>
                            <td className="py-6 px-4 text-gray-600 font-medium">{team.losses}</td>
                            <td className="py-6 px-4 text-right font-black text-xl text-green-600 italic tracking-tighter">{team.points}</td>
                          </tr>
                        ))}
                      </tbody>
                   </table>
                </div>
              </div>
            )}

            {activeTab === 'matches' && (
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-black italic uppercase tracking-tighter text-gray-900">Match Schedule</h3>
                  {isOrganizer && (
                    <button onClick={addMatch} className="bg-green-50 text-green-700 px-6 py-2 rounded-2xl font-bold flex items-center gap-2 hover:bg-green-100 transition-colors">
                      <PlusCircle className="w-4 h-4" /> New Match
                    </button>
                  )}
                </div>
                <div className="grid gap-4">
                  {matches.map(m => (
                    <div key={m.id} className="bg-gray-50 p-6 rounded-3xl border border-gray-100 flex items-center justify-between group hover:border-green-200 transition-all">
                       <div className="flex-1 text-center">
                          <p className="text-sm font-black uppercase tracking-tighter text-gray-900">{m.team1_name}</p>
                          <p className="text-3xl font-black mt-2">{m.score1}</p>
                       </div>
                       <div className="px-8 flex flex-col items-center">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${m.status === 'live' ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-200 text-gray-500'}`}>
                             {m.status}
                          </span>
                          <span className="text-gray-300 font-bold my-2">VS</span>
                          {m.status === 'pending' && isOrganizer ? (
                             <button onClick={() => startMatch(m.id)} className="bg-green-600 text-white px-4 py-1.5 rounded-full text-xs font-bold hover:bg-green-700 transition-all">Start</button>
                          ) : (
                             <Link to={`/scoring/${m.id}`} className="text-green-600 text-xs font-black uppercase tracking-widest flex items-center gap-1 hover:underline">
                                <PlayCircle className="w-4 h-4" /> View
                             </Link>
                          )}
                       </div>
                       <div className="flex-1 text-center">
                          <p className="text-sm font-black uppercase tracking-tighter text-gray-900">{m.team2_name}</p>
                          <p className="text-3xl font-black mt-2">{m.score2}</p>
                       </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'info' && (
              <div className="p-10 space-y-8">
                 <div>
                    <h4 className="text-lg font-bold text-gray-900 mb-4">Handbook & Official Rules</h4>
                    <div className="prose prose-sm text-gray-600">
                       <p>{tournament.rules_handbook || "The organizer hasn't uploaded official rules yet. Standard Badminton World Federation (BWF) rules apply."}</p>
                    </div>
                 </div>
                 <div className="bg-blue-50 p-8 rounded-3xl border border-blue-100">
                    <h4 className="text-blue-900 font-bold flex items-center gap-2 mb-2">
                       <LayoutGrid className="w-5 h-5" />
                       Match Format
                    </h4>
                    <p className="text-blue-800 text-sm">Best of 3 sets, rally point system to 21 points. Standard singles/doubles lines apply. Professional conduct is expected from all athletes.</p>
                 </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-80 space-y-6">
           <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
              <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-6">Tournament Meta</h3>
              <div className="space-y-6">
                 <div>
                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Total Teams</p>
                    <div className="flex items-center gap-3">
                       <Users className="w-5 h-5 text-green-600" />
                       <span className="text-2xl font-black">{teams.length}</span>
                    </div>
                 </div>
                 <div>
                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Matches Played</p>
                    <div className="flex items-center gap-3">
                       <LayoutGrid className="w-5 h-5 text-green-600" />
                       <span className="text-2xl font-black">{matches.filter(m => m.status === 'completed').length}</span>
                    </div>
                 </div>
                 <div>
                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Event Date</p>
                    <div className="flex items-center gap-3">
                       <Calendar className="w-5 h-5 text-green-600" />
                       <span className="font-bold text-gray-900">{new Date(tournament.start_date!).toLocaleDateString()}</span>
                    </div>
                 </div>
              </div>
           </div>

           <div className="bg-gray-900 p-8 rounded-[2.5rem] text-white shadow-xl">
              <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-4">Official Organizer</h3>
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center font-bold text-xl">
                    <Trophy className="w-6 h-6" />
                 </div>
                 <div>
                    <p className="font-bold text-lg">Elite Sports</p>
                    <p className="text-xs text-gray-400">Verified Organization</p>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default TournamentDetailPage;
