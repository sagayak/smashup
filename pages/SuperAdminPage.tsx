
import React, { useState, useEffect } from 'react';
import { Shield, Search, ChevronRight, User, TrendingUp, Key, Trash2, X } from 'lucide-react';
import { db, dbService } from '../services/firebase';
import { collection, query, onSnapshot, orderBy, doc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
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
    const unsub = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map(d => d.data() as Profile));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleUpdateCredits = async (action: 'add' | 'deduct') => {
    if (!selectedUser || creditAmount <= 0) return;
    const delta = action === 'add' ? creditAmount : -creditAmount;
    
    try {
      await dbService.profiles.updateCredits(
        selectedUser.id,
        delta,
        `SuperAdmin Override: ${action}`,
        action
      );
      alert(`Credits updated via Cloud Transaction.`);
      setCreditAmount(0);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    if (!confirm(`Delete ${selectedUser.username} permanently?`)) return;
    await deleteDoc(doc(db, "profiles", selectedUser.id));
    setSelectedUser(null);
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="bg-gray-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden border border-gray-800 shadow-2xl">
        <h1 className="text-5xl font-black italic uppercase tracking-tighter leading-none mb-2">Command Center</h1>
        <p className="text-gray-400 mt-2 font-medium">Cloud Node: {db.app.options.projectId}</p>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          <div className="relative">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text"
              placeholder="Filter cloud profiles..."
              className="w-full pl-16 pr-6 py-5 bg-white border border-gray-100 rounded-[2rem] shadow-sm outline-none font-bold"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden">
            <table className="w-full text-left">
              <tbody className="divide-y divide-gray-50">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-green-50/30 transition-colors">
                    <td className="px-8 py-6 flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-900 text-white rounded-2xl flex items-center justify-center font-black italic border-2 border-green-500">{u.username[0].toUpperCase()}</div>
                      <div>
                        <p className="font-black italic uppercase tracking-tighter">{u.full_name}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">@{u.username}</p>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-2xl font-black italic">{u.credits}c</td>
                    <td className="px-8 py-6 text-right">
                      <button onClick={() => setSelectedUser(u)} className="p-3 bg-white border border-gray-100 rounded-xl hover:text-green-600 transition-all"><ChevronRight /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-4">
          {selectedUser ? (
            <div className="bg-white p-10 rounded-[3rem] border-2 border-green-600 shadow-2xl sticky top-24">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black italic uppercase">Override</h3>
                <button onClick={() => setSelectedUser(null)}><X /></button>
              </div>
              <div className="space-y-6">
                <input 
                  type="number"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(parseInt(e.target.value) || 0)}
                  className="w-full px-6 py-5 bg-gray-50 border rounded-2xl text-3xl font-black text-center"
                  placeholder="0"
                />
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => handleUpdateCredits('deduct')} className="py-4 border-2 rounded-2xl font-black uppercase italic text-red-600">Deduct</button>
                  <button onClick={() => handleUpdateCredits('add')} className="py-4 bg-green-600 text-white rounded-2xl font-black uppercase italic">Add</button>
                </div>
                <button onClick={handleDeleteUser} className="w-full py-4 text-red-600 font-black uppercase italic text-xs border border-red-100 rounded-xl mt-4"><Trash2 className="inline w-4 h-4 mr-2"/> Delete Profile</button>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-gray-300 font-black italic uppercase">Select profile to manage</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminPage;
