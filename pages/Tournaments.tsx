
import React, { useState, useEffect } from 'react';
import { Tournament, User, UserRole, TournamentType, MatchFormat } from '../types';
import { store } from '../services/mockStore';
import TournamentDetails from './TournamentDetails';

const Tournaments: React.FC<{ user: User }> = ({ user }) => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, User>>({});
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  
  const [newTourney, setNewTourney] = useState<Partial<Tournament>>({
    name: '',
    venue: '',
    startDate: '',
    endDate: '',
    type: TournamentType.LEAGUE,
    format: MatchFormat.SINGLES,
    numCourts: 2
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [t, u] = await Promise.all([store.getTournaments(), store.getAllUsers()]);
      setTournaments(t);
      const map: Record<string, User> = {};
      u.forEach(user => { map[user.id] = user; });
      setUsersMap(map);
    } catch (err) {
      console.error("Failed to load data", err);
    }
  }

  const handleCreate = async () => {
    if (!newTourney.name || !newTourney.venue || !newTourney.startDate || !newTourney.endDate) {
      setError('Please fill in all required fields, including dates.');
      return;
    }
    
    setError('');
    setIsCreating(true);
    try {
      await store.addTournament({
        name: newTourney.name,
        venue: newTourney.venue,
        startDate: newTourney.startDate,
        endDate: newTourney.endDate,
        type: newTourney.type as TournamentType,
        format: newTourney.format as MatchFormat,
        numCourts: newTourney.numCourts as number,
        organizerId: user.id,
        status: 'UPCOMING',
        participants: []
      } as Tournament);
      
      await loadData();
      setShowCreate(false);
      setNewTourney({
        name: '',
        venue: '',
        startDate: '',
        endDate: '',
        type: TournamentType.LEAGUE,
        format: MatchFormat.SINGLES,
        numCourts: 2
      });
    } catch (err: any) {
      setError(err.message || 'Failed to create tournament. Check permissions.');
    } finally {
      setIsCreating(false);
    }
  };

  if (selectedTournament) {
    return <TournamentDetails tournament={selectedTournament} user={user} onBack={() => setSelectedTournament(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter italic">Browse Events</h3>
        {user.role !== UserRole.PLAYER && (
          <button 
            onClick={() => {
              setShowCreate(true);
              setError('');
            }}
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center space-x-2 shadow-xl shadow-indigo-100 active:scale-95"
          >
            <span>+ Create Tournament</span>
          </button>
        )}
      </div>

      {showCreate && (
        <div className="bg-white p-8 rounded-[2.5rem] border-2 border-indigo-100 shadow-2xl space-y-6 animate-in slide-in-from-top duration-500">
          <div className="flex justify-between items-center">
            <h4 className="text-2xl font-black text-slate-800 tracking-tighter uppercase italic">Tournament Architect</h4>
            <button onClick={() => setShowCreate(false)} className="text-slate-300 hover:text-slate-500 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          
          {error && <div className="bg-rose-50 text-rose-500 p-4 rounded-2xl text-xs font-black uppercase tracking-widest border border-rose-100 text-center">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
               <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Event Name</label>
                <input 
                  type="text" placeholder="e.g. Winter Open 2024" 
                  className="p-4 bg-slate-50 border-2 border-slate-50 rounded-2xl w-full focus:border-indigo-500 outline-none font-bold transition-all"
                  value={newTourney.name} onChange={e => setNewTourney({...newTourney, name: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Venue</label>
                <input 
                  type="text" placeholder="Stadium / Court Name" 
                  className="p-4 bg-slate-50 border-2 border-slate-50 rounded-2xl w-full focus:border-indigo-500 outline-none font-bold transition-all"
                  value={newTourney.venue} onChange={e => setNewTourney({...newTourney, venue: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Date</label>
                  <input 
                    type="date" className="p-4 bg-slate-50 border-2 border-slate-50 rounded-2xl w-full focus:border-indigo-500 outline-none font-bold text-sm"
                    value={newTourney.startDate} onChange={e => setNewTourney({...newTourney, startDate: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">End Date</label>
                  <input 
                    type="date" className="p-4 bg-slate-50 border-2 border-slate-50 rounded-2xl w-full focus:border-indigo-500 outline-none font-bold text-sm"
                    value={newTourney.endDate} onChange={e => setNewTourney({...newTourney, endDate: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Type</label>
                  <select 
                    className="p-4 bg-slate-50 border-2 border-slate-50 rounded-2xl w-full focus:border-indigo-500 outline-none font-bold"
                    value={newTourney.type} onChange={e => setNewTourney({...newTourney, type: e.target.value as TournamentType})}
                  >
                    <option value={TournamentType.LEAGUE}>League</option>
                    <option value={TournamentType.KNOCKOUT}>Knockout</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Format</label>
                  <select 
                    className="p-4 bg-slate-50 border-2 border-slate-50 rounded-2xl w-full focus:border-indigo-500 outline-none font-bold"
                    value={newTourney.format} onChange={e => setNewTourney({...newTourney, format: e.target.value as MatchFormat})}
                  >
                    <option value={MatchFormat.SINGLES}>Singles</option>
                    <option value={MatchFormat.DOUBLES}>Doubles</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Total Courts</label>
                <input 
                  type="number" min="1" max="10"
                  className="p-4 bg-slate-50 border-2 border-slate-50 rounded-2xl w-full focus:border-indigo-500 outline-none font-bold"
                  value={newTourney.numCourts} onChange={e => setNewTourney({...newTourney, numCourts: parseInt(e.target.value)})}
                />
              </div>
              <div className="pt-4">
                 <button 
                  onClick={handleCreate} 
                  disabled={isCreating}
                  className="w-full bg-indigo-600 text-white px-8 py-5 rounded-[1.5rem] font-black uppercase tracking-widest text-sm hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50 active:scale-95"
                >
                  {isCreating ? 'Synchronizing with Cloud...' : 'Launch Tournament Arena'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {tournaments.map(t => (
          <div 
            key={t.id} 
            onClick={() => setSelectedTournament(t)}
            className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden group hover:border-indigo-400 hover:shadow-2xl hover:shadow-indigo-50 transition-all cursor-pointer transform hover:-translate-y-1 duration-300"
          >
            <div className="h-48 bg-slate-100 relative overflow-hidden">
               <img src={`https://picsum.photos/seed/${t.id}/600/400`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-90 group-hover:opacity-100" alt="Badminton Court" />
               <div className="absolute top-4 left-4">
                 <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg ${t.status === 'ONGOING' ? 'bg-green-500 text-white' : 'bg-indigo-600 text-white'}`}>
                   {t.status}
                 </span>
               </div>
            </div>
            <div className="p-8">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-black text-slate-800 text-xl tracking-tighter uppercase italic leading-none">{t.name}</h4>
                <div className="bg-slate-50 px-2 py-1 rounded-lg text-[9px] font-black text-slate-400 uppercase tracking-widest border border-slate-100">{t.format}</div>
              </div>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-6 flex items-center space-x-2">
                <svg className="w-3 h-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <span>{t.venue}</span>
              </p>
              <div className="flex justify-between items-center pt-6 border-t border-slate-50">
                <div className="flex items-center space-x-2">
                   <div className="flex -space-x-2">
                     {t.participants.slice(0, 3).map(pId => (
                       <div key={pId} className="w-8 h-8 rounded-full border-2 border-white bg-indigo-50 flex items-center justify-center text-[10px] font-black text-indigo-600 shadow-sm">
                          {usersMap[pId]?.name[0] || '?'}
                       </div>
                     ))}
                   </div>
                   <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{t.participants.length} Active</span>
                </div>
                <div className="text-indigo-600 font-black text-[10px] uppercase tracking-widest group-hover:translate-x-1 transition-transform flex items-center space-x-1">
                  <span>Enter Arena</span>
                  <span>→</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Tournaments;
