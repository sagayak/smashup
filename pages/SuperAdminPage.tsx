
import React, { useState, useEffect } from 'react';
import { Shield, Search, ChevronRight, X, Zap } from 'lucide-react';
import { db, dbService } from '../services/firebase';
import { collection, query, orderBy, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { Profile } from '../types';

interface SuperAdminPageProps {
  profile: Profile;
}

const SuperAdminPage: React.FC<SuperAdminPageProps> = ({ profile }) => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [creditAmount, setCreditAmount] = useState(0);

  useEffect(() => {
    const q = query(collection(db, "profiles"), orderBy("created_at", "desc"));
    const unsubscribe = onSnapshot(q, (snap) => {
      const profileData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Profile));
      setUsers(profileData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleUpdateCredits = async (action: 'add' | 'deduct') => {
    if (!selectedUser || creditAmount <= 0) return;
    const delta = action === 'add' ? creditAmount : -creditAmount;
    
    try {
      await dbService.profiles.updateCredits(selectedUser.id, delta, `SuperAdmin Override: ${action}`, action);
      alert(`Balance Synced on Cloud Node.`);
      setCreditAmount(0);
      setSelectedUser(null);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="bg-gray-900 rounded-[3rem] p-12 text-white relative overflow-hidden border border-gray-800 shadow-2xl">
        <h1 className="text-5xl font-black italic uppercase tracking-tighter leading-none mb-2">Central Node</h1>
        <p className="text-gray-400 mt-2 font-black uppercase tracking-widest text-[10px] flex items-center gap-2">
           <Zap className="w-3 h-3 text-green-500" /> Authorized Firebase Admin Access
        </p>
      </div>

      <div className="grid lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7 space-y-6">
          <div className="relative">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300 w-5 h-5" />
            <input 
              type="text"
              placeholder="Filter global profiles..."
              className="w-full pl-16 pr-6 py-5 bg-white border border-gray-100 rounded-[2rem] shadow-sm outline-none font-bold italic text-lg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="bg-white rounded-[3rem] border border-gray-100 shadow-xl overflow-hidden">
            <table className="w-full text-left">
              <tbody className="divide-y divide-gray-50">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-green-50 transition-colors">
                    <td className="px-8 py-6 flex items-center gap-5">
                      <div className="w-14 h-14 bg-gray-900 text-white rounded-2xl flex items-center justify-center font-black italic text-xl border-2 border-green-500 shadow-lg">{u.username[0].toUpperCase()}</div>
                      <div>
                        <p className="font-black italic uppercase tracking-tighter text-lg">{u.full_name}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">@{u.username}</p>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-3xl font-black italic tracking-tighter text-gray-900">{u.credits}c</td>
                    <td className="px-8 py-6 text-right">
                      <button onClick={() => setSelectedUser(u)} className="p-4 bg-gray-50 rounded-2xl hover:bg-green-600 hover:text-white transition-all"><ChevronRight className="w-5 h-5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-5">
          {selectedUser ? (
            <div className="bg-white p-12 rounded-[4rem] border-2 border-green-600 shadow-2xl sticky top-24 animate-in slide-in-from-right-4">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-3xl font-black italic uppercase tracking-tighter">Command Control</h3>
                <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-gray-100 rounded-full"><X /></button>
              </div>
              <div className="space-y-8">
                <div>
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-3 ml-2">Override Credits</label>
                   <input 
                    type="number"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(parseInt(e.target.value) || 0)}
                    className="w-full px-8 py-6 bg-gray-50 border-none rounded-3xl text-5xl font-black text-center italic tracking-tighter focus:ring-4 focus:ring-green-500/10 outline-none"
                    placeholder="0"
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <button onClick={() => handleUpdateCredits('deduct')} className="py-5 border-2 rounded-2xl font-black uppercase italic tracking-tighter text-red-600 hover:bg-red-50">Deduct</button>
                  <button onClick={() => handleUpdateCredits('add')} className="py-5 bg-green-600 text-white rounded-2xl font-black uppercase italic tracking-tighter shadow-xl shadow-green-100 hover:bg-green-700">Grant</button>
                </div>
                <div className="pt-6 border-t border-gray-50">
                  <p className="text-[10px] text-gray-400 font-black uppercase text-center tracking-widest mb-4 italic leading-relaxed">Changes are atomic and logged to Firebase Transaction Audit.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-96 flex flex-col items-center justify-center text-gray-200 bg-gray-50/50 rounded-[4rem] border-2 border-dashed border-gray-100">
               <Shield className="w-16 h-16 mb-4 opacity-10" />
               <p className="font-black italic uppercase tracking-widest text-xs opacity-30">Select Node to Override</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminPage;
