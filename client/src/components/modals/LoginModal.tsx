import React, { useState, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import {
  Shield,
  Mail,
  Key,
  LogIn,
  AlertCircle,
  X,
  Eye,
  EyeOff,
  Lock
} from 'lucide-react';

interface LoginModalProps {
  isStandalone?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isStandalone = false }) => {
  const {
    loginModalOpen,
    setLoginModalOpen,
    login,
    currentUser,
    isAuthenticated,
    theme
  } = useChat() as any;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Sync state whenever the login modal is opened
  useEffect(() => {
    if (loginModalOpen) {
      const savedEmail = localStorage.getItem('chat_saved_email') || currentUser?.email || '';
      setEmail(savedEmail);
      setPassword('');
      setError(null);
    }
  }, [loginModalOpen, currentUser]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (rememberEmail) {
        localStorage.setItem('chat_saved_email', cleanEmail);
      } else {
        localStorage.removeItem('chat_saved_email');
      }

      await login(cleanEmail, cleanPassword);
      setPassword('');
      setLoginModalOpen(false);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  if (!isStandalone && !loginModalOpen && isAuthenticated) return null;

  const isDark = theme === 'slate';

  return (
    <div
      onClick={(e) => {
        if (isAuthenticated && !isStandalone && e.target === e.currentTarget) {
          setLoginModalOpen(false);
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md ${
          isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900'
        } border rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all max-h-[92vh] cursor-default`}
      >
        {/* Header */}
        <div
          className={`p-5 border-b ${
            isDark ? 'border-zinc-800 bg-zinc-950/60' : 'border-slate-100 bg-slate-50/80'
          } flex items-center justify-between`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-500 font-bold">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base tracking-tight">Personalize Chat</h2>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-blue-500/10 text-blue-500 font-medium border border-blue-500/20">
                  Enterprise Auth
                </span>
              </div>
              <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                Internal Company Communication System
              </p>
            </div>
          </div>

          {isAuthenticated && !isStandalone && (
            <button
              type="button"
              onClick={() => setLoginModalOpen(false)}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                isDark
                  ? 'text-zinc-400 hover:text-white hover:bg-zinc-800 active:bg-zinc-700'
                  : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200'
              }`}
              title="Close modal"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Form Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSignIn} className="space-y-4 text-xs">
            <div>
              <label className={`block mb-1.5 font-medium ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                Corporate Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.internal"
                  required
                  autoComplete="email"
                  className={`w-full h-9 pl-9 pr-3 rounded-lg border text-xs focus:outline-hidden transition-colors ${
                    isDark
                      ? 'bg-zinc-950 border-zinc-700 text-white focus:border-blue-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500'
                  }`}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={`block font-medium ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                  Account Password
                </label>
              </div>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your account password"
                  required
                  autoComplete="current-password"
                  className={`w-full h-9 pl-9 pr-10 rounded-lg border text-xs font-mono focus:outline-hidden transition-colors ${
                    isDark
                      ? 'bg-zinc-950 border-zinc-700 text-white focus:border-blue-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberEmail}
                  onChange={(e) => setRememberEmail(e.target.checked)}
                  className="rounded border-zinc-700 text-blue-600 focus:ring-blue-500"
                />
                <span className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                  Remember email on this device
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition flex items-center justify-center gap-2 shadow-xs cursor-pointer mt-2 disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              <span>{loading ? 'Authenticating...' : 'Sign In to Workspace'}</span>
            </button>
          </form>

          <div className="pt-3 border-t border-slate-800/40 flex items-center justify-between text-[11px]">
            <p className={`flex items-center gap-1.5 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
              <Lock className="w-3 h-3 text-emerald-500" />
              <span>Encrypted Session • Self-Hosted Gateway</span>
            </p>
            {isAuthenticated && !isStandalone && (
              <button
                type="button"
                onClick={() => setLoginModalOpen(false)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                  isDark
                    ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
