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
  onRamp: boolean;
  nitroActive: boolean;
  nitroFuel: number; // 0.0 to 1.0
  slipstreamActive: boolean;
  boostPadTimer: number; // boost pad active countdown
  stunTimer: number; // slow down timer from bump or hazard
  isBraking: boolean;
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
    throttleInput: number, // 1: gas, -1: brake, 0: coast
    wantsNitro: boolean,
    delta: number
  ) {
    if (racer.finished) {
      // Coast down to gradual stop after finishing
      racer.speed *= Math.pow(0.94, delta * 60);
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

    // 3. Throttle, Brake & Speed Physics
    let targetSpeed = stats.maxSpeedUnitsPerSec;
    racer.isBraking = throttleInput < 0;

    // Modifiers to maximum speed
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
      targetSpeed *= 0.65; // temporary hazard stagger
    }

    // Process acceleration vs braking vs coasting
    if (throttleInput < 0) {
      // Heavy active braking
      const brakeForce = 75.0; // units/sec^2
      racer.speed = Math.max(0, racer.speed - brakeForce * delta);
    } else if (throttleInput > 0 || racer.nitroActive) {
      // Active gas acceleration
      const accel = racer.nitroActive ? stats.accelerationRate * 1.6 : stats.accelerationRate;
      if (racer.speed < targetSpeed) {
        racer.speed = Math.min(targetSpeed, racer.speed + accel * delta);
      } else {
        // Natural air resistance drag
        racer.speed = Math.max(targetSpeed, racer.speed - 30 * delta);
      }
    } else {
      // Coasting with natural drag down to idle roll
      const coastTarget = 15.0;
      if (racer.speed > coastTarget) {
        racer.speed = Math.max(coastTarget, racer.speed - 25 * delta);
      }
    }

    // 4. Longitudinal Progression
    racer.currentZ += racer.speed * delta;

    // 5. Check Finish Line
    if (racer.currentZ >= this.track.length - 20 && !racer.finished) {
      racer.finished = true;
    }

    // 6. Track Features & Airborne Ramp Physics
    const center = this.track.getTrackCenter(racer.currentZ);
    const groundY = center.y;
    racer.onRamp = false;

    // Check ramp interactions
    for (const feat of this.track.features) {
      if (feat.lane === racer.lane) {
        const rampStart = feat.z - feat.length / 2;
        const rampEnd = feat.z + feat.length / 2;

        if (feat.type === 'ramp') {
          // Riding on the ramp surface
          if (racer.currentZ >= rampStart && racer.currentZ <= rampEnd && !racer.isAirborne) {
            racer.onRamp = true;
            const progress = (racer.currentZ - rampStart) / feat.length;
            racer.currentY = groundY + progress * feat.height;
            racer.pitchAngle = center.pitch + 0.25;
          }
          // Launch off the lip!
          else if (
            racer.currentZ > rampEnd &&
            racer.currentZ - rampEnd < 4.0 &&
            !racer.isAirborne &&
            racer.speed > 20
          ) {
            racer.isAirborne = true;
            racer.verticalVelocity = 15 + (racer.speed / 45) * 8;
            racer.pitchAngle = 0.32;
            this.collisionEvents.push({
              type: 'ramp',
              victimId: racer.id,
              instigatorId: racer.id,
              intensity: 1.0,
            });
          }
        } else if (feat.type === 'boost_pad') {
          if (Math.abs(feat.z - racer.currentZ) < 3.0 && racer.boostPadTimer <= 0) {
            racer.boostPadTimer = 2.2;
            racer.speed = Math.max(racer.speed, stats.maxSpeedUnitsPerSec * 1.25);
            this.collisionEvents.push({
              type: 'boost_pad',
              victimId: racer.id,
              instigatorId: racer.id,
              intensity: 1.0,
            });
          }
        } else if (feat.type === 'obstacle') {
          if (Math.abs(feat.z - racer.currentZ) < 2.5 && racer.stunTimer <= 0 && !racer.isAirborne) {
            racer.speed *= 0.55;
            racer.stunTimer = 1.3;
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

    // 7. Gravity & Airborne Dynamics
    if (racer.isAirborne) {
      racer.verticalVelocity -= 38 * delta; // Gravity
      racer.currentY += racer.verticalVelocity * delta;

      // Aerial pitch physics
      racer.pitchAngle -= 0.5 * delta;

      // Landing check
      if (racer.currentY <= groundY) {
        racer.currentY = groundY;
        racer.verticalVelocity = 0;
        racer.isAirborne = false;
        racer.pitchAngle = center.pitch;
      }
    } else if (!racer.onRamp) {
      racer.currentY = groundY;
      racer.pitchAngle = center.pitch;
    }

    racer.yawAngle = center.yaw;
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
            rB.currentX -= pushDirection * (1.4 + bumpPowerA * 0.08);
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
            rA.currentX += pushDirection * (1.4 + bumpPowerB * 0.08);
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
