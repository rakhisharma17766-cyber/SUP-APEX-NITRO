import React from 'react';
import { RacerEntity } from '../game/physics';
import { TrackData } from '../game/trackGenerator';
import { Zap, Volume2, VolumeX, Flame, ChevronLeft, ChevronRight, Trophy, ShieldAlert, Sparkles } from 'lucide-react';
import { soundSynth } from '../game/audio';

interface GameHUDProps {
  player: RacerEntity;
  racers: RacerEntity[];
  track: TrackData;
  activeNotification: string | null;
  onLaneShift: (direction: -1 | 1) => void;
  onNitroToggle: (active: boolean) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onPause?: () => void;
  countdown: number | null; // 3, 2, 1, or 0 (GO!)
}

export const GameHUD: React.FC<GameHUDProps> = ({
  player,
  racers,
  track,
  activeNotification,
  onLaneShift,
  onNitroToggle,
  isMuted,
  onToggleMute,
  countdown,
}) => {
  // Sort racers by progress along track for leaderboard
  const sortedRacers = [...racers].sort((a, b) => b.currentZ - a.currentZ);
  const playerRank = sortedRacers.findIndex((r) => r.id === player.id) + 1;

  // Track progress percentage
  const trackLength = track.length - 20;
  const playerProgress = Math.min(100, Math.max(0, (player.currentZ / trackLength) * 100));

  // Current KM/H calculation
  const speedKmh = Math.round((player.speed / 60) * 180);
  const nitroPercent = Math.round(player.nitroFuel * 100);

  return (
    <div className="absolute inset-0 pointer-events-none select-none flex flex-col justify-between p-4 md:p-6">
      {/* Top Bar: Progress Bar & Audio / Stats */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between pointer-events-auto">
          {/* Rank Badge */}
          <div className="flex items-center gap-3 bg-slate-900/80 backdrop-blur-md border border-cyan-500/30 rounded-2xl px-4 py-2 shadow-lg">
            <div className="flex items-center gap-1.5 font-arcade text-lg md:text-2xl font-black">
              <span className="text-slate-400 text-xs md:text-sm">POS</span>
              <span
                className={`text-glow ${
                  playerRank === 1
                    ? 'text-amber-400'
                    : playerRank === 2
                    ? 'text-slate-200'
                    : playerRank === 3
                    ? 'text-amber-700'
                    : 'text-rose-400'
                }`}
              >
                {playerRank}
              </span>
              <span className="text-slate-500 text-xs">/ 4</span>
            </div>
            <div className="h-6 w-px bg-slate-700" />
            <div className="flex items-center gap-1.5 text-xs md:text-sm font-semibold text-slate-300">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>{Math.round(playerProgress)}%</span>
            </div>
          </div>

          {/* Sound / Settings Button */}
          <button
            onClick={onToggleMute}
            className="p-2.5 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-2xl border border-slate-700 backdrop-blur-md transition-all active:scale-95 shadow-lg"
            title="Toggle Sound"
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5 text-cyan-400" />}
          </button>
        </div>

        {/* Global Track Progress Bar */}
        <div className="relative w-full bg-slate-950/70 border border-slate-800/80 rounded-full h-4 backdrop-blur-md px-1 flex items-center shadow-inner overflow-hidden">
          {/* Progress fill */}
          <div
            className="h-2 rounded-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-rose-500 transition-all duration-100 ease-out"
            style={{ width: `${playerProgress}%` }}
          />

          {/* Icons for all 4 racers along track */}
          {sortedRacers.map((racer) => {
            const prog = Math.min(100, Math.max(0, (racer.currentZ / trackLength) * 100));
            const isMe = racer.id === player.id;
            return (
              <div
                key={racer.id}
                className="absolute top-1/2 -translate-y-1/2 transition-all duration-100 ease-out"
                style={{ left: `calc(${prog}% - 6px)` }}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full border-2 border-white shadow-md flex items-center justify-center ${
                    isMe ? 'ring-2 ring-cyan-400 scale-125 z-10' : 'opacity-80'
                  }`}
                  style={{ backgroundColor: racer.color }}
                />
              </div>
            );
          })}
          {/* Finish flag icon */}
          <div className="absolute right-1 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-400">
            🏁
          </div>
        </div>
      </div>

      {/* Center Countdown Display */}
      {countdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className={`font-arcade font-black text-7xl md:text-9xl tracking-wider animate-bounce ${
              countdown === 0
                ? 'text-cyan-400 neon-glow-cyan drop-shadow-[0_0_35px_#06b6d4]'
                : 'text-amber-400 drop-shadow-[0_0_25px_#f59e0b]'
            }`}
          >
            {countdown === 0 ? 'GO!' : countdown}
          </div>
        </div>
      )}

      {/* Middle Alerts (Drafting, Bump, Boost) */}
      <div className="flex flex-col items-center gap-2 pointer-events-none">
        {player.slipstreamActive && (
          <div className="flex items-center gap-2 bg-cyan-950/80 border border-cyan-400/80 px-4 py-1.5 rounded-full text-cyan-300 font-arcade text-xs md:text-sm tracking-wide shadow-[0_0_20px_rgba(6,182,212,0.5)] animate-pulse">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>SLIPSTREAM DRAFTING +15% TOP SPEED</span>
          </div>
        )}

        {player.stunTimer > 0 && (
          <div className="flex items-center gap-2 bg-rose-950/80 border border-rose-500 px-4 py-1.5 rounded-full text-rose-300 font-arcade text-xs md:text-sm tracking-wide shadow-[0_0_20px_rgba(244,63,94,0.5)] animate-bounce">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span>BUMP IMPACT! STAGGERED</span>
          </div>
        )}

        {activeNotification && (
          <div className="bg-slate-900/90 border border-amber-400 px-5 py-2 rounded-2xl text-amber-300 font-arcade text-xs md:text-sm tracking-wide shadow-2xl animate-pulse">
            {activeNotification}
          </div>
        )}
      </div>

      {/* Bottom Area: Speedometer, Nitro Tank, & Controls */}
      <div className="flex flex-col md:flex-row items-end md:items-center justify-between gap-4">
        {/* Left Side: Touch Steering Buttons */}
        <div className="flex gap-3 pointer-events-auto">
          <button
            onPointerDown={() => onLaneShift(-1)}
            className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-slate-900/80 active:bg-cyan-600/40 border border-slate-700 active:border-cyan-400 backdrop-blur-md flex items-center justify-center text-slate-200 active:text-cyan-300 transition-transform active:scale-95 shadow-xl"
            aria-label="Steer Left"
          >
            <ChevronLeft className="w-9 h-9" />
          </button>
          <button
            onPointerDown={() => onLaneShift(1)}
            className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-slate-900/80 active:bg-cyan-600/40 border border-slate-700 active:border-cyan-400 backdrop-blur-md flex items-center justify-center text-slate-200 active:text-cyan-300 transition-transform active:scale-95 shadow-xl"
            aria-label="Steer Right"
          >
            <ChevronRight className="w-9 h-9" />
          </button>
        </div>

        {/* Center: Curved Digital Speedometer */}
        <div className="flex items-center gap-4 bg-slate-900/85 backdrop-blur-lg border border-slate-700/80 rounded-3xl p-3 md:p-4 shadow-2xl pointer-events-auto">
          {/* Digital readout */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] md:text-xs font-bold text-slate-400 tracking-wider">SPEED</span>
            <div className="flex items-baseline gap-1">
              <span className="font-arcade text-3xl md:text-5xl font-black text-white text-glow">
                {speedKmh}
              </span>
              <span className="text-xs font-bold text-cyan-400">KM/H</span>
            </div>
            {/* RPM notch indicators */}
            <div className="flex gap-1 mt-1.5">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-1.5 rounded-xs transition-colors duration-100 ${
                    speedKmh > (i + 1) * 25
                      ? i >= 6
                        ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
                        : i >= 4
                        ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]'
                        : 'bg-cyan-400 shadow-[0_0_8px_#06b6d4]'
                      : 'bg-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Nitro Boost Gauge & Big Trigger Button */}
        <div className="flex items-center gap-3 pointer-events-auto">
          {/* Nitro Vertical Gauge */}
          <div className="flex flex-col items-center gap-1 bg-slate-900/80 backdrop-blur-md border border-cyan-500/30 rounded-2xl px-2.5 py-3 shadow-lg">
            <Flame className={`w-4 h-4 ${player.nitroActive ? 'text-cyan-300 animate-bounce' : 'text-slate-500'}`} />
            <div className="w-3.5 h-16 md:h-20 bg-slate-950 rounded-full border border-slate-700 relative overflow-hidden flex flex-col justify-end">
              <div
                className={`w-full rounded-full transition-all duration-75 ${
                  player.nitroActive
                    ? 'bg-gradient-to-t from-cyan-400 to-indigo-400 shadow-[0_0_12px_#06b6d4]'
                    : 'bg-cyan-500'
                }`}
                style={{ height: `${nitroPercent}%` }}
              />
            </div>
            <span className="text-[10px] font-arcade font-bold text-cyan-400">{nitroPercent}%</span>
          </div>

          {/* Nitro Activation Button */}
          <button
            onPointerDown={() => {
              onNitroToggle(true);
              soundSynth.playNitroBoost();
            }}
            onPointerUp={() => onNitroToggle(false)}
            onPointerLeave={() => onNitroToggle(false)}
            className={`w-20 h-20 md:w-24 md:h-24 rounded-3xl font-arcade font-black flex flex-col items-center justify-center gap-1 transition-all active:scale-90 shadow-2xl border-2 ${
              player.nitroActive
                ? 'bg-gradient-to-br from-cyan-400 to-indigo-600 border-white text-white neon-glow-cyan'
                : player.nitroFuel > 0.05
                ? 'bg-gradient-to-br from-cyan-600/90 to-blue-700/90 border-cyan-400/60 text-white hover:brightness-110'
                : 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Zap className={`w-7 h-7 ${player.nitroActive ? 'animate-spin' : ''}`} />
            <span className="text-xs md:text-sm tracking-wider">NITRO</span>
          </button>
        </div>
      </div>
    </div>
  );
};
