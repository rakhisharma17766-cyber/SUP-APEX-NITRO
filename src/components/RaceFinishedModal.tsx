import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { RacerEntity } from '../game/physics';
import { VEHICLES } from '../game/cars';
import { Trophy, Coins, RotateCcw, Home, Sparkles, Flame, ShieldAlert } from 'lucide-react';
import { getPostRaceCommentary } from '../services/aiCrewChief';

interface RaceFinishedModalProps {
  player: RacerEntity;
  racers: RacerEntity[];
  totalBumps: number;
  onReplay: () => void;
  onReturnToGarage: () => void;
  onAwardCoins: (amount: number) => void;
}

export const RaceFinishedModal: React.FC<RaceFinishedModalProps> = ({
  player,
  racers,
  totalBumps,
  onReplay,
  onReturnToGarage,
  onAwardCoins,
}) => {
  const [commentary, setCommentary] = useState<string>('Generating race highlights...');
  const [loadingCommentary, setLoadingCommentary] = useState<boolean>(true);

  // Sort by finish rank
  const podium = [...racers].sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.currentZ - a.currentZ;
  });

  const playerRank = podium.findIndex((r) => r.id === player.id) + 1;

  // Calculate Coin rewards
  const rankRewards = [500, 300, 180, 100];
  const rankCoins = rankRewards[playerRank - 1] || 100;
  const bumpBonus = totalBumps * 25;
  const totalCoinsEarned = rankCoins + bumpBonus;

  useEffect(() => {
    // Trigger confetti for podium finishers
    if (playerRank <= 3) {
      confetti({
        particleCount: playerRank === 1 ? 120 : 60,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#06b6d4', '#f59e0b', '#ec4899', '#ffffff'],
      });
    }

    // Award coins to user state
    onAwardCoins(totalCoinsEarned);

    // Call Gemini for AI Post-Race Commentary
    const carDef = VEHICLES[player.carId] || VEHICLES.red_storm;
    getPostRaceCommentary(
      playerRank,
      carDef.name,
      player.finishTime || 35.0,
      totalBumps,
      player.slipstreamActive
    ).then((text) => {
      setCommentary(text);
      setLoadingCommentary(false);
    });
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-xl max-h-[90dvh] overflow-y-auto bg-slate-900 border border-slate-700/80 rounded-3xl p-5 sm:p-7 shadow-2xl flex flex-col gap-5 text-white relative my-auto">
        {/* Glow ambient background */}
        <div className="absolute -right-20 -top-20 w-60 h-60 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-60 h-60 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header Rank Badge */}
        <div className="text-center flex flex-col items-center gap-1">
          <div className="flex items-center justify-center gap-2">
            <Trophy
              className={`w-10 h-10 ${
                playerRank === 1
                  ? 'text-amber-400 animate-bounce'
                  : playerRank === 2
                  ? 'text-slate-300'
                  : playerRank === 3
                  ? 'text-amber-700'
                  : 'text-slate-500'
              }`}
            />
            <h2 className="font-arcade text-3xl md:text-5xl font-black tracking-wider text-glow">
              {playerRank === 1
                ? 'VICTORY!'
                : playerRank === 2
                ? '2ND PLACE'
                : playerRank === 3
                ? '3RD PLACE'
                : 'FINISH!'}
            </h2>
          </div>
          <p className="text-sm font-semibold text-slate-400">
            Official Clock Time: {player.finishTime ? `${player.finishTime.toFixed(2)}s` : '32.18s'}
          </p>
        </div>

        {/* Podium Leaderboard Table */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2">
          {podium.map((racer, idx) => {
            const isMe = racer.id === player.id;
            return (
              <div
                key={racer.id}
                className={`flex items-center justify-between px-3.5 py-2 rounded-xl transition-all ${
                  isMe
                    ? 'bg-cyan-950/60 border border-cyan-500/50 shadow-md'
                    : 'bg-slate-900/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`font-arcade text-sm font-bold w-6 ${
                      idx === 0
                        ? 'text-amber-400'
                        : idx === 1
                        ? 'text-slate-300'
                        : idx === 2
                        ? 'text-amber-600'
                        : 'text-slate-500'
                    }`}
                  >
                    #{idx + 1}
                  </span>
                  <div
                    className="w-3.5 h-3.5 rounded-full border border-white/60"
                    style={{ backgroundColor: racer.color }}
                  />
                  <span className={`text-sm font-semibold ${isMe ? 'text-cyan-300 font-bold' : 'text-slate-200'}`}>
                    {racer.name} {isMe && '(You)'}
                  </span>
                </div>
                <div className="font-arcade text-xs text-slate-400">
                  {racer.finishTime ? `${racer.finishTime.toFixed(2)}s` : '--'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Coin Rewards Breakdown */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-slate-400">Rank Bounty</span>
              <span className="font-arcade text-lg font-bold text-amber-300">+{rankCoins}</span>
            </div>
            <Coins className="w-6 h-6 text-amber-400" />
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-slate-400">Bump Bonus ({totalBumps}x)</span>
              <span className="font-arcade text-lg font-bold text-rose-300">+{bumpBonus}</span>
            </div>
            <ShieldAlert className="w-6 h-6 text-rose-400" />
          </div>
        </div>

        {/* Gemini AI Race Commentary */}
        <div className="bg-slate-950/70 border border-indigo-500/40 rounded-2xl p-4 flex gap-3 items-start">
          <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5 animate-pulse" />
          <div className="flex flex-col gap-1">
            <span className="text-xs font-arcade font-bold text-indigo-300 tracking-wide">
              APEX ESPORTS RACE COMMENTARY
            </span>
            <p className="text-xs md:text-sm text-slate-300 italic leading-relaxed">
              {loadingCommentary ? (
                <span className="animate-pulse">Generating electrifying race play-by-play...</span>
              ) : (
                commentary
              )}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={onReturnToGarage}
            className="flex-1 py-3.5 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Home className="w-5 h-5" />
            <span>Garage</span>
          </button>

          <button
            onClick={onReplay}
            className="flex-1 py-3.5 px-4 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-arcade font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 transition-all active:scale-95 neon-glow-cyan"
          >
            <RotateCcw className="w-5 h-5" />
            <span>Replay Race</span>
          </button>
        </div>
      </div>
    </div>
  );
};
