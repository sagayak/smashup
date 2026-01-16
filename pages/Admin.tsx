
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { store } from '../services/mockStore';

const Admin: React.FC = () => {
  // Fix: use empty array and fetch via useEffect
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [adjustment, setAdjustment] = useState<string>('0');
  const [reason, setReason] = useState<string>('');

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    const allUsers = await store.getAllUsers();
    setUsers(allUsers);
  }

  // Fix: handleAdjustCredits must be async
  const handleAdjustCredits = async () => {
    if (selectedUser && adjustment !== '0') {
      await store.adjustCredits(selectedUser.id, parseInt(adjustment), reason || 'Admin Adjustment');
      await loadUsers();
      setSelectedUser(null);
      setAdjustment('0');
      setReason('');
    }
  };

  const handleResetPassword = (u: User) => {
    // In this mock, we just clear the request and alert the developer
    u.resetRequested = false;
    alert(`Developer Action Required: Reset password for ${u.username}. Temporary password set to 'password123'`);
    u.password = 'password123';
    // Fix: update local state instead of using non-existent store.users
    setUsers([...users]);
  };

  return (
    <div className="space-y-6">
      {/* Reset Requests Banner */}
      {users.some(u => u.resetRequested) && (
        <div className="bg-amber-50 border-2 border-amber-100 p-6 rounded-3xl animate-in slide-in-from-top">
          <h3 className="text-amber-800 font-black uppercase tracking-widest text-xs mb-4">Pending Password Resets</h3>
          <div className="flex flex-wrap gap-3">
            {users.filter(u => u.resetRequested).map(u => (
              <div key={u.id} className="bg-white px-4 py-2 rounded-xl flex items-center space-x-3 shadow-sm border border-amber-200">
                <span className="font-bold text-slate-700 text-sm">@{u.username}</span>
                <button onClick={() => handleResetPassword(u)} className="text-xs font-black text-amber-600 hover:text-amber-800 uppercase">Reset to 'password123'</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-white">
          <h3 className="font-black text-slate-800 uppercase tracking-wider text-sm">User Management</h3>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{users.length} Total Users</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                <th className="px-8 py-5">User</th>
                <th className="px-8 py-5">Role</th>
                <th className="px-8 py-5">Credits</th>
                <th className="px-8 py-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center font-black text-slate-400 shadow-inner">{u.name[0]}</div>
                      <div>
                        <p className="font-bold text-slate-800 leading-none mb-1">{u.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">@{u.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase ${u.role === UserRole.SUPERADMIN ? 'bg-purple-100 text-purple-600' : u.role === UserRole.ORGANIZER ? 'bg-orange-100 text-orange-600' : 'bg-indigo-50 text-indigo-600'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-8 py-5 font-black text-slate-700">{u.credits}</td>
                  <td className="px-8 py-5 text-right">
                    <button 
                      onClick={() => setSelectedUser(u)}
                      className="text-indigo-600 text-xs font-black uppercase tracking-widest hover:bg-indigo-50 px-3 py-2 rounded-lg transition-colors"
                    >
                      Credits
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-10 shadow-2xl animate-in zoom-in duration-200">
            <h4 className="text-2xl font-black text-slate-800 mb-2">Adjust Credits</h4>
            <p className="text-slate-400 text-sm font-medium mb-8 uppercase tracking-widest">User: {selectedUser.name}</p>
            
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-1">Amount (+/-)</label>
                <input 
                  type="number" 
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none font-bold text-xl" 
                  value={adjustment}
                  onChange={e => setAdjustment(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-1">Reason</label>
                <textarea 
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none font-bold min-h-[100px]" 
                  placeholder="Win bonus, tournament fee, etc."
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                />
              </div>
              <div className="flex space-x-4 pt-2">
                <button onClick={handleAdjustCredits} className="flex-grow bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">Apply</button>
                <button onClick={() => setSelectedUser(null)} className="px-8 py-4 font-bold text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
