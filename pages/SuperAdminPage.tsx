
import React, { useState, useEffect } from 'react';
import { Shield, Search, UserPlus, CreditCard, ChevronRight, AlertTriangle, User, TrendingUp } from 'lucide-react';
import { supabase } from '../services/supabase';
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
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setUsers(data);
    setLoading(false);
  };

  const handleUpdateCredits = async (action: 'add' | 'deduct') => {
    if (!selectedUser || creditAmount <= 0) return;

    const delta = action === 'add' ? creditAmount : -creditAmount;
    
    const { error } = await supabase.rpc('update_user_credits', {
      target_user_id: selectedUser.id,
      amount_change: delta,
      log_description: `SuperAdmin ${profile.username} ${action}ed ${creditAmount} credits`,
      log_action: action
    });

    if (!error) {
      alert(`Successfully ${action}ed credits`);
      setSelectedUser(null);
      setCreditAmount(0);
      fetchUsers();
    } else {
      alert(error.message);
    }
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="bg-gray-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-green-600/20 blur-[100px] rounded-full" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-green-400 font-bold uppercase tracking-widest text-xs mb-2">
              <Shield className="w-4 h-4" />
              SuperAdmin Command Center
            </div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter">Global Management</h1>
            <p className="text-gray-400 mt-2">Oversee all users, credits, and system health.</p>
          </div>
          <div className="flex gap-4">
             <div className="bg-gray-800 p-4 rounded-3xl border border-gray-700">
                <p className="text-xs font-bold text-gray-500 uppercase mb-1">Total Users</p>
                <p className="text-2xl font-black">{users.length}</p>
             </div>
             <div className="bg-gray-800 p-4 rounded-3xl border border-gray-700">
                <p className="text-xs font-bold text-gray-500 uppercase mb-1">Circulating Credits</p>
                <p className="text-2xl font-black">{users.reduce((acc, u) => acc + u.credits, 0)}</p>
             </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input 
                type="text"
                placeholder="Search by name or username..."
                className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-[2rem] shadow-sm outline-none focus:ring-2 focus:ring-green-500 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {/* Added missing TrendingUp icon here */}
            <button onClick={fetchUsers} className="p-4 bg-white border border-gray-200 rounded-full shadow-sm hover:bg-gray-50 transition-colors">
              <TrendingUp className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">User</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Role</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Credits</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Joined</th>
                    <th className="px-6 py-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-green-50/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-2xl flex items-center justify-center font-bold text-gray-500">
                            {u.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{u.full_name}</p>
                            <p className="text-sm text-gray-500">@{u.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          u.role === 'superadmin' ? 'bg-purple-100 text-purple-700' :
                          u.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono font-bold text-green-600">{u.credits}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => setSelectedUser(u)}
                          className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-100 rounded-xl transition-all"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div>
          {selectedUser ? (
            <div className="bg-white p-8 rounded-[2.5rem] border border-green-200 shadow-xl shadow-green-50 sticky top-24 animate-in slide-in-from-right-4">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <User className="w-5 h-5 text-green-600" />
                Manage User
              </h3>
              
              <div className="bg-gray-50 p-6 rounded-3xl mb-8">
                <div className="text-center">
                  <div className="w-20 h-20 bg-green-100 rounded-[2rem] mx-auto mb-3 flex items-center justify-center text-3xl font-bold text-green-600">
                    {selectedUser.username.charAt(0).toUpperCase()}
                  </div>
                  <h4 className="font-bold text-xl">{selectedUser.full_name}</h4>
                  <p className="text-gray-500">Current Balance: <span className="text-green-600 font-bold">{selectedUser.credits}</span></p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Credit Amount</label>
                  <input 
                    type="number"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(parseInt(e.target.value) || 0)}
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-2xl font-black text-center focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="0"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => handleUpdateCredits('deduct')}
                    className="px-6 py-4 bg-white border-2 border-red-100 text-red-600 font-bold rounded-2xl hover:bg-red-50 transition-all active:scale-95"
                  >
                    Deduct
                  </button>
                  <button 
                    onClick={() => handleUpdateCredits('add')}
                    className="px-6 py-4 bg-green-600 text-white font-bold rounded-2xl hover:bg-green-700 shadow-lg shadow-green-100 transition-all active:scale-95"
                  >
                    Add Credits
                  </button>
                </div>

                <button 
                  onClick={() => setSelectedUser(null)}
                  className="w-full py-3 text-gray-400 text-sm font-medium hover:text-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 p-8 rounded-[2.5rem] border border-dashed border-gray-200 text-center sticky top-24">
              <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-400 font-medium">Select a user to manage their credits and permissions</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminPage;
