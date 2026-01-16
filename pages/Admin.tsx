
import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { store } from '../services/mockStore';

const Admin: React.FC = () => {
  const [users, setUsers] = useState<User[]>(store.users);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [adjustment, setAdjustment] = useState<string>('0');
  const [reason, setReason] = useState<string>('');

  const handleAdjustCredits = () => {
    if (selectedUser && adjustment !== '0') {
      store.adjustCredits(selectedUser.id, parseInt(adjustment), reason || 'Admin Adjustment');
      setUsers([...store.users]);
      setSelectedUser(null);
      setAdjustment('0');
      setReason('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-800">User Management</h3>
          <div className="text-sm text-slate-500">{users.length} registered users</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Credits</th>
                <th className="px-6 py-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500">{u.name[0]}</div>
                      <div>
                        <p className="font-bold text-slate-700">{u.name}</p>
                        <p className="text-xs text-slate-400">@{u.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${u.role === UserRole.SUPERADMIN ? 'bg-purple-100 text-purple-600' : u.role === UserRole.ORGANIZER ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-600'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-700">{u.credits}</td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => setSelectedUser(u)}
                      className="text-indigo-600 text-sm font-bold hover:underline"
                    >
                      Adjust Credits
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl">
            <h4 className="text-xl font-bold text-slate-800 mb-2">Adjust Credits</h4>
            <p className="text-slate-500 text-sm mb-6">Updating credits for <span className="font-bold text-slate-800">{selectedUser.name}</span></p>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Amount (+/-)</label>
                <input 
                  type="number" 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" 
                  value={adjustment}
                  onChange={e => setAdjustment(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Reason</label>
                <textarea 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" 
                  placeholder="Win bonus, tournament fee, etc."
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                />
              </div>
              <div className="flex space-x-3 pt-2">
                <button onClick={handleAdjustCredits} className="flex-grow bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-all">Apply Changes</button>
                <button onClick={() => setSelectedUser(null)} className="px-6 py-3 font-bold text-slate-400 hover:text-slate-600">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
