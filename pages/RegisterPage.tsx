
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { dbService } from '../services/firebase';
import { Trophy, User, Lock, CheckCircle2, WifiOff, Cloud } from 'lucide-react';
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

    try {
      await dbService.auth.signUp(
        formData.username,
        formData.fullName,
        formData.role,
        formData.password
      );
      alert("Success! Your profile is registered on the global Firestore cluster.");
      navigate('/login');
    } catch (err: any) {
      setError(err.message || "Registration failed. The cloud node is blocked.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-court flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-white rounded-[3.5rem] shadow-2xl overflow-hidden grid md:grid-cols-2 border border-green-100">
        <div className="bg-green-600 p-12 text-white flex flex-col justify-center relative">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Trophy className="w-64 h-64 -mr-16 -mt-16" />
          </div>
          <h2 className="text-5xl font-black italic uppercase tracking-tighter mb-4 leading-none">The Court<br/>Is Ready.</h2>
          <p className="text-green-100 text-lg mb-8 opacity-90 font-medium">ShuttleUp: Powered by Cloud Firestore.</p>
          <div className="space-y-4">
            {['Global Data Sync', 'NoSQL Performance', 'Instant Updates'].map(f => (
              <div key={f} className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-300" />
                <span className="font-black italic uppercase tracking-tighter text-sm">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-12 overflow-y-auto max-h-[90vh]">
          <div className="mb-10">
            <h1 className="text-4xl font-black text-gray-900 tracking-tight italic uppercase">Create Profile</h1>
            <p className="text-gray-500 mt-1 font-medium text-sm">Synchronizing with Firebase Cluster.</p>
          </div>

          {error && (
            <div className="mb-8 p-6 bg-red-50 border-2 border-red-200 rounded-[2rem] flex flex-col gap-2 animate-in slide-in-from-top-2 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="bg-red-500 p-2 rounded-xl">
                  <WifiOff className="w-5 h-5 text-white" />
                </div>
                <div className="text-sm text-red-700 leading-relaxed flex-1">
                  <p className="font-black mb-1 uppercase tracking-wider text-xs italic">Sync Error</p>
                  <p className="font-bold text-[11px] leading-tight">{error}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-6">
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Unique Username</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className="w-full pl-12 pr-4 py-5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-green-500/10 focus:bg-white transition-all outline-none font-bold"
                  placeholder="e.g. smashmaster"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                  className="w-full px-5 py-5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-green-500/10 focus:bg-white transition-all outline-none font-bold"
                  placeholder="John Smith"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value as UserRole})}
                  className="w-full px-5 py-5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-green-500/10 focus:bg-white transition-all outline-none font-bold cursor-pointer"
                >
                  <option value="player">Player</option>
                  <option value="admin">Organizer</option>
                  <option value="superadmin">SuperAdmin</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Secure Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full pl-12 pr-4 py-5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-green-500/10 focus:bg-white transition-all outline-none font-bold"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 hover:bg-black text-white font-black italic uppercase tracking-tighter text-2xl py-6 rounded-[2rem] shadow-2xl transition-all active:scale-95 disabled:opacity-50 mt-6"
            >
              {loading ? "Initializing..." : "Register Profile"}
            </button>
          </form>

          <div className="mt-10 text-center">
            <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
              Already an athlete?{' '}
              <Link to="/login" className="text-green-600 font-black hover:underline underline-offset-4">
                Login here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
