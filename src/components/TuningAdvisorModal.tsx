import React, { useEffect, useState } from 'react';
import { VEHICLES, UpgradeKey } from '../game/cars';
import { TRACK_THEMES, TrackThemeId } from '../game/trackGenerator';
import { getTuningStrategyAdvice, StrategyBriefing } from '../services/aiCrewChief';
import { Sparkles, X, Shield, Zap, Flame, Compass, BrainCircuit } from 'lucide-react';

interface TuningAdvisorModalProps {
  carId: string;
  themeId: TrackThemeId;
  trackLength: number;
  upgrades: { [key in UpgradeKey]?: number };
  onClose: () => void;
}

export const TuningAdvisorModal: React.FC<TuningAdvisorModalProps> = ({
  carId,
  themeId,
  trackLength,
  upgrades,
  onClose,
}) => {
  const [strategy, setStrategy] = useState<StrategyBriefing | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const car = VEHICLES[carId] || VEHICLES.red_storm;
  const theme = TRACK_THEMES[themeId] || TRACK_THEMES.cyber;

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    getTuningStrategyAdvice(car.name, theme.name, trackLength, upgrades as Record<string, number>).then((res) => {
      if (isMounted) {
        setStrategy(res);
        setLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [carId, themeId, trackLength, upgrades]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-lg bg-slate-900 border border-cyan-500/40 rounded-3xl p-6 shadow-2xl flex flex-col gap-5 text-white relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/80 hover:bg-slate-700 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyan-500/20 rounded-2xl border border-cyan-400/40 text-cyan-400">
            <BrainCircuit className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="font-arcade text-xl font-bold tracking-wide text-glow text-cyan-400">
              APEX AI CREW CHIEF
            </h3>
            <p className="text-xs text-slate-400">
              Tactical telemetry for {car.name} on {theme.name} ({trackLength}m)
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-cyan-400">
            <Sparkles className="w-8 h-8 animate-spin" />
            <span className="font-arcade text-xs tracking-wider animate-pulse">
              ANALYZING AERODYNAMICS & TELEMETRY...
            </span>
          </div>
        ) : strategy ? (
          <div className="flex flex-col gap-4">
            {/* Tactical Tip */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex gap-3.5 items-start">
              <Zap className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="text-xs font-arcade font-bold text-amber-400">NITRO & JUMP TACTIC</span>
                <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                  {strategy.tacticalTip}
                </p>
              </div>
            </div>

            {/* Playstyle Recommendation */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex gap-3.5 items-start">
              <Compass className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="text-xs font-arcade font-bold text-cyan-400">RECOMMENDED PLAYSTYLE</span>
                <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                  {strategy.recommendedPlaystyle}
                </p>
              </div>
            </div>

            {/* Rival Threat Warning */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex gap-3.5 items-start">
              <Shield className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="text-xs font-arcade font-bold text-rose-400">RIVAL THREAT WARNING</span>
                <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                  {strategy.rivalWarning}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <button
          onClick={onClose}
          className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-2xl font-arcade font-bold text-sm tracking-wider text-white shadow-lg transition active:scale-95"
        >
          CONFIRM SETUP
        </button>
      </div>
    </div>
  );
};
