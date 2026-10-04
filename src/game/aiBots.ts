import { RacerEntity } from './physics';
import { TrackData } from './trackGenerator';

export interface BotDriver {
  entity: RacerEntity;
  personality: 'aggressive' | 'tactical' | 'speedster';
  decisionTimer: number;
  nitroCooldown: number;
}

export function createBotRacers(track: TrackData): BotDriver[] {
  const botsConfig = [
    {
      id: 'bot_alpha',
      name: 'Bot Apex',
      carId: 'nitro_apex',
      color: '#06b6d4',
      lane: 0,
      personality: 'speedster' as const,
      zOffset: -2,
      baseSpeed: 50.5,
      accel: 28,
    },
    {
      id: 'bot_bravo',
      name: 'Bot Cyber',
      carId: 'cyber_beast',
      color: '#eab308',
      lane: 2,
      personality: 'aggressive' as const,
      zOffset: -5,
      baseSpeed: 48.5,
      accel: 26,
    },
    {
      id: 'bot_charlie',
      name: 'Bot Turbo',
      carId: 'red_storm',
      color: '#ec4899',
      lane: 3,
      personality: 'tactical' as const,
      zOffset: -8,
      baseSpeed: 49.5,
      accel: 27,
    },
  ];

  return botsConfig.map((cfg) => {
    const entity: RacerEntity = {
      id: cfg.id,
      isPlayer: false,
      name: cfg.name,
      carId: cfg.carId,
      color: cfg.color,
      lane: cfg.lane,
      currentX: track.lanes[cfg.lane],
      currentZ: cfg.zOffset,
      currentY: 0,
      speed: 0,
      verticalVelocity: 0,
      rollAngle: 0,
      pitchAngle: 0,
      yawAngle: 0,
      isAirborne: false,
      onRamp: false,
      isBraking: false,
      nitroActive: false,
      nitroFuel: 1.0,
      slipstreamActive: false,
      boostPadTimer: 0,
      stunTimer: 0,
      finished: false,
      finishTime: 0,
      rank: 4,
      stats: {
        maxSpeedUnitsPerSec: cfg.baseSpeed + Math.random() * 2.0,
        maxSpeedKmh: 155 + Math.floor(Math.random() * 10),
        accelerationRate: cfg.accel + Math.random() * 3,
        dragCoefficient: 0.985,
        armorWeight: cfg.personality === 'aggressive' ? 2.0 : 1.3,
        bumpKnockbackPower: cfg.personality === 'aggressive' ? 7.5 : 5.5,
        nitroDurationSeconds: 3.0,
        nitroSpeedMultiplier: 1.28,
        nitroRefillRate: 0.12,
      },
    };

    return {
      entity,
      personality: cfg.personality,
      decisionTimer: Math.random() * 0.5,
      nitroCooldown: 3.0 + Math.random() * 3.0,
    };
  });
}

export function updateBotAI(
  bot: BotDriver,
  track: TrackData,
  allRacers: RacerEntity[],
  delta: number
): { targetLane: number; wantsNitro: boolean; throttle: number } {
  bot.decisionTimer -= delta;
  bot.nitroCooldown -= delta;

  const currentZ = bot.entity.currentZ;
  let targetLane = bot.entity.lane;
  let wantsNitro = false;
  let throttle = 1.0;

  // Find player entity to perform balanced arcade rubber-banding
  const player = allRacers.find((r) => r.isPlayer);
  if (player) {
    const leadDistance = currentZ - player.currentZ;

    // Intelligent Rubber-Banding:
    // If bot is far ahead, ease off throttle so player can draft and challenge
    if (leadDistance > 35) {
      throttle = 0.74; // gentle coast
    } else if (leadDistance > 20) {
      throttle = 0.84; // competitive pace
    } else if (leadDistance < -15) {
      // Bot is falling behind: catch up!
      throttle = 1.0;
      if (bot.nitroCooldown <= 0 && bot.entity.nitroFuel > 0.3) {
        wantsNitro = true;
        bot.nitroCooldown = 4.0 + Math.random() * 2.0;
      }
    } else {
      // Close quarter racing: intense bumper duel
      throttle = 0.96;
    }
  }

  // Tactical lane choices every 0.25 - 0.45s
  if (bot.decisionTimer <= 0) {
    bot.decisionTimer = 0.28 + Math.random() * 0.18;

    // 1. Obstacle avoidance ahead
    const obstacleAhead = track.features.find(
      (f) =>
        f.type === 'obstacle' &&
        f.lane === bot.entity.lane &&
        f.z > currentZ &&
        f.z - currentZ < 35
    );

    if (obstacleAhead) {
      if (bot.entity.lane === 0) targetLane = 1;
      else if (bot.entity.lane === 3) targetLane = 2;
      else targetLane = Math.random() > 0.5 ? bot.entity.lane + 1 : bot.entity.lane - 1;
    } else {
      // 2. Seek Speed Boost Pad ahead
      const boostAhead = track.features.find(
        (f) =>
          f.type === 'boost_pad' &&
          f.z > currentZ &&
          f.z - currentZ < 40 &&
          Math.abs(f.lane - bot.entity.lane) === 1
      );

      if (boostAhead && Math.random() < 0.7) {
        targetLane = boostAhead.lane;
      } else if (bot.personality === 'aggressive') {
        // Find closest rival ahead to bump
        const rivalAhead = allRacers.find(
          (r) =>
            r.id !== bot.entity.id &&
            r.currentZ > currentZ &&
            r.currentZ - currentZ < 18 &&
            Math.abs(r.lane - bot.entity.lane) <= 1
        );
        if (rivalAhead && Math.random() < 0.6) {
          targetLane = rivalAhead.lane;
        }
      }
    }

    // 3. Strategic Nitro on ramps or straightaways
    if (!wantsNitro && bot.nitroCooldown <= 0 && bot.entity.nitroFuel > 0.45) {
      const nearRamp = track.features.some(
        (f) => f.type === 'ramp' && Math.abs(f.z - currentZ) < 25 && f.lane === bot.entity.lane
      );
      if (nearRamp || Math.random() < 0.35) {
        wantsNitro = true;
        bot.nitroCooldown = 5.0 + Math.random() * 3.0;
      }
    }
  }

  // Continue burning nitro if currently active and fuel remaining
  if (bot.entity.nitroActive && bot.entity.nitroFuel > 0.15) {
    wantsNitro = true;
  }

  return { targetLane, wantsNitro, throttle };
}
