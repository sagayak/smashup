
import React, { useState, useEffect } from 'react';
import { User, UserRole, CreditRequest } from '../types';
import { store } from '../services/mockStore';

const Admin: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [requests, setRequests] = useState<CreditRequest[]>([]);
  const [view, setView] = useState<'users' | 'requests'>('users');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [allUsers, allRequests] = await Promise.all([store.getAllUsers(), store.getCreditRequests()]);
    setUsers(allUsers);
    setRequests(allRequests);
  }

  const handleResolveRequest = async (id: string, approved: boolean) => {
    await store.resolveCreditRequest(id, approved);
    await loadData();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex space-x-4">
        <button 
          onClick={() => setView('users')}
          className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'users' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:text-slate-900 bg-white'}`}
        >Users</button>
        <button 
          onClick={() => setView('requests')}
          className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center space-x-2 ${view === 'requests' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:text-slate-900 bg-white'}`}
        >
          <span>Credit Requests</span>
          {requests.length > 0 && <span className="bg-rose-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[8px]">{requests.length}</span>}
        </button>
      </div>

      {view === 'users' && (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
           <table className="w-full text-left">
              <thead className="bg-slate-50/50">
                 <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="px-8 py-5">User</th>
                    <th className="px-8 py-5">Role</th>
                    <th className="px-8 py-5 text-right">Credits</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                 {users.map(u => (
                   <tr key={u.id}>
                      <td className="px-8 py-5">
                        <div className="flex items-center space-x-3">
                           <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center font-black text-slate-400">{u.name[0]}</div>
                           <div>
                              <p className="font-bold text-slate-800 leading-none">{u.name}</p>
                              <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">@{u.username}</p>
                           </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                         <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${u.role === UserRole.SUPERADMIN ? 'bg-purple-50 text-purple-600' : 'bg-indigo-50 text-indigo-600'}`}>
                           {u.role}
                         </span>
                      </td>
                      <td className="px-8 py-5 text-right font-black text-indigo-600">{u.credits}</td>
                   </tr>
                 ))}
              </tbody>
           </table>
        </div>
      )}

      {view === 'requests' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {requests.map(req => (
             <div key={req.id} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm animate-in zoom-in">
                <div className="flex justify-between items-start mb-6">
                   <div>
                      <h4 className="font-black text-slate-800 uppercase tracking-tighter">@{req.username}</h4>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(req.timestamp).toLocaleDateString()}</p>
                   </div>
                   <div className="text-xl font-black text-indigo-600">+{req.amount}</div>
                </div>
                <div className="flex space-x-3">
                   <button onClick={() => handleResolveRequest(req.id, true)} className="flex-1 bg-emerald-500 text-white font-black py-3 rounded-xl uppercase tracking-widest text-[10px]">Approve</button>
                   <button onClick={() => handleResolveRequest(req.id, false)} className="flex-1 bg-rose-50 text-rose-500 font-black py-3 rounded-xl uppercase tracking-widest text-[10px]">Reject</button>
                </div>
             </div>
           ))}
           {requests.length === 0 && <p className="text-slate-300 font-bold text-center py-20 col-span-full">No pending requests.</p>}
        </div>
      )}
    </div>
  );
};

export default Admin;
