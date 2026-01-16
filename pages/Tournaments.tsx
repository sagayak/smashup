
import React, { useState, useEffect } from 'react';
import { Tournament, User, UserRole, TournamentType, MatchFormat } from '../types';
import { store } from '../services/mockStore';
import TournamentDetails from './TournamentDetails';

const Tournaments: React.FC<{ user: User }> = ({ user }) => {
  // Fix: initialize with empty array and fetch via useEffect
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  // Fix: usersMap to resolve user names synchronously in render
  const [usersMap, setUsersMap] = useState<Record<string, User>>({});
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTourney, setNewTourney] = useState<Partial<Tournament>>({
    name: '',
    venue: '',
    startDate: '',
    endDate: '',
    type: TournamentType.LEAGUE,
    format: MatchFormat.SINGLES,
    numCourts: 2
  });

  // Fix: Fetch tournaments and users on mount
  useEffect(() => {
    async function loadData() {
      const [t, u] = await Promise.all([store.getTournaments(), store.getAllUsers()]);
      setTournaments(t);
      const map: Record<string, User> = {};
      u.forEach(user => { map[user.id] = user; });
      setUsersMap(map);
    }
    loadData();
  }, []);

  // Fix: handleCreate must be async
  const handleCreate = async () => {
    if (newTourney.name && newTourney.venue) {
      await store.addTournament({
        ...newTourney,
        organizerId: user.id,
        status: 'UPCOMING',
        participants: []
      } as Tournament);
      const updated = await store.getTournaments();
      setTournaments(updated);
      setShowCreate(false);
    }
  };

  if (selectedTournament) {
    return <TournamentDetails tournament={selectedTournament} user={user} onBack={() => setSelectedTournament(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-slate-800">Browse Events</h3>
        {user.role !== UserRole.PLAYER && (
          <button 
            onClick={() => setShowCreate(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center space-x-2 shadow-lg shadow-indigo-100"
          >
            <span>+ Create Tournament</span>
          </button>
        )}
      </div>

      {showCreate && (
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-6 animate-in slide-in-from-top duration-300">
          <h4 className="text-xl font-bold text-slate-800">New Tournament Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Event Name</label>
              <input 
                type="text" placeholder="e.g. Winter Open 2024" 
                className="p-3 bg-slate-50 border border-slate-200 rounded-2xl w-full focus:ring-2 focus:ring-indigo-500 outline-none"
                value={newTourney.name} onChange={e => setNewTourney({...newTourney, name: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Venue</label>
              <input 
                type="text" placeholder="Stadium / Court Name" 
                className="p-3 bg-slate-50 border border-slate-200 rounded-2xl w-full focus:ring-2 focus:ring-indigo-500 outline-none"
                value={newTourney.venue} onChange={e => setNewTourney({...newTourney, venue: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Date</label>
              <input 
                type="date" className="p-3 bg-slate-50 border border-slate-200 rounded-2xl w-full focus:ring-2 focus:ring-indigo-500 outline-none"
                value={newTourney.startDate} onChange={e => setNewTourney({...newTourney, startDate: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Courts Available</label>
              <input 
                type="number" 
                className="p-3 bg-slate-50 border border-slate-200 rounded-2xl w-full focus:ring-2 focus:ring-indigo-500 outline-none"
                value={newTourney.numCourts} onChange={e => setNewTourney({...newTourney, numCourts: parseInt(e.target.value)})}
              />
            </div>
          </div>
          <div className="flex space-x-4 pt-2">
            <button onClick={handleCreate} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black hover:bg-indigo-700 transition-all">Launch Event</button>
            <button onClick={() => setShowCreate(false)} className="px-6 py-3 text-slate-500 font-bold hover:text-slate-700 transition-colors">Discard</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {tournaments.map(t => (
          <div 
            key={t.id} 
            onClick={() => setSelectedTournament(t)}
            className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden group hover:border-indigo-400 hover:shadow-xl hover:shadow-indigo-50 transition-all cursor-pointer transform hover:-translate-y-1 duration-300"
          >
            <div className="h-40 bg-slate-100 relative overflow-hidden">
               <img src={`https://picsum.photos/seed/${t.id}/500/300`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="Badminton Court" />
               <div className="absolute top-4 left-4">
                 <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${t.status === 'ONGOING' ? 'bg-green-500 text-white' : 'bg-indigo-600 text-white shadow-lg'}`}>
                   {t.status}
                 </span>
               </div>
            </div>
            <div className="p-6">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-black text-slate-800 text-xl leading-tight">{t.name}</h4>
                <div className="bg-slate-50 p-2 rounded-xl text-xs font-bold text-slate-400">{t.format}</div>
              </div>
              <p className="text-slate-400 text-sm mb-6 flex items-center space-x-2">
                <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <span>{t.venue}</span>
              </p>
              <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                <div className="flex items-center space-x-2">
                   <div className="flex -space-x-2">
                     {t.participants.slice(0, 3).map(pId => (
                       <div key={pId} className="w-8 h-8 rounded-full border-2 border-white bg-indigo-100 flex items-center justify-center text-[10px] font-black text-indigo-600">
                          {/* Fix: use usersMap for synchronous lookup */}
                          {usersMap[pId]?.name[0] || '?'}
                       </div>
                     ))}
                   </div>
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.participants.length} Joined</span>
                </div>
                <div className="text-indigo-600 font-black text-xs uppercase tracking-widest group-hover:translate-x-1 transition-transform">Enter Arena →</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Tournaments;
