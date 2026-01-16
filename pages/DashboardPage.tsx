
import React, { useState, useEffect } from 'react';
import { Trophy, Play, Star, PlayCircle, Clock, ChevronRight, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { db } from '../services/firebase';
import { collection, query, where, limit, onSnapshot, getCountFromServer } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { Tournament, Match, Profile } from '../types';

interface DashboardPageProps {
  profile: Profile;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ profile }) => {
  const [stats, setStats] = useState({ totalTournaments: 0, liveMatches: 0 });
  const [featuredTournaments, setFeaturedTournaments] = useState<Tournament[]>([]);
  const [recentLiveMatches, setRecentLiveMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Featured Tournaments Listener
    const tQuery = query(collection(db, "tournaments"), where("status", "==", "published"), limit(3));
    const unsubscribeTourneys = onSnapshot(tQuery, (snap) => {
      const tourneys = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tournament));
      setFeaturedTournaments(tourneys);
    });

    // Live Matches Listener
    const mQuery = query(collection(db, "matches"), where("status", "==", "live"));
    const unsubscribeMatches = onSnapshot(mQuery, (snap) => {
      const matches = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match));
      setRecentLiveMatches(matches);
      setLoading(false);
    });

    // Stats Logic (Server-side counts)
    const fetchCounts = async () => {
      const tSnap = await getCountFromServer(collection(db, "tournaments"));
      const mSnap = await getCountFromServer(query(collection(db, "matches"), where("status", "==", "live")));
      setStats({
        totalTournaments: tSnap.data().count,
        liveMatches: mSnap.data().count
      });
    };
    fetchCounts();

    return () => {
      unsubscribeTourneys();
      unsubscribeMatches();
    };
  }, []);

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-gray-900 italic tracking-tighter uppercase">The Court is Waiting</h1>
          <p className="text-gray-500 mt-1 font-medium flex items-center gap-2">
            <Zap className="w-4 h-4 text-green-500" /> Firebase Cloud Sync Active.
          </p>
        </div>
        <Link to="/tournaments" className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-2xl font-black italic uppercase tracking-tighter shadow-xl flex items-center gap-2 transition-all active:scale-95">
          <Trophy className="w-5 h-5" /> Find Tournaments
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          { label: 'Active Arenas', value: stats.totalTournaments, icon: Trophy, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Live Battles', value: stats.liveMatches, icon: Play, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Global Credits', value: profile.credits, icon: Star, color: 'text-green-600', bg: 'bg-green-50' },
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
        <div className="space-y-6">
          <h3 className="text-2xl font-black text-gray-800 italic uppercase tracking-tighter flex items-center gap-3">
            <Play className="w-6 h-6 text-red-500 animate-pulse" /> Live Scoring Hub
          </h3>
          <div className="grid gap-6">
            {recentLiveMatches.length === 0 ? (
              <div className="bg-white p-16 rounded-[3rem] border-2 border-dashed border-gray-100 text-center shadow-inner">
                <PlayCircle className="w-16 h-16 text-gray-100 mx-auto mb-4" />
                <p className="text-gray-400 font-black uppercase tracking-widest text-sm italic">No active matches</p>
              </div>
            ) : (
              recentLiveMatches.map((match) => (
                <Link key={match.id} to={`/scoring/${match.id}`} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-2xl transition-all group relative overflow-hidden">
                  <div className="absolute top-4 right-4 flex items-center gap-1.5 text-gray-400 font-black text-[10px] uppercase">
                     <Clock className="w-3 h-3" /> {formatTime(match.scheduled_at)}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex flex-col items-center flex-1">
                      <div className="w-16 h-16 bg-gray-900 text-white rounded-[1.5rem] mb-3 flex items-center justify-center font-black text-2xl italic shadow-lg">{match.team1_name?.charAt(0)}</div>
                      <span className="text-sm font-black text-gray-900 uppercase tracking-tighter italic text-center px-2">{match.team1_name}</span>
                    </div>
                    <div className="text-5xl font-black text-green-600 italic tracking-tighter">{match.score1} - {match.score2}</div>
                    <div className="flex flex-col items-center flex-1">
                      <div className="w-16 h-16 bg-green-600 text-white rounded-[1.5rem] mb-3 flex items-center justify-center font-black text-2xl italic shadow-lg">{match.team2_name?.charAt(0)}</div>
                      <span className="text-sm font-black text-gray-900 uppercase tracking-tighter italic text-center px-2">{match.team2_name}</span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-2xl font-black text-gray-800 italic uppercase tracking-tighter">Featured Arenas</h3>
          <div className="grid gap-6">
            {featuredTournaments.map((tournament) => (
              <Link key={tournament.id} to={`/tournament/${tournament.id}`} className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all flex items-center gap-6 group border-l-8 border-l-green-600">
                <div className="bg-gray-100 w-24 h-24 rounded-[1.5rem] overflow-hidden flex-shrink-0 group-hover:scale-105 transition-transform">
                   <img src={`https://picsum.photos/seed/${tournament.id}/200/200`} className="w-full h-full object-cover grayscale group-hover:grayscale-0" alt="Venue" />
                </div>
                <div className="flex-1">
                  <h4 className="font-black text-xl text-gray-900 uppercase tracking-tighter italic">{tournament.name}</h4>
                  <div className="flex gap-4 mt-2 text-[11px] text-gray-500 font-bold uppercase italic">
                    <Zap className="w-3.5 h-3.5 text-green-600" /> Start: {new Date(tournament.start_date!).toLocaleDateString()}
                  </div>
                </div>
                <ChevronRight className="w-6 h-6 text-gray-300" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
