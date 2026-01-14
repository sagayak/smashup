
import React, { useState, useEffect } from 'react';
import { Trophy, Calendar, MapPin, Plus, Loader2, Search, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Tournament, Profile } from '../types';

interface TournamentsPageProps {
  profile: Profile;
}

const TournamentsPage: React.FC<TournamentsPageProps> = ({ profile }) => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newTournament, setNewTournament] = useState({
    name: '',
    description: '',
    location_name: '',
    start_date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setTournaments(data);
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profile.credits < 200) {
      alert("Insufficient credits. Hosting a tournament costs 200 credits.");
      return;
    }

    const { error } = await supabase.rpc('update_user_credits', {
      target_user_id: profile.id,
      amount_change: -200,
      log_description: `Hosted tournament: ${newTournament.name}`,
      log_action: 'tournament_fee'
    });

    if (error) {
      alert(error.message);
      return;
    }

    const { data: tournament, error: insertError } = await supabase
      .from('tournaments')
      .insert({
        ...newTournament,
        organizer_id: profile.id,
        status: 'published'
      })
      .select()
      .single();

    if (!insertError) {
      setIsCreating(false);
      fetchTournaments();
      alert("Tournament created successfully!");
    } else {
      alert(insertError.message);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-gray-900 italic tracking-tighter uppercase">Tournament Arena</h1>
          <p className="text-gray-500 mt-1">Join existing battles or command your own.</p>
        </div>
        {(profile.role === 'admin' || profile.role === 'superadmin') && (
          <button 
            onClick={() => setIsCreating(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-[2rem] font-black italic uppercase tracking-tighter shadow-xl shadow-green-100 flex items-center gap-2 transition-all active:scale-95 group"
          >
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
            Host Tournament (200c)
          </button>
        )}
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        <aside className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
             <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 block">Search</label>
                <div className="relative">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                   <input type="text" className="w-full pl-9 pr-4 py-3 bg-gray-50 border-none rounded-2xl text-sm" placeholder="Filter names..." />
                </div>
             </div>
             <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 block">Status</label>
                <div className="flex flex-wrap gap-2">
                   {['All', 'Active', 'Finished'].map(s => (
                      <button key={s} className={`px-4 py-2 rounded-xl text-xs font-bold ${s === 'All' ? 'bg-green-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                         {s}
                      </button>
                   ))}
                </div>
             </div>
          </div>
        </aside>

        <div className="lg:col-span-3">
          {loading ? (
            <div className="flex justify-center p-20"><Loader2 className="w-10 h-10 animate-spin text-green-600" /></div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-6">
              {tournaments.map((t) => (
                <Link 
                  key={t.id}
                  to={`/tournament/${t.id}`}
                  className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all overflow-hidden group"
                >
                  <div className="h-40 bg-gray-100 relative">
                    <img src={`https://picsum.photos/seed/${t.id}/600/400`} className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700" alt="Cover" />
                    <div className="absolute top-4 right-4">
                       <span className="bg-white/90 backdrop-blur px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-green-700 shadow-sm">
                          {t.status}
                       </span>
                    </div>
                  </div>
                  <div className="p-8">
                    <h3 className="text-2xl font-black text-gray-900 group-hover:text-green-600 transition-colors line-clamp-1">{t.name}</h3>
                    <div className="mt-4 space-y-2">
                       <div className="flex items-center gap-2 text-gray-500 text-sm">
                          <MapPin className="w-4 h-4 text-green-500" />
                          <span className="font-medium">{t.location_name || 'Global Arena'}</span>
                       </div>
                       <div className="flex items-center gap-2 text-gray-500 text-sm">
                          <Calendar className="w-4 h-4 text-green-500" />
                          <span className="font-medium">{new Date(t.start_date!).toLocaleDateString()}</span>
                       </div>
                    </div>
                    <div className="mt-6 pt-6 border-t border-gray-50 flex items-center justify-between">
                       <div className="flex -space-x-2">
                          {[1,2,3].map(i => (
                             <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-green-100 flex items-center justify-center text-[10px] font-bold text-green-700">U{i}</div>
                          ))}
                       </div>
                       <span className="text-xs font-bold text-gray-400">Join Match</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal for Create */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-10">
              <div className="flex justify-between items-center mb-8">
                <div>
                   <h2 className="text-3xl font-black italic uppercase tracking-tighter">New Tournament</h2>
                   <p className="text-gray-500">Hosting costs 200 credits.</p>
                </div>
                <div className="bg-green-50 p-4 rounded-[2rem] text-center">
                   <p className="text-[10px] font-bold text-green-600 uppercase">Available</p>
                   <p className="text-xl font-black text-green-700">{profile.credits}</p>
                </div>
              </div>

              <form onSubmit={handleCreate} className="space-y-6">
                <div className="space-y-4">
                  <input 
                    required
                    placeholder="Event Name"
                    className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-green-500 font-bold"
                    value={newTournament.name}
                    onChange={(e) => setNewTournament({...newTournament, name: e.target.value})}
                  />
                  <textarea 
                    placeholder="Rules & Description"
                    className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-green-500 min-h-[120px]"
                    value={newTournament.description}
                    onChange={(e) => setNewTournament({...newTournament, description: e.target.value})}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <input 
                      placeholder="Location"
                      className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-green-500"
                      value={newTournament.location_name}
                      onChange={(e) => setNewTournament({...newTournament, location_name: e.target.value})}
                    />
                    <input 
                      type="date"
                      required
                      className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-green-500 font-bold"
                      value={newTournament.start_date}
                      onChange={(e) => setNewTournament({...newTournament, start_date: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4">
                  <button type="button" onClick={() => setIsCreating(false)} className="py-4 font-bold text-gray-400 hover:text-gray-600">Cancel</button>
                  <button type="submit" className="bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-bold shadow-xl shadow-green-100 transition-all active:scale-95">
                    Launch Event
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentsPage;
