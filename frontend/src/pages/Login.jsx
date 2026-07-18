import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { ShieldAlert, KeyRound, User, AlertCircle, RefreshCw, Lock } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      navigate('/admin/dashboard');
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiService.login(username, password);
      if (response.status === 'success') {
        localStorage.setItem('admin_token', response.token);
        localStorage.setItem('admin_user', JSON.stringify(response.user));
        navigate('/admin/dashboard');
      } else {
        setError(response.message || 'Authentication failed.');
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Check server status.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[75vh] items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-lg border border-slate-300 bg-white shadow-sm overflow-hidden">
        {/* Portal Header Accent Band */}
        <div className="bg-[#1e293b] p-4 text-slate-100 flex items-center gap-3 border-b border-slate-700">
          <div className="rounded bg-[#1E40AF] p-2 text-white shrink-0">
            <Lock size={18} />
          </div>
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider">Secure Officer Gateway</h3>
            <p className="text-[10px] text-slate-400">Department Administration Panel</p>
          </div>
        </div>

        <div className="p-6">
          <div className="text-center mb-6">
            <h2 className="text-lg font-extrabold text-slate-900">Sign In to Dashboard</h2>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              This system is restricted to authorized municipal officers and department administrators. System activity is logged.
            </p>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded border border-rose-300 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username-login" className="mb-1.5 block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Officer Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  id="username-login"
                  type="text"
                  placeholder="Enter employee username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  className="w-full rounded border border-slate-300 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-[#1E40AF] focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password-login" className="mb-1.5 block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Security Password
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  id="password-login"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="w-full rounded border border-slate-300 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-[#1E40AF] focus:bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded bg-[#1E40AF] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#16327e] disabled:opacity-50 tracking-wider uppercase mt-2 shadow-sm"
            >
              {loading ? <RefreshCw size={14} className="animate-spin" /> : 'Request Console Access'}
            </button>
          </form>

          {/* Compliance notice & demo credentials */}
          <div className="mt-6 border-t border-slate-200 pt-4 space-y-3.5">
            <div className="rounded border border-slate-200 bg-slate-50 p-3.5 text-[10px] text-slate-600 leading-normal">
              <span className="block font-bold text-slate-700 mb-1">Project Demo Credentials:</span>
              <div>Username: <strong className="font-mono text-slate-900">admin</strong></div>
              <div>Password: <strong className="font-mono text-slate-900">admin123</strong></div>
            </div>
            
            <div className="flex items-start gap-1.5 text-[9px] text-slate-400 leading-normal">
              <ShieldAlert size={12} className="shrink-0 mt-0.5" />
              <span>Warning: Unauthorized access attempts are monitored under the Computer Misuse and Cyber Security Regulations.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
