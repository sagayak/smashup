
import React, { useState, useEffect } from 'react';
import { CreditCard, History, BadgeCheck, Database, Cloud } from 'lucide-react';
import { db, dbService } from '../services/firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { Profile, CreditLog } from '../types';

interface ProfilePageProps {
  profile: Profile;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ profile }) => {
  const [logs, setLogs] = useState<CreditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "credit_logs"), 
      where("user_id", "==", profile.id),
      orderBy("created_at", "desc"),
      limit(10)
    );
    
    const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map(d => d.data() as CreditLog));
      setLoadingLogs(false);
    });

    return () => unsub();
  }, [profile.id]);

  const simulateAddCredits = async () => {
    try {
      await dbService.profiles.updateCredits(
        profile.id, 
        500, 
        "Simulated credit top-up", 
        'add'
      );
      alert("Added 500 simulated credits via Firestore transaction!");
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="grid lg:grid-cols-3 gap-8">
        
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
                      <BadgeCheck className="w-3 h-3" /> Cloud Verified
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
                <Database className="w-5 h-5 text-green-600" />
                Firestore Node Status
             </h3>
             <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                   <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Protocol</span>
                   <span className="text-[10px] font-black text-green-600 uppercase">GCP Firestore</span>
                </div>
                <div className="flex items-center gap-3">
                   <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                   <p className="text-sm font-bold text-gray-700">Online & Synchronized</p>
                </div>
             </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
             <h3 className="text-2xl font-black italic uppercase tracking-tighter text-gray-900 flex items-center gap-3">
                <History className="w-6 h-6 text-green-600" />
                Arena Activity (Firestore Log)
             </h3>
          </div>

          <div className="bg-white rounded-[3.5rem] border border-gray-100 shadow-sm overflow-hidden p-8">
            {logs.length === 0 ? (
              <div className="text-center py-12">
                <Cloud className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No activity recorded on this node</p>
              </div>
            ) : (
              <div className="space-y-4">
                {logs.map(log => (
                  <div key={log.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-transparent hover:border-green-100 transition-all">
                    <div>
                      <p className="font-bold text-gray-800">{log.description}</p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest">{new Date(log.created_at).toLocaleString()}</p>
                    </div>
                    <div className={`text-xl font-black italic tracking-tighter ${log.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {log.amount > 0 ? '+' : ''}{log.amount}c
                    </div>
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
