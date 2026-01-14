
import React, { useState, useEffect } from 'react';
/* Added ChevronRight to the lucide-react imports */
import { Trophy, TrendingUp, Users, Calendar, ArrowRight, Play, Star, PlayCircle, Clock, ChevronRight } from 'lucide-react';
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

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

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
        myMatches: 0,
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
          <h1 className="text-4xl font-black text-gray-900 italic tracking-tighter uppercase">The Court is Waiting</h1>
          <p className="text-gray-500 mt-1 font-medium">Real-time badminton management at your fingertips.</p>
        </div>
        <div className="flex gap-3">
          <Link to="/tournaments" className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-2xl font-black italic uppercase tracking-tighter shadow-xl shadow-green-100 flex items-center gap-2 transition-all active:scale-95">
            <Trophy className="w-5 h-5" />
            Find Tournaments
          </Link>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          { label: 'Active Tournaments', value: stats.totalTournaments, icon: Trophy, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Matches Live Now', value: stats.liveMatches, icon: Play, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Total Credits', value: profile.credits, icon: Star, color: 'text-green-600', bg: 'bg-green-50' },
        ].map((item, idx) => (
          <div key={idx} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all group">
            <div className="flex items-center gap-6">
              <div className={`${item.bg} ${item.color} p-5 rounded-[1.5rem] group-hover:scale-110 transition-transform`}>
                <item.icon className="w-8 h-8" />
              </div>
              <div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{item.label}</p>
                <p className="text-4xl font-black text-gray-900 italic tracking-tighter">{item.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-10">
        {/* Live Matches */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-gray-800 italic uppercase tracking-tighter flex items-center gap-3">
              <Play className="w-6 h-6 text-red-500 animate-pulse" />
              Live Scoring Hub
            </h3>
            <span className="text-[10px] text-red-600 font-black uppercase tracking-[0.2em] bg-red-50 px-3 py-1 rounded-full border border-red-100">Live Now</span>
          </div>
          
          <div className="grid gap-6">
            {recentLiveMatches.length === 0 ? (
              <div className="bg-white p-16 rounded-[3rem] border-2 border-dashed border-gray-100 text-center shadow-inner">
                <PlayCircle className="w-16 h-16 text-gray-100 mx-auto mb-4" />
                <p className="text-gray-400 font-black uppercase tracking-widest text-sm italic">No active matches found</p>
                <Link to="/tournaments" className="mt-4 text-green-600 font-bold hover:underline inline-block">Check upcoming schedules</Link>
              </div>
            ) : (
              recentLiveMatches.map((match) => (
                <Link 
                  key={match.id} 
                  to={`/scoring/${match.id}`}
                  className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-2xl hover:border-green-300 transition-all group relative overflow-hidden"
                >
                  <div className="absolute top-4 right-4 flex items-center gap-1.5 text-gray-400 font-black text-[10px] uppercase">
                     <Clock className="w-3 h-3" /> {formatTime(match.scheduled_at)}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex flex-col items-center flex-1">
                      <div className="w-16 h-16 bg-gray-900 text-white rounded-[1.5rem] mb-3 flex items-center justify-center font-black text-2xl italic shadow-lg">
                        {match.team1_name?.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-black text-gray-900 uppercase tracking-tighter italic">{match.team1_name}</span>
                    </div>
                    <div className="flex flex-col items-center px-10">
                      <div className="text-5xl font-black text-green-600 italic tracking-tighter flex items-center gap-4">
                        {match.score1} <span className="text-gray-200 text-3xl font-normal">-</span> {match.score2}
                      </div>
                      <div className="w-12 h-1 bg-green-500 rounded-full mt-4 animate-pulse" />
                    </div>
                    <div className="flex flex-col items-center flex-1">
                      <div className="w-16 h-16 bg-green-600 text-white rounded-[1.5rem] mb-3 flex items-center justify-center font-black text-2xl italic shadow-lg">
                        {match.team2_name?.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-black text-gray-900 uppercase tracking-tighter italic">{match.team2_name}</span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Featured Tournaments */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-gray-800 italic uppercase tracking-tighter">Featured Arenas</h3>
            <Link to="/tournaments" className="text-green-600 text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-green-50 px-4 py-2 rounded-full transition-all border border-green-100">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid gap-6">
            {featuredTournaments.map((tournament) => (
              <Link 
                key={tournament.id}
                to={`/tournament/${tournament.id}`}
                className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all flex items-center gap-6 group border-l-8 border-l-green-600"
              >
                <div className="bg-gray-100 w-24 h-24 rounded-[1.5rem] overflow-hidden flex-shrink-0 group-hover:scale-105 transition-transform">
                   <img src={`https://picsum.photos/seed/${tournament.id}/200/200`} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" alt="Venue" />
                </div>
                <div className="flex-1">
                  <h4 className="font-black text-xl text-gray-900 uppercase tracking-tighter italic group-hover:text-green-600 transition-colors">{tournament.name}</h4>
                  <div className="flex flex-wrap gap-4 mt-2">
                    <p className="text-[11px] text-gray-500 font-bold flex items-center gap-1.5 uppercase tracking-widest">
                      <Calendar className="w-3.5 h-3.5 text-green-600" />
                      {new Date(tournament.start_date!).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </p>
                    <p className="text-[11px] text-gray-500 font-bold flex items-center gap-1.5 uppercase tracking-widest">
                      <Users className="w-3.5 h-3.5 text-green-600" />
                      Global Entry
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <ChevronRight className="w-6 h-6 text-gray-300 group-hover:text-green-600 group-hover:translate-x-1 transition-all" />
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
