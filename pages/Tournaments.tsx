import React, { useState, useEffect } from 'react';
import { Tournament, User, UserRole, TournamentType, MatchFormat } from '../types';
import { store } from '../services/mockStore';
import TournamentDetails from './TournamentDetails';

const Tournaments: React.FC<{ user: User }> = ({ user }) => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [searchId, setSearchId] = useState('');
  
  const [newTourney, setNewTourney] = useState<Partial<Tournament>>({
    name: '', venue: '', startDate: '', endDate: '',
    type: TournamentType.LEAGUE, format: MatchFormat.SINGLES,
    numCourts: 2, isPublic: true, playerLimit: 32, scorerPin: '0000'
  });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [allTourneys, allUsers] = await Promise.all([
      store.getTournaments(),
      store.getAllUsers()
    ]);
    
    setUsers(allUsers);
    // Filter visibility: Public OR Participant OR Organizer OR SuperAdmin
    const visible = allTourneys.filter(t => 
      t.isPublic || 
      t.participants.includes(user.username) || 
      t.organizerId === user.id || 
      user.role === UserRole.SUPERADMIN
    );
    setTournaments(visible);
  }

  const handleSearch = async () => {
    if (!searchId) return;
    const t = await store.searchTournamentById(searchId);
    if (t) {
       if (t.participants.includes(user.username) || t.organizerId === user.id || user.role === UserRole.SUPERADMIN) {
         setSelectedTournament(t);
       } else {
         setTournaments([t]); 
       }
    } else {
      setError("Tournament ID not found");
    }
  };

  const handleJoinAction = async (t: Tournament) => {
    try {
      if (t.isPublic) {
        if (t.participants.length >= t.playerLimit) return alert("Tournament is full!");
        await store.joinTournament(t.id, user);
        alert("Joined successfully!");
        await loadData();
      } else {
        await store.requestJoinTournament(t.id, user);
        alert("Join request sent to organizer!");
      }
    } catch (err) {
      alert("Action failed.");
    }
  };

  const handleCreate = async () => {
    if (user.credits < 200) {
      setError("Insufficient credits! Cost: 200 Credits.");
      return;
    }
    
    setIsCreating(true);
    try {
      await store.addTournament({
        ...newTourney,
        organizerId: user.id,
        status: 'UPCOMING',
        participants: [user.username],
        playerPool: [],
        rankingCriteriaOrder: ['MATCHES_WON', 'SETS_WON', 'POINTS_DIFF', 'HEAD_TO_HEAD']
      } as any);
      setShowCreate(false);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  if (selectedTournament) {
    return <TournamentDetails tournament={selectedTournament} user={user} onBack={() => { setSelectedTournament(null); loadData(); }} />;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <input 
            type="text" placeholder="Enter ID (e.g. BWF-24)" 
            className="w-full p-4 pl-12 bg-white border border-slate-200 rounded-2xl shadow-sm outline-none focus:border-indigo-500 font-black uppercase tracking-widest text-sm"
            value={searchId} onChange={e => setSearchId(e.target.value)}
          />
          <button onClick={handleSearch} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </button>
        </div>

        <button 
          onClick={() => { setShowCreate(true); setError(''); }}
          className="w-full md:w-auto bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center justify-center space-x-2"
        >
          <span>Create Tournament</span>
          <span className="bg-indigo-500 px-2 py-0.5 rounded-lg text-[10px]">-200 Credits</span>
        </button>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-8 md:p-12 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-8">
              <h4 className="text-3xl font-black text-slate-800 italic uppercase tracking-tighter">New Arena</h4>
              <button onClick={() => setShowCreate(false)} className="text-slate-300 hover:text-slate-500">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl mb-6 flex items-center justify-between">
                <p className="text-rose-500 font-black uppercase tracking-widest text-[10px]">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input label="Tournament Name" value={newTourney.name} onChange={v => setNewTourney({...newTourney, name: v})} />
              <Input label="Venue" value={newTourney.venue} onChange={v => setNewTourney({...newTourney, venue: v})} />
              <Input label="Start Date" type="date" value={newTourney.startDate} onChange={v => setNewTourney({...newTourney, startDate: v})} />
              <Input label="End Date" type="date" value={newTourney.endDate} onChange={v => setNewTourney({...newTourney, endDate: v})} />
              <Input label="Player Limit" type="number" value={newTourney.playerLimit} onChange={v => setNewTourney({...newTourney, playerLimit: parseInt(v)})} />
              <Input label="Scorer Pin" maxLength={4} value={newTourney.scorerPin} onChange={v => setNewTourney({...newTourney, scorerPin: v})} />
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Access Level</label>
                <select 
                  className="w-full p-3 bg-slate-50 rounded-xl font-bold border-2 border-slate-50 focus:border-indigo-500 outline-none"
                  value={newTourney.isPublic ? 'true' : 'false'} 
                  onChange={e => setNewTourney({...newTourney, isPublic: e.target.value === 'true'})}
                >
                  <option value="true">Public (Open)</option>
                  <option value="false">Protected (Invite Only)</option>
                </select>
              </div>
            </div>

            <button 
              onClick={handleCreate} disabled={isCreating}
              className="w-full bg-indigo-600 text-white font-black py-5 rounded-3xl mt-10 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 uppercase tracking-widest text-sm"
            >
              {isCreating ? 'Creating Arena...' : 'Launch Tournament'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {tournaments.map(t => {
          const isMember = t.participants.includes(user.username) || t.organizerId === user.id || user.role === UserRole.SUPERADMIN;
          const organizer = users.find(u => u.id === t.organizerId);
          return (
            <div key={t.id} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-2xl transition-all group overflow-hidden relative">
              <div className="flex justify-between items-start mb-6">
                 <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 px-3 py-1 rounded-lg">ID: {t.uniqueId}</span>
                 <div className="flex space-x-1">
                    <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${t.isPublic ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'bg-rose-500 text-white shadow-lg shadow-rose-100'}`}>
                      {t.isPublic ? 'Public' : 'Protected'}
                    </span>
                    <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${t.isLocked ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'}`}>
                      {t.isLocked ? 'LOCKED' : 'DRAFT'}
                    </span>
                 </div>
              </div>
              <h4 className="text-2xl font-black text-slate-800 tracking-tighter mb-1 uppercase italic leading-none">{t.name}</h4>
              <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">{t.venue}</p>
              <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-6 italic">Organized by: {organizer?.name || 'Loading...'}</p>
              
              {isMember ? (
                <button 
                  onClick={() => setSelectedTournament(t)}
                  className="w-full bg-slate-50 text-slate-800 font-black py-3 rounded-xl uppercase tracking-widest text-[10px] group-hover:bg-indigo-600 group-hover:text-white transition-all flex items-center justify-center space-x-2"
                >
                  <span>Dashboard</span>
                  <span>→</span>
                </button>
              ) : (
                <button 
                  onClick={() => handleJoinAction(t)}
                  className="w-full bg-indigo-600 text-white font-black py-3 rounded-xl uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-100 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  {t.isPublic ? 'Join Now' : 'Request Access'}
                </button>
              )}

              <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center text-[9px] font-black text-slate-400 uppercase tracking-widest">
                 <span>{t.format} • {t.type}</span>
                 <span>{t.participants.length}/{t.playerLimit} Slots</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Input = ({ label, value, onChange, type = "text", placeholder = "", maxLength }: any) => (
  <div className="space-y-1">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
    <input 
      type={type} 
      maxLength={maxLength}
      placeholder={placeholder}
      className="w-full p-3 bg-slate-50 border-2 border-slate-50 rounded-xl focus:border-indigo-500 outline-none font-bold"
      value={value} onChange={e => onChange(e.target.value)}
    />
  </div>
);

export default Tournaments;