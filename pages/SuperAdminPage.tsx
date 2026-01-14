
import React, { useState, useEffect } from 'react';
import { Shield, Search, UserPlus, CreditCard, ChevronRight, AlertTriangle, User, TrendingUp, Key, Trash2, Edit3, X } from 'lucide-react';
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
  const [newPassword, setNewPassword] = useState('');

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
      setCreditAmount(0);
      fetchUsers();
    } else {
      alert(error.message);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword) return;
    const { error } = await supabase.rpc('admin_reset_password', {
      target_user_id: selectedUser.id,
      new_password: newPassword
    });
    if (!error) {
      alert("Password reset successful.");
      setNewPassword('');
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    if (!confirm(`Are you absolutely sure you want to delete ${selectedUser.username}? This cannot be undone.`)) return;
    
    const { error } = await supabase.from('profiles').delete().eq('id', selectedUser.id);
    if (!error) {
      alert("User removed from cluster.");
      setSelectedUser(null);
      fetchUsers();
    }
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="bg-gray-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden border border-gray-800 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-green-600/20 blur-[120px] rounded-full -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <div className="flex items-center gap-2 text-green-400 font-black uppercase tracking-widest text-xs mb-4 px-4 py-1 bg-green-900/40 rounded-full w-fit">
              <Shield className="w-4 h-4" />
              SuperAdmin Command Center
            </div>
            <h1 className="text-5xl font-black italic uppercase tracking-tighter leading-none mb-2">Global System<br/>Management</h1>
            <p className="text-gray-400 mt-2 font-medium">God Mode: Total control over all entities in the Arena.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div className="bg-gray-800/50 p-6 rounded-[2rem] border border-gray-700 backdrop-blur-sm">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Users</p>
                <p className="text-4xl font-black italic tracking-tighter">{users.length}</p>
             </div>
             <div className="bg-gray-800/50 p-6 rounded-[2rem] border border-gray-700 backdrop-blur-sm">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Credits</p>
                <p className="text-4xl font-black italic tracking-tighter text-green-500">{users.reduce((acc, u) => acc + u.credits, 0)}</p>
             </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input 
                type="text"
                placeholder="Search by name, @username, or UserID..."
                className="w-full pl-16 pr-6 py-5 bg-white border border-gray-100 rounded-[2rem] shadow-sm outline-none focus:ring-4 focus:ring-green-500/10 transition-all font-bold"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button onClick={fetchUsers} className="p-5 bg-white border border-gray-100 rounded-[1.5rem] shadow-sm hover:bg-gray-50 transition-colors group">
              <TrendingUp className="w-6 h-6 text-gray-600 group-hover:rotate-12 transition-transform" />
            </button>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">User / ID</th>
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Auth Level</th>
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Balance</th>
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className={`hover:bg-green-50/30 transition-colors group ${selectedUser?.id === u.id ? 'bg-green-50' : ''}`}>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gray-900 text-white rounded-2xl flex items-center justify-center font-black italic border-2 border-green-500">
                            {u.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-black text-gray-900 uppercase italic tracking-tighter">{u.full_name}</p>
                            <p className="text-xs text-gray-400 font-bold flex items-center gap-1.5 uppercase tracking-widest">
                               <span className="text-green-600">ID:</span> {u.id.split('-')[0]} 
                               <span className="mx-1">•</span>
                               @{u.username}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                          u.role === 'superadmin' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                          u.role === 'admin' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-500 border-gray-200'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-2xl font-black text-gray-900 italic tracking-tighter">{u.credits}c</p>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button 
                          onClick={() => setSelectedUser(u)}
                          className="p-3 bg-white border border-gray-100 rounded-xl text-gray-400 hover:text-green-600 hover:border-green-200 shadow-sm transition-all active:scale-95"
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

        <div className="lg:col-span-4">
          {selectedUser ? (
            <div className="bg-white p-10 rounded-[3rem] border-2 border-green-600 shadow-2xl sticky top-24 animate-in slide-in-from-right-8 duration-500 overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                 <Shield className="w-32 h-32" />
              </div>
              
              <div className="flex justify-between items-start mb-8">
                 <h3 className="text-2xl font-black italic text-gray-900 uppercase tracking-tighter">User Settings</h3>
                 <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X className="w-6 h-6"/></button>
              </div>
              
              <div className="bg-gray-50 p-8 rounded-[2.5rem] mb-8 text-center border border-gray-100">
                <div className="w-24 h-24 bg-gray-900 text-white rounded-[2rem] mx-auto mb-4 flex items-center justify-center text-4xl font-black italic border-4 border-green-500 shadow-xl">
                  {selectedUser.username.charAt(0).toUpperCase()}
                </div>
                <h4 className="font-black text-2xl uppercase italic tracking-tighter text-gray-900 leading-none">{selectedUser.full_name}</h4>
                <p className="text-green-600 font-black uppercase tracking-widest text-[10px] mt-2">UUID: {selectedUser.id}</p>
              </div>

              <div className="space-y-8">
                {/* Credit Control */}
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Credit Operations</label>
                  <input 
                    type="number"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(parseInt(e.target.value) || 0)}
                    className="w-full px-6 py-5 bg-gray-50 border border-gray-100 rounded-2xl text-3xl font-black text-center focus:ring-4 focus:ring-green-500/10 outline-none italic tracking-tighter"
                    placeholder="0"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => handleUpdateCredits('deduct')}
                      className="px-6 py-4 bg-white border-2 border-red-100 text-red-600 font-black uppercase italic tracking-tighter rounded-2xl hover:bg-red-50 transition-all active:scale-95"
                    >
                      Deduct
                    </button>
                    <button 
                      onClick={() => handleUpdateCredits('add')}
                      className="px-6 py-4 bg-green-600 text-white font-black uppercase italic tracking-tighter rounded-2xl hover:bg-green-700 shadow-xl shadow-green-100 transition-all active:scale-95"
                    >
                      Add Credits
                    </button>
                  </div>
                </div>

                {/* Password Reset */}
                <div className="space-y-4 pt-4 border-t border-gray-50">
                   <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Overload Password</label>
                   <div className="relative">
                      <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                      <input 
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter New Password"
                        className="w-full pl-10 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-xl font-bold outline-none focus:bg-white"
                      />
                   </div>
                   <button 
                    onClick={handleResetPassword}
                    className="w-full py-4 bg-gray-900 text-white font-black uppercase italic tracking-tighter text-sm rounded-xl hover:bg-black transition-all"
                   >
                     Reset Access Key
                   </button>
                </div>

                {/* Destructive Actions */}
                <div className="pt-4 border-t border-gray-50">
                  <button 
                    onClick={handleDeleteUser}
                    className="w-full py-4 bg-red-50 text-red-600 font-black uppercase italic tracking-tighter text-sm rounded-xl hover:bg-red-100 flex items-center justify-center gap-2 transition-all"
                  >
                    <Trash2 className="w-4 h-4" /> Eject from Arena
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 p-12 rounded-[3rem] border-2 border-dashed border-gray-200 text-center sticky top-24">
              <Shield className="w-16 h-16 text-gray-200 mx-auto mb-6" />
              <p className="text-gray-400 font-black uppercase tracking-widest text-xs italic">Select an entity to initiate<br/>overload protocols</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminPage;
