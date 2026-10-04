import React, { useState, useMemo } from 'react';
import {
  VEHICLES,
  UPGRADES_META,
  UpgradeKey,
  getUpgradeCost,
  computePhysicsStats,
} from '../game/cars';
import { UserGarageData, ActiveRacerSession } from '../services/firebase';
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
  User,
} from 'lucide-react';
import { soundSynth } from '../game/audio';
import { TrackThemeId } from '../game/trackGenerator';

interface GarageMenuProps {
  session: ActiveRacerSession | null;
  garageData: UserGarageData;
  onSelectCar: (carId: string) => void;
  onUnlockCar: (carId: string, price: number) => void;
  onUpgradeStat: (carId: string, statKey: UpgradeKey, cost: number) => void;
  onStartSoloRace: (trackLength: number, trackTheme: TrackThemeId) => void;
  onOpenMultiplayer: () => void;
  onOpenAiChief: () => void;
  onOpenSettings: () => void;
  onOpenAuthModal: () => void;
  onSignOut: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

const CAR_KEYS = Object.keys(VEHICLES);

export const GarageMenu: React.FC<GarageMenuProps> = ({
  session,
  garageData,
  onSelectCar,
  onUnlockCar,
  onUpgradeStat,
  onStartSoloRace,
  onOpenMultiplayer,
  onOpenAiChief,
  onOpenSettings,
  onOpenAuthModal,
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

  const paintOptions = useMemo(() => {
    return Array.from(
      new Set([
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
      ])
    );
  }, [currentCar.primaryColor]);

  return (
    <div className="w-full min-h-[100dvh] bg-slate-950 text-slate-100 p-4 sm:p-6 md:p-8 flex flex-col justify-between gap-6 md:gap-8 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
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

        {/* Currency, Settings & Google Auth */}
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

          {/* CUSTOM RACER CLOUD AUTHENTICATION SECTION */}
          {session ? (
            <div className="flex items-center gap-3 bg-slate-900/95 border border-cyan-500/50 rounded-2xl px-3.5 py-1.5 backdrop-blur-md shadow-[0_0_15px_rgba(6,182,212,0.25)]">
              {/* User Avatar */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-indigo-600 flex items-center justify-center font-arcade font-black text-white text-xs shadow-sm">
                {session.displayName.charAt(0).toUpperCase()}
              </div>

              {/* Profile Details */}
              <div className="flex flex-col text-left">
                <span className="text-xs font-arcade font-bold text-white max-w-[130px] truncate leading-tight">
                  {session.displayName}
                </span>
                <span className="text-[10px] text-cyan-400 font-semibold flex items-center gap-1">
                  <CheckCircle className="w-2.5 h-2.5 text-emerald-400" /> Cloud Synced
                </span>
              </div>

              {/* Sign Out Button */}
              <button
                onClick={onSignOut}
                className="p-1.5 text-slate-400 hover:text-rose-400 transition ml-1 rounded-lg hover:bg-slate-800"
                title="Log Out of Racer Account"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-arcade font-bold text-xs rounded-2xl shadow-lg transition active:scale-95 neon-glow-cyan"
              title="Log In or Register Custom Racer Profile"
            >
              <User className="w-4 h-4 text-cyan-200" />
              <span>RACER LOGIN / REGISTER</span>
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
                  {!unlocked && <Lock className="w-3 h-3 text-amber-400" />}
                  <span>{car.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3D Showcase & Tuning Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* 3D Interactive Turntable */}
          <div className="lg:col-span-7 h-72 sm:h-80 md:h-96 relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950/80 shadow-inner group">
            <GarageStage
              carId={activeCarId}
              customColor={selectedColor}
            />

            {/* Left / Right Carousel Controls */}
            <button
              onClick={handlePrevCar}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-3 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-white backdrop-blur-md transition active:scale-90 shadow-lg"
              title="Previous Car"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={handleNextCar}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-white backdrop-blur-md transition active:scale-90 shadow-lg"
              title="Next Car"
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            {/* Custom Paint Color Swatches */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700 shadow-md">
              <span className="text-[10px] font-bold text-slate-400 mr-1 uppercase">Paint:</span>
              {paintOptions.map((c, idx) => (
                <button
                  key={`paint-swatch-${c}-${idx}`}
                  onClick={() => {
                    setSelectedColor(c);
                    soundSynth.playBoostPad();
                  }}
                  className={`w-5 h-5 rounded-full border-2 transition active:scale-90 ${
                    selectedColor === c ? 'border-white scale-110 shadow-md' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>

          {/* Vehicle Stats, Specs, & Upgrade Tuning Matrix */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-arcade font-bold text-cyan-400 uppercase tracking-wider">
                Telemetry & Tuning Matrix
              </span>
              <span className="text-xs text-slate-400 font-semibold">
                Tier Levels: 1 - 5
              </span>
            </div>

            {/* 5 Upgradable Real-Time Physics Stats */}
            <div className="space-y-3">
              {UPGRADES_META.map((meta) => {
                const key = meta.key;
                const currentLevel = carUpgrades[key] || 1;
                const cost = getUpgradeCost(currentLevel);
                const isMax = currentLevel >= 5;

                return (
                  <div
                    key={key}
                    className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between gap-3 shadow-md"
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400 flex-shrink-0">
                        {key === 'topSpeed' && <Gauge className="w-4 h-4" />}
                        {key === 'acceleration' && <Zap className="w-4 h-4" />}
                        {key === 'heavyArmor' && <Shield className="w-4 h-4" />}
                        {key === 'nitroDuration' && <Flame className="w-4 h-4" />}
                        {key === 'nitroPower' && <Sparkles className="w-4 h-4 text-amber-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-arcade font-bold text-white truncate">
                            {meta.name}
                          </span>
                          <span className="text-[10px] text-cyan-400 font-bold ml-2">
                            LVL {currentLevel}/5
                          </span>
                        </div>
                        {/* 5 Pips Progress Bar */}
                        <div className="flex gap-1 mt-1">
                          {[1, 2, 3, 4, 5].map((lvl) => (
                            <div
                              key={lvl}
                              className={`h-1.5 flex-1 rounded-full ${
                                lvl <= currentLevel
                                  ? 'bg-gradient-to-r from-cyan-400 to-indigo-500 shadow-[0_0_6px_rgba(6,182,212,0.6)]'
                                  : 'bg-slate-800'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Upgrade Action Button */}
                    <button
                      onClick={() => handleUpgrade(key)}
                      disabled={isMax || !isUnlocked || garageData.coins < cost}
                      className={`px-3 py-1.5 rounded-xl font-arcade font-bold text-xs flex items-center gap-1 transition active:scale-95 flex-shrink-0 ${
                        isMax
                          ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-default'
                          : !isUnlocked || garageData.coins < cost
                          ? 'bg-slate-900 text-slate-500 border border-slate-800 opacity-60'
                          : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-md font-black'
                      }`}
                    >
                      {isMax ? (
                        'MAX'
                      ) : (
                        <>
                          <Coins className="w-3 h-3 fill-current" />
                          <span>{cost}</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Unlock Locked Car CTA */}
            {!isUnlocked && (
              <div className="mt-2 p-4 rounded-2xl bg-gradient-to-r from-amber-950/60 to-rose-950/60 border border-amber-500/50 flex items-center justify-between gap-4 shadow-xl">
                <div>
                  <span className="font-arcade text-xs font-bold text-amber-400 block uppercase">
                    PROTOTYPE LOCKED
                  </span>
                  <span className="text-xs text-slate-300">
                    Unlock permanent access to this high-performance racing machine.
                  </span>
                </div>
                <button
                  onClick={handleUnlock}
                  disabled={garageData.coins < currentCar.unlockPrice}
                  className="px-5 py-2.5 rounded-2xl font-arcade font-black text-xs bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-lg flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
                >
                  <Coins className="w-4 h-4 fill-current" />
                  <span>UNLOCK ({currentCar.unlockPrice})</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 3. TRACK & RACE CONFIGURATION */}
      <section className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-md flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="text-xs font-arcade font-bold text-cyan-400 uppercase tracking-wider">
            Grand Prix Circuit Parameters
          </span>
          <span className="text-xs text-slate-400">
            Procedural 3D Track Layout with Dynamic Splines
          </span>
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

      {/* 4. BOTTOM COMMAND & ACTION BAR (With Distinct Gaps for Offline and Multiplayer) */}
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
