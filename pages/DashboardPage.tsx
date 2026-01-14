
import React, { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Users, Calendar, ArrowRight, Play, Star, PlayCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Tournament, Match, Profile } from '../types';

interface DashboardPageProps {
  profile: Profile;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ profile }) => {
  const [stats, setStats] = useState({ totalTournaments: 0, liveMatches: 0, myMatches: 0 });
  const [featuredTournaments, setFeaturedTournaments] = useState<Tournament[]>([]);
  const [recentLiveMatches, setRecentLiveMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    
    // Subscribe to live score updates
    const channel = supabase
      .channel('dashboard_updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, () => {
        fetchDashboardData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const { count: tourCount } = await supabase.from('tournaments').select('*', { count: 'exact', head: true });
      const { count: liveCount } = await supabase.from('matches').select('*', { count: 'exact', head: true }).eq('status', 'live');
      
      const { data: featured } = await supabase
        .from('tournaments')
        .select('*')
        .eq('status', 'published')
        .limit(3);

      const { data: live } = await supabase
        .from('matches')
        .select(`
          *,
          team1:team1_id(name),
          team2:team2_id(name)
        `)
        .eq('status', 'live')
        .limit(4);

      setStats({
        totalTournaments: tourCount || 0,
        liveMatches: liveCount || 0,
        myMatches: 0, // In a real app, query participation
      });
      setFeaturedTournaments(featured || []);
      setRecentLiveMatches((live || []).map(m => ({
        ...m,
        team1_name: (m.team1 as any)?.name,
        team2_name: (m.team2 as any)?.name,
      })));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">The Court is Waiting</h1>
          <p className="text-gray-500 mt-1">Here's what's happening in ShuttleUp today.</p>
        </div>
        <div className="flex gap-3">
          <Link to="/tournaments" className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-green-100 flex items-center gap-2 transition-all active:scale-95">
            <Trophy className="w-4 h-4" />
            Find Tournaments
          </Link>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          { label: 'Active Tournaments', value: stats.totalTournaments, icon: Trophy, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Matches Live Now', value: stats.liveMatches, icon: Play, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'My Matches', value: stats.myMatches, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
        ].map((item, idx) => (
          <div key={idx} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className={`${item.bg} ${item.color} p-4 rounded-2xl`}>
                <item.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{item.label}</p>
                <p className="text-3xl font-bold text-gray-900">{item.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Live Matches */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Play className="w-5 h-5 text-red-500 animate-pulse" />
              Live Scoring
            </h3>
            <span className="text-sm text-red-500 font-semibold uppercase tracking-wider">Live Updates</span>
          </div>
          
          <div className="grid gap-4">
            {recentLiveMatches.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border-2 border-dashed border-gray-100 text-center">
                <PlayCircle className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-400 font-medium">No matches live at the moment</p>
              </div>
            ) : (
              recentLiveMatches.map((match) => (
                <Link 
                  key={match.id} 
                  to={`/scoring/${match.id}`}
                  className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:border-green-300 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col items-center flex-1">
                      <div className="w-12 h-12 bg-gray-50 rounded-full mb-2 flex items-center justify-center font-bold text-gray-700">
                        {match.team1_name?.charAt(0)}
                      </div>
                      <span className="text-sm font-bold text-gray-900 line-clamp-1">{match.team1_name}</span>
                    </div>
                    <div className="flex flex-col items-center px-8">
                      <div className="text-3xl font-black text-green-600 flex items-center gap-3">
                        {match.score1} <span className="text-gray-300 text-xl font-normal">-</span> {match.score2}
                      </div>
                      <span className="text-[10px] font-bold uppercase text-red-500 tracking-tighter mt-1">Live</span>
                    </div>
                    <div className="flex flex-col items-center flex-1">
                      <div className="w-12 h-12 bg-gray-50 rounded-full mb-2 flex items-center justify-center font-bold text-gray-700">
                        {match.team2_name?.charAt(0)}
                      </div>
                      <span className="text-sm font-bold text-gray-900 line-clamp-1">{match.team2_name}</span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Featured Tournaments */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-800">Featured Tournaments</h3>
            <Link to="/tournaments" className="text-green-600 text-sm font-bold flex items-center gap-1 hover:underline">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid gap-4">
            {featuredTournaments.map((tournament) => (
              <Link 
                key={tournament.id}
                to={`/tournament/${tournament.id}`}
                className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center gap-4 group"
              >
                <div className="bg-green-50 p-3 rounded-xl group-hover:bg-green-600 transition-colors">
                  <Trophy className="w-6 h-6 text-green-600 group-hover:text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900">{tournament.name}</h4>
                  <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(tournament.start_date!).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-green-700 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                    Active
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
