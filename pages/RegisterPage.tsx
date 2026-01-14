
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase, mapUsernameToEmail } from '../services/supabase';
import { Trophy, User, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { UserRole } from '../types';

const RegisterPage: React.FC = () => {
  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    password: '',
    role: 'player' as UserRole,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const username = formData.username.toLowerCase().trim();
    if (username.length < 3) {
      setError("Username must be at least 3 characters");
      setLoading(false);
      return;
    }

    try {
      const emailShim = mapUsernameToEmail(username);
      
      const { data, error: authError } = await supabase.auth.signUp({
        email: emailShim,
        password: formData.password,
        options: {
          data: {
            username: username,
            full_name: formData.fullName,
            role: formData.role,
          }
        }
      });

      if (authError) {
        if (authError.message.includes("invalid email")) {
          throw new Error(`The identifier "${emailShim}" was rejected. Please go to your Supabase Dashboard > Auth > Settings and DISABLE "Confirm Email".`);
        }
        throw authError;
      }

      if (data.user) {
        alert("Registration successful! Sign in with your username.");
        navigate('/login');
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong. Check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-court flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-white rounded-[3rem] shadow-2xl overflow-hidden grid md:grid-cols-2 border border-green-100">
        <div className="bg-green-600 p-12 text-white flex flex-col justify-center relative">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Trophy className="w-64 h-64 -mr-16 -mt-16" />
          </div>
          <h2 className="text-5xl font-black italic uppercase tracking-tighter mb-4 leading-none">Join the<br/>Elite.</h2>
          <p className="text-green-100 text-lg mb-8 opacity-90">ShuttleUp: Tournament management redefined for winners.</p>
          <div className="space-y-4">
            {['Direct Username Login', 'Live Real-time Scoring', 'Internal Credits System'].map(f => (
              <div key={f} className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-300" />
                <span className="font-bold tracking-tight">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-12">
          <div className="mb-10">
            <h1 className="text-3xl font-black text-gray-900 tracking-tight italic uppercase">Create Profile</h1>
            <p className="text-gray-500 mt-1 font-medium text-sm">No email verification required.</p>
          </div>

          {error && (
            <div className="mb-8 p-5 bg-red-50 border-2 border-red-100 rounded-2xl flex items-start gap-4 animate-in slide-in-from-top-2">
              <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
              <div className="text-sm text-red-700 leading-relaxed">
                <p className="font-bold mb-1">Authorization Blocked</p>
                <p>{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-5">
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Unique Username</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-green-500 transition-all outline-none font-bold"
                  placeholder="e.g. sagayak"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-green-500 outline-none font-bold"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Account Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value as UserRole})}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-green-500 outline-none font-bold appearance-none cursor-pointer"
                >
                  <option value="player">Player</option>
                  <option value="admin">Organizer</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Secure Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-green-500 transition-all outline-none font-bold"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 hover:bg-black text-white font-black italic uppercase tracking-tighter text-xl py-5 rounded-[2rem] shadow-xl transition-all active:scale-95 disabled:opacity-50 mt-4"
            >
              {loading ? "Registering..." : "Ready for Court"}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-gray-500 font-medium">
              Member already?{' '}
              <Link to="/login" className="text-green-600 font-black hover:underline underline-offset-4">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
