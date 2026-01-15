
import React, { useState, useEffect } from 'react';
import { Trophy, Calendar, MapPin, Plus, Loader2, Search, Hash, Send, Crosshair } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, dbService } from '../services/supabase';
import { Tournament, Profile } from '../types';

interface TournamentsPageProps {
  profile: Profile;
}

const TournamentsPage: React.FC<TournamentsPageProps> = ({ profile }) => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [searchId, setSearchId] = useState('');
  const [newTournament, setNewTournament] = useState({
    name: '',
    description: '',
    location_name: '',
    latitude: 0,
    longitude: 0,
    start_date: new Date().toISOString().split('T')[0],
  });
  const navigate = useNavigate();

  useEffect(() => {
    if (!supabase) return;

    const fetchTournaments = async () => {
      const { data } = await supabase
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (data) setTournaments(data as Tournament[]);
      setLoading(false);
    };

    fetchTournaments();

    const channel = supabase.channel('tournaments-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, fetchTournaments)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleLocateMe = () => {
    if (!navigator.geolocation) return alert("Geolocation not supported.");
    navigator.geolocation.getCurrentPosition((pos) => {
      setNewTournament(prev => ({
        ...prev,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude
      }));
      alert("Coordinates locked! Precise arena location set.");
    });
  };

  const handleSearchById = async () => {
    if (!searchId || !supabase) return;
    const { data } = await supabase
      .from('tournaments')
      .select('*')
      .eq('share_id', searchId.toUpperCase())
      .single();
    
    if (data) {
      navigate(`/tournament/${data.id}`);
    } else {
      alert("Tournament Node not found in cluster.");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profile.credits < 200) {
      alert("Insufficient credits. Hosting costs 200c.");
      return;
    }

    if (!confirm("200 credits will be deducted. Proceed?")) return;

    try {
      const tournament = await dbService.tournaments.create(
        {
          name: newTournament.name,
          description: newTournament.description,
          location_name: newTournament.location_name,
          start_date: newTournament.start_date,
          latitude: newTournament.latitude,
          longitude: newTournament.longitude
        },
        profile.id
      );

      setIsCreating(false);
      alert(`Success! Arena Created. Share ID: ${tournament.share_id}`);
    } catch (err: any) {
      alert(err.message || "Failed to create tournament");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <h1 className="text-5xl font-black text-gray-900 italic uppercase tracking-tighter leading-none">Tournament<br/>Arena</h1>
          <p className="text-gray-500 mt-2 font-medium">Join existing battles or pay 200c to command your own.</p>
        </div>
        
        <div className="flex gap-4">
          <div className="bg-white border border-gray-100 p-2 rounded-[2rem] shadow-sm flex items-center gap-2 pr-6">
             <div className="bg-gray-100 p-3 rounded-full"><Hash className="w-5 h-5 text-gray-400" /></div>
             <input 
              type="text" 
              placeholder="SHTL-XXXX"
              className="bg-transparent border-none outline-none font-black italic tracking-tighter uppercase w-32"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchById()}
             />
             <button onClick={handleSearchById} className="text-green-600 font-black uppercase tracking-widest text-[10px] hover:underline">Find</button>
          </div>
          <button 
            onClick={() => setIsCreating(true)}
            className={`flex items-center gap-3 px-10 py-5 rounded-[2rem] font-black italic uppercase tracking-tighter text-xl shadow-2xl transition-all active:scale-95 group border-b-4
              ${profile.credits >= 200 
                ? 'bg-green-600 text-white hover:bg-green-700 shadow-green-100 border-green-800' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed border-gray-300'}`}
          >
            <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform" />
            Host Arena (200c)
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-8">
        <aside className="lg:col-span-1 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl space-y-8 sticky top-24">
             <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 block ml-1">Live Search</label>
                <div className="relative">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                   <input type="text" className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-green-500/10" placeholder="Filter names..." />
                </div>
             </div>
             <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 block ml-1">Status Filter</label>
                <div className="flex flex-col gap-2">
                   {['All Tournaments', 'Active Only', 'Finished Results'].map(s => (
                      <button key={s} className={`px-6 py-4 rounded-2xl text-xs font-black uppercase italic tracking-tighter text-left transition-all ${s === 'All Tournaments' ? 'bg-gray-900 text-white shadow-xl' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                         {s}
                      </button>
                   ))}
                </div>
             </div>
          </div>
        </aside>

        <div className="lg:col-span-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-20 gap-4">
               <Loader2 className="w-12 h-12 animate-spin text-green-600" />
               <p className="text-gray-400 font-black uppercase italic tracking-tighter">Syncing Arena Data...</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-8">
              {tournaments.length === 0 ? (
                <div className="col-span-full py-32 text-center bg-white rounded-[3rem] border-2 border-dashed border-gray-100">
                   <Trophy className="w-16 h-16 text-gray-100 mx-auto mb-4" />
                   <p className="text-gray-400 font-black uppercase italic tracking-tighter">No active tournaments found</p>
                </div>
              ) : (
                tournaments.map((t) => (
                  <Link 
                    key={t.id}
                    to={`/tournament/${t.id}`}
                    className="bg-white rounded-[3rem] border border-gray-100 shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all overflow-hidden group border-b-8 border-b-gray-100 hover:border-b-green-500"
                  >
                    <div className="h-48 bg-gray-100 relative overflow-hidden">
                      <img src={`https://picsum.photos/seed/${t.id}/600/400`} className="w-full h-full object-cover opacity-80 group-hover:scale-110 transition-transform duration-1000" alt="Cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
                         <span className="bg-white/95 backdrop-blur px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-green-700 shadow-xl">
                            {t.status}
                         </span>
                         <span className="bg-gray-900 text-white px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase border border-white/20">
                            {t.share_id}
                         </span>
                      </div>
                    </div>
                    <div className="p-8">
                      <h3 className="text-2xl font-black text-gray-900 group-hover:text-green-600 transition-colors line-clamp-1 italic uppercase tracking-tighter">{t.name}</h3>
                      <div className="mt-4 flex flex-wrap gap-4">
                         <div className="flex items-center gap-2 text-gray-400 text-[11px] font-black uppercase tracking-widest">
                            <MapPin className="w-4 h-4 text-green-500" />
                            {t.location_name || 'Global Arena'}
                         </div>
                         <div className="flex items-center gap-2 text-gray-400 text-[11px] font-black uppercase tracking-widest">
                            <Calendar className="w-4 h-4 text-green-500" />
                            {new Date(t.start_date!).toLocaleDateString()}
                         </div>
                      </div>
                      <div className="mt-8 flex items-center justify-between pt-6 border-t border-gray-50">
                         <div className="flex items-center gap-2">
                           <div className="w-10 h-10 rounded-2xl bg-gray-900 flex items-center justify-center text-[10px] font-black text-green-400 italic">ID</div>
                           <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 italic">Join Pool</span>
                         </div>
                         <div className="bg-green-50 text-green-600 p-3 rounded-2xl group-hover:bg-green-600 group-hover:text-white transition-all">
                            <Send className="w-5 h-5" />
                         </div>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300 border-t-8 border-green-600">
            <div className="p-12">
              <div className="flex justify-between items-center mb-10">
                <div>
                   <h2 className="text-4xl font-black italic uppercase tracking-tighter">New Arena</h2>
                   <p className="text-gray-500 font-medium">Initialize a global tournament node.</p>
                </div>
                <div className="bg-green-50 p-6 rounded-[2rem] text-center border border-green-100 shadow-xl shadow-green-50">
                   <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Fee: 200c</p>
                   <p className="text-2xl font-black text-green-700 italic tracking-tighter">Bal: {profile.credits}</p>
                </div>
              </div>

              <form onSubmit={handleCreate} className="space-y-6">
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2">Tournament Identity</label>
                    <input 
                      required
                      placeholder="e.g. Smash Masters 2025"
                      className="w-full px-8 py-5 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-green-500/10 font-black italic tracking-tighter text-xl uppercase"
                      value={newTournament.name}
                      onChange={(e) => setNewTournament({...newTournament, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2">Arena Details & Rules</label>
                    <textarea 
                      placeholder="Briefly describe the match format..."
                      className="w-full px-8 py-5 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-green-500/10 min-h-[140px] font-medium"
                      value={newTournament.description}
                      onChange={(e) => setNewTournament({...newTournament, description: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2 flex justify-between">
                         Location Node
                         <button type="button" onClick={handleLocateMe} className="text-green-600 flex items-center gap-1 hover:underline"><Crosshair className="w-3 h-3"/> Use GPS</button>
                      </label>
                      <input 
                        placeholder="e.g. Center Court"
                        className="w-full px-8 py-5 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-green-500/10 font-bold"
                        value={newTournament.location_name}
                        onChange={(e) => setNewTournament({...newTournament, location_name: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2">Launch Date</label>
                      <input 
                        type="date"
                        required
                        className="w-full px-8 py-5 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-green-500/10 font-black italic uppercase tracking-tighter"
                        value={newTournament.start_date}
                        onChange={(e) => setNewTournament({...newTournament, start_date: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 pt-6">
                  <button type="button" onClick={() => setIsCreating(false)} className="py-5 font-black uppercase italic tracking-tighter text-gray-400 hover:text-gray-600 transition-colors">Abort Launch</button>
                  <button 
                    type="submit" 
                    disabled={profile.credits < 200}
                    className="bg-gray-900 hover:bg-black text-white py-5 rounded-2xl font-black italic uppercase tracking-tighter text-xl shadow-2xl transition-all active:scale-95 disabled:opacity-50"
                  >
                    Launch Arena Now
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
