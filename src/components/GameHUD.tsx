import React from 'react';
import { HudState } from '../game/GameCanvas';
import {
  Volume2,
  VolumeX,
  Flame,
  ChevronLeft,
  ChevronRight,
  Trophy,
  ShieldAlert,
  Sparkles,
  Zap,
  ArrowUp,
  Disc,
  Settings,
} from 'lucide-react';
import { OrientationMode } from './SettingsModal';
import { soundSynth } from '../game/audio';

interface GameHUDProps {
  hudState: HudState;
  activeNotification: string | null;
  onLaneShift: (direction: -1 | 1) => void;
  onThrottleChange: (throttle: number) => void;
  onNitroToggle: (active: boolean) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenSettings: () => void;
  countdown: number | null;
  currentThrottle: number;
  wantsNitro: boolean;
  orientationMode: OrientationMode;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  hudState,
  activeNotification,
  onLaneShift,
  onThrottleChange,
  onNitroToggle,
  isMuted,
  onToggleMute,
  onOpenSettings,
  countdown,
  currentThrottle,
  wantsNitro,
}) => {
  const {
    speedKmh,
    nitroPercent,
    playerRank,
    playerProgress,
    isAirborne,
    onRamp,
    slipstreamActive,
    stunTimer,
    racersProgress,
  } = hudState;

  return (
    <div className="absolute inset-0 pointer-events-none select-none flex flex-col justify-between p-3 md:p-5 overflow-hidden z-20 touch-none pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] px-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]">
      {/* Top Header: Position Badge, Global Track Progress, Sound & Settings */}
      <div className="flex flex-col gap-2 w-full max-w-5xl mx-auto">
        <div className="flex items-center justify-between pointer-events-auto">
          {/* Rank Position Badge */}
          <div className="flex items-center gap-3 bg-slate-900/90 backdrop-blur-md border border-cyan-500/40 rounded-2xl px-3.5 py-1.5 shadow-lg">
            <div className="flex items-center gap-1 font-arcade text-base md:text-xl font-black">
              <span className="text-slate-400 text-xs">POS</span>
              <span
                className={`text-glow text-lg md:text-2xl ${
                  playerRank === 1
                    ? 'text-amber-400'
                    : playerRank === 2
                    ? 'text-slate-200'
                    : playerRank === 3
                    ? 'text-amber-600'
                    : 'text-rose-400'
                }`}
              >
                {playerRank}
              </span>
              <span className="text-slate-500 text-xs">/ 4</span>
            </div>
            <div className="h-5 w-px bg-slate-700" />
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>{Math.round(playerProgress)}%</span>
            </div>
          </div>

          {/* Desktop Keyboard Controls Legend */}
          <div className="hidden lg:flex items-center gap-3 bg-slate-950/70 border border-slate-800 rounded-full px-4 py-1 text-[11px] text-slate-300 font-semibold backdrop-blur-sm">
            <span><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-cyan-400 font-bold">A / ←</kbd> Steer Left</span>
            <span><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-cyan-400 font-bold">D / →</kbd> Steer Right</span>
            <span><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-emerald-400 font-bold">W / ↑</kbd> Gas</span>
            <span><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-rose-400 font-bold">S / ↓</kbd> Brake</span>
            <span><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-amber-400 font-bold">SPACE</kbd> Nitro</span>
          </div>

          {/* Settings & Sound Toggles */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenSettings}
              className="p-2.5 bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white rounded-2xl border border-slate-700 backdrop-blur-md transition-all active:scale-95 shadow-lg pointer-events-auto"
              title="Settings"
            >
              <Settings className="w-5 h-5 text-indigo-400" />
            </button>
            <button
              onClick={onToggleMute}
              className="p-2.5 bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white rounded-2xl border border-slate-700 backdrop-blur-md transition-all active:scale-95 shadow-lg pointer-events-auto"
              title="Toggle Sound"
            >
              {isMuted ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5 text-cyan-400" />}
            </button>
          </div>
        </div>

        {/* Global Track Progress Bar */}
        <div className="relative w-full bg-slate-950/80 border border-slate-800 rounded-full h-3.5 backdrop-blur-md px-1 flex items-center shadow-inner overflow-hidden">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-rose-500 transition-all duration-150 ease-out"
            style={{ width: `${playerProgress}%` }}
          />

          {racersProgress.map((r) => (
            <div
              key={r.id}
              className="absolute top-1/2 -translate-y-1/2 transition-all duration-150 ease-out"
              style={{ left: `calc(${r.progress}% - 6px)` }}
            >
              <div
                className={`w-3.5 h-3.5 rounded-full border-2 border-white shadow-md ${
                  r.isPlayer ? 'ring-2 ring-cyan-400 scale-125 z-10' : 'opacity-85'
                }`}
                style={{ backgroundColor: r.color }}
              />
            </div>
          ))}
          <div className="absolute right-1 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-400">
            🏁
          </div>
        </div>
      </div>

      {/* Countdown Overlay (3, 2, 1, GO!) */}
      {countdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className={`font-arcade font-black text-7xl md:text-9xl tracking-wider animate-bounce ${
              countdown === 0
                ? 'text-cyan-400 neon-glow-cyan drop-shadow-[0_0_40px_#06b6d4]'
                : 'text-amber-400 drop-shadow-[0_0_30px_#f59e0b]'
            }`}
          >
            {countdown === 0 ? 'GO!' : countdown}
          </div>
        </div>
      )}

      {/* Center Dynamic Stunt & Race Alerts */}
      <div className="flex flex-col items-center gap-2 pointer-events-none">
        {isAirborne && (
          <div className="bg-amber-950/90 border border-amber-400/90 px-5 py-2 rounded-full text-amber-300 font-arcade text-xs md:text-sm tracking-wide shadow-[0_0_25px_rgba(245,158,11,0.7)] animate-pulse flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400 animate-spin" />
            <span>AIRBORNE STUNT JUMP!</span>
          </div>
        )}

        {onRamp && !isAirborne && (
          <div className="bg-amber-950/80 border border-amber-500/80 px-4 py-1.5 rounded-full text-amber-400 font-arcade text-xs tracking-wide animate-pulse">
            RAMP ELEVATION CLIMB
          </div>
        )}

        {slipstreamActive && (
          <div className="flex items-center gap-2 bg-cyan-950/85 border border-cyan-400/90 px-5 py-2 rounded-full text-cyan-300 font-arcade text-xs md:text-sm tracking-wide shadow-[0_0_25px_rgba(6,182,212,0.7)] animate-pulse">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <span>SLIPSTREAM DRAFTING +15% TOP SPEED</span>
          </div>
        )}

        {stunTimer > 0 && (
          <div className="flex items-center gap-2 bg-rose-950/90 border border-rose-500 px-5 py-2 rounded-full text-rose-300 font-arcade text-xs md:text-sm tracking-wide shadow-[0_0_25px_rgba(244,63,94,0.7)] animate-bounce">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span>BUMP IMPACT! STAGGERED</span>
          </div>
        )}

        {activeNotification && (
          <div className="bg-slate-900/95 border border-amber-400 px-6 py-2.5 rounded-2xl text-amber-300 font-arcade text-xs md:text-sm tracking-wide shadow-2xl animate-pulse">
            {activeNotification}
          </div>
        )}
      </div>

      {/* Bottom Controls Bar: Robust Pointer-Captured Non-Sticking Touch Buttons */}
      <div className="flex items-end justify-between gap-3 md:gap-8 w-full max-w-5xl mx-auto touch-none pointer-events-auto">
        {/* Left Side: Accurate Non-Sticking Steer Left & Right Buttons */}
        <div className="flex gap-3">
          {/* Steer Left Button */}
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              onLaneShift(-1);
            }}
            className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-slate-900/95 active:bg-cyan-600/70 border-2 border-slate-700 active:border-cyan-400 backdrop-blur-md flex flex-col items-center justify-center text-slate-100 active:text-cyan-300 transition-transform active:scale-90 shadow-2xl touch-none select-none"
            aria-label="Steer Left"
          >
            <ChevronLeft className="w-9 h-9 stroke-[2.5]" />
            <span className="text-[10px] font-arcade font-bold text-slate-300">LEFT</span>
          </button>

          {/* Steer Right Button */}
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              onLaneShift(1);
            }}
            className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-slate-900/95 active:bg-cyan-600/70 border-2 border-slate-700 active:border-cyan-400 backdrop-blur-md flex flex-col items-center justify-center text-slate-100 active:text-cyan-300 transition-transform active:scale-90 shadow-2xl touch-none select-none"
            aria-label="Steer Right"
          >
            <ChevronRight className="w-9 h-9 stroke-[2.5]" />
            <span className="text-[10px] font-arcade font-bold text-slate-300">RIGHT</span>
          </button>
        </div>

        {/* Center: Digital Speedometer & Nitro Tank */}
        <div className="flex items-center gap-3.5 bg-slate-900/95 backdrop-blur-lg border border-slate-700 rounded-3xl px-4 py-2.5 shadow-2xl">
          {/* Speedometer */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold text-slate-400 tracking-wider">SPEED</span>
            <div className="flex items-baseline gap-1">
              <span className="font-arcade text-3xl md:text-5xl font-black text-white text-glow">
                {speedKmh}
              </span>
              <span className="text-[10px] md:text-xs font-bold text-cyan-400">KM/H</span>
            </div>
            {/* RPM notches */}
            <div className="flex gap-1 mt-1">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 md:w-2 h-1.5 rounded-xs transition-colors duration-100 ${
                    speedKmh > (i + 1) * 24
                      ? i >= 6
                        ? 'bg-rose-500 shadow-[0_0_6px_#f43f5e]'
                        : i >= 4
                        ? 'bg-amber-400 shadow-[0_0_6px_#f59e0b]'
                        : 'bg-cyan-400 shadow-[0_0_6px_#06b6d4]'
                      : 'bg-slate-800'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="h-10 w-px bg-slate-800" />

          {/* Nitro Vertical Gauge */}
          <div className="flex flex-col items-center gap-1">
            <Flame className={`w-4 h-4 ${wantsNitro ? 'text-cyan-300 animate-bounce' : 'text-slate-500'}`} />
            <div className="w-3.5 h-12 md:h-14 bg-slate-950 rounded-full border border-slate-700 relative overflow-hidden flex flex-col justify-end">
              <div
                className={`w-full rounded-full transition-all duration-75 ${
                  wantsNitro
                    ? 'bg-gradient-to-t from-cyan-400 to-indigo-400 shadow-[0_0_12px_#06b6d4]'
                    : 'bg-cyan-500'
                }`}
                style={{ height: `${nitroPercent}%` }}
              />
            </div>
            <span className="text-[9px] font-arcade font-bold text-cyan-400">{nitroPercent}%</span>
          </div>
        </div>

        {/* Right Side: Pointer-Captured Gas, Brake & Nitro (Never Gets Stuck) */}
        <div className="flex items-center gap-3">
          {/* Brake Button */}
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              try {
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              } catch {}
              onThrottleChange(-1);
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              try {
                (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
              } catch {}
              onThrottleChange(1);
            }}
            onPointerCancel={(e) => {
              try {
                (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
              } catch {}
              onThrottleChange(1);
            }}
            className={`w-14 h-14 md:w-17 md:h-17 rounded-2xl flex flex-col items-center justify-center gap-0.5 border-2 transition-all active:scale-90 shadow-2xl touch-none select-none ${
              currentThrottle < 0
                ? 'bg-rose-600 border-rose-300 text-white shadow-[0_0_18px_#f43f5e]'
                : 'bg-slate-900/95 hover:bg-slate-800 border-slate-700 text-rose-400'
            }`}
            aria-label="Brake"
          >
            <Disc className="w-6 h-6" />
            <span className="text-[9px] font-arcade font-bold">BRAKE</span>
          </button>

          {/* Acceleration (Gas) Button */}
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              try {
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              } catch {}
              onThrottleChange(1);
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              try {
                (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
              } catch {}
              // Default to forward cruise
              onThrottleChange(1);
            }}
            onPointerCancel={(e) => {
              try {
                (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
              } catch {}
              onThrottleChange(1);
            }}
            className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl flex flex-col items-center justify-center gap-0.5 border-2 transition-all active:scale-90 shadow-2xl touch-none select-none ${
              currentThrottle > 0
                ? 'bg-gradient-to-t from-emerald-600 to-teal-500 border-emerald-300 text-white shadow-[0_0_20px_#10b981]'
                : 'bg-slate-900/95 hover:bg-slate-800 border-slate-700 text-emerald-400'
            }`}
            aria-label="Accelerate Gas"
          >
            <ArrowUp className="w-7 h-7 stroke-[3]" />
            <span className="text-[10px] font-arcade font-bold">GAS</span>
          </button>

          {/* Nitro Activation Button */}
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              try {
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              } catch {}
              onNitroToggle(true);
              soundSynth.playNitroBoost();
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              try {
                (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
              } catch {}
              onNitroToggle(false);
            }}
            onPointerCancel={(e) => {
              try {
                (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
              } catch {}
              onNitroToggle(false);
            }}
            className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl font-arcade font-black flex flex-col items-center justify-center gap-0.5 transition-all active:scale-90 shadow-2xl border-2 touch-none select-none ${
              wantsNitro
                ? 'bg-gradient-to-br from-cyan-400 to-indigo-600 border-white text-white neon-glow-cyan'
                : nitroPercent > 5
                ? 'bg-gradient-to-br from-cyan-600/95 to-blue-700/95 border-cyan-400/80 text-white hover:brightness-110'
                : 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
            }`}
            aria-label="Nitro Boost"
          >
            <Zap className={`w-6 h-6 ${wantsNitro ? 'animate-spin' : ''}`} />
            <span className="text-[10px] tracking-wider">NITRO</span>
          </button>
        </div>
      </div>
    </div>
  );
};
