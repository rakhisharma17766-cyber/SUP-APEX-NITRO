import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  loadUserGarage,
  saveUserGarage,
  loadLocalGarage,
  testFirestoreConnection,
  UserGarageData,
  DEFAULT_USER_GARAGE,
  updatePlayerRaceTick,
  getActiveRacerSession,
  logoutRacer,
  ActiveRacerSession,
  db,
} from './services/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { VEHICLES, computePhysicsStats, UpgradeKey } from './game/cars';
import { TrackThemeId, generateTrackData, TrackData, LANE_X_COORDS } from './game/trackGenerator';
import { RacerEntity, PhysicsEngine, CollisionEvent } from './game/physics';
import { createBotRacers, BotDriver } from './game/aiBots';
import { GameCanvas, HudState } from './game/GameCanvas';
import { GameHUD } from './components/GameHUD';
import { GarageMenu } from './components/GarageMenu';
import { TuningAdvisorModal } from './components/TuningAdvisorModal';
import { MultiplayerLobbyModal } from './components/MultiplayerLobbyModal';
import { RaceFinishedModal } from './components/RaceFinishedModal';
import { SettingsModal, OrientationMode } from './components/SettingsModal';
import { RacerAuthModal } from './components/RacerAuthModal';
import { soundSynth } from './game/audio';

type GameMode = 'garage' | 'racing' | 'finished';

const DEFAULT_HUD_STATE: HudState = {
  speedKmh: 0,
  nitroPercent: 100,
  playerRank: 1,
  playerProgress: 0,
  isAirborne: false,
  onRamp: false,
  slipstreamActive: false,
  stunTimer: 0,
  racersProgress: [],
};

