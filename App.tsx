
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { Trophy, Users, Shield, LogOut, LayoutDashboard, CreditCard, PlayCircle, Menu, X, PlusCircle, TrendingUp, Settings, AlertTriangle } from 'lucide-react';
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
    if (!supabase) {
      setLoading(false);
      return;
    }

    fetchSession();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchSession = async () => {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await fetchProfile(session.user.id);
    } else {
      setLoading(false);
    }
  };

  const fetchProfile = async (userId: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error) {
      setProfile(data);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    if (supabase) await supabase.auth.signOut();
    navigate('/login');
  };

  if (!supabase) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-6">
        <div className="max-w-md w-full bg-gray-800 p-8 rounded-3xl border border-red-500 shadow-2xl text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-6" />
          <h1 className="text-2xl font-black italic uppercase tracking-tighter mb-4">Connection Failed</h1>
          <p className="text-gray-400 mb-6">
            ShuttleUp cannot connect to the backend. Please check your Supabase environment variables (<code className="text-red-400">SUPABASE_URL</code> and <code className="text-red-400">SUPABASE_ANON_KEY</code>).
          </p>
          <div className="bg-black/50 p-4 rounded-xl text-xs font-mono text-left overflow-auto">
            1. Go to Supabase Project Settings<br/>
            2. Find API Keys<br/>
            3. Add to Environment Variables
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-court text-white">
        <div className="text-center">
          <Trophy className="w-16 h-16 mx-auto mb-4 animate-bounce" />
          <h1 className="text-2xl font-bold">ShuttleUp</h1>
          <p className="mt-2 text-green-200">Preparing the court...</p>
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
            <span className="text-xl font-bold text-gray-800 tracking-tight">ShuttleUp</span>
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
                <span className="font-medium">{link.label}</span>
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t border-gray-100">
            <div className="bg-green-50 rounded-2xl p-4 mb-4">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-green-700 uppercase">Credits</span>
                <CreditCard className="w-4 h-4 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-green-900">{profile.credits}</div>
            </div>

            <button 
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-16 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-6">
          <h2 className="text-lg font-semibold text-gray-700">Welcome, {profile.full_name}</h2>
          <div className="flex items-center gap-4">
             <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-medium text-gray-900">{profile.username}</span>
                <span className="text-xs text-gray-500 capitalize">{profile.role}</span>
             </div>
             <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold border-2 border-green-500">
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
