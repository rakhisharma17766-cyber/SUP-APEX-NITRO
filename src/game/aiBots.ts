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
    },
    {
      id: 'bot_bravo',
      name: 'Bot Cyber',
      carId: 'cyber_beast',
      color: '#eab308',
      lane: 2,
      personality: 'aggressive' as const,
      zOffset: -5,
    },
    {
      id: 'bot_charlie',
      name: 'Bot Turbo',
      carId: 'red_storm',
      color: '#ec4899',
      lane: 3,
      personality: 'tactical' as const,
      zOffset: -8,
    },
  ];

  return botsConfig.map((cfg) => {
    // Generate base physics stats for bot
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
      nitroActive: false,
      nitroFuel: 1.0,
      slipstreamActive: false,
      boostPadTimer: 0,
      stunTimer: 0,
      finished: false,
      finishTime: 0,
      rank: 4,
      stats: {
        maxSpeedUnitsPerSec: 58 + Math.random() * 6,
        maxSpeedKmh: 175 + Math.floor(Math.random() * 15),
        accelerationRate: 35 + Math.random() * 5,
        dragCoefficient: 0.985,
        armorWeight: cfg.personality === 'aggressive' ? 2.2 : 1.4,
        bumpKnockbackPower: cfg.personality === 'aggressive' ? 9.0 : 6.5,
        nitroDurationSeconds: 3.5,
        nitroSpeedMultiplier: 1.38,
        nitroRefillRate: 0.18,
      },
    };

    return {
      entity,
      personality: cfg.personality,
      decisionTimer: Math.random() * 0.5,
      nitroCooldown: 2.0 + Math.random() * 3.0,
    };
  });
}

export function updateBotAI(
  bot: BotDriver,
  track: TrackData,
  allRacers: RacerEntity[],
  delta: number
): { targetLane: number; wantsNitro: boolean } {
  bot.decisionTimer -= delta;
  bot.nitroCooldown -= delta;

  const currentZ = bot.entity.currentZ;
  let targetLane = bot.entity.lane;
  let wantsNitro = false;

  // Evaluate decisions every 0.25 - 0.45s to simulate reaction time
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
      // Steer to safer adjacent lane
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

      if (boostAhead && Math.random() < 0.75) {
        targetLane = boostAhead.lane;
      } else if (bot.personality === 'aggressive') {
        // Find closest rival ahead to bump
        const rivalAhead = allRacers.find(
          (r) =>
            r.id !== bot.entity.id &&
            r.currentZ > currentZ &&
            r.currentZ - currentZ < 20 &&
            Math.abs(r.lane - bot.entity.lane) <= 1
        );
        if (rivalAhead && Math.random() < 0.6) {
          targetLane = rivalAhead.lane;
        }
      }
    }

    // 3. Strategic Nitro usage
    if (bot.nitroCooldown <= 0 && bot.entity.nitroFuel > 0.4) {
      // Trigger nitro on ramps, straightaways, or when trailing behind
      const isTrailing = allRacers.some(
        (r) => r.id !== bot.entity.id && r.currentZ > currentZ + 15
      );
      if (isTrailing || Math.random() < 0.5) {
        wantsNitro = true;
        bot.nitroCooldown = 4.0 + Math.random() * 3.0;
      }
    }
  }

  // Continue burning nitro if currently active and fuel remaining
  if (bot.entity.nitroActive && bot.entity.nitroFuel > 0.15) {
    wantsNitro = true;
  }

  return { targetLane, wantsNitro };
}
