import React, { useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  VEHICLES,
  UPGRADES_META,
  UpgradeKey,
  getUpgradeCost,
  computePhysicsStats,
  VehicleDefinition,
} from '../game/cars';
import { UserGarageData } from '../services/firebase';
import { GarageStage } from './GarageStage';
import {
  Coins,
  Play,
  Users,
  BrainCircuit,
  Lock,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Zap,
  Shield,
  Flame,
  Rocket,
  Sparkles,
  Volume2,
  VolumeX,
  LogIn,
  LogOut,
} from 'lucide-react';
import { soundSynth } from '../game/audio';
import { TrackThemeId } from '../game/trackGenerator';

interface GarageMenuProps {
  user: FirebaseUser | null;
  garageData: UserGarageData;
  onSelectCar: (carId: string) => void;
  onUnlockCar: (carId: string, price: number) => void;
  onUpgradeStat: (carId: string, statKey: UpgradeKey, cost: number) => void;
  onStartSoloRace: (trackLength: number, trackTheme: TrackThemeId) => void;
  onOpenMultiplayer: () => void;
  onOpenAiChief: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

const CAR_KEYS = Object.keys(VEHICLES);

export const GarageMenu: React.FC<GarageMenuProps> = ({
  user,
  garageData,
  onSelectCar,
  onUnlockCar,
  onUpgradeStat,
  onStartSoloRace,
  onOpenMultiplayer,
  onOpenAiChief,
  onSignIn,
  onSignOut,
  isMuted,
  onToggleMute,
}) => {
  const activeCarId = garageData.activeCarId || 'red_storm';
  const activeIndex = CAR_KEYS.indexOf(activeCarId);
  const currentCar = VEHICLES[activeCarId] || VEHICLES.red_storm;

  const [selectedColor, setSelectedColor] = useState<string>(currentCar.primaryColor);
  const [trackLength, setTrackLength] = useState<number>(2500);
  const [trackTheme, setTrackTheme] = useState<TrackThemeId>('cyber');

  const isUnlocked = garageData.unlockedCars.includes(activeCarId);
  const carUpgrades = garageData.upgrades[activeCarId] || {
    topSpeed: 1,
    acceleration: 1,
    heavyArmor: 1,
    nitroDuration: 1,
    nitroPower: 1,
  };

  const physicsStats = computePhysicsStats(activeCarId, carUpgrades);

  const handlePrevCar = () => {
    const nextIdx = (activeIndex - 1 + CAR_KEYS.length) % CAR_KEYS.length;
    const nextCarId = CAR_KEYS[nextIdx];
    onSelectCar(nextCarId);
    setSelectedColor(VEHICLES[nextCarId].primaryColor);
    soundSynth.playBoostPad();
  };

  const handleNextCar = () => {
    const nextIdx = (activeIndex + 1) % CAR_KEYS.length;
    const nextCarId = CAR_KEYS[nextIdx];
    onSelectCar(nextCarId);
    setSelectedColor(VEHICLES[nextCarId].primaryColor);
    soundSynth.playBoostPad();
  };

  const handleUpgrade = (key: UpgradeKey) => {
    const currentLevel = carUpgrades[key] || 1;
    if (currentLevel >= 5) return;
    const cost = getUpgradeCost(currentLevel);
    if (garageData.coins < cost) {
      soundSynth.playBump(0.5);
      return;
    }
    soundSynth.playCoinSound();
    onUpgradeStat(activeCarId, key, cost);
  };

  const handleUnlock = () => {
    if (garageData.coins < currentCar.unlockPrice) {
      soundSynth.playBump(0.5);
      return;
    }
    soundSynth.playVictoryFanfare();
    onUnlockCar(activeCarId, currentCar.unlockPrice);
  };

  const paintOptions = [
    currentCar.primaryColor,
    '#ef4444',
    '#06b6d4',
    '#eab308',
    '#a855f7',
    '#10b981',
    '#f43f5e',
    '#f97316',
  ];

  return (
    <div className="relative w-full h-full flex flex-col justify-between p-4 md:p-6 overflow-y-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between z-20">
        {/* Title */}
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-400 to-indigo-600 flex items-center justify-center font-arcade font-black text-white text-xl shadow-lg neon-glow-cyan">
            S
          </div>
          <div>
            <h1 className="font-arcade text-xl md:text-2xl font-black tracking-wider text-glow text-cyan-400">
              SUP APEX NITRO
            </h1>
            <p className="text-[10px] md:text-xs text-slate-400 tracking-wider">
              2.5D MULTIPLAYER ARCADE RACING
            </p>
          </div>
        </div>

        {/* User coins & Auth */}
        <div className="flex items-center gap-3">
          {/* Coins Badge */}
          <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md border border-amber-500/40 rounded-2xl px-4 py-2 shadow-lg">
            <Coins className="w-5 h-5 text-amber-400 animate-spin" />
            <span className="font-arcade text-base md:text-lg font-black text-amber-300">
              {garageData.coins.toLocaleString()}
            </span>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={onToggleMute}
            className="p-2.5 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-2xl border border-slate-700 backdrop-blur-md transition active:scale-95 shadow-lg"
            title="Toggle Sound"
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5 text-cyan-400" />}
          </button>

          {/* Auth Button */}
          {user ? (
            <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700 rounded-2xl px-3 py-1.5 backdrop-blur-md">
              <span className="text-xs font-semibold text-slate-200 hidden sm:inline">
                {user.displayName || 'Apex Driver'}
              </span>
              <button
                onClick={onSignOut}
                className="p-1 text-slate-400 hover:text-rose-400 transition"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onSignIn}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600/80 hover:bg-indigo-600 border border-indigo-400/50 rounded-2xl font-semibold text-xs text-white shadow-lg transition active:scale-95"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Garage Section: 3D Stage & Upgrades */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 my-auto items-center z-10">
        {/* Left Side: Vehicle Info & Paint Switcher */}
        <div className="lg:col-span-3 flex flex-col gap-4 bg-slate-900/70 backdrop-blur-md border border-slate-800 rounded-3xl p-5 shadow-2xl">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-arcade font-bold px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-400 uppercase">
                {currentCar.category}
              </span>
            </div>
            <h2 className="font-arcade text-2xl font-black text-white mt-1 text-glow">
              {currentCar.name}
            </h2>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              {currentCar.description}
            </p>
          </div>

          {/* Paint Swatches */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-400">Custom Livery Paint:</span>
            <div className="flex gap-2 flex-wrap">
              {paintOptions.map((hex, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedColor(hex)}
                  className={`w-7 h-7 rounded-xl border-2 transition active:scale-90 shadow-md ${
                    selectedColor === hex ? 'border-white scale-110 shadow-cyan-500/50' : 'border-slate-700'
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>

          {/* AI Crew Chief Advisor Button */}
          <button
            onClick={onOpenAiChief}
            className="flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-indigo-950/80 to-purple-950/80 hover:from-indigo-900/90 hover:to-purple-900/90 border border-indigo-500/50 rounded-2xl text-xs font-arcade font-bold text-indigo-300 shadow-xl transition active:scale-95"
          >
            <BrainCircuit className="w-4 h-4 text-indigo-400 animate-pulse" />
            <span>APEX AI CREW CHIEF</span>
          </button>
        </div>

        {/* Center: 3D Turntable Stage with Left/Right Nav */}
        <div className="lg:col-span-5 relative h-72 md:h-96 flex items-center justify-center">
          <GarageStage carId={activeCarId} customColor={selectedColor} />

          {/* Left / Right Carousel Controls */}
          <button
            onClick={handlePrevCar}
            className="absolute left-1 top-1/2 -translate-y-1/2 p-3 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-2xl backdrop-blur-md transition active:scale-90 shadow-xl"
            aria-label="Previous Car"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={handleNextCar}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-3 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-2xl backdrop-blur-md transition active:scale-90 shadow-xl"
            aria-label="Next Car"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Lock Overlay if Car is Locked */}
          {!isUnlocked && (
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center gap-3 rounded-3xl p-6 text-center">
              <div className="p-4 bg-slate-900/90 border border-amber-500/60 rounded-3xl text-amber-400 shadow-2xl">
                <Lock className="w-8 h-8" />
              </div>
              <div className="flex flex-col">
                <span className="font-arcade text-lg font-black text-amber-300">
                  LOCKED VEHICLE
                </span>
                <span className="text-xs text-slate-400">Unlock with earned race bounty</span>
              </div>
              <button
                onClick={handleUnlock}
                className="mt-1 px-6 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-arcade font-black text-xs md:text-sm rounded-2xl shadow-xl transition active:scale-95 flex items-center gap-2 neon-glow-amber"
              >
                <Coins className="w-4 h-4" />
                <span>UNLOCK FOR {currentCar.unlockPrice} COINS</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Side: Real Upgrades Matrix */}
        <div className="lg:col-span-4 flex flex-col gap-3 bg-slate-900/70 backdrop-blur-md border border-slate-800 rounded-3xl p-5 shadow-2xl">
          <div className="flex items-center justify-between">
            <span className="font-arcade text-sm font-bold text-cyan-400 tracking-wide">
              PERFORMANCE UPGRADES
            </span>
            <span className="text-[10px] text-slate-400 font-semibold">MAX LVL 5</span>
          </div>

          <div className="flex flex-col gap-2.5">
            {UPGRADES_META.map((meta) => {
              const currentLvl = carUpgrades[meta.key] || 1;
              const isMax = currentLvl >= 5;
              const cost = getUpgradeCost(currentLvl);
              const canAfford = garageData.coins >= cost;

              return (
                <div
                  key={meta.key}
                  className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-2.5 flex items-center justify-between gap-3"
                >
                  <div className="flex flex-col flex-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                      <span>{meta.name}</span>
                      <span className="font-arcade text-cyan-400">Lvl {currentLvl}/5</span>
                    </div>

                    {/* Progress Level pips */}
                    <div className="flex gap-1.5 mt-1.5">
                      {[1, 2, 3, 4, 5].map((lvl) => (
                        <div
                          key={lvl}
                          className={`h-2 flex-1 rounded-full transition-all ${
                            lvl <= currentLvl
                              ? 'bg-gradient-to-r from-cyan-400 to-indigo-500 shadow-[0_0_6px_#06b6d4]'
                              : 'bg-slate-800'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Upgrade Action Button */}
                  <button
                    onClick={() => handleUpgrade(meta.key)}
                    disabled={isMax || !canAfford || !isUnlocked}
                    className={`py-2 px-3 rounded-xl font-arcade text-xs font-bold transition active:scale-95 flex items-center gap-1.5 shrink-0 ${
                      isMax
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : canAfford && isUnlocked
                        ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-md'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {isMax ? (
                      'MAX'
                    ) : (
                      <>
                        <Coins className="w-3.5 h-3.5 text-amber-400" />
                        <span>{cost}</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Real Live Physics Spec Summary */}
          <div className="mt-1 pt-3 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Top Speed:</span>
              <span className="font-bold text-white">{physicsStats.maxSpeedKmh} KM/H</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Armor Weight:</span>
              <span className="font-bold text-white">{physicsStats.armorWeight.toFixed(1)}x</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Nitro Boost:</span>
              <span className="font-bold text-white">+{Math.round((physicsStats.nitroSpeedMultiplier - 1) * 100)}%</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Nitro Burn:</span>
              <span className="font-bold text-white">{physicsStats.nitroDurationSeconds.toFixed(1)}s</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Control Bar: Race Track Selection & Launch Buttons */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t border-slate-800/80 z-20">
        {/* Track quick selectors */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-2xl border border-slate-800">
            {[
              { id: 'cyber' as const, name: 'Neon Cyber' },
              { id: 'desert' as const, name: 'Desert Canyon' },
              { id: 'beach' as const, name: 'Sunset Beach' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTrackTheme(t.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  trackTheme === t.id
                    ? 'bg-cyan-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-2xl border border-slate-800">
            {[
              { len: 1000, label: '1,000m' },
              { len: 2500, label: '2,500m' },
              { len: 5000, label: '5,000m' },
            ].map((l) => (
              <button
                key={l.len}
                onClick={() => setTrackLength(l.len)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  trackLength === l.len
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Launch Buttons */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Multiplayer Button */}
          <button
            onClick={onOpenMultiplayer}
            disabled={!isUnlocked}
            className="flex-1 md:flex-none py-4 px-6 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-arcade font-bold text-xs md:text-sm rounded-2xl flex items-center justify-center gap-2 shadow-xl transition active:scale-95 disabled:opacity-50"
          >
            <Users className="w-5 h-5 text-indigo-400" />
            <span>MULTIPLAYER PADDOCK</span>
          </button>

          {/* Solo Play (Offline Bots) */}
          <button
            onClick={() => onStartSoloRace(trackLength, trackTheme)}
            disabled={!isUnlocked}
            className="flex-1 md:flex-none py-4 px-8 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:via-blue-500 hover:to-indigo-500 text-white font-arcade font-black text-sm md:text-base tracking-wider rounded-2xl flex items-center justify-center gap-2.5 shadow-2xl transition active:scale-95 disabled:opacity-50 neon-glow-cyan"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>PLAY SOLO (OFFLINE BOTS)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
