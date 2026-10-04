import React, { useState } from 'react';
import { ShieldCheck, User, Lock, Eye, EyeOff, X, Sparkles, LogIn, UserPlus } from 'lucide-react';
import { registerRacer, loginRacer, ActiveRacerSession, UserGarageData } from '../services/firebase';
import { soundSynth } from '../game/audio';

interface RacerAuthModalProps {
  initialMode?: 'login' | 'register';
  onSuccess: (session: ActiveRacerSession, garage: UserGarageData) => void;
  onClose: () => void;
}

export const RacerAuthModal: React.FC<RacerAuthModalProps> = ({
  initialMode = 'login',
  onSuccess,
  onClose,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [racerName, setRacerName] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = racerName.trim();
    if (!cleanName) {
      setErrorMsg('Please enter your Racer Name / Call-sign.');
      soundSynth.playBump(0.4);
      return;
    }

    if (!password) {
      setErrorMsg('Please enter your Password.');
      soundSynth.playBump(0.4);
      return;
    }

    if (mode === 'register') {
      if (password.length < 3) {
        setErrorMsg('Password must be at least 3 characters.');
        soundSynth.playBump(0.4);
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match. Please verify.');
        soundSynth.playBump(0.4);
        return;
      }
    }

    setIsLoading(true);

    try {
      if (mode === 'register') {
        const res = await registerRacer(cleanName, password);
        if (res.success && res.session && res.garage) {
          soundSynth.playVictoryFanfare();
          onSuccess(res.session, res.garage);
          onClose();
        } else {
          setErrorMsg(res.error || 'Registration failed.');
          soundSynth.playBump(0.5);
        }
      } else {
        const res = await loginRacer(cleanName, password);
        if (res.success && res.session && res.garage) {
          soundSynth.playCoinSound();
          onSuccess(res.session, res.garage);
          onClose();
        } else {
          setErrorMsg(res.error || 'Login failed.');
          soundSynth.playBump(0.5);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Authentication notice: ${msg}`);
      soundSynth.playBump(0.5);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl p-6 sm:p-7 shadow-2xl flex flex-col gap-5 text-white relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/80 hover:bg-slate-700 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyan-500/20 rounded-2xl border border-cyan-400/40 text-cyan-400 flex-shrink-0 neon-glow-cyan">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-arcade text-lg sm:text-xl font-black tracking-wide text-glow text-cyan-400">
              {mode === 'login' ? 'RACER CLOUD LOGIN' : 'CREATE RACER PROFILE'}
            </h3>
            <p className="text-xs text-slate-400">Direct cloud save & garage synchronization</p>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex bg-slate-950/90 p-1 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 rounded-xl font-arcade text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              mode === 'login'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>LOG IN</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 rounded-xl font-arcade text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              mode === 'register'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>NEW RACER</span>
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="bg-rose-950/80 border border-rose-500 text-rose-300 text-xs px-3.5 py-2.5 rounded-xl animate-shake">
            {errorMsg}
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {/* Racer Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-cyan-400" />
              <span>RACER CALL-SIGN / NAME:</span>
            </label>
            <input
              type="text"
              value={racerName}
              onChange={(e) => setRacerName(e.target.value)}
              maxLength={24}
              placeholder="e.g. Apex Viper"
              autoFocus
              className="bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-arcade text-white focus:outline-none focus:border-cyan-400 transition"
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-cyan-400" />
              <span>PASSWORD:</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={32}
                placeholder="Enter password..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 pr-10 text-sm font-arcade text-white focus:outline-none focus:border-cyan-400 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password (Register mode only) */}
          {mode === 'register' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-cyan-400" />
                <span>CONFIRM PASSWORD:</span>
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                maxLength={32}
                placeholder="Re-enter password..."
                className="bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-arcade text-white focus:outline-none focus:border-cyan-400 transition"
              />
            </div>
          )}

          {/* Cloud Auto-Sync Reassurance */}
          <div className="text-[11px] text-slate-400 bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>All coins, unlocked cars, and engine upgrades sync instantly to Firebase!</span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 py-3 px-6 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-arcade font-bold text-sm tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-lg transition active:scale-95 disabled:opacity-60 neon-glow-cyan"
          >
            {isLoading ? (
              <span>SYNCING CLOUD DATA...</span>
            ) : mode === 'login' ? (
              <>
                <LogIn className="w-4 h-4" />
                <span>LOG IN & LOAD SAVED GARAGE</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>REGISTER RACER ACCOUNT</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
