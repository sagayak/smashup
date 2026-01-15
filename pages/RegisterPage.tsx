
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { dbService } from '../services/supabase';
import { Trophy, Mail, User, Lock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { UserRole } from '../types';

const RegisterPage: React.FC = () => {
  const [formData, setFormData] = useState({
    email: '',
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
        formData.email,
        formData.username,
        formData.fullName,
        formData.role,
        formData.password
      );
      // Inform user to check email if verification is on, or just log in
      alert("Registration initiated! Please check your email for verification (if enabled) and then log in.");
      navigate('/login');
    } catch (err: any) {
      setError(err.message || "Registration failed. Username or email might be taken.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      await dbService.auth.signInWithGoogle();
    } catch (err: any) {
      setError(err.message);
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
          <h2 className="text-5xl font-black italic uppercase tracking-tighter mb-4 leading-none text-white">Join the<br/>Arena.</h2>
          <div className="space-y-4 mt-6">
            {['Global Rankings', 'Live Tournament Sync', 'Atomic Credit System'].map(f => (
              <div key={f} className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-300" />
                <span className="font-black italic uppercase tracking-tighter text-xs">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-12 overflow-y-auto max-h-[90vh]">
          <div className="mb-8">
             <h3 className="text-2xl font-black italic uppercase tracking-tighter text-gray-900">Create Profile</h3>
             <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mt-1">Real emails required for Google sync.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <p className="text-[10px] font-bold text-red-700">{error}</p>
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-100 py-4 rounded-2xl mb-6 hover:bg-gray-50 transition-all active:scale-95 shadow-sm"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
            <span className="font-black italic uppercase tracking-tighter text-gray-700">Continue with Google</span>
          </button>

          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-4 text-gray-300 font-bold tracking-widest">or manual setup</span></div>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Real Email Address</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold"
                placeholder="athlete@shuttleup.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Unique Username</label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold"
                  placeholder="smash_king"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Role Type</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value as UserRole})}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold"
                >
                  <option value="player">Player</option>
                  <option value="admin">Organizer</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Full Display Name</label>
              <input
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Secure Password</label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 hover:bg-black text-white font-black italic uppercase tracking-tighter text-xl py-5 rounded-[2rem] shadow-2xl transition-all active:scale-95 disabled:opacity-50 mt-4"
            >
              {loading ? "Allocating..." : "Register Profile"}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
              Already an athlete?{' '}
              <Link to="/login" className="text-green-600 font-black hover:underline underline-offset-4">
                Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
