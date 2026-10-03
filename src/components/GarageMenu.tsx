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
  LogIn,
  LogOut,
  Sliders,
  MapPin,
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
  const [sideTab, setSideTab] = useState<'upgrades' | 'track'>('upgrades');

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
    <div className="w-full h-full max-h-screen overflow-hidden flex flex-col justify-between p-3 md:p-5 select-none bg-slate-950 text-slate-100">
      {/* 1. TOP HEADER (Fixed Height) */}
      <header className="flex items-center justify-between z-20 shrink-0 pb-2 border-b border-slate-800/80">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-cyan-400 to-indigo-600 flex items-center justify-center font-arcade font-black text-white text-lg shadow-lg neon-glow-cyan">
            S
          </div>
          <div>
            <h1 className="font-arcade text-lg md:text-xl font-black tracking-wider text-glow text-cyan-400 leading-none">
              SUP APEX NITRO
            </h1>
            <span className="text-[10px] text-slate-400 font-semibold tracking-wider">
              2.5D MULTIPLAYER ARCADE RACING
            </span>
          </div>
        </div>

        {/* Currency & Authentication */}
        <div className="flex items-center gap-2.5">
          {/* Coins Badge */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-amber-500/50 rounded-2xl px-3 py-1.5 shadow-lg">
            <Coins className="w-4 h-4 text-amber-400 animate-spin" />
            <span className="font-arcade text-sm md:text-base font-black text-amber-300">
              {garageData.coins.toLocaleString()}
            </span>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={onToggleMute}
            className="p-2 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-2xl border border-slate-700 backdrop-blur-md transition active:scale-95 shadow-md"
            title="Toggle Sound"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>

          {/* Auth Button */}
          {user ? (
            <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700 rounded-2xl px-3 py-1 backdrop-blur-md">
              <span className="text-xs font-semibold text-slate-200 hidden sm:inline max-w-[100px] truncate">
                {user.displayName || 'Apex Driver'}
              </span>
              <button
                onClick={onSignOut}
                className="p-1 text-slate-400 hover:text-rose-400 transition"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onSignIn}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/90 hover:bg-indigo-600 border border-indigo-400/50 rounded-2xl font-semibold text-xs text-white shadow-md transition active:scale-95"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. CENTER STAGE & PANELS (Flex-1, Scroll-safe, Never overflows viewport) */}
      <main className="flex-1 min-h-0 py-3 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center z-10 overflow-hidden">
        {/* 3D Turntable Showroom (Left / Center) */}
        <div className="lg:col-span-7 h-full flex flex-col justify-between relative bg-slate-900/40 rounded-3xl border border-slate-800/80 p-3 overflow-hidden">
          {/* Car Metadata Header */}
          <div className="flex items-start justify-between z-10">
            <div>
              <span className="text-[10px] font-arcade font-bold px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-400 uppercase">
                {currentCar.category}
              </span>
              <h2 className="font-arcade text-xl md:text-2xl font-black text-white mt-1 text-glow">
                {currentCar.name}
              </h2>
              <p className="text-[11px] text-slate-300 max-w-sm line-clamp-2">
                {currentCar.description}
              </p>
            </div>

            {/* Paint Palette */}
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] font-bold text-slate-400">LIVERY</span>
              <div className="flex gap-1.5">
                {paintOptions.slice(0, 5).map((hex, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedColor(hex)}
                    className={`w-5 h-5 rounded-lg border transition active:scale-90 shadow-sm ${
                      selectedColor === hex ? 'border-white scale-110 shadow-cyan-500/50' : 'border-slate-700'
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* 3D Model Stage Canvas */}
          <div className="relative flex-1 min-h-0 w-full flex items-center justify-center">
            <GarageStage carId={activeCarId} customColor={selectedColor} />

            {/* Left & Right Switch Controls */}
            <button
              onClick={handlePrevCar}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2.5 bg-slate-900/85 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-2xl backdrop-blur-md transition active:scale-90 shadow-lg z-20"
              aria-label="Previous Car"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleNextCar}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-slate-900/85 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-2xl backdrop-blur-md transition active:scale-90 shadow-lg z-20"
              aria-label="Next Car"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* Lock Overlay */}
            {!isUnlocked && (
              <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs flex flex-col items-center justify-center gap-2 rounded-2xl p-4 text-center z-30">
                <div className="p-3 bg-slate-900/90 border border-amber-500/60 rounded-2xl text-amber-400 shadow-xl">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-arcade text-base font-black text-amber-300">LOCKED VEHICLE</h3>
                  <p className="text-[11px] text-slate-400">Unlock with earned race bounty</p>
                </div>
                <button
                  onClick={handleUnlock}
                  className="mt-1 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 text-slate-950 font-arcade font-black text-xs rounded-xl shadow-xl transition active:scale-95 flex items-center gap-1.5 neon-glow-amber"
                >
                  <Coins className="w-4 h-4" />
                  <span>UNLOCK FOR {currentCar.unlockPrice} COINS</span>
                </button>
              </div>
            )}
          </div>

          {/* Quick Specs Footer */}
          <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-[10px] md:text-xs text-center z-10">
            <div className="bg-slate-950/60 p-1.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[9px]">TOP SPEED</span>
              <span className="font-bold text-white">{physicsStats.maxSpeedKmh} KM/H</span>
            </div>
            <div className="bg-slate-950/60 p-1.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[9px]">ARMOR MASS</span>
              <span className="font-bold text-white">{physicsStats.armorWeight.toFixed(1)}x</span>
            </div>
            <div className="bg-slate-950/60 p-1.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[9px]">NITRO BOOST</span>
              <span className="font-bold text-cyan-300">+{Math.round((physicsStats.nitroSpeedMultiplier - 1) * 100)}%</span>
            </div>
            <div className="bg-slate-950/60 p-1.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[9px]">BURN TIME</span>
              <span className="font-bold text-amber-300">{physicsStats.nitroDurationSeconds.toFixed(1)}s</span>
            </div>
          </div>
        </div>

        {/* Right Side: Tabbed Upgrades & Track Setup (Locked Height with Internal Scroll) */}
        <div className="lg:col-span-5 h-full flex flex-col justify-between bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-3xl p-3.5 shadow-2xl overflow-hidden">
          {/* Tabs Navigation */}
          <div className="flex bg-slate-950/80 p-1 rounded-2xl border border-slate-800 shrink-0">
            <button
              onClick={() => setSideTab('upgrades')}
              className={`flex-1 py-1.5 rounded-xl font-arcade text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                sideTab === 'upgrades'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>TUNING & UPGRADES</span>
            </button>
            <button
              onClick={() => setSideTab('track')}
              className={`flex-1 py-1.5 rounded-xl font-arcade text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                sideTab === 'track'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>TRACK SELECTION</span>
            </button>
          </div>

          {/* Tab 1: Performance Upgrades */}
          {sideTab === 'upgrades' ? (
            <div className="flex-1 min-h-0 overflow-y-auto pr-1 my-2 flex flex-col gap-2">
              {UPGRADES_META.map((meta) => {
                const currentLvl = carUpgrades[meta.key] || 1;
                const isMax = currentLvl >= 5;
                const cost = getUpgradeCost(currentLvl);
                const canAfford = garageData.coins >= cost;

                return (
                  <div
                    key={meta.key}
                    className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-2.5 flex items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="flex flex-col flex-1">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                        <span>{meta.name}</span>
                        <span className="font-arcade text-cyan-400 text-[11px]">
                          Lvl {currentLvl}/5
                        </span>
                      </div>
                      <div className="flex gap-1.5 mt-1.5">
                        {[1, 2, 3, 4, 5].map((lvl) => (
                          <div
                            key={lvl}
                            className={`h-1.5 flex-1 rounded-full transition-all ${
                              lvl <= currentLvl
                                ? 'bg-gradient-to-r from-cyan-400 to-indigo-500 shadow-[0_0_6px_#06b6d4]'
                                : 'bg-slate-800'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => handleUpgrade(meta.key)}
                      disabled={isMax || !canAfford || !isUnlocked}
                      className={`py-1.5 px-3 rounded-xl font-arcade text-xs font-bold transition active:scale-95 flex items-center gap-1 shrink-0 ${
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
          ) : (
            /* Tab 2: Track Distance & Theme */
            <div className="flex-1 min-h-0 overflow-y-auto pr-1 my-2 flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-slate-300">Track Distance:</span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { len: 1000, label: '1,000m', badge: 'Sprint' },
                    { len: 2500, label: '2,500m', badge: 'Standard' },
                    { len: 5000, label: '5,000m', badge: 'Endurance' },
                  ].map((opt) => (
                    <button
                      key={opt.len}
                      onClick={() => setTrackLength(opt.len)}
                      className={`p-2 rounded-2xl border text-center transition ${
                        trackLength === opt.len
                          ? 'bg-cyan-950/80 border-cyan-400 text-cyan-300 shadow-md'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-900'
                      }`}
                    >
                      <span className="font-arcade text-xs font-black block">{opt.label}</span>
                      <span className="text-[10px] text-slate-500">{opt.badge}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-slate-300">Visual Theme:</span>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: 'cyber' as const, name: 'Neon Cyber City', desc: 'Glowing cyan gridlines & skyscrapers' },
                    { id: 'desert' as const, name: 'Desert Canyon', desc: 'Terracotta canyons & red rock mesas' },
                    { id: 'beach' as const, name: 'Sunset Beach', desc: 'Tropical highway & ocean water plane' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTrackTheme(t.id)}
                      className={`p-2.5 rounded-2xl border text-left flex items-center justify-between transition ${
                        trackTheme === t.id
                          ? 'bg-cyan-950/80 border-cyan-400 text-cyan-300 shadow-md'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-900'
                      }`}
                    >
                      <div>
                        <span className="font-arcade text-xs font-bold block">{t.name}</span>
                        <span className="text-[10px] text-slate-400">{t.desc}</span>
                      </div>
                      <div className={`w-3.5 h-3.5 rounded-full border ${trackTheme === t.id ? 'bg-cyan-400 border-white' : 'border-slate-700'}`} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* AI Advisor Button inside card */}
          <button
            onClick={onOpenAiChief}
            className="w-full py-2.5 px-3 bg-indigo-950/70 hover:bg-indigo-900/80 border border-indigo-500/50 rounded-2xl text-xs font-arcade font-bold text-indigo-300 flex items-center justify-center gap-2 shadow-lg transition active:scale-95 shrink-0"
          >
            <BrainCircuit className="w-4 h-4 text-indigo-400 animate-pulse" />
            <span>APEX AI CREW CHIEF STRATEGY</span>
          </button>
        </div>
      </main>

      {/* 3. BOTTOM COMMAND BAR (Fixed Height, Always Visible) */}
      <footer className="shrink-0 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-3 z-20">
        <div className="flex items-center gap-2 text-xs text-slate-400 hidden sm:flex">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>Server 60 FPS Engine Ready</span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Multiplayer Button */}
          <button
            onClick={onOpenMultiplayer}
            disabled={!isUnlocked}
            className="flex-1 sm:flex-none py-3 px-5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-arcade font-bold text-xs md:text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg transition active:scale-95 disabled:opacity-50"
          >
            <Users className="w-4 h-4 text-indigo-400" />
            <span>MULTIPLAYER PADDOCK</span>
          </button>

          {/* Play Solo (Offline Bots) Primary Button */}
          <button
            onClick={() => onStartSoloRace(trackLength, trackTheme)}
            disabled={!isUnlocked}
            className="flex-1 sm:flex-none py-3 px-7 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-arcade font-black text-sm md:text-base tracking-wider rounded-2xl flex items-center justify-center gap-2 shadow-2xl transition active:scale-95 disabled:opacity-50 neon-glow-cyan"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>PLAY SOLO (OFFLINE BOTS)</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
