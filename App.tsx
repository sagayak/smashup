
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Trophy, Shield, LogOut, LayoutDashboard, Menu, X, Zap, User as UserIcon, Cloud, AlertCircle, RefreshCw } from 'lucide-react';
import { auth, db, dbService } from './services/firebase';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { Profile } from './types';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import TournamentsPage from './pages/TournamentsPage';
import TournamentDetailPage from './pages/TournamentDetailPage';
import LiveScoringPage from './pages/LiveScoringPage';
import SuperAdminPage from './pages/SuperAdminPage';
import ProfilePage from './pages/ProfilePage';

const AppContent: React.FC = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Real-time profile listener
        const profileRef = doc(db, "profiles", user.uid);
        const unsubscribeProfile = onSnapshot(profileRef, (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as Profile);
            setSyncError(null);
          } else {
            setSyncError("User profile record not found in Arena Database.");
          }
          setLoading(false);
        }, (err) => {
          console.error("Profile listen error:", err);
          setSyncError("Failed to sync profile data.");
          setLoading(false);
        });

        return () => unsubscribeProfile();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <Zap className="w-16 h-16 mx-auto mb-4 animate-bounce text-green-500" />
          <h1 className="text-3xl font-black italic uppercase tracking-tighter">ShuttleUp</h1>
          <p className="mt-2 text-green-400 font-black italic uppercase tracking-widest text-[10px] animate-pulse">Entering the Arena...</p>
        </div>
      </div>
    );
  }

  if (syncError && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 p-6">
        <div className="max-w-md w-full bg-white rounded-[3rem] p-12 text-center shadow-2xl border-t-8 border-red-500">
           <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
           <h2 className="text-3xl font-black italic uppercase tracking-tighter text-gray-900 mb-4">Sync Failure</h2>
           <p className="text-gray-500 font-bold text-sm mb-8 leading-relaxed">{syncError}</p>
           <div className="space-y-4">
             <button onClick={() => window.location.reload()} className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black uppercase italic tracking-tighter hover:bg-black transition-all flex items-center justify-center gap-2">
               <RefreshCw className="w-4 h-4" /> Try Re-Syncing
             </button>
             <button onClick={() => dbService.auth.signOut()} className="w-full text-gray-400 font-black uppercase text-[10px] tracking-widest hover:text-red-500 transition-colors">
               Sign Out
             </button>
           </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const navLinks = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/tournaments', icon: Trophy, label: 'Tournaments' },
    { to: '/profile', icon: UserIcon, label: 'My Profile' },
  ];

  if (profile.role === 'superadmin') navLinks.push({ to: '/superadmin', icon: Shield, label: 'SuperAdmin' });

  return (
    <div className="flex min-h-screen bg-gray-50">
      <button className="lg:hidden fixed bottom-6 right-6 z-50 bg-green-600 text-white p-4 rounded-full shadow-lg" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
        {isSidebarOpen ? <X /> : <Menu />}
      </button>

      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transition-transform lg:translate-x-0 lg:static ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-gray-100 flex items-center gap-3">
            <div className="bg-green-600 p-2 rounded-lg"><Trophy className="w-6 h-6 text-white" /></div>
            <span className="text-xl font-bold text-gray-800 tracking-tight uppercase italic">ShuttleUp</span>
          </div>
          <nav className="flex-1 p-4 space-y-2">
            {navLinks.map((link) => (
              <Link key={link.to} to={link.to} onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-green-50 hover:text-green-600 transition-colors group">
                <link.icon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="font-bold text-sm tracking-tight uppercase italic">{link.label}</span>
              </Link>
            ))}
          </nav>
          <div className="p-4 border-t border-gray-100">
            <div className="bg-green-600 rounded-3xl p-5 mb-4 shadow-lg shadow-green-100 relative overflow-hidden group">
              <span className="text-[10px] font-black text-green-100 uppercase tracking-widest">Global Credits</span>
              <div className="text-3xl font-black text-white italic tracking-tighter">{profile.credits}</div>
            </div>
            <button onClick={() => dbService.auth.signOut()} className="flex items-center gap-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors font-bold uppercase italic text-sm">
              <LogOut className="w-5 h-5" />
              Exit Arena
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        <header className="sticky top-0 z-30 h-16 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-600 rounded-full border border-green-100 shadow-sm">
            <Cloud className="w-3 h-3" />
            <span className="text-[10px] font-black uppercase tracking-widest">Live Firebase Sync</span>
          </div>
          <div className="flex items-center gap-4">
             <div className="hidden sm:flex flex-col items-end leading-none">
                <span className="text-sm font-black text-gray-900 tracking-tighter italic uppercase">{profile.full_name}</span>
                <span className="text-[9px] text-green-600 font-bold uppercase tracking-widest mt-1">{profile.role}</span>
             </div>
             <div className="w-10 h-10 rounded-2xl bg-gray-900 flex items-center justify-center text-white font-black italic border-2 border-green-500 shadow-md">
                {profile.username?.charAt(0).toUpperCase() || 'U'}
             </div>
          </div>
        </header>
        <div className="p-6 overflow-y-auto">
          <Routes>
            <Route path="/" element={<DashboardPage profile={profile} />} />
            <Route path="/tournaments" element={<TournamentsPage profile={profile} />} />
            <Route path="/tournament/:id" element={<TournamentDetailPage profile={profile} />} />
            <Route path="/scoring/:matchId" element={<LiveScoringPage profile={profile} />} />
            <Route path="/profile" element={<ProfilePage profile={profile} />} />
            {profile.role === 'superadmin' && <Route path="/superadmin" element={<SuperAdminPage profile={profile} />} />}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => (
  <HashRouter>
    <AppContent />
  </HashRouter>
);

export default App;
