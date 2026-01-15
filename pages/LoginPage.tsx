
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { dbService } from '../services/supabase';
import { Trophy, Lock, User, ShieldCheck, Database, WifiOff } from 'lucide-react';

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const profile = await dbService.auth.signIn(username, password);

      if (profile.role === 'superadmin' && !showPin) {
        setShowPin(true);
        setLoading(false);
        return;
      }

      if (profile.role === 'superadmin' && pin !== '31218') {
        throw new Error("ACCESS DENIED: Invalid Super PIN.");
      }

      navigate('/');
    } catch (err: any) {
      setError(err.message || "Authentication failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-green-600/10 blur-[120px] rounded-full -mr-48 -mt-48" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full -ml-48 -mb-48" />

      <div className="max-w-md w-full bg-white rounded-[3.5rem] shadow-2xl overflow-hidden border border-gray-800 relative z-10">
        <div className="p-10">
          <div className="flex flex-col items-center mb-10 text-center">
            <div className="bg-green-600 p-5 rounded-[2rem] mb-5 shadow-xl shadow-green-100/20">
              <Trophy className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-4xl font-black text-gray-900 italic uppercase tracking-tighter text-center w-full leading-tight">Enter Arena</h1>
            <p className="text-gray-400 mt-2 font-medium flex items-center gap-2">
              <Database className="w-4 h-4" /> Postgres SQL Cluster
            </p>
          </div>

          {error && (
            <div className="mb-8 p-6 bg-red-50 border-2 border-red-200 rounded-[2.5rem] flex flex-col gap-4 animate-in shake duration-300">
              <div className="flex items-start gap-4">
                <div className="bg-red-500 p-2 rounded-xl mt-1">
                  <WifiOff className="w-5 h-5 text-white" />
                </div>
                <div className="text-[10px] text-red-700 leading-relaxed flex-1">
                  <p className="font-black mb-1 uppercase tracking-wider italic">Access Blocked</p>
                  <p className="font-bold leading-tight mb-2">{error}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Username</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-12 pr-4 py-5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-green-500/10 focus:bg-white transition-all outline-none font-bold"
                  placeholder="Your username"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-green-500/10 focus:bg-white transition-all outline-none font-bold"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {showPin && (
              <div className="animate-in slide-in-from-top-4">
                <label className="block text-[10px] font-black text-green-600 uppercase tracking-[0.2em] mb-3 ml-1 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  SuperAdmin PIN Required
                </label>
                <input
                  type="password"
                  required
                  maxLength={5}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full px-4 py-5 bg-green-50 border border-green-200 rounded-2xl focus:ring-4 focus:ring-green-500/10 outline-none text-center text-3xl font-black tracking-[0.8em] text-green-700"
                  placeholder="•••••"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 hover:bg-black text-white font-black italic uppercase tracking-tighter text-2xl py-6 rounded-[2rem] shadow-2xl transition-all active:scale-95 disabled:opacity-50 mt-4"
            >
              {loading ? "Verifying Node..." : "Sign In"}
            </button>
          </form>

          <div className="mt-10 pt-10 border-t border-gray-50 text-center">
            <p className="text-gray-400 font-bold text-[11px] uppercase tracking-widest">
              No account in cluster?{' '}
              <Link to="/register" className="text-green-600 font-black hover:underline underline-offset-4">
                Register Now
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
