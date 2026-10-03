import React, { useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  VEHICLES,
  UPGRADES_META,
  UpgradeKey,
  getUpgradeCost,
  computePhysicsStats,
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
  Volume2,
  VolumeX,
  LogOut,
  Sliders,
  Settings,
  Sparkles,
  Zap,
  Shield,
  Gauge,
  Flame,
  CheckCircle,
  Fingerprint,
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
  onOpenSettings: () => void;
  onOpenBiometricAuth: () => void;
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
  onOpenSettings,
  onOpenBiometricAuth,
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
    '#3b82f6',
    '#ffffff',
  ];

  const hasBiometric = !!(user && garageData.fingerprintAuth);

  return (
    <div className="w-full min-h-screen overflow-y-auto bg-slate-950 text-slate-100 p-4 md:p-8 flex flex-col justify-between gap-8 select-none">
      {/* 1. TOP NAVIGATION HEADER */}
      <header className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-indigo-600 flex items-center justify-center font-arcade font-black text-white text-2xl shadow-lg neon-glow-cyan">
            S
          </div>
          <div>
            <h1 className="font-arcade text-xl md:text-2xl font-black tracking-wider text-glow text-cyan-400 leading-tight">
              SUP APEX NITRO
            </h1>
            <p className="text-xs text-slate-400 font-semibold tracking-wider">
              2.5D MULTIPLAYER ARCADE HYPER RACING
            </p>
          </div>
        </div>

        {/* Currency, Settings & Biometric Auth */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Coins Badge */}
          <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-amber-500/50 rounded-2xl px-4 py-2 shadow-lg">
            <Coins className="w-5 h-5 text-amber-400 animate-spin" />
            <span className="font-arcade text-base md:text-lg font-black text-amber-300">
              {garageData.coins.toLocaleString()} COINS
            </span>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={onToggleMute}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-2xl border border-slate-700 backdrop-blur-md transition active:scale-95 shadow-md"
            title="Toggle Sound"
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5 text-cyan-400" />}
          </button>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-2xl border border-slate-700 backdrop-blur-md transition active:scale-95 shadow-md flex items-center gap-1.5"
            title="Game Settings"
          >
            <Settings className="w-5 h-5 text-cyan-400" />
            <span className="text-xs font-bold hidden sm:inline">Settings</span>
          </button>

          {/* Passwordless Biometric Fingerprint Auth */}
          {hasBiometric ? (
            <div className="flex items-center gap-2.5 bg-slate-900 border border-cyan-500/60 rounded-2xl px-4 py-1.5 backdrop-blur-md shadow-[0_0_15px_rgba(6,182,212,0.25)]">
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Fingerprint className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-arcade font-bold text-white leading-tight">
                  {garageData.displayName || user?.displayName || 'Apex Driver'}
                </span>
                <span className="text-[9px] text-cyan-400 font-semibold flex items-center gap-1">
                  <CheckCircle className="w-2.5 h-2.5 text-emerald-400" /> Fingerprint Verified
                </span>
              </div>
              <button
                onClick={onSignOut}
                className="p-1.5 text-slate-400 hover:text-rose-400 transition ml-1"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenBiometricAuth}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 border border-cyan-400/60 rounded-2xl font-arcade font-bold text-xs text-white shadow-lg transition active:scale-95 neon-glow-cyan"
            >
              <Fingerprint className="w-4 h-4 animate-pulse text-cyan-300" />
              <span>FINGERPRINT SIGN IN / REGISTER</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. CAR SHOWROOM SECTION */}
      <section className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-md flex flex-col gap-6">
        {/* Car Header & Quick Selector Pills */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-arcade font-bold px-2.5 py-1 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-400 uppercase">
                {currentCar.category}
              </span>
              <span className="text-xs text-slate-400 font-semibold">
                ORIGINAL AUDIO: <strong className="text-white uppercase">{currentCar.soundProfile.replace('_', ' ')}</strong>
              </span>
            </div>
            <h2 className="font-arcade text-2xl md:text-4xl font-black text-white mt-1 text-glow">
              {currentCar.name}
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl mt-1 leading-relaxed">
              {currentCar.description}
            </p>
          </div>

          {/* All 6 Cars Quick Switcher Buttons */}
          <div className="flex gap-2 flex-wrap items-center">
            {CAR_KEYS.map((key) => {
              const car = VEHICLES[key];
              const unlocked = garageData.unlockedCars.includes(key);
              const isActive = key === activeCarId;

              return (
                <button
                  key={key}
                  onClick={() => {
                    onSelectCar(key);
                    setSelectedColor(car.primaryColor);
                    soundSynth.playBoostPad();
                  }}
                  className={`px-3 py-2 rounded-2xl border text-xs font-arcade font-bold flex items-center gap-1.5 transition active:scale-95 ${
                    isActive
                      ? 'bg-cyan-600 border-cyan-400 text-white shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                      : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  {!unlocked && <Lock className="w-3.5 h-3.5 text-amber-400" />}
                  <span>{car.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3D Turntable Stage with Carousel Controls */}
        <div className="relative w-full h-80 md:h-96 bg-slate-950/80 rounded-3xl border border-slate-800/80 overflow-hidden flex items-center justify-center shadow-inner">
          <GarageStage carId={activeCarId} customColor={selectedColor} />

          {/* Left / Right Carousel Buttons */}
          <button
            onClick={handlePrevCar}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3.5 bg-slate-900/85 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-2xl backdrop-blur-md transition active:scale-90 shadow-xl z-20"
            aria-label="Previous Car"
          >
            <ChevronLeft className="w-7 h-7" />
          </button>
          <button
            onClick={handleNextCar}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3.5 bg-slate-900/85 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-2xl backdrop-blur-md transition active:scale-90 shadow-xl z-20"
            aria-label="Next Car"
          >
            <ChevronRight className="w-7 h-7" />
          </button>

          {/* Lock Overlay if Locked */}
          {!isUnlocked && (
            <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs flex flex-col items-center justify-center gap-3 rounded-3xl p-6 text-center z-30">
              <div className="p-4 bg-slate-900 border border-amber-500/60 rounded-3xl text-amber-400 shadow-2xl">
                <Lock className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-arcade text-xl font-black text-amber-300">LOCKED VEHICLE</h3>
                <p className="text-xs text-slate-400 mt-0.5">Earn coins in races to unlock this hypercar</p>
              </div>
              <button
                onClick={handleUnlock}
                className="mt-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 text-slate-950 font-arcade font-black text-sm rounded-2xl shadow-xl transition active:scale-95 flex items-center gap-2 neon-glow-amber"
              >
                <Coins className="w-5 h-5" />
                <span>UNLOCK FOR {currentCar.unlockPrice} COINS</span>
              </button>
            </div>
          )}
        </div>

        {/* Paint Swatches & Real Specifications Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Paint Swatches */}
          <div className="lg:col-span-4 flex flex-col gap-2 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
            <span className="text-xs font-bold text-slate-300">CUSTOM LIVERY COAT:</span>
            <div className="flex gap-2 flex-wrap">
              {paintOptions.map((hex, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedColor(hex)}
                  className={`w-7 h-7 rounded-xl border-2 transition active:scale-90 shadow-sm ${
                    selectedColor === hex ? 'border-white scale-110 shadow-cyan-500/50' : 'border-slate-700'
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>

          {/* Physics Stats Cards */}
          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 flex flex-col items-center text-center">
              <Gauge className="w-5 h-5 text-cyan-400 mb-1" />
              <span className="text-[10px] text-slate-400 font-bold">TOP SPEED</span>
              <span className="font-arcade text-lg md:text-xl font-black text-white">{physicsStats.maxSpeedKmh} KM/H</span>
            </div>
            <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 flex flex-col items-center text-center">
              <Shield className="w-5 h-5 text-indigo-400 mb-1" />
              <span className="text-[10px] text-slate-400 font-bold">BUMP MASS</span>
              <span className="font-arcade text-lg md:text-xl font-black text-white">{physicsStats.armorWeight.toFixed(1)}x</span>
            </div>
            <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 flex flex-col items-center text-center">
              <Flame className="w-5 h-5 text-amber-400 mb-1" />
              <span className="text-[10px] text-slate-400 font-bold">NITRO BOOST</span>
              <span className="font-arcade text-lg md:text-xl font-black text-amber-300">+{Math.round((physicsStats.nitroSpeedMultiplier - 1) * 100)}%</span>
            </div>
            <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 flex flex-col items-center text-center">
              <Zap className="w-5 h-5 text-emerald-400 mb-1" />
              <span className="text-[10px] text-slate-400 font-bold">BURN TIME</span>
              <span className="font-arcade text-lg md:text-xl font-black text-emerald-300">{physicsStats.nitroDurationSeconds.toFixed(1)}s</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. PERFORMANCE TUNING & UPGRADES */}
      <section className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-md flex flex-col gap-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div>
            <h3 className="font-arcade text-lg md:text-xl font-black text-cyan-400 text-glow flex items-center gap-2">
              <Sliders className="w-5 h-5 text-cyan-400" />
              <span>PERFORMANCE TUNING UPGRADES</span>
            </h3>
            <p className="text-xs text-slate-400">Upgrade parts to increase top speed, acceleration, and ramming power</p>
          </div>
          <span className="text-xs font-bold text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            MAX LEVEL 5
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {UPGRADES_META.map((meta) => {
            const currentLvl = carUpgrades[meta.key] || 1;
            const isMax = currentLvl >= 5;
            const cost = getUpgradeCost(currentLvl);
            const canAfford = garageData.coins >= cost;

            return (
              <div
                key={meta.key}
                className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-md hover:border-slate-700 transition"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-100">{meta.name}</span>
                    <span className="font-arcade text-xs text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded-md border border-cyan-500/40">
                      LVL {currentLvl}/5
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {meta.description}
                  </p>
                </div>

                {/* Level Pips */}
                <div className="flex gap-1.5 my-1">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <div
                      key={lvl}
                      className={`h-2 flex-1 rounded-full transition-all ${
                        lvl <= currentLvl
                          ? 'bg-gradient-to-r from-cyan-400 to-indigo-500 shadow-[0_0_8px_#06b6d4]'
                          : 'bg-slate-800'
                      }`}
                    />
                  ))}
                </div>

                {/* Upgrade Button */}
                <button
                  onClick={() => handleUpgrade(meta.key)}
                  disabled={isMax || !canAfford || !isUnlocked}
                  className={`w-full py-2.5 px-4 rounded-xl font-arcade text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1.5 ${
                    isMax
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : canAfford && isUnlocked
                      ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-md'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {isMax ? (
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-4 h-4 text-emerald-400" /> MAX LEVEL
                    </span>
                  ) : (
                    <>
                      <Coins className="w-4 h-4 text-amber-400" />
                      <span>UPGRADE TO LVL {currentLvl + 1} ({cost} COINS)</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. TRACK SELECTION SECTION */}
      <section className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-md flex flex-col gap-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div>
            <h3 className="font-arcade text-lg md:text-xl font-black text-indigo-400 text-glow">
              CIRCUIT & TRACK CONFIGURATION
            </h3>
            <p className="text-xs text-slate-400">Choose your competition circuit length and visual environment</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Track Distance */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-slate-300">CIRCUIT DISTANCE:</span>
            <div className="grid grid-cols-3 gap-3">
              {[
                { len: 1000, label: '1,000m', badge: 'Sprint Heat', desc: 'Fast furious 30s dash' },
                { len: 2500, label: '2,500m', badge: 'Standard GP', desc: 'Balanced tactical circuit' },
                { len: 5000, label: '5,000m', badge: 'Endurance', desc: 'Epic long distance test' },
              ].map((opt) => (
                <button
                  key={opt.len}
                  onClick={() => setTrackLength(opt.len)}
                  className={`p-3.5 rounded-2xl border text-center transition ${
                    trackLength === opt.len
                      ? 'bg-cyan-950/90 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                      : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:bg-slate-900'
                  }`}
                >
                  <span className="font-arcade text-base font-black block">{opt.label}</span>
                  <span className="text-xs font-semibold text-slate-200 block mt-0.5">{opt.badge}</span>
                  <span className="text-[10px] text-slate-500 mt-1 block">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Track Theme */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-slate-300">VISUAL ENVIRONMENT:</span>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'cyber' as const, name: 'Neon Cyber', tag: 'Skyline' },
                { id: 'desert' as const, name: 'Desert Canyon', tag: 'Red Rock' },
                { id: 'beach' as const, name: 'Sunset Beach', tag: 'Ocean Water' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTrackTheme(t.id)}
                  className={`p-3.5 rounded-2xl border text-center transition ${
                    trackTheme === t.id
                      ? 'bg-cyan-950/90 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                      : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:bg-slate-900'
                  }`}
                >
                  <span className="font-arcade text-sm font-bold block">{t.name}</span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">{t.tag}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 5. BOTTOM COMMAND & ACTION BAR (With Distinct Gaps for Offline and Multiplayer) */}
      <footer className="sticky bottom-0 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800 p-4 md:p-5 rounded-3xl shadow-2xl flex flex-wrap items-center justify-between gap-6 z-40">
        <div className="flex items-center gap-3">
          {/* AI Crew Chief Advisor Button */}
          <button
            onClick={onOpenAiChief}
            className="py-3 px-5 bg-gradient-to-r from-indigo-950 to-purple-950 hover:from-indigo-900 hover:to-purple-900 border border-indigo-500/50 rounded-2xl text-xs font-arcade font-bold text-indigo-300 flex items-center gap-2 shadow-lg transition active:scale-95"
          >
            <BrainCircuit className="w-4 h-4 text-indigo-400 animate-pulse" />
            <span>APEX AI CHIEF STRATEGY</span>
          </button>
        </div>

        {/* Action Buttons with Generous Gaps */}
        <div className="flex items-center gap-5 sm:gap-7 w-full sm:w-auto">
          {/* Multiplayer Button */}
          <button
            onClick={onOpenMultiplayer}
            disabled={!isUnlocked}
            className="flex-1 sm:flex-none py-4 px-6 md:px-8 bg-slate-900 hover:bg-slate-800 border-2 border-slate-700 hover:border-indigo-400 text-white font-arcade font-bold text-sm md:text-base rounded-2xl flex items-center justify-center gap-2.5 shadow-xl transition active:scale-95 disabled:opacity-50"
          >
            <Users className="w-5 h-5 text-indigo-400" />
            <span>MULTIPLAYER PADDOCK</span>
          </button>

          {/* Play Solo Primary Action Button */}
          <button
            onClick={() => onStartSoloRace(trackLength, trackTheme)}
            disabled={!isUnlocked}
            className="flex-1 sm:flex-none py-4 px-8 md:px-10 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-arcade font-black text-base md:text-lg tracking-wider rounded-2xl flex items-center justify-center gap-3 shadow-2xl transition active:scale-95 disabled:opacity-50 neon-glow-cyan"
          >
            <Play className="w-6 h-6 fill-current" />
            <span>PLAY SOLO (OFFLINE BOTS)</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