export default function App() {
  const [session, setSession] = useState<ActiveRacerSession | null>(() => getActiveRacerSession());
  const [garageData, setGarageData] = useState<UserGarageData>(() => loadLocalGarage());
  const [gameMode, setGameMode] = useState<GameMode>('garage');

  // Active Race Configuration
  const [activeTrackTheme, setActiveTrackTheme] = useState<TrackThemeId>('cyber');
  const [activeTrackLength, setActiveTrackLength] = useState<number>(2500);
  const [multiplayerRoomId, setMultiplayerRoomId] = useState<string | null>(null);

  // Modals
  const [showTuningAdvisor, setShowTuningAdvisor] = useState<boolean>(false);
  const [showMultiplayerLobby, setShowMultiplayerLobby] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);

  // Orientation Mode: 'auto' | 'landscape' | 'portrait'
  const [orientationMode, setOrientationMode] = useState<OrientationMode>('auto');

  // Active Racers & Physics Engine
  const [trackData, setTrackData] = useState<TrackData | null>(null);
  const physicsEngineRef = useRef<PhysicsEngine | null>(null);
  const playerEntityRef = useRef<RacerEntity | null>(null);
  const botDriversRef = useRef<BotDriver[]>([]);
  const opponentRacersRef = useRef<Map<string, RacerEntity>>(new Map());

  // Input states (Stable Ref read inside GameCanvas 60 FPS loop)
  const inputRef = useRef<{
    throttle: number; // 1: gas, -1: brake, 0: coast
    targetLane: number; // 0..3 (0: Leftmost on screen, 3: Rightmost on screen)
    wantsNitro: boolean;
  }>({
    throttle: 1, // Default forward drive
    targetLane: 1,
    wantsNitro: false,
  });

  // UI state for button highlights
  const [currentThrottle, setCurrentThrottle] = useState<number>(1);
  const [wantsNitroState, setWantsNitroState] = useState<boolean>(false);

  // Decoupled HUD state received from canvas loop at ~16Hz
  const [hudState, setHudState] = useState<HudState>(DEFAULT_HUD_STATE);
  const [activeNotification, setActiveNotification] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [totalBumpsDelivered, setTotalBumpsDelivered] = useState<number>(0);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(soundSynth.getMuted());

  // 1. Initialize Connection & Auto-Load Saved Garage on boot
  useEffect(() => {
    testFirestoreConnection();
    const currentSession = getActiveRacerSession();
    setSession(currentSession);
    loadUserGarage(currentSession).then((loaded) => {
      setGarageData(loaded);
    });
  }, []);

  const handleAuthSuccess = (newSession: ActiveRacerSession, loadedGarage: UserGarageData) => {
    setSession(newSession);
    setGarageData(loadedGarage);
    triggerHUDAlert(`RACER PROFILE LOADED: ${newSession.displayName.toUpperCase()}!`);
  };

  const handleSignOut = () => {
    logoutRacer();
    setSession(null);
    const local = loadLocalGarage();
    setGarageData(local);
    triggerHUDAlert('LOGGED OUT TO GUEST MODE');
  };

  // Car Selection & Upgrades
  const handleSelectCar = (carId: string) => {
    const updated = { ...garageData, activeCarId: carId };
    setGarageData(updated);
    saveUserGarage(session, updated);
  };

  const handleUnlockCar = (carId: string, price: number) => {
    if (garageData.coins < price) return;
    const updated = {
      ...garageData,
      coins: garageData.coins - price,
      activeCarId: carId,
      unlockedCars: [...garageData.unlockedCars, carId],
    };
    setGarageData(updated);
    saveUserGarage(session, updated);
  };

  const handleUpgradeStat = (carId: string, statKey: UpgradeKey, cost: number) => {
    if (garageData.coins < cost) return;
    const currentLevels = garageData.upgrades[carId] || {
      topSpeed: 1,
      acceleration: 1,
      heavyArmor: 1,
      nitroDuration: 1,
      nitroPower: 1,
    };
    const nextLvl = (currentLevels[statKey] || 1) + 1;
    const updated: UserGarageData = {
      ...garageData,
      coins: garageData.coins - cost,
      upgrades: {
        ...garageData.upgrades,
        [carId]: {
          ...currentLevels,
          [statKey]: nextLvl,
        },
      },
    };
    setGarageData(updated);
    saveUserGarage(session, updated);
  };

  const handleAwardCoins = (amount: number) => {
    const isWinner = playerEntityRef.current?.rank === 1;
    const updated: UserGarageData = {
      ...garageData,
      coins: garageData.coins + amount,
      stats: {
        ...garageData.stats,
        racesPlayed: (garageData.stats.racesPlayed || 0) + 1,
        racesWon: isWinner ? (garageData.stats.racesWon || 0) + 1 : garageData.stats.racesWon || 0,
        totalBumps: (garageData.stats.totalBumps || 0) + totalBumpsDelivered,
      },
    };
    setGarageData(updated);
    saveUserGarage(session, updated);
  };

  const triggerHUDAlert = (text: string) => {
    setActiveNotification(text);
    setTimeout(() => {
      setActiveNotification((prev) => (prev === text ? null : prev));
    }, 2800);
  };

  // Start Offline / Solo Race
  const handleStartSoloRace = (len: number, theme: TrackThemeId) => {
    setActiveTrackLength(len);
    setActiveTrackTheme(theme);
    setMultiplayerRoomId(null);
    initializeRace(len, theme, null);
  };

  // Start Multiplayer Race
  const handleStartMultiplayerRace = (roomId: string, len: number, theme: TrackThemeId) => {
    setActiveTrackLength(len);
    setActiveTrackTheme(theme);
    setMultiplayerRoomId(roomId);
    setShowMultiplayerLobby(false);
    initializeRace(len, theme, roomId);
  };

  // Core Race Initializer
  const initializeRace = (trackLen: number, trackTheme: TrackThemeId, roomId: string | null) => {
    const newTrack = generateTrackData(trackLen, trackTheme);
    setTrackData(newTrack);

    const activeCarKey = garageData.activeCarId || 'red_storm';
    const carUpgrades = garageData.upgrades[activeCarKey] || {
      topSpeed: 1,
      acceleration: 1,
      heavyArmor: 1,
      nitroDuration: 1,
      nitroPower: 1,
    };
    const playerPhysicsStats = computePhysicsStats(activeCarKey, carUpgrades);

    // Player Entity
    const playerEntity: RacerEntity = {
      id: session ? session.username : 'player_1',
      isPlayer: true,
      name: session ? session.displayName : garageData.displayName || 'You',
      carId: activeCarKey,
      color: VEHICLES[activeCarKey]?.primaryColor || '#ef4444',
      lane: 1,
      currentX: LANE_X_COORDS[1],
      currentY: 0,
      currentZ: 0,
      speed: 0,
      verticalVelocity: 0,
      rollAngle: 0,
      pitchAngle: 0,
      yawAngle: 0,
      isAirborne: false,
      onRamp: false,
      nitroActive: false,
      nitroFuel: 1.0,
      slipstreamActive: false,
      boostPadTimer: 0,
      stunTimer: 0,
      isBraking: false,
      finished: false,
      finishTime: 0,
      rank: 1,
      stats: playerPhysicsStats,
    };
    playerEntityRef.current = playerEntity;

    // Smart AI Bots
    const bots = createBotRacers(newTrack);
    botDriversRef.current = bots;

    // Physics Engine
    const physics = new PhysicsEngine(newTrack);
    physicsEngineRef.current = physics;

    // Reset controls & HUD
    inputRef.current = { throttle: 1, targetLane: 1, wantsNitro: false };
    setCurrentThrottle(1);
    setWantsNitroState(false);
    setTotalBumpsDelivered(0);
    setHudState({
      speedKmh: 0,
      nitroPercent: 100,
      playerRank: 1,
      playerProgress: 0,
      isAirborne: false,
      onRamp: false,
      slipstreamActive: false,
      stunTimer: 0,
      racersProgress: [],
    });

    setGameMode('racing');
    soundSynth.startEngine(VEHICLES[activeCarKey]?.soundProfile || 'f1_scream');

    // Countdown sequence (3, 2, 1, GO)
    setCountdown(3);
    soundSynth.playCountdownBeep(false);

    let count = 3;
    const interval = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
        soundSynth.playCountdownBeep(false);
      } else if (count === 0) {
        setCountdown(0);
        soundSynth.playCountdownBeep(true);
        triggerHUDAlert('GO! BOOST AWAY!');
      } else {
        setCountdown(null);
        clearInterval(interval);
      }
    }, 1000);
  };

  // Realtime Multiplayer Sync Listener (Throttled Firestore Snapshot)
  useEffect(() => {
    if (!multiplayerRoomId || gameMode !== 'racing') return;

    const unsub = onSnapshot(
      collection(db, 'rooms', multiplayerRoomId, 'players'),
      (snapshot) => {
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const pId = data.playerId;
          const myId = session ? session.username : 'player_1';
          if (pId !== myId) {
            const oppCarId = data.carId || 'red_storm';
            const existing = opponentRacersRef.current.get(pId);
            if (!existing) {
              const newOpponent: RacerEntity = {
                id: pId,
                isPlayer: false,
                name: data.displayName || 'Opponent',
                carId: oppCarId,
                color: data.color || '#06b6d4',
                lane: data.lane || 2,
                currentX: data.x || 0,
                currentY: 0,
                currentZ: data.z || 0,
                speed: (data.speed || 0) / 3.6,
                verticalVelocity: 0,
                rollAngle: 0,
                pitchAngle: 0,
                yawAngle: 0,
                isAirborne: false,
                onRamp: false,
                nitroActive: data.nitroActive || false,
                nitroFuel: 1.0,
                slipstreamActive: false,
                boostPadTimer: 0,
                stunTimer: 0,
                isBraking: false,
                finished: data.finished || false,
                finishTime: data.finishTime || 0,
                rank: data.rank || 2,
                stats: computePhysicsStats(oppCarId),
              };
              opponentRacersRef.current.set(pId, newOpponent);
            } else {
              // Interpolate remote opponent tick
              existing.currentX = existing.currentX * 0.7 + (data.x || 0) * 0.3;
              existing.currentZ = existing.currentZ * 0.6 + (data.z || 0) * 0.4;
              existing.speed = (data.speed || 0) / 3.6;
              existing.nitroActive = data.nitroActive || false;
              existing.finished = data.finished || false;
              existing.rank = data.rank || existing.rank;
            }
          }
        });
      },
      (err) => {
        console.warn('Opponent sync error:', err);
      }
    );

    return () => unsub();
  }, [multiplayerRoomId, gameMode, session]);

  // Throttled 20Hz Network Tick Outbound to Firestore
  useEffect(() => {
    if (!multiplayerRoomId || gameMode !== 'racing') return;

    const interval = setInterval(() => {
      const p = playerEntityRef.current;
      if (p) {
        const myId = session ? session.username : 'player_1';
        updatePlayerRaceTick(multiplayerRoomId, myId, {
          x: p.currentX,
          z: p.currentZ,
          lane: p.lane,
          speed: Math.round(p.speed * 3.6),
          nitroActive: p.nitroActive,
          finished: p.finished,
          finishTime: p.finishTime,
          rank: p.rank,
        });
      }
    }, 50); // 20Hz

    return () => clearInterval(interval);
  }, [multiplayerRoomId, gameMode, session]);

  // Handle Collision Events
  const handleCollisionEvent = (event: CollisionEvent) => {
    if (event.type === 'bump') {
      soundSynth.playBump(event.intensity);
      if (event.intensity > 0.6) {
        triggerHUDAlert('HEAVY BUMP!');
        setTotalBumpsDelivered((prev) => prev + 1);
      }
    } else if (event.type === 'obstacle') {
      soundSynth.playBump(0.9);
      triggerHUDAlert('CRASH! BARRIER HIT');
    } else if (event.type === 'boost_pad') {
      soundSynth.playBoostPad();
      triggerHUDAlert('SUPERCHARGED BOOST PAD!');
    } else if (event.type === 'ramp') {
      soundSynth.playRampJump();
      triggerHUDAlert('RAMP LAUNCH! AIR TIME!');
    }
  };

  // Input Handlers
  const handleLaneShift = (direction: -1 | 1) => {
    if (countdown !== null && countdown > 0) return;
    const current = inputRef.current.targetLane;
    const nextLane = Math.max(0, Math.min(3, current + direction));
    if (nextLane !== current) {
      inputRef.current.targetLane = nextLane;
      soundSynth.playLaneSwitch();
    }
  };

  const handleThrottleChange = (val: number) => {
    inputRef.current.throttle = val;
    setCurrentThrottle(val);
  };

  const handleNitroToggle = (active: boolean) => {
    inputRef.current.wantsNitro = active;
    setWantsNitroState(active);
  };

  const handleToggleMute = () => {
    const muted = soundSynth.toggleMute();
    setIsAudioMuted(muted);
  };

  const handleRaceFinished = useCallback(() => {
    setGameMode('finished');
  }, []);

  return (
    <div className="relative w-full min-h-[100dvh] bg-slate-950 text-slate-100 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* 1. Main Garage View (Clean, Scrollable, Professional) */}
      {gameMode === 'garage' && (
        <GarageMenu
          session={session}
          garageData={garageData}
          onSelectCar={handleSelectCar}
          onUnlockCar={handleUnlockCar}
          onUpgradeStat={handleUpgradeStat}
          onStartSoloRace={handleStartSoloRace}
          onOpenMultiplayer={() => setShowMultiplayerLobby(true)}
          onOpenAiChief={() => setShowTuningAdvisor(true)}
          onOpenSettings={() => setShowSettings(true)}
          onOpenAuthModal={() => setShowAuthModal(true)}
          onSignOut={handleSignOut}
          isMuted={isAudioMuted}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* 2. Active 3D Race View - Locked to Dynamic Viewport (Zero Scroll Glitches) */}
      {gameMode === 'racing' && trackData && playerEntityRef.current && physicsEngineRef.current && (
        <div className="fixed inset-0 z-50 w-screen h-[100dvh] flex items-center justify-center bg-slate-950 overflow-hidden touch-none select-none pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
          <div
            className={`relative overflow-hidden w-full h-full flex items-center justify-center ${
              orientationMode === 'landscape'
                ? 'max-w-[177.78vh] aspect-video max-h-screen shadow-2xl rounded-none md:rounded-3xl border border-slate-800'
                : orientationMode === 'portrait'
                ? 'max-h-[177.78vw] aspect-[9/16] max-w-screen shadow-2xl rounded-none md:rounded-3xl border border-slate-800'
                : ''
            }`}
          >
            <GameCanvas
              track={trackData}
              playerEntity={playerEntityRef.current}
              botDrivers={botDriversRef.current}
              opponentRacersMap={opponentRacersRef.current}
              physics={physicsEngineRef.current}
              inputRef={inputRef}
              onHudUpdate={setHudState}
              onCollisionEvent={handleCollisionEvent}
              onRaceFinished={handleRaceFinished}
              countdown={countdown}
            />

            <GameHUD
              hudState={hudState}
              activeNotification={activeNotification}
              onLaneShift={handleLaneShift}
              onThrottleChange={handleThrottleChange}
              onNitroToggle={handleNitroToggle}
              isMuted={isAudioMuted}
              onToggleMute={handleToggleMute}
              onOpenSettings={() => setShowSettings(true)}
              countdown={countdown}
              currentThrottle={currentThrottle}
              wantsNitro={wantsNitroState}
              orientationMode={orientationMode}
            />
          </div>
        </div>
      )}

      {/* 3. Race Finished Results Modal */}
      {gameMode === 'finished' && playerEntityRef.current && (
        <RaceFinishedModal
          player={playerEntityRef.current}
          racers={[
            playerEntityRef.current,
            ...botDriversRef.current.map((b) => b.entity),
            ...Array.from(opponentRacersRef.current.values()),
          ]}
          totalBumps={totalBumpsDelivered}
          onReplay={() => initializeRace(activeTrackLength, activeTrackTheme, multiplayerRoomId)}
          onReturnToGarage={() => setGameMode('garage')}
          onAwardCoins={handleAwardCoins}
        />
      )}

      {/* Gemini AI Tuning Advisor Modal */}
      {showTuningAdvisor && (
        <TuningAdvisorModal
          carId={garageData.activeCarId || 'red_storm'}
          themeId={activeTrackTheme}
          trackLength={activeTrackLength}
          upgrades={garageData.upgrades[garageData.activeCarId || 'red_storm'] || {}}
          onClose={() => setShowTuningAdvisor(false)}
        />
      )}

      {/* Multiplayer Room Lobby Modal */}
      {showMultiplayerLobby && (
        <MultiplayerLobbyModal
          session={session}
          activeCarId={garageData.activeCarId || 'red_storm'}
          onStartMultiplayerRace={handleStartMultiplayerRace}
          onClose={() => setShowMultiplayerLobby(false)}
          onOpenAuthModal={() => setShowAuthModal(true)}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          orientationMode={orientationMode}
          onSetOrientationMode={setOrientationMode}
          isMuted={isAudioMuted}
          onToggleMute={handleToggleMute}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Custom Racer Cloud Authentication Modal */}
      {showAuthModal && (
        <RacerAuthModal
          onSuccess={handleAuthSuccess}
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </div>
  );
}
