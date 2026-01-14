
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { Trophy, Users, Shield, LogOut, LayoutDashboard, CreditCard, PlayCircle, Menu, X, PlusCircle, TrendingUp, Settings, AlertTriangle, Database, ExternalLink } from 'lucide-react';
import { supabase } from './services/supabase';
import { Profile } from './types';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import TournamentsPage from './pages/TournamentsPage';
import TournamentDetailPage from './pages/TournamentDetailPage';
import SuperAdminPage from './pages/SuperAdminPage';
import LiveScoringPage from './pages/LiveScoringPage';
import ProfilePage from './pages/ProfilePage';

const AppContent: React.FC = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchSession();

    // Listen for cross-tab credit updates
    const handleSync = (e: MessageEvent) => {
      if (e.data.event === 'CREDIT_UPDATE' && profile && e.data.payload.id === profile.id) {
        setProfile(prev => prev ? { ...prev, credits: e.data.payload.credits } : null);
      }
    };
    const syncChannel = new BroadcastChannel('shuttleup_sync');
    syncChannel.addEventListener('message', handleSync);
    return () => syncChannel.removeEventListener('message', handleSync);
  }, [profile?.id]);

  const fetchSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setProfile(session.user);
      }
    } catch (e) {
      console.error("Session fetch failed", e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-court text-white">
        <div className="text-center">
          <Database className="w-16 h-16 mx-auto mb-4 animate-pulse text-green-300" />
          <h1 className="text-3xl font-black italic uppercase tracking-tighter">ShuttleUp</h1>
          <p className="mt-2 text-green-200 font-black italic uppercase tracking-widest text-xs">Connecting to CockroachDB Cluster...</p>
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
    { to: '/credits', icon: CreditCard, label: 'Credits' },
    { to: '/profile', icon: Settings, label: 'Profile' },
  ];

  if (profile.role === 'superadmin') {
    navLinks.push({ to: '/superadmin', icon: Shield, label: 'SuperAdmin' });
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar Mobile Toggle */}
      <button 
        className="lg:hidden fixed bottom-6 right-6 z-50 bg-green-600 text-white p-4 rounded-full shadow-lg"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        {isSidebarOpen ? <X /> : <Menu />}
      </button>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transition-transform lg:translate-x-0 lg:static
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-gray-100 flex items-center gap-3">
            <div className="bg-green-600 p-2 rounded-lg">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-800 tracking-tight uppercase italic">ShuttleUp</span>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-green-50 hover:text-green-600 transition-colors group"
                onClick={() => setIsSidebarOpen(false)}
              >
                <link.icon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="font-bold text-sm tracking-tight uppercase italic">{link.label}</span>
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t border-gray-100">
            <div className="bg-green-600 rounded-3xl p-5 mb-4 shadow-lg shadow-green-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:scale-125 transition-transform">
                <CreditCard className="w-12 h-12 text-white" />
              </div>
              <span className="text-[10px] font-black text-green-100 uppercase tracking-widest">Global Credits</span>
              <div className="text-3xl font-black text-white italic tracking-tighter">{profile.credits}</div>
            </div>

            <button 
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-bold text-sm uppercase italic">Exit Arena</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-16 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
             <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
             <h2 className="text-sm font-black italic uppercase tracking-tighter text-gray-400">Node: Local-Cluster-01</h2>
          </div>
          <div className="flex items-center gap-4">
             <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-black text-gray-900 tracking-tighter italic uppercase">{profile.full_name}</span>
                <span className="text-[9px] text-green-600 font-bold uppercase tracking-widest">{profile.role}</span>
             </div>
             <div className="w-10 h-10 rounded-2xl bg-gray-900 flex items-center justify-center text-white font-black italic border-2 border-green-500 shadow-md">
                {profile.username.charAt(0).toUpperCase()}
             </div>
          </div>
        </header>

        <div className="p-6">
          <Routes>
            <Route path="/" element={<DashboardPage profile={profile} />} />
            <Route path="/tournaments" element={<TournamentsPage profile={profile} />} />
            <Route path="/tournament/:id" element={<TournamentDetailPage profile={profile} />} />
            <Route path="/scoring/:matchId" element={<LiveScoringPage profile={profile} />} />
            <Route path="/credits" element={<ProfilePage profile={profile} />} />
            <Route path="/profile" element={<ProfilePage profile={profile} />} />
            {profile.role === 'superadmin' && (
              <Route path="/superadmin" element={<SuperAdminPage profile={profile} />} />
            )}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
};

export default App;
