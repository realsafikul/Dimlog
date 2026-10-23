import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  User, 
  Auth 
} from 'firebase/auth';
import { 
  X, 
  LogIn, 
  UserPlus, 
  LogOut, 
  ShieldCheck, 
  Key, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Database,
  Info
} from 'lucide-react';
import { getStoredApiKey, saveStoredApiKey, firebaseConfig } from '../firebase/config';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  auth: Auth | null;
  onApiKeySaved: (newKey: string) => void;
  onToast: (msg: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  auth,
  onApiKeySaved,
  onToast,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState(getStoredApiKey());
  const [showApiKeyConfig, setShowApiKeyConfig] = useState(!getStoredApiKey());
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    const key = apiKeyInput.trim();
    saveStoredApiKey(key);
    onApiKeySaved(key);
    setSuccessMsg('API Key saved successfully!');
    onToast('Firebase API Key configured ✓');
    setTimeout(() => {
      setSuccessMsg(null);
      if (key) setShowApiKeyConfig(false);
    }, 1500);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const activeApiKey = getStoredApiKey();
    if (!activeApiKey) {
      setErrorMsg('Please enter your Firebase Web API Key above first.');
      setShowApiKeyConfig(true);
      return;
    }

    if (!auth) {
      setErrorMsg('Firebase Auth is not ready. Please verify your Web API Key.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        onToast(`Signed in as ${email} ✓`);
        onClose();
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
        onToast(`Account created for ${email} ✓`);
        onClose();
      }
    } catch (err: any) {
      console.error('Firebase Auth error:', err);
      let message = err.message || 'Authentication failed. Please check credentials.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        message = 'Invalid email or password. Please try again.';
      } else if (err.code === 'auth/email-already-in-use') {
        message = 'This email is already registered. Please sign in instead.';
      } else if (err.code === 'auth/weak-password') {
        message = 'Password should be at least 6 characters.';
      } else if (err.code === 'auth/network-request-failed') {
        message = 'Network error. Please check your internet connection.';
      } else if (err.code === 'auth/api-key-not-valid' || err.code === 'auth/invalid-api-key') {
        message = 'The provided Firebase Web API Key is invalid.';
        setShowApiKeyConfig(true);
      }
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!auth) return;
    setLoading(true);
    try {
      await signOut(auth);
      onToast('Signed out of cloud account');
      onClose();
    } catch (err: any) {
      setErrorMsg('Failed to sign out: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade">
      <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-bold">
              {currentUser ? 'Cloud Account' : 'Authorized Staff Login'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cloud Project Info Badge */}
        <div className="mt-3 p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/50 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-indigo-900 dark:text-indigo-200">
              Firebase Project: <span className="font-mono font-bold">dimlog-d0f35</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Realtime DB
            </span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate font-mono">
            {firebaseConfig.databaseURL}
          </div>
        </div>

        {/* If Already Logged In */}
        {currentUser ? (
          <div className="mt-5 space-y-4">
            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-base">
                {currentUser.email ? currentUser.email.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                  Signed in as
                </div>
                <div className="text-sm font-bold truncate text-slate-900 dark:text-slate-100">
                  {currentUser.email}
                </div>
                <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                  UID: {currentUser.uid.slice(0, 12)}...
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Your device is actively synchronized with the cloud database. All recorded power cuts, notes, and restorations automatically persist in Realtime Database.
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl text-sm font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        ) : (
          /* Login / Register Form */
          <div className="mt-4 space-y-4">
            {/* API Key Configuration Section */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowApiKeyConfig(!showApiKeyConfig)}
                className="w-full px-3.5 py-2.5 bg-slate-100/80 dark:bg-slate-800/80 text-left text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Key className="w-3.5 h-3.5 text-amber-500" />
                  <span>
                    {getStoredApiKey() ? 'Firebase Web API Key (Configured ✓)' : 'Enter Firebase Web API Key'}
                  </span>
                </div>
                <span className="text-[10px] text-indigo-500 uppercase">
                  {showApiKeyConfig ? 'Hide' : 'Configure'}
                </span>
              </button>

              {showApiKeyConfig && (
                <div className="p-3 bg-white dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 text-xs">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">
                    Paste the <strong>Web API Key</strong> from your Firebase Console (Project Settings ➔ General ➔ Web API Key):
                  </p>
                  <form onSubmit={handleSaveApiKey} className="flex gap-2">
                    <input
                      type="text"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="AIzaSy..."
                      className="flex-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm"
                    >
                      Save Key
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Tab switch */}
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  mode === 'login'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  mode === 'register'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Register Staff
              </button>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 flex-none mt-0.5" />
                <span className="leading-snug">{errorMsg}</span>
              </div>
            )}

            {/* Success Message */}
            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-none mt-0.5" />
                <span className="leading-snug">{successMsg}</span>
              </div>
            )}

            {/* Login / Register Fields */}
            <form onSubmit={handleAuthSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@example.com"
                  required
                  className="w-full px-3 py-2 text-sm rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3 py-2 text-sm rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl text-sm font-bold bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-md shadow-indigo-500/25 hover:brightness-105 active:scale-98 transition flex items-center justify-center gap-2 mt-4"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : mode === 'login' ? (
                  <LogIn className="w-4 h-4" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                <span>{mode === 'login' ? 'Sign In to Cloud' : 'Register Account'}</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
