import { LANE_X_COORDS, TrackData, TrackFeature } from './trackGenerator';
import { ActivePhysicsStats } from './cars';

export interface RacerEntity {
  id: string;
  isPlayer: boolean;
  name: string;
  carId: string;
  color: string;
  lane: number; // 0, 1, 2, 3
  currentX: number;
  currentZ: number;
  currentY: number; // for airborne jumps
  speed: number; // units/sec
  verticalVelocity: number;
  rollAngle: number;
  pitchAngle: number;
  yawAngle: number;
  isAirborne: boolean;
  nitroActive: boolean;
  nitroFuel: number; // 0.0 to 1.0
  slipstreamActive: boolean;
  boostPadTimer: number; // boost pad active countdown
  stunTimer: number; // slow down timer from bump
  finished: boolean;
  finishTime: number;
  rank: number;
  stats: ActivePhysicsStats;
}

export interface CollisionEvent {
  type: 'bump' | 'boost_pad' | 'ramp' | 'obstacle';
  victimId: string;
  instigatorId: string;
  intensity: number;
}

export class PhysicsEngine {
  public track: TrackData;
  public collisionEvents: CollisionEvent[] = [];

  constructor(track: TrackData) {
    this.track = track;
  }

  public updateRacer(
    racer: RacerEntity,
    targetLaneInput: number, // 0..3
    wantsNitro: boolean,
    delta: number
  ) {
    if (racer.finished) {
      // Coast down to gradual stop after finishing
      racer.speed *= Math.pow(0.95, delta * 60);
      racer.currentZ += racer.speed * delta;
      return;
    }

    const stats = racer.stats;

    // 1. Lane Targeting & Lateral Movement
    const clampedLane = Math.max(0, Math.min(3, targetLaneInput));
    racer.lane = clampedLane;
    const targetLaneX = LANE_X_COORDS[clampedLane];

    // Smooth lateral movement towards target lane
    const lateralSpeed = 16.0; // units/sec lateral lane-shift
    const dx = targetLaneX - racer.currentX;
    if (Math.abs(dx) > 0.02) {
      const step = Math.sign(dx) * Math.min(Math.abs(dx), lateralSpeed * delta);
      racer.currentX += step;
      // Banking roll angle into the lane switch
      const targetRoll = -Math.sign(dx) * 0.16;
      racer.rollAngle += (targetRoll - racer.rollAngle) * 0.2;
    } else {
      racer.currentX = targetLaneX;
      racer.rollAngle += (0 - racer.rollAngle) * 0.2;
    }

    // 2. Nitro Management
    if (wantsNitro && racer.nitroFuel > 0.05) {
      racer.nitroActive = true;
      const burnRate = 1.0 / stats.nitroDurationSeconds;
      racer.nitroFuel = Math.max(0, racer.nitroFuel - burnRate * delta);
      if (racer.nitroFuel <= 0) {
        racer.nitroActive = false;
      }
    } else {
      racer.nitroActive = false;
      // Slow passive nitro regeneration
      racer.nitroFuel = Math.min(1.0, racer.nitroFuel + stats.nitroRefillRate * delta);
    }

    // 3. Speed & Acceleration Physics
    let targetSpeed = stats.maxSpeedUnitsPerSec;

    // Speed modifiers
    if (racer.nitroActive) {
      targetSpeed *= stats.nitroSpeedMultiplier;
    }
    if (racer.slipstreamActive) {
      targetSpeed *= 1.15; // +15% aerodynamic draft bonus
    }
    if (racer.boostPadTimer > 0) {
      racer.boostPadTimer -= delta;
      targetSpeed *= 1.35; // +35% instant pad boost
    }
    if (racer.stunTimer > 0) {
      racer.stunTimer -= delta;
      targetSpeed *= 0.65; // temporary stagger
    }

    // Accelerate toward target speed
    if (racer.speed < targetSpeed) {
      const accel = racer.nitroActive ? stats.accelerationRate * 1.6 : stats.accelerationRate;
      racer.speed = Math.min(targetSpeed, racer.speed + accel * delta);
    } else {
      // Natural drag deceleration
      racer.speed = Math.max(targetSpeed, racer.speed - 30 * delta);
    }

    // 4. Longitudinal Progression
    racer.currentZ += racer.speed * delta;

    // 5. Check Finish Line
    if (racer.currentZ >= this.track.length - 20 && !racer.finished) {
      racer.finished = true;
    }

    // 6. Track Features (Ramps, Boost Pads, Obstacles)
    this.checkTrackFeatures(racer);

    // 7. Vertical Airborne Dynamics & Gravity
    const center = this.track.getTrackCenter(racer.currentZ);
    const groundY = center.y;

    if (racer.isAirborne) {
      racer.verticalVelocity -= 32 * delta; // Gravity
      racer.currentY += racer.verticalVelocity * delta;

      // Slight airborne pitch tilt
      racer.pitchAngle = Math.min(0.3, racer.pitchAngle - 0.5 * delta);

      // Landing check
      if (racer.currentY <= groundY) {
        racer.currentY = groundY;
        racer.verticalVelocity = 0;
        racer.isAirborne = false;
        racer.pitchAngle = center.pitch;
      }
    } else {
      racer.currentY = groundY;
      racer.pitchAngle = center.pitch;
    }

    racer.yawAngle = center.yaw;
  }

