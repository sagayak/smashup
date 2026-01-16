
import React, { useState, useEffect } from 'react';
import { User, UserRole, CreditRequest, Tournament } from '../types';
import { store } from '../services/mockStore';

interface AdminProps {
  user: User;
}

const Admin: React.FC<AdminProps> = ({ user: currentUser }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [requests, setRequests] = useState<CreditRequest[]>([]);
  const [resetRequests, setResetRequests] = useState<User[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [view, setView] = useState<'users' | 'requests' | 'tournaments' | 'resets'>('users');
  
  const [isAdjusting, setIsAdjusting] = useState<User | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('0');
  const [adjustReason, setAdjustReason] = useState('Manual adjustment by Admin');

  const [isResetting, setIsResetting] = useState<User | null>(null);
  const [tempPassword, setTempPassword] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [allUsers, allRequests, allTourneys, allResets] = await Promise.all([
      store.getAllUsers(), 
      store.getCreditRequests(),
      store.getTournaments(),
      store.getResetRequests()
    ]);
    setUsers(allUsers);
    setRequests(allRequests);
    setTournaments(allTourneys);
    setResetRequests(allResets);
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
    } catch (err) {
      console.error("Adjustment failed", err);
      alert("Adjustment failed");
    }
  };

  const handleCompleteReset = async () => {
    if (!isResetting || !tempPassword) return;
    try {
      await store.completeReset(isResetting.id, tempPassword);
      setIsResetting(null);
      setTempPassword('');
      alert("Password reset completed. User can now login with the new temporary password.");
      await loadData();
    } catch (err) {
      alert("Failed to complete reset.");
    }
  };

  const handleDeleteUser = async (userToDelete: User) => {
    if (userToDelete.id === currentUser.id) {
      return alert("Critical Error: You cannot delete your own profile.");
    }
    if (!window.confirm(`SUPERADMIN ACTION: Permanently delete user profile "${userToDelete.name}" (@${userToDelete.username})?`)) return;
    
    try {
      await store.deleteUser(userToDelete.id);
      await loadData();
    } catch (err) {
      alert("Failed to delete user profile.");
    }
  };

  const handleDeleteTournament = async (id: string, name: string) => {
    if (!window.confirm(`SUPERADMIN ACTION: Permanently delete "${name}" and all associated data?`)) return;
    try {
      await store.deleteTournament(id);
      await loadData();
    } catch (err) {
      alert("Failed to delete tournament.");
    }
  };

  const isSuperAdmin = currentUser.role === UserRole.SUPERADMIN;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex space-x-2 overflow-x-auto pb-2 no-scrollbar">
        <TabButton active={view === 'users'} onClick={() => setView('users')} label="Users" />
        <TabButton 
          active={view === 'requests'} 
          onClick={() => setView('requests')} 
          label="Requests" 
          count={requests.length} 
        />
        <TabButton 
          active={view === 'resets'} 
          onClick={() => setView('resets')} 
          label="Reset Req" 
          count={resetRequests.length} 
        />
        <TabButton 
          active={view === 'tournaments'} 
          onClick={() => setView('tournaments')} 
          label="Arenas" 
          count={tournaments.length} 
        />
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
                              <p className="font-bold text-slate-800 uppercase italic text-sm">{u.name}</p>
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
                         <div className="flex justify-end space-x-2">
                           <button 
                             onClick={() => setIsAdjusting(u)}
                             className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                           >Add Credits</button>
                           {isSuperAdmin && u.id !== currentUser.id && (
                             <button 
                               onClick={() => handleDeleteUser(u)}
                               className="bg-rose-50 text-rose-500 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all shadow-sm active:scale-95"
                             >Delete</button>
                           )}
                         </div>
                      </td>
                   </tr>
                 ))}
              </tbody>
           </table>
        </div>
      )}

      {view === 'resets' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {resetRequests.map(u => (
             <div key={u.id} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm animate-in zoom-in">
                <div className="flex items-center space-x-4 mb-6">
                   <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center font-black text-xl">!</div>
                   <div>
                      <h4 className="font-black text-slate-800 uppercase tracking-tighter italic">{u.name}</h4>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">@{u.username}</p>
                   </div>
                </div>
                <button 
                  onClick={() => setIsResetting(u)} 
                  className="w-full bg-slate-900 text-white font-black py-4 rounded-xl uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all"
                >Process Reset</button>
             </div>
           ))}
           {resetRequests.length === 0 && <div className="col-span-full py-20 text-center bg-white rounded-[2rem] border border-dashed border-slate-200"><p className="text-slate-300 font-black uppercase tracking-widest text-xs">No pending reset requests.</p></div>}
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
           {requests.length === 0 && <div className="col-span-full py-20 text-center bg-white rounded-[2rem] border border-dashed border-slate-200"><p className="text-slate-300 font-black uppercase tracking-widest text-xs">No pending requests.</p></div>}
        </div>
      )}

      {view === 'tournaments' && (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
           <table className="w-full text-left">
              <thead className="bg-slate-50/50">
                 <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="px-8 py-5">Arena</th>
                    <th className="px-8 py-5">Organizer</th>
                    <th className="px-8 py-5">Privacy</th>
                    <th className="px-8 py-5 text-right">Action</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                 {tournaments.map(t => (
                   <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5">
                         <p className="font-bold text-slate-800 uppercase italic text-sm">{t.name}</p>
                         <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">ID: {t.uniqueId}</p>
                      </td>
                      <td className="px-8 py-5">
                         <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{users.find(u => u.id === t.organizerId)?.name || 'Unknown'}</p>
                      </td>
                      <td className="px-8 py-5">
                         <span className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest ${t.isPublic ? 'bg-indigo-50 text-indigo-500' : 'bg-slate-100 text-slate-400'}`}>
                           {t.isPublic ? 'Public' : 'Protected'}
                         </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                         <button 
                           onClick={() => handleDeleteTournament(t.id, t.name)}
                           className="bg-rose-50 text-rose-500 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all"
                         >Delete</button>
                      </td>
                   </tr>
                 ))}
              </tbody>
           </table>
        </div>
      )}

      {isAdjusting && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[300] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl animate-in zoom-in duration-300">
              <h4 className="text-2xl font-black text-slate-800 text-center mb-2 italic uppercase tracking-tighter">Adjust Credits</h4>
              <div className="space-y-6 mb-10">
                 <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-2">Amount</label>
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
                 <button onClick={handleManualAdjust} className="flex-grow bg-indigo-600 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all">Apply</button>
                 <button onClick={() => setIsAdjusting(null)} className="px-8 font-black text-slate-400 uppercase tracking-widest text-[10px]">Cancel</button>
              </div>
           </div>
        </div>
      )}

      {isResetting && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[300] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl animate-in zoom-in duration-300">
              <h4 className="text-2xl font-black text-slate-800 text-center mb-2 italic uppercase tracking-tighter">Manual Password Reset</h4>
              <p className="text-center text-slate-400 text-xs mb-8 uppercase tracking-widest font-bold">Setting temp password for @{isResetting.username}</p>
              <div className="space-y-6 mb-10">
                 <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-2">Temporary Password</label>
                   <input 
                     type="text" 
                     placeholder="NewSecurePass123"
                     className="w-full p-5 bg-slate-50 rounded-2xl text-center text-xl font-black outline-none border-2 border-transparent focus:border-indigo-500 transition-all"
                     value={tempPassword}
                     onChange={e => setTempPassword(e.target.value)}
                   />
                 </div>
              </div>
              <div className="flex space-x-4">
                 <button onClick={handleCompleteReset} disabled={!tempPassword} className="flex-grow bg-slate-900 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all disabled:opacity-50">Set New Password</button>
                 <button onClick={() => { setIsResetting(null); setTempPassword(''); }} className="px-8 font-black text-slate-400 uppercase tracking-widest text-[10px]">Cancel</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const TabButton = ({ active, onClick, label, count }: any) => (
  <button 
    onClick={onClick} 
    className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center space-x-2 shrink-0 ${active ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:text-slate-900 bg-white'}`}
  >
    <span>{label}</span>
    {count !== undefined && <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] ${active ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-400'}`}>{count}</span>}
  </button>
);

export default Admin;
