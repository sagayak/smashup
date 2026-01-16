
import React, { useState, useEffect } from 'react';
import { User, UserRole, CreditRequest } from '../types';
import { store } from '../services/mockStore';

const Admin: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [requests, setRequests] = useState<CreditRequest[]>([]);
  const [view, setView] = useState<'users' | 'requests'>('users');
  const [isAdjusting, setIsAdjusting] = useState<User | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('0');
  const [adjustReason, setAdjustReason] = useState('Manual adjustment by Admin');

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

  const handleManualAdjust = async () => {
    if (!isAdjusting) return;
    const amount = parseInt(adjustAmount);
    if (isNaN(amount)) return alert("Invalid amount");
    
    try {
      await store.adjustCredits(isAdjusting.id, amount, adjustReason);
      setIsAdjusting(null);
      setAdjustAmount('0');
      setAdjustReason('Manual adjustment by Admin');
      await loadData();
      alert(`Successfully adjusted ${isAdjusting.name}'s balance by ${amount} credits.`);
    } catch (err) {
      console.error("Adjustment failed", err);
      alert("Adjustment failed");
    }
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
                    <th className="px-8 py-5 text-center">Credits</th>
                    <th className="px-8 py-5 text-right">Actions</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                 {users.map(u => (
                   <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5">
                        <div className="flex items-center space-x-3">
                           <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-400">{u.name[0]}</div>
                           <div>
                              <p className="font-bold text-slate-800 leading-none uppercase italic text-sm">{u.name}</p>
                              <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mt-0.5">@{u.username}</p>
                           </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                         <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${u.role === UserRole.SUPERADMIN ? 'bg-purple-50 text-purple-600 border border-purple-100' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}>
                           {u.role}
                         </span>
                      </td>
                      <td className="px-8 py-5 text-center font-black text-indigo-600 tabular-nums">{u.credits}</td>
                      <td className="px-8 py-5 text-right">
                         <button 
                           onClick={() => setIsAdjusting(u)}
                           className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 hover:scale-105 active:scale-95 transition-all"
                         >
                           Add Credits
                         </button>
                      </td>
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
                      <h4 className="font-black text-slate-800 uppercase tracking-tighter italic">@{req.username}</h4>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(req.timestamp).toLocaleDateString()}</p>
                   </div>
                   <div className="text-xl font-black text-indigo-600">+{req.amount}</div>
                </div>
                <div className="flex space-x-3">
                   <button onClick={() => handleResolveRequest(req.id, true)} className="flex-1 bg-emerald-500 text-white font-black py-3 rounded-xl uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-100">Approve</button>
                   <button onClick={() => handleResolveRequest(req.id, false)} className="flex-1 bg-rose-50 text-rose-500 font-black py-3 rounded-xl uppercase tracking-widest text-[10px]">Reject</button>
                </div>
             </div>
           ))}
           {requests.length === 0 && (
             <div className="col-span-full py-20 text-center bg-white rounded-[2rem] border border-dashed border-slate-200">
               <p className="text-slate-300 font-black uppercase tracking-widest text-xs">No pending requests.</p>
             </div>
           )}
        </div>
      )}

      {isAdjusting && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[300] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl animate-in zoom-in duration-300">
              <h4 className="text-2xl font-black text-slate-800 text-center mb-2 italic uppercase tracking-tighter">Adjust Credits</h4>
              <p className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">User: {isAdjusting.name} (@{isAdjusting.username})</p>
              
              <div className="space-y-6 mb-10">
                 <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-2">Amount (Negative to deduct)</label>
                   <input 
                     type="number" 
                     className="w-full p-5 bg-slate-50 rounded-2xl text-center text-3xl font-black outline-none border-2 border-transparent focus:border-indigo-500 transition-all"
                     value={adjustAmount}
                     onChange={e => setAdjustAmount(e.target.value)}
                   />
                 </div>
                 <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-2">Reason</label>
                   <input 
                     type="text" 
                     className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500 transition-all text-xs"
                     value={adjustReason}
                     onChange={e => setAdjustReason(e.target.value)}
                   />
                 </div>
              </div>

              <div className="flex space-x-4">
                 <button 
                  onClick={handleManualAdjust}
                  className="flex-grow bg-indigo-600 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-indigo-100 active:scale-95 transition-all"
                 >
                   Apply Adjustment
                 </button>
                 <button 
                  onClick={() => setIsAdjusting(null)}
                  className="px-8 font-black text-slate-400 uppercase tracking-widest text-[10px] hover:text-slate-600 transition-colors"
                 >
                   Cancel
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
