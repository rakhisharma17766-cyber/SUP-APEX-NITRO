import React from 'react';
import {
  X,
  Smartphone,
  Monitor,
  Maximize2,
  Volume2,
  VolumeX,
  Gauge,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { soundSynth } from '../game/audio';

export type OrientationMode = 'auto' | 'landscape' | 'portrait';

interface SettingsModalProps {
  orientationMode: OrientationMode;
  onSetOrientationMode: (mode: OrientationMode) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  orientationMode,
  onSetOrientationMode,
  isMuted,
  onToggleMute,
  onClose,
}) => {
  const toggleFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    } catch {
      // Ignored if blocked in iframe
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto bg-slate-900 border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col gap-5 text-slate-100 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-arcade text-lg md:text-xl font-black text-white text-glow">
                GAME SETTINGS
              </h2>
              <p className="text-xs text-slate-400">Display, Orientation & Audio Engine</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Orientation Mode Section */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Monitor className="w-4 h-4 text-cyan-400" />
              <span>SCREEN ORIENTATION MODE</span>
            </span>
            <span className="text-[10px] font-semibold text-cyan-400">ACTIVE: {orientationMode.toUpperCase()}</span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {/* Auto Mode */}
            <button
              onClick={() => onSetOrientationMode('auto')}
              className={`p-3 rounded-2xl border text-center flex flex-col items-center gap-1.5 transition ${
                orientationMode === 'auto'
                  ? 'bg-cyan-600/30 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/60'
              }`}
            >
              <Sparkles className="w-5 h-5" />
              <span className="font-arcade text-xs font-bold block">AUTO</span>
              <span className="text-[9px] text-slate-400 leading-tight">Adaptive Viewport</span>
            </button>

            {/* Forced Landscape Mode */}
            <button
              onClick={() => onSetOrientationMode('landscape')}
              className={`p-3 rounded-2xl border text-center flex flex-col items-center gap-1.5 transition ${
                orientationMode === 'landscape'
                  ? 'bg-cyan-600/30 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/60'
              }`}
            >
              <Monitor className="w-5 h-5" />
              <span className="font-arcade text-xs font-bold block">LANDSCAPE</span>
              <span className="text-[9px] text-slate-400 leading-tight">16:9 Widescreen Arcade</span>
            </button>

            {/* Forced Portrait Mode */}
            <button
              onClick={() => onSetOrientationMode('portrait')}
              className={`p-3 rounded-2xl border text-center flex flex-col items-center gap-1.5 transition ${
                orientationMode === 'portrait'
                  ? 'bg-cyan-600/30 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/60'
              }`}
            >
              <Smartphone className="w-5 h-5" />
              <span className="font-arcade text-xs font-bold block">PORTRAIT</span>
              <span className="text-[9px] text-slate-400 leading-tight">9:16 Mobile Speed</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/60">
            <strong>Landscape Mode:</strong> Locks aspect ratio to a 16:9 ultra-wide cinematic racing stage with wide peripheral vision.
            <br />
            <strong>Portrait Mode:</strong> Locks aspect ratio to an authentic 9:16 vertical arcade racer with optimized vertical lane visibility.
          </p>
        </div>

        {/* Audio & Fullscreen Quick Toggles */}
        <div className="grid grid-cols-2 gap-3">
          {/* Sound Toggle */}
          <button
            onClick={() => {
              onToggleMute();
              soundSynth.playBump(0.4);
            }}
            className="p-3 bg-slate-950/70 hover:bg-slate-800 border border-slate-800 rounded-2xl flex items-center justify-between gap-2 transition"
          >
            <div className="flex items-center gap-2">
              {isMuted ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5 text-cyan-400" />}
              <span className="text-xs font-bold text-slate-200">Engine & SFX</span>
            </div>
            <span className={`text-[10px] font-arcade font-bold px-2 py-0.5 rounded-full ${isMuted ? 'bg-rose-950 text-rose-400' : 'bg-cyan-950 text-cyan-400'}`}>
              {isMuted ? 'MUTED' : 'ON'}
            </span>
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-3 bg-slate-950/70 hover:bg-slate-800 border border-slate-800 rounded-2xl flex items-center justify-between gap-2 transition"
          >
            <div className="flex items-center gap-2">
              <Maximize2 className="w-5 h-5 text-indigo-400" />
              <span className="text-xs font-bold text-slate-200">Fullscreen</span>
            </div>
            <span className="text-[10px] font-arcade font-bold px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-400">
              EXPAND
            </span>
          </button>
        </div>

        {/* Controls Guide */}
        <div className="flex flex-col gap-2 bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Gauge className="w-4 h-4 text-amber-400" />
            <span>ACCURATE CONTROLS SCHEME</span>
          </span>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
            <div className="flex items-center justify-between bg-slate-900/60 p-2 rounded-xl">
              <span>Steer Left:</span>
              <span className="font-bold text-cyan-400">LEFT BUTTON / A / ←</span>
            </div>
            <div className="flex items-center justify-between bg-slate-900/60 p-2 rounded-xl">
              <span>Steer Right:</span>
              <span className="font-bold text-cyan-400">RIGHT BUTTON / D / →</span>
            </div>
            <div className="flex items-center justify-between bg-slate-900/60 p-2 rounded-xl">
              <span>Gas / Drive:</span>
              <span className="font-bold text-emerald-400">GAS PEDAL / W / ↑</span>
            </div>
            <div className="flex items-center justify-between bg-slate-900/60 p-2 rounded-xl">
              <span>Hard Brake:</span>
              <span className="font-bold text-rose-400">BRAKE PEDAL / S / ↓</span>
            </div>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full py-3 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 rounded-2xl font-arcade font-bold text-xs text-white shadow-lg transition active:scale-95 text-center"
        >
          SAVE & RETURN
        </button>
      </div>
    </div>
  );
};
