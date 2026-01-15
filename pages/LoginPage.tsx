
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { dbService } from '../services/supabase';
import { Trophy, Lock, Mail, ShieldCheck, AlertTriangle } from 'lucide-react';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
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
      const profile = await dbService.auth.signIn(email, password);

      // SuperAdmin Check
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

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      await dbService.auth.signInWithGoogle();
      // Redirect happens automatically
    } catch (err: any) {
      setError(err.message || "Google Login failed.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-green-600/10 blur-[120px] rounded-full -mr-48 -mt-48" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full -ml-48 -mb-48" />

      <div className="max-w-md w-full bg-white rounded-[3.5rem] shadow-2xl overflow-hidden border border-gray-800 relative z-10">
        <div className="p-10">
          <div className="flex flex-col items-center mb-8 text-center">
            <div className="bg-green-600 p-5 rounded-[2rem] mb-5 shadow-xl shadow-green-100/20">
              <Trophy className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-4xl font-black text-gray-900 italic uppercase tracking-tighter leading-tight">ShuttleUp Login</h1>
          </div>

          {error && (
            <div className="mb-6 p-5 bg-red-50 border-2 border-red-200 rounded-[2rem] flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <p className="text-[11px] font-bold text-red-700 leading-tight">{error}</p>
              </div>
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-100 py-4 rounded-2xl mb-6 hover:bg-gray-50 transition-all active:scale-95 disabled:opacity-50"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
            <span className="font-black italic uppercase tracking-tighter text-gray-700 text-sm">Continue with Google</span>
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-4 text-gray-400 font-bold tracking-widest">or use email</span></div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Real Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-green-500/10 outline-none font-bold"
                  placeholder="pro@shuttleup.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-green-500/10 outline-none font-bold"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {showPin && (
              <div className="animate-in slide-in-from-top-4">
                <label className="block text-[10px] font-black text-green-600 uppercase tracking-widest mb-2 ml-1">Super PIN</label>
                <input
                  type="password"
                  required
                  maxLength={5}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full py-4 bg-green-50 border border-green-200 rounded-2xl text-center text-2xl font-black tracking-[0.5em] text-green-700"
                  placeholder="•••••"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 hover:bg-black text-white font-black italic uppercase tracking-tighter text-xl py-5 rounded-[2rem] shadow-2xl transition-all active:scale-95 disabled:opacity-50 mt-2"
            >
              {loading ? "Syncing..." : "Sign In"}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-gray-50 text-center">
            <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest leading-loose">
              Need a new profile?{' '}
              <Link to="/register" className="text-green-600 font-black hover:underline underline-offset-4">
                Create Account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
