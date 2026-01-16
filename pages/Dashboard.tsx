
import React, { useState, useEffect } from 'react';
import { Tournament, Match, User } from '../types';
import { store } from '../services/mockStore';

const Dashboard: React.FC<{ user: User }> = ({ user }) => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    setTournaments(store.getTournaments());
    // Get matches where the user is a participant
    const allMatches = store.matches.filter(m => m.participants.includes(user.id));
    setMatches(allMatches);
  }, [user]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Win Rate" value="68%" trend="+4%" icon="🎯" />
        <StatCard title="Tournaments" value={tournaments.length.toString()} trend="Active" icon="🏆" />
        <StatCard title="Credits Earned" value={user.credits.toString()} trend="Lifetime" icon="💎" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Matches */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-white">
              <h3 className="font-black text-slate-800 uppercase tracking-wider text-sm">Recent Matches</h3>
              <button className="text-indigo-600 text-xs font-bold hover:underline uppercase tracking-widest">History →</button>
            </div>
            <div className="divide-y divide-slate-50">
              {matches.length > 0 ? matches.map(match => (
                <div key={match.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className="flex -space-x-3">
                      {match.participants.map(pId => (
                        <div key={pId} className="w-12 h-12 rounded-full border-4 border-white bg-slate-200 flex items-center justify-center text-sm font-black text-slate-600 shadow-sm">
                          {store.getUser(pId)?.name[0]}
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">
                        {store.getUser(match.participants[0])?.name.split(' ')[0]} <span className="text-slate-300 font-light mx-1">vs</span> {store.getUser(match.participants[1])?.name.split(' ')[0]}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(match.startTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-black uppercase tracking-widest ${match.winnerId === user.id ? 'text-green-500' : 'text-rose-500'}`}>
                      {match.winnerId === user.id ? 'Victory' : 'Defeat'}
                    </p>
                    <p className="text-lg font-black text-slate-700 font-mono">
                      {match.scores.map(s => `${s[0]}-${s[1]}`).join(' ')}
                    </p>
                  </div>
                </div>
              )) : (
                <div className="p-16 text-center">
                  <div className="text-4xl mb-4">🏸</div>
                  <p className="text-slate-400 font-medium">No match history yet. Join a tournament to start your journey!</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {/* Quick Action Card */}
          <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-xl shadow-indigo-100 relative overflow-hidden group">
            <div className="relative z-10">
              <h3 className="font-black text-2xl mb-2">Ready to Smash?</h3>
              <p className="text-indigo-100 text-sm mb-6 leading-relaxed">Check out the upcoming tournaments and register to earn massive rewards.</p>
              <button 
                className="w-full bg-white text-indigo-600 font-black py-4 rounded-2xl hover:bg-indigo-50 transition-all shadow-lg transform group-hover:scale-[1.02]"
              >
                Join Tournament
              </button>
            </div>
            {/* Decoration */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-indigo-400/30 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-32 h-32 bg-indigo-800/20 rounded-full blur-2xl"></div>
          </div>

          {/* Leaderboard */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <h3 className="font-black text-slate-800 uppercase tracking-wider text-sm mb-6 px-2">Top Performers</h3>
            <div className="space-y-5">
              {store.users.sort((a, b) => b.credits - a.credits).slice(0, 5).map((u, idx) => (
                <div key={u.id} className="flex items-center justify-between p-2 rounded-2xl hover:bg-slate-50 transition-colors">
                  <div className="flex items-center space-x-4">
                    <span className={`text-xs font-black w-6 h-6 flex items-center justify-center rounded-lg ${idx === 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                      {idx + 1}
                    </span>
                    <div>
                      <span className="font-bold text-slate-700 block text-sm">{u.name}</span>
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Rank {idx + 1}</span>
                    </div>
                  </div>
                  <span className="text-indigo-600 font-black text-sm">{u.credits} <span className="text-[10px] uppercase opacity-50 ml-0.5">pts</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, trend, icon }: any) => (
  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-shadow">
    <div>
      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">{title}</p>
      <div className="flex items-baseline space-x-2">
        <h4 className="text-3xl font-black text-slate-800 tracking-tight">{value}</h4>
        <span className="text-green-500 text-xs font-black bg-green-50 px-1.5 py-0.5 rounded-lg">{trend}</span>
      </div>
    </div>
    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-3xl shadow-inner">{icon}</div>
  </div>
);

export default Dashboard;
