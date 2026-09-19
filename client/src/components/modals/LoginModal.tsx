import React, { useState, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import {
  Mail,
  Key,
  LogIn,
  AlertCircle,
  X,
  Eye,
  EyeOff
} from 'lucide-react';
import { getServerBaseUrl } from '../../services/api';

interface LoginModalProps {
  isStandalone?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isStandalone = false }) => {
  const {
    loginModalOpen,
    setLoginModalOpen,
    login,
    currentUser,
    isAuthenticated
  } = useChat() as any;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const hasInitializedRef = React.useRef(false);

  // Sync state only once when the login modal opens, preventing background presence re-renders from overwriting typed input
  useEffect(() => {
    if (loginModalOpen || isStandalone) {
      if (!hasInitializedRef.current) {
        const savedEmail = localStorage.getItem('chat_saved_email') || currentUser?.email || '';
        setEmail(savedEmail);
        setPassword('');
        setError(null);
        hasInitializedRef.current = true;
      }
    } else {
      hasInitializedRef.current = false;
    }
  }, [loginModalOpen, isStandalone]);

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
      const errMsg = err.message || 'Authentication failed. Please verify your credentials.';
      if (errMsg.toLowerCase().includes('failed to fetch') || errMsg.toLowerCase().includes('networkerror')) {
        setError(`Unable to connect to server at ${getServerBaseUrl() || 'http://localhost:8000'}. Check network connection.`);
      } else {
        setError(errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isStandalone && !loginModalOpen && isAuthenticated) return null;

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
        className="w-full max-w-md bg-surface border border-subtle text-primary rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all max-h-[92vh] cursor-default"
      >
        {/* Header */}
        <div className="p-5 border-b border-subtle bg-surface flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/company-logo.jpeg"
              alt="C4S-connector Logo"
              className="w-10 h-10 rounded-xl object-cover border border-subtle shadow-xs shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base tracking-tight text-primary">C4S-connector</h2>
                <span className="text-xs px-1.5 py-0.5 rounded font-mono bg-surface-hover text-secondary font-medium border border-subtle">
                  Enterprise
                </span>
              </div>
              <p className="text-xs text-secondary mt-0.5">
                Internal Communication System
              </p>
            </div>
          </div>

          {isAuthenticated && !isStandalone && (
            <button
              type="button"
              onClick={() => setLoginModalOpen(false)}
              className="p-2 rounded-lg transition-colors cursor-pointer text-secondary hover:text-primary hover:bg-surface-hover"
              title="Close modal"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Form Content */}
        <div className="p-6 overflow-y-auto space-y-4 bg-surface text-primary">
          {error && (
            <div className="p-3 rounded-lg bg-surface-hover border border-subtle text-danger text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSignIn} className="space-y-4 text-xs">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block font-medium text-secondary">
                  Corporate Email Address
                </label>
                {email && (
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('');
                      localStorage.removeItem('chat_saved_email');
                    }}
                    className="text-xs text-accent hover:underline cursor-pointer transition-colors"
                  >
                    Clear / Switch account
                  </button>
                )}
              </div>
              <div className="relative">
                <Mail className="w-4 h-4 text-muted absolute left-3 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.internal"
                  required
                  autoComplete="email"
                  className="w-full h-10 pl-9 pr-3 rounded-lg border border-subtle bg-canvas text-primary text-xs focus:outline-none focus:border-accent transition-colors placeholder:text-muted"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block font-medium text-secondary">
                  Account Password
                </label>
              </div>
              <div className="relative">
                <Key className="w-4 h-4 text-muted absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your account password"
                  required
                  autoComplete="current-password"
                  className="w-full h-10 pl-9 pr-10 rounded-lg border border-subtle bg-canvas text-primary text-xs font-mono focus:outline-none focus:border-accent transition-colors placeholder:text-muted"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-muted hover:text-primary cursor-pointer transition-colors"
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
                  className="rounded border-subtle text-accent focus:ring-accent accent-accent"
                />
                <span className="text-xs text-secondary">
                  Remember email on this device
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 active:scale-[0.98] text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg cursor-pointer mt-3 disabled:opacity-50 tracking-wide"
            >
              <LogIn className="w-4 h-4 text-white" />
              <span className="text-white">{loading ? 'Authenticating...' : 'Sign In to Workspace'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
