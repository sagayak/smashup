
import React, { useState, useEffect } from 'react';
import { CreditCard, History, TrendingUp, TrendingDown, BadgeCheck, Shield, ChevronRight } from 'lucide-react';
import { supabase } from '../services/supabase';
import { Profile, CreditLog } from '../types';

interface ProfilePageProps {
  profile: Profile;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ profile }) => {
  const [logs, setLogs] = useState<CreditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, [profile.id]);

  const fetchLogs = async () => {
    const { data } = await supabase
      .from('credit_logs')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });

    if (data) setLogs(data);
    setLoadingLogs(false);
  };

  const simulateAddCredits = async () => {
    const amount = 500;
    const { error } = await supabase.rpc('update_user_credits', {
      target_user_id: profile.id,
      amount_change: amount,
      log_description: "Simulated credit top-up",
      log_action: 'add'
    });

    if (!error) {
      alert("Added 500 simulated credits!");
      fetchLogs();
      // Reload page or use parent refetch logic if available
      window.location.reload(); 
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* Profile Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 -mr-16 -mt-16 rounded-full" />
             <div className="flex flex-col items-center text-center">
                <div className="w-24 h-24 bg-green-100 rounded-[2rem] flex items-center justify-center text-4xl font-bold text-green-600 mb-4 border-4 border-white shadow-lg">
                   {profile.username.charAt(0).toUpperCase()}
                </div>
                <h2 className="text-2xl font-black text-gray-900">{profile.full_name}</h2>
                <p className="text-gray-500 font-medium">@{profile.username}</p>
                <div className="mt-4 flex items-center gap-2">
                   <span className="bg-gray-900 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">{profile.role}</span>
                   <span className="bg-green-50 text-green-700 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1">
                      <BadgeCheck className="w-3 h-3" /> Verified
                   </span>
                </div>
             </div>

             <div className="mt-10 p-6 bg-green-600 rounded-3xl text-white shadow-lg shadow-green-100">
                <div className="flex justify-between items-center mb-1">
                   <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Account Credits</span>
                   <CreditCard className="w-5 h-5 opacity-60" />
                </div>
                <div className="text-4xl font-black italic tracking-tighter mb-4">{profile.credits}</div>
                <button 
                  onClick={simulateAddCredits}
                  className="w-full bg-white text-green-600 font-black uppercase tracking-tighter italic text-sm py-3 rounded-2xl shadow-md hover:bg-green-50 transition-all active:scale-95"
                >
                  Top Up Simulation (+500c)
                </button>
             </div>
          </div>

          <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-4">
             <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                Account Security
             </h3>
             <p className="text-sm text-gray-500">Your account uses username-based authentication. Remember your credentials as password recovery is disabled for privacy.</p>
             <div className="pt-4 border-t border-gray-50">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Linked Email (Private)</p>
                <p className="text-sm font-medium text-gray-700 mt-1">{profile.email || 'None provided'}</p>
             </div>
          </div>
        </div>

        {/* Credit Logs */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
             <h3 className="text-2xl font-black italic uppercase tracking-tighter text-gray-900 flex items-center gap-3">
                <History className="w-6 h-6 text-green-600" />
                Transaction History
             </h3>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
             {loadingLogs ? (
                <div className="p-10 text-center text-gray-400">Loading history...</div>
             ) : logs.length === 0 ? (
                <div className="p-20 text-center">
                   <TrendingUp className="w-12 h-12 text-gray-100 mx-auto mb-4" />
                   <p className="text-gray-400 font-medium">No transactions found</p>
                </div>
             ) : (
                <div className="divide-y divide-gray-50">
                   {logs.map((log) => (
                      <div key={log.id} className="p-6 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                         <div className={`p-3 rounded-2xl ${log.amount > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                            {log.amount > 0 ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                         </div>
                         <div className="flex-1">
                            <h4 className="font-bold text-gray-900">{log.description}</h4>
                            <p className="text-xs text-gray-400 font-medium mt-1">{new Date(log.created_at).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, month: 'short', day: 'numeric', year: 'numeric' })}</p>
                         </div>
                         <div className={`text-xl font-black italic tracking-tighter ${log.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {log.amount > 0 ? '+' : ''}{log.amount}c
                         </div>
                         <ChevronRight className="w-5 h-5 text-gray-200" />
                      </div>
                   ))}
                </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