  private checkTrackFeatures(racer: RacerEntity) {
    const marginZ = 2.5;

    for (const feat of this.track.features) {
      // Check if feature is at same lane and within Z window
      if (Math.abs(feat.z - racer.currentZ) < marginZ && feat.lane === racer.lane) {
        if (feat.type === 'boost_pad') {
          if (racer.boostPadTimer <= 0) {
            racer.boostPadTimer = 1.8;
            this.collisionEvents.push({
              type: 'boost_pad',
              victimId: racer.id,
              instigatorId: racer.id,
              intensity: 1.0,
            });
          }
        } else if (feat.type === 'ramp') {
          if (!racer.isAirborne && racer.speed > 25) {
            racer.isAirborne = true;
            racer.verticalVelocity = 12 + (racer.speed / 50) * 4;
            racer.pitchAngle = 0.25;
            this.collisionEvents.push({
              type: 'ramp',
              victimId: racer.id,
              instigatorId: racer.id,
              intensity: 1.0,
            });
          }
        } else if (feat.type === 'obstacle') {
          if (racer.stunTimer <= 0 && !racer.isAirborne) {
            racer.speed *= 0.6;
            racer.stunTimer = 1.2;
            this.collisionEvents.push({
              type: 'obstacle',
              victimId: racer.id,
              instigatorId: racer.id,
              intensity: 1.0,
            });
          }
        }
      }
    }
  }

  // Inter-Vehicle Collisions (Bumping) and Slipstreaming
  public resolveVehicleInteractions(racers: RacerEntity[]) {
    // 1. Reset slipstream before checking
    racers.forEach((r) => (r.slipstreamActive = false));

    for (let i = 0; i < racers.length; i++) {
      for (let j = i + 1; j < racers.length; j++) {
        const rA = racers[i];
        const rB = racers[j];

        const deltaZ = rA.currentZ - rB.currentZ;
        const deltaX = rA.currentX - rB.currentX;
        const absDeltaZ = Math.abs(deltaZ);
        const absDeltaX = Math.abs(deltaX);

        // Check Slipstream / Drafting
        // Car trailing behind between 3m and 14m in almost same lane
        if (absDeltaX < 1.8 && absDeltaZ >= 3.0 && absDeltaZ <= 14.0) {
          if (deltaZ > 0) {
            // rB is behind rA
            rB.slipstreamActive = true;
          } else {
            // rA is behind rB
            rA.slipstreamActive = true;
          }
        }

        // Check Physical Collision / Bumping (overlap box: Z within 3.6m and X within 1.9m)
        if (absDeltaZ < 3.6 && absDeltaX < 1.9) {
          const armorA = rA.stats.armorWeight;
          const armorB = rB.stats.armorWeight;
          const bumpPowerA = rA.stats.bumpKnockbackPower;
          const bumpPowerB = rB.stats.bumpKnockbackPower;

          // Push apart laterally
          const pushDirection = deltaX >= 0 ? 1 : -1;
          const bumpIntensity = Math.abs(armorA - armorB) + 1.0;

          if (armorA >= armorB) {
            // Car A shoves Car B
            rB.currentX -= pushDirection * (1.2 + bumpPowerA * 0.08);
            rB.stunTimer = 0.8;
            rB.speed *= 0.85;
            this.collisionEvents.push({
              type: 'bump',
              victimId: rB.id,
              instigatorId: rA.id,
              intensity: bumpIntensity,
            });
          } else {
            // Car B shoves Car A
            rA.currentX += pushDirection * (1.2 + bumpPowerB * 0.08);
            rA.stunTimer = 0.8;
            rA.speed *= 0.85;
            this.collisionEvents.push({
              type: 'bump',
              victimId: rA.id,
              instigatorId: rB.id,
              intensity: bumpIntensity,
            });
          }

          // Enforce track road boundaries [-5.8, +5.8]
          rA.currentX = Math.max(-5.8, Math.min(5.8, rA.currentX));
          rB.currentX = Math.max(-5.8, Math.min(5.8, rB.currentX));
        }
      }
    }
  }

  public drainCollisionEvents(): CollisionEvent[] {
    const events = [...this.collisionEvents];
    this.collisionEvents = [];
    return events;
  }
}
