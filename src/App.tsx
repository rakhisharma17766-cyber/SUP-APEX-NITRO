import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  loadUserGarage,
  saveUserGarage,
  testFirestoreConnection,
  UserGarageData,
  DEFAULT_USER_GARAGE,
  updatePlayerRaceTick,
  db,
} from './services/firebase';
import { User as FirebaseUser } from 'firebase/auth';
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
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [garageData, setGarageData] = useState<UserGarageData>(DEFAULT_USER_GARAGE);
  const [gameMode, setGameMode] = useState<GameMode>('garage');

  // Active Race Configuration
  const [activeTrackTheme, setActiveTrackTheme] = useState<TrackThemeId>('cyber');
  const [activeTrackLength, setActiveTrackLength] = useState<number>(2500);
  const [multiplayerRoomId, setMultiplayerRoomId] = useState<string | null>(null);

  // Modals
  const [showTuningAdvisor, setShowTuningAdvisor] = useState<boolean>(false);
  const [showMultiplayerLobby, setShowMultiplayerLobby] = useState<boolean>(false);

  // Active Racers & Physics Engine
  const [trackData, setTrackData] = useState<TrackData | null>(null);
  const physicsEngineRef = useRef<PhysicsEngine | null>(null);
  const playerEntityRef = useRef<RacerEntity | null>(null);
  const botDriversRef = useRef<BotDriver[]>([]);
  const opponentRacersRef = useRef<Map<string, RacerEntity>>(new Map());

  // Input states (Stable Ref read inside GameCanvas 60 FPS loop)
  const inputRef = useRef<{
    throttle: number; // 1: gas, -1: brake, 0: coast
    targetLane: number; // 0..3
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

  // 1. Initialize Firebase Connection & Auth
  useEffect(() => {
    testFirestoreConnection();

    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      const garage = await loadUserGarage(user);
      setGarageData(garage);
    });

    return () => unsub();
  }, []);

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.warn('Google sign-in popup error:', e);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      const local = await loadUserGarage(null);
      setGarageData(local);
    } catch (e) {
      console.warn('Sign out error:', e);
    }
  };

  // Car Selection & Upgrades
  const handleSelectCar = (carId: string) => {
    const updated = { ...garageData, activeCarId: carId };
    setGarageData(updated);
    saveUserGarage(currentUser, updated);
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
    saveUserGarage(currentUser, updated);
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
    saveUserGarage(currentUser, updated);
  };

  const handleAwardCoins = (amount: number) => {
    const updated: UserGarageData = {
      ...garageData,
      coins: garageData.coins + amount,
      stats: {
        ...garageData.stats,
        racesPlayed: garageData.stats.racesPlayed + 1,
        totalBumps: garageData.stats.totalBumps + totalBumpsDelivered,
      },
    };
    setGarageData(updated);
    saveUserGarage(currentUser, updated);
  };

  // Start Race Setup
  const initializeRace = useCallback(
    (length: number, theme: TrackThemeId, roomId: string | null = null) => {
      const track = generateTrackData(length, theme);
      setTrackData(track);
      physicsEngineRef.current = new PhysicsEngine(track);

      const carId = garageData.activeCarId || 'red_storm';
      const carDef = VEHICLES[carId] || VEHICLES.red_storm;
      const upgrades = garageData.upgrades[carId] || {};
      const physicsStats = computePhysicsStats(carId, upgrades);

      const player: RacerEntity = {
        id: currentUser ? currentUser.uid : 'player_local',
        isPlayer: true,
        name: currentUser?.displayName || 'Apex Driver',
        carId,
        color: carDef.primaryColor,
        lane: 1,
        currentX: LANE_X_COORDS[1],
        currentZ: 0,
        currentY: 0,
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
        stats: physicsStats,
      };

      playerEntityRef.current = player;
      inputRef.current = {
        throttle: 1, // Start accelerating on green
        targetLane: 1,
        wantsNitro: false,
      };
      setCurrentThrottle(1);
      setWantsNitroState(false);
      setTotalBumpsDelivered(0);
      setMultiplayerRoomId(roomId);
      setShowMultiplayerLobby(false);

      // Generate Fallback AI Bots
      const bots = createBotRacers(track);
      botDriversRef.current = bots;
      opponentRacersRef.current.clear();

      setGameMode('racing');

      // Countdown sequence (3, 2, 1, GO!)
      setCountdown(3);
      soundSynth.playCountdownBeep(false);

      const t1 = setTimeout(() => {
        setCountdown(2);
        soundSynth.playCountdownBeep(false);
      }, 1000);

      const t2 = setTimeout(() => {
        setCountdown(1);
        soundSynth.playCountdownBeep(false);
      }, 2000);

      const t3 = setTimeout(() => {
        setCountdown(0);
        soundSynth.playCountdownBeep(true);
        setTimeout(() => setCountdown(null), 1000);
      }, 3000);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    },
    [currentUser, garageData]
  );

  const handleStartSoloRace = (length: number, theme: TrackThemeId) => {
    setActiveTrackLength(length);
    setActiveTrackTheme(theme);
    initializeRace(length, theme, null);
  };

  const handleStartMultiplayerRace = (roomId: string, length: number, theme: TrackThemeId) => {
    setActiveTrackLength(length);
    setActiveTrackTheme(theme);
    initializeRace(length, theme, roomId);
  };

  // Keyboard Controls Listener (WASD & Arrow Keys & Space)
  useEffect(() => {
    if (gameMode !== 'racing') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Steer Left
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        inputRef.current.targetLane = Math.max(0, inputRef.current.targetLane - 1);
      }
      // Steer Right
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        inputRef.current.targetLane = Math.min(3, inputRef.current.targetLane + 1);
      }
      // Accelerate (Gas)
      else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        inputRef.current.throttle = 1;
        setCurrentThrottle(1);
      }
      // Brake
      else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        inputRef.current.throttle = -1;
        setCurrentThrottle(-1);
      }
      // Nitro Boost
      else if (e.key === ' ' || e.key === 'Shift') {
        if (!inputRef.current.wantsNitro) {
          inputRef.current.wantsNitro = true;
          setWantsNitroState(true);
          soundSynth.playNitroBoost();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (
        e.key === 'ArrowUp' ||
        e.key === 'w' ||
        e.key === 'W' ||
        e.key === 'ArrowDown' ||
        e.key === 's' ||
        e.key === 'S'
      ) {
        inputRef.current.throttle = 1; // Default to cruise/drive
        setCurrentThrottle(1);
      } else if (e.key === ' ' || e.key === 'Shift') {
        inputRef.current.wantsNitro = false;
        setWantsNitroState(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameMode]);

  // Network sync to Firebase in Multiplayer mode (20Hz)
  useEffect(() => {
    if (!multiplayerRoomId || !currentUser || gameMode !== 'racing') return;

    const interval = setInterval(() => {
      const player = playerEntityRef.current;
      if (player) {
        updatePlayerRaceTick(multiplayerRoomId, currentUser.uid, {
          x: player.currentX,
          z: player.currentZ,
          lane: player.lane,
          speed: player.speed,
          nitroActive: player.nitroActive,
          finished: player.finished,
          finishTime: player.finishTime,
          rank: player.rank,
        });
      }
    }, 50);

    return () => clearInterval(interval);
  }, [multiplayerRoomId, currentUser, gameMode]);

  // Subscribe to Opponents in Multiplayer Room
  useEffect(() => {
    if (!multiplayerRoomId || gameMode !== 'racing') return;

    const unsub = onSnapshot(collection(db, 'rooms', multiplayerRoomId, 'players'), (snap) => {
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.playerId !== currentUser?.uid) {
          let opp = opponentRacersRef.current.get(data.playerId);
          if (!opp) {
            const oppStats = computePhysicsStats(data.carId || 'red_storm', {});
            opp = {
              id: data.playerId,
              isPlayer: false,
              name: data.displayName || 'Racer',
              carId: data.carId || 'red_storm',
              color: data.color || '#f43f5e',
              lane: data.lane || 2,
              currentX: data.x || 0,
              currentZ: data.z || 0,
              currentY: 0,
              speed: data.speed || 0,
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
              stats: oppStats,
            };
            opponentRacersRef.current.set(data.playerId, opp);
          } else {
            opp.currentX += (data.x - opp.currentX) * 0.25;
            opp.currentZ += (data.z - opp.currentZ) * 0.25;
            opp.speed = data.speed;
            opp.nitroActive = data.nitroActive;
            opp.finished = data.finished;
            opp.finishTime = data.finishTime;
          }
        }
      });
    });

    return () => unsub();
  }, [multiplayerRoomId, gameMode, currentUser]);

  const handleCollisionEvent = useCallback((event: CollisionEvent) => {
    if (!playerEntityRef.current) return;
    const isPlayerInvolved =
      event.victimId === playerEntityRef.current.id ||
      event.instigatorId === playerEntityRef.current.id;

    if (isPlayerInvolved) {
      if (event.type === 'bump') {
        if (event.instigatorId === playerEntityRef.current.id) {
          setTotalBumpsDelivered((prev) => prev + 1);
          triggerHUDAlert('RIVAL BUMPED! +25 COIN BONUS');
        }
      } else if (event.type === 'boost_pad') {
        triggerHUDAlert('SPEED PAD BOOST! +35%');
      } else if (event.type === 'ramp') {
        triggerHUDAlert('AIRBORNE STUNT JUMP!');
      } else if (event.type === 'obstacle') {
        triggerHUDAlert('ROAD HAZARD! SPEED LOSS');
      }
    }
  }, []);

  const triggerHUDAlert = (msg: string) => {
    setActiveNotification(msg);
    setTimeout(() => {
      setActiveNotification((prev) => (prev === msg ? null : prev));
    }, 1800);
  };

  // On-Screen Touch / Button Handlers
  const handleLaneShift = (direction: -1 | 1) => {
    inputRef.current.targetLane = Math.max(0, Math.min(3, inputRef.current.targetLane + direction));
  };

  const handleThrottleChange = (throttle: number) => {
    inputRef.current.throttle = throttle;
    setCurrentThrottle(throttle);
  };

  const handleNitroToggle = (active: boolean) => {
    inputRef.current.wantsNitro = active;
    setWantsNitroState(active);
  };

  const handleToggleMute = () => {
    const muted = soundSynth.toggleMute();
    setIsAudioMuted(muted);
  };

  return (
    <div className="relative w-screen h-screen max-h-screen overflow-hidden bg-slate-950 text-slate-100 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* 1. Main Garage View */}
      {gameMode === 'garage' && (
        <GarageMenu
          user={currentUser}
          garageData={garageData}
          onSelectCar={handleSelectCar}
          onUnlockCar={handleUnlockCar}
          onUpgradeStat={handleUpgradeStat}
          onStartSoloRace={handleStartSoloRace}
          onOpenMultiplayer={() => setShowMultiplayerLobby(true)}
          onOpenAiChief={() => setShowTuningAdvisor(true)}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
          isMuted={isAudioMuted}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* 2. Active 3D Race View */}
      {gameMode === 'racing' && trackData && playerEntityRef.current && physicsEngineRef.current && (
        <div className="relative w-full h-full">
          <GameCanvas
            track={trackData}
            playerEntity={playerEntityRef.current}
            botDrivers={botDriversRef.current}
            opponentRacersMap={opponentRacersRef.current}
            physics={physicsEngineRef.current}
            inputRef={inputRef}
            onHudUpdate={setHudState}
            onCollisionEvent={handleCollisionEvent}
            onRaceFinished={() => setGameMode('finished')}
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
            countdown={countdown}
            currentThrottle={currentThrottle}
            wantsNitro={wantsNitroState}
          />
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
          user={currentUser}
          activeCarId={garageData.activeCarId || 'red_storm'}
          onStartMultiplayerRace={handleStartMultiplayerRace}
          onClose={() => setShowMultiplayerLobby(false)}
        />
      )}
    </div>
  );
}
