
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { dbService } from '../services/firebase';
import { Trophy, User, Lock, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
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
      navigate('/');
    } catch (err: any) {
      setError(err.message || "Registration failed. Username might be taken.");
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
            {['Global Rankings', 'Live Arena Sync', 'Simulated Credits'].map(f => (
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
             <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mt-1">No email required. Remember your credentials.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <p className="text-[10px] font-bold text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Unique Username</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value.toLowerCase().replace(/\s/g, '')})}
                  className="w-full pl-11 pr-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold"
                  placeholder="smash_pro"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
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
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Secure Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full pl-11 pr-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 hover:bg-black text-white font-black italic uppercase tracking-tighter text-xl py-5 rounded-[2rem] shadow-2xl transition-all active:scale-95 disabled:opacity-50 mt-4"
            >
              {loading ? "Allocating Node..." : "Initialize Profile"}
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
