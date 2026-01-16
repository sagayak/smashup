
import React, { useState, useEffect } from 'react';
import { User, UserRole } from './types';
import { store } from './services/mockStore';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Tournaments from './pages/Tournaments';
import Admin from './pages/Admin';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuth, setIsAuth] = useState(false);

  // Simple Auth simulation
  const handleLogin = (userId: string) => {
    const user = store.getUser(userId);
    if (user) {
      setCurrentUser(user);
      setIsAuth(true);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsAuth(false);
  };

  if (!isAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
               <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">SmashTourney Pro</h1>
            <p className="text-slate-400 mt-2 font-medium">Select a role to preview the application</p>
          </div>

          <div className="space-y-4">
            <LoginButton 
              label="Login as SuperAdmin" 
              onClick={() => handleLogin('1')} 
              icon="👑" 
              desc="Manage users, credits & site configuration" 
            />
            <LoginButton 
              label="Login as Organizer" 
              onClick={() => handleLogin('4')} 
              icon="📋" 
              desc="Create and manage badminton tournaments" 
            />
            <LoginButton 
              label="Login as Player (Viktor)" 
              onClick={() => handleLogin('2')} 
              icon="🏸" 
              desc="View matches, standings & earn credits" 
            />
          </div>

          <p className="text-center text-slate-300 text-xs mt-10">
            Production system would use Firebase Authentication.
          </p>
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
      {activeTab === 'tournaments' && currentUser && <Tournaments user={currentUser} />}
      {activeTab === 'admin' && currentUser && <Admin />}
      {activeTab === 'profile' && (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
          <div className="w-24 h-24 bg-slate-100 rounded-full mx-auto flex items-center justify-center text-4xl mb-4">👤</div>
          <h3 className="text-2xl font-bold text-slate-800">{currentUser?.name}</h3>
          <p className="text-slate-400 mb-6">@{currentUser?.username}</p>
          <div className="max-w-xs mx-auto space-y-3 text-left">
            <div className="flex justify-between border-b pb-2">
              <span className="text-slate-400 font-medium">Email</span>
              <span className="text-slate-700">{currentUser?.email}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-slate-400 font-medium">Role</span>
              <span className="text-indigo-600 font-bold uppercase text-xs pt-1">{currentUser?.role}</span>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

const LoginButton = ({ label, onClick, icon, desc }: any) => (
  <button 
    onClick={onClick}
    className="w-full flex items-center p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
  >
    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 transition-transform">{icon}</div>
    <div className="ml-4 text-left">
      <p className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{label}</p>
      <p className="text-xs text-slate-400 font-medium">{desc}</p>
    </div>
  </button>
);

export default App;
