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
import { createBotRacers, updateBotAI, BotDriver } from './game/aiBots';
import { GameCanvas } from './game/GameCanvas';
import { GameHUD } from './components/GameHUD';
import { GarageMenu } from './components/GarageMenu';
import { TuningAdvisorModal } from './components/TuningAdvisorModal';
import { MultiplayerLobbyModal } from './components/MultiplayerLobbyModal';
import { RaceFinishedModal } from './components/RaceFinishedModal';
import { soundSynth } from './game/audio';

type GameMode = 'garage' | 'racing' | 'finished';

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

  // Input states
  const targetLaneRef = useRef<number>(1);
  const wantsNitroRef = useRef<boolean>(false);
  const [activeNotification, setActiveNotification] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [totalBumpsDelivered, setTotalBumpsDelivered] = useState<number>(0);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(soundSynth.getMuted());

  // Force re-render tick for HUD
  const [, setTick] = useState<number>(0);

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
  const initializeRace = useCallback((length: number, theme: TrackThemeId, roomId: string | null = null) => {
    const track = generateTrackData(length, theme);
    setTrackData(track);
    physicsEngineRef.current = new PhysicsEngine(track);

    const carId = garageData.activeCarId || 'red_storm';
    const carDef = VEHICLES[carId] || VEHICLES.red_storm;
    const upgrades = garageData.upgrades[carId] || {};
    const physicsStats = computePhysicsStats(carId, upgrades);

    // Initial player entity
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
      nitroActive: false,
      nitroFuel: 1.0,
      slipstreamActive: false,
      boostPadTimer: 0,
      stunTimer: 0,
      finished: false,
      finishTime: 0,
      rank: 1,
      stats: physicsStats,
    };

    playerEntityRef.current = player;
    targetLaneRef.current = 1;
    wantsNitroRef.current = false;
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
      setCountdown(0); // GO!
      soundSynth.playCountdownBeep(true);
      setTimeout(() => setCountdown(null), 1000);
    }, 3000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [currentUser, garageData]);

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

  // Keyboard controls listener
  useEffect(() => {
    if (gameMode !== 'racing') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        targetLaneRef.current = Math.max(0, targetLaneRef.current - 1);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        targetLaneRef.current = Math.min(3, targetLaneRef.current + 1);
      } else if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        if (!wantsNitroRef.current) {
          wantsNitroRef.current = true;
          soundSynth.playNitroBoost();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        wantsNitroRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameMode]);

  // Real-time Physics Simulation Loop (60 FPS) & Throttled 20Hz Network Tick
  useEffect(() => {
    if (gameMode !== 'racing' || !physicsEngineRef.current || !playerEntityRef.current) return;

    let animId: number;
    let lastTime = performance.now();
    let networkTickTimer = 0;
    const startTime = performance.now();

    const loop = (currentTime: number) => {
      animId = requestAnimationFrame(loop);

      const delta = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;

      const physics = physicsEngineRef.current;
      const player = playerEntityRef.current;
      if (!physics || !player) return;

      const canAccelerate = countdown === null;

      // 1. Update Player Physics
      physics.updateRacer(
        player,
        targetLaneRef.current,
        canAccelerate && wantsNitroRef.current,
        canAccelerate ? delta : 0
      );

      // Record finish time if newly crossed
      if (player.finished && player.finishTime === 0) {
        player.finishTime = (performance.now() - startTime) / 1000;
      }

      // 2. Update AI Bots
      const allRacers: RacerEntity[] = [
        player,
        ...botDriversRef.current.map((b) => b.entity),
        ...Array.from(opponentRacersRef.current.values()),
      ];

      botDriversRef.current.forEach((bot) => {
        if (canAccelerate) {
          const { targetLane, wantsNitro } = updateBotAI(bot, physics.track, allRacers, delta);
          physics.updateRacer(bot.entity, targetLane, wantsNitro, delta);

          if (bot.entity.finished && bot.entity.finishTime === 0) {
            bot.entity.finishTime = (performance.now() - startTime) / 1000;
          }
        }
      });

      // 3. Resolve Vehicle Interactions (Bumping, Slipstream)
      physics.resolveVehicleInteractions(allRacers);

      // 4. Throttled 20Hz Network Update to Firebase (every 50ms)
      if (multiplayerRoomId && currentUser) {
        networkTickTimer += delta;
        if (networkTickTimer >= 0.05) {
          networkTickTimer = 0;
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
      }

      // Request HUD re-render
      setTick((prev) => (prev + 1) % 1000);
    };

    animId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(animId);
  }, [gameMode, countdown, multiplayerRoomId, currentUser]);

  // Subscribe to Multiplayer Room Opponents
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
              nitroActive: data.nitroActive || false,
              nitroFuel: 1.0,
              slipstreamActive: false,
              boostPadTimer: 0,
              stunTimer: 0,
              finished: data.finished || false,
              finishTime: data.finishTime || 0,
              rank: data.rank || 2,
              stats: oppStats,
            };
            opponentRacersRef.current.set(data.playerId, opp);
          } else {
            // Smooth LERP updates for 20Hz network ticks
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

  const handleCollisionEvent = (event: CollisionEvent) => {
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
        triggerHUDAlert('AIRBORNE RAMP JUMP!');
      } else if (event.type === 'obstacle') {
        triggerHUDAlert('ROAD HAZARD! SPEED LOSS');
      }
    }
  };

  const triggerHUDAlert = (msg: string) => {
    setActiveNotification(msg);
    setTimeout(() => {
      setActiveNotification((prev) => (prev === msg ? null : prev));
    }, 1800);
  };

  const handleLaneShift = (direction: -1 | 1) => {
    targetLaneRef.current = Math.max(0, Math.min(3, targetLaneRef.current + direction));
  };

  const handleNitroToggle = (active: boolean) => {
    wantsNitroRef.current = active;
  };

  const handleToggleMute = () => {
    const muted = soundSynth.toggleMute();
    setIsAudioMuted(muted);
  };

  // Build combined racers array for 3D canvas and HUD
  const allRacersList = playerEntityRef.current
    ? [
        playerEntityRef.current,
        ...botDriversRef.current.map((b) => b.entity),
        ...Array.from(opponentRacersRef.current.values()),
      ]
    : [];

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* 1. Main Garage Mode */}
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

      {/* 2. Active 3D Race Mode */}
      {gameMode === 'racing' && trackData && playerEntityRef.current && physicsEngineRef.current && (
        <div className="relative w-full h-full">
          <GameCanvas
            track={trackData}
            racers={allRacersList}
            playerEntity={playerEntityRef.current}
            physics={physicsEngineRef.current}
            onCollisionEvent={handleCollisionEvent}
            onRaceFinished={() => setGameMode('finished')}
          />

          <GameHUD
            player={playerEntityRef.current}
            racers={allRacersList}
            track={trackData}
            activeNotification={activeNotification}
            onLaneShift={handleLaneShift}
            onNitroToggle={handleNitroToggle}
            isMuted={isAudioMuted}
            onToggleMute={handleToggleMute}
            countdown={countdown}
          />
        </div>
      )}

      {/* 3. Race Finished Results Modal */}
      {gameMode === 'finished' && playerEntityRef.current && (
        <RaceFinishedModal
          player={playerEntityRef.current}
          racers={allRacersList}
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
