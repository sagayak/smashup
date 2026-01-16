import React, { useState, useEffect } from 'react';
import { User, UserRole, Tournament } from './types';
import { store } from './services/mockStore';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Tournaments from './pages/Tournaments';
import Admin from './pages/Admin';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuth, setIsAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [loading, setLoading] = useState(false);
  const [pendingJoinId, setPendingJoinId] = useState<string | null>(null);
  const [invitedTournament, setInvitedTournament] = useState<Tournament | null>(null);
  
  // Auth Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.PLAYER);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Handle Join Link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get('join');
    if (joinId) {
      setPendingJoinId(joinId);
      store.searchTournamentById(joinId).then(t => {
        if (t) setInvitedTournament(t);
      });
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await store.login(username, password);
      if (user) {
        setCurrentUser(user);
        setIsAuth(true);
        if (pendingJoinId) {
          setActiveTab('tournaments');
        }
      } else {
        setError('User profile not found.');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const newUser = await store.signup({
        username,
        password,
        name,
        email: `${username}@smashpro.local`,
        role
      });
      if (newUser) {
        // Automatically login after signup if invited
        const user = await store.login(username, password);
        if (user) {
          setCurrentUser(user);
          setIsAuth(true);
          if (pendingJoinId) {
            setActiveTab('tournaments');
          }
        } else {
          setAuthMode('login');
          setSuccess('Signup successful! Please login.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Signup failed. Username might be taken.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await store.requestReset(username);
      if (result) {
        setSuccess('Reset request sent to admin!');
        setAuthMode('login');
      } else {
        setError('Username not found');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await store.logout();
    setCurrentUser(null);
    setIsAuth(false);
    setUsername('');
    setPassword('');
    // Clear invite if logging out
    setPendingJoinId(null);
    setInvitedTournament(null);
  };

  if (!isAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-[2rem] p-10 shadow-2xl animate-in zoom-in duration-300 relative overflow-hidden">
          {invitedTournament && (
            <div className="absolute top-0 left-0 right-0 bg-indigo-600 p-4 text-center">
               <p className="text-white text-[10px] font-black uppercase tracking-widest leading-none">
                 You've been invited to join
               </p>
               <h4 className="text-white font-black text-sm uppercase italic tracking-tighter mt-1">{invitedTournament.name}</h4>
            </div>
          )}
          
          <div className={`text-center mb-8 ${invitedTournament ? 'mt-12' : ''}`}>
            <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-200 rotate-3">
               <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h1 className="text-4xl font-black text-slate-800 tracking-tighter">SmashPro</h1>
            <p className="text-slate-400 mt-2 font-medium">Cloud Database Connected</p>
          </div>

          {error && <div className="mb-4 p-3 bg-rose-50 text-rose-500 text-sm font-bold rounded-xl text-center border border-rose-100">{error}</div>}
          {success && <div className="mb-4 p-3 bg-emerald-50 text-emerald-600 text-sm font-bold rounded-xl text-center border border-emerald-100">{success}</div>}

          {authMode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <Input label="Username" value={username} onChange={setUsername} placeholder="your_username" disabled={loading} />
              <Input label="Password" value={password} onChange={setPassword} placeholder="••••••••" type="password" disabled={loading} />
              <button disabled={loading} type="submit" className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50">
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>
              <div className="flex justify-between text-xs font-bold uppercase tracking-widest pt-2">
                <button type="button" onClick={() => setAuthMode('signup')} className="text-indigo-500 hover:text-indigo-700">Create Account</button>
                <button type="button" onClick={() => setAuthMode('reset')} className="text-slate-400 hover:text-slate-600">Forgot Password?</button>
              </div>
            </form>
          )}

          {authMode === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-4">
              <Input label="Full Name" value={name} onChange={setName} placeholder="John Doe" disabled={loading} />
              <Input label="Username" value={username} onChange={setUsername} placeholder="johndoe123" disabled={loading} />
              <Input label="Password" value={password} onChange={setPassword} placeholder="••••••••" type="password" disabled={loading} />
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Role</label>
                <select 
                  className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none font-bold"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  disabled={loading}
                >
                  <option value={UserRole.PLAYER}>Player</option>
                  <option value={UserRole.ORGANIZER}>Organizer</option>
                </select>
              </div>
              <button disabled={loading} type="submit" className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50">
                {loading ? 'Creating Account...' : 'Sign Up'}
              </button>
              <button type="button" onClick={() => setAuthMode('login')} className="w-full text-xs font-black text-slate-400 uppercase tracking-widest py-2">Back to Login</button>
            </form>
          )}

          {authMode === 'reset' && (
            <form onSubmit={handleResetRequest} className="space-y-4">
              <p className="text-slate-500 text-sm mb-4 text-center">Enter your username and we'll notify the developer to reset your password.</p>
              <Input label="Username" value={username} onChange={setUsername} placeholder="your_username" disabled={loading} />
              <button disabled={loading} type="submit" className="w-full bg-slate-800 text-white font-black py-4 rounded-2xl hover:bg-slate-900 transition-all shadow-lg">
                {loading ? 'Sending...' : 'Request Reset'}
              </button>
              <button type="button" onClick={() => setAuthMode('login')} className="w-full text-xs font-black text-slate-400 uppercase tracking-widest py-2">Back to Login</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <Layout 
      user={currentUser} 
      onLogout={handleLogout} 
      activeTab={activeTab} 
      setActiveTab={setActiveTab}
    >
      {activeTab === 'dashboard' && currentUser && <Dashboard user={currentUser} />}
      {activeTab === 'tournaments' && currentUser && <Tournaments user={currentUser} initialJoinId={pendingJoinId} />}
      {activeTab === 'admin' && currentUser && <Admin user={currentUser} />}
      {activeTab === 'profile' && (
        <div className="bg-white p-12 rounded-[2rem] shadow-sm border border-slate-100 text-center animate-in fade-in slide-in-from-bottom duration-500">
          <div className="w-32 h-32 bg-slate-50 rounded-full mx-auto flex items-center justify-center text-6xl mb-6 shadow-inner">👤</div>
          <h3 className="text-3xl font-black text-slate-800 tracking-tight">{currentUser?.name}</h3>
          <p className="text-slate-400 font-bold mb-8">@{currentUser?.username}</p>
          <div className="max-w-xs mx-auto space-y-4 text-left">
            <ProfileRow label="Role" value={currentUser?.role || ''} isHighlight />
            <ProfileRow label="Member Since" value="July 2024" />
            <ProfileRow label="Tournament Status" value="Active" />
          </div>
        </div>
      )}
    </Layout>
  );
};

const Input = ({ label, value, onChange, placeholder, type = "text", disabled = false }: any) => (
  <div className="space-y-1">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
    <input 
      type={type} 
      placeholder={placeholder} 
      disabled={disabled}
      className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:bg-white outline-none font-bold transition-all disabled:opacity-50"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required
    />
  </div>
);

const ProfileRow = ({ label, value, isHighlight = false }: any) => (
  <div className="flex justify-between items-center py-3 border-b border-slate-50">
    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{label}</span>
    <span className={`font-bold ${isHighlight ? 'text-indigo-600 uppercase text-xs' : 'text-slate-700'}`}>{value}</span>
  </div>
);

export default App;