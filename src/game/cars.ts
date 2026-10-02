// Vehicle Configurations, Physics Constants, and Upgrade Formulas

export interface VehicleDefinition {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: 'Speed & Agility' | 'Heavy Brawler' | 'Nitro Overcharger';
  unlockPrice: number;
  primaryColor: string;
  accentColor: string;
  glowColor: string;
  baseStats: {
    topSpeed: number; // In km/h (e.g. 150)
    acceleration: number; // 1-10
    heavyArmor: number; // 1-10
    nitroDuration: number; // Seconds (e.g. 2.5)
    nitroPower: number; // Speed boost multiplier (e.g. 1.35)
  };
}

export const VEHICLES: Record<string, VehicleDefinition> = {
  red_storm: {
    id: 'red_storm',
    name: 'Red Storm F1',
    tagline: 'Hyper-Aero Speed Demon',
    description: 'Ultra-lightweight open-wheel chassis engineered for blinding acceleration and laser-sharp lane switches.',
    category: 'Speed & Agility',
    unlockPrice: 0, // Default starter car
    primaryColor: '#ef4444',
    accentColor: '#ffffff',
    glowColor: '#f87171',
    baseStats: {
      topSpeed: 160,
      acceleration: 8.5,
      heavyArmor: 3.5,
      nitroDuration: 2.8,
      nitroPower: 1.35,
    },
  },
  cyber_beast: {
    id: 'cyber_beast',
    name: 'Cyber Beast',
    tagline: 'Titanium Bumper Juggernaut',
    description: 'Armored angular heavy-duty muscle car with reinforced ramming cowls that sends rivals flying sideways on impact.',
    category: 'Heavy Brawler',
    unlockPrice: 1200,
    primaryColor: '#eab308',
    accentColor: '#1e293b',
    glowColor: '#fde047',
    baseStats: {
      topSpeed: 145,
      acceleration: 6.0,
      heavyArmor: 9.5,
      nitroDuration: 2.5,
      nitroPower: 1.3,
    },
  },
  nitro_apex: {
    id: 'nitro_apex',
    name: 'Nitro Apex',
    tagline: 'Twin-Turbine Rocket',
    description: 'Futuristic hyper-cruiser equipped with dual compressed-plasma tanks for extended, earth-shattering nitro burn.',
    category: 'Nitro Overcharger',
    unlockPrice: 2500,
    primaryColor: '#06b6d4',
    accentColor: '#8b5cf6',
    glowColor: '#38bdf8',
    baseStats: {
      topSpeed: 155,
      acceleration: 7.2,
      heavyArmor: 5.0,
      nitroDuration: 4.8,
      nitroPower: 1.5,
    },
  },
};

export type UpgradeKey = 'topSpeed' | 'acceleration' | 'heavyArmor' | 'nitroDuration' | 'nitroPower';

export interface UpgradeMeta {
  key: UpgradeKey;
  name: string;
  description: string;
  icon: string;
  maxLevel: number;
}

export const UPGRADES_META: UpgradeMeta[] = [
  {
    key: 'topSpeed',
    name: 'Twin-Turbo Engine',
    description: 'Increases top linear velocity (km/h) across the entire straightaway.',
    icon: 'gauge',
    maxLevel: 5,
  },
  {
    key: 'acceleration',
    name: 'Torque Transmission',
    description: 'Reduces time needed to reach peak speed and recovers quickly after bumping.',
    icon: 'zap',
    maxLevel: 5,
  },
  {
    key: 'heavyArmor',
    name: 'Reinforced Ram Armor',
    description: 'Increases collision mass, shoving lighter cars outward without loss of velocity.',
    icon: 'shield',
    maxLevel: 5,
  },
  {
    key: 'nitroDuration',
    name: 'Plasma Tank Capacity',
    description: 'Extends continuous burn duration of each nitro blast.',
    icon: 'flame',
    maxLevel: 5,
  },
  {
    key: 'nitroPower',
    name: 'Supercharged Injector',
    description: 'Amps up the maximum speed multiplier when nitro is engaged.',
    icon: 'rocket',
    maxLevel: 5,
  },
];

// Price calculation per upgrade level
export function getUpgradeCost(level: number): number {
  // Level 1 -> 2: 250
  // Level 2 -> 3: 500
  // Level 3 -> 4: 900
  // Level 4 -> 5: 1400
  const costs = [0, 250, 500, 900, 1400, 2000];
  return costs[level] || 2000;
}

// Active dynamic physics variables calculation
export interface ActivePhysicsStats {
  maxSpeedUnitsPerSec: number; // In Three.js units/sec (e.g. 55-90)
  maxSpeedKmh: number; // Displayed in speedometer
  accelerationRate: number; // units/sec^2
  dragCoefficient: number;
  armorWeight: number; // 1.0 to 3.0 mass multiplier
  bumpKnockbackPower: number;
  nitroDurationSeconds: number; // 2.5 to 5.5s
  nitroSpeedMultiplier: number; // 1.3 to 1.6x
  nitroRefillRate: number; // percent per second
}

export function computePhysicsStats(
  carId: string,
  upgradeLevels: { [key in UpgradeKey]?: number } = {}
): ActivePhysicsStats {
  const car = VEHICLES[carId] || VEHICLES.red_storm;
  const topSpeedLvl = upgradeLevels.topSpeed || 1;
  const accelLvl = upgradeLevels.acceleration || 1;
  const armorLvl = upgradeLevels.heavyArmor || 1;
  const nitroDurLvl = upgradeLevels.nitroDuration || 1;
  const nitroPwrLvl = upgradeLevels.nitroPower || 1;

  // Real Stat Scaling
  const baseKmh = car.baseStats.topSpeed;
  const maxSpeedKmh = Math.round(baseKmh + (topSpeedLvl - 1) * 12);
  // Scale km/h to Three.js track units/sec: 180 km/h approx 60 units/sec
  const maxSpeedUnitsPerSec = (maxSpeedKmh / 180) * 60;

  // Acceleration: higher level -> reaches peak speed faster
  const baseAccel = car.baseStats.acceleration;
  const accelerationRate = 28 + (baseAccel + accelLvl * 1.5) * 2.8;

  // Armor Weight: scales bump impulse
  const baseArmor = car.baseStats.heavyArmor;
  const armorWeight = 1.0 + (baseArmor / 10) * 0.8 + (armorLvl - 1) * 0.25;
  const bumpKnockbackPower = 6.0 + (baseArmor + armorLvl * 2) * 0.8;

  // Nitro
  const baseNitroDur = car.baseStats.nitroDuration;
  const nitroDurationSeconds = baseNitroDur + (nitroDurLvl - 1) * 0.55;

  const baseNitroPwr = car.baseStats.nitroPower;
  const nitroSpeedMultiplier = baseNitroPwr + (nitroPwrLvl - 1) * 0.06;

  const nitroRefillRate = 0.12 + (nitroPwrLvl - 1) * 0.03; // ~12-24% per sec

  return {
    maxSpeedUnitsPerSec,
    maxSpeedKmh,
    accelerationRate,
    dragCoefficient: 0.985,
    armorWeight,
    bumpKnockbackPower,
    nitroDurationSeconds,
    nitroSpeedMultiplier,
    nitroRefillRate,
  };
}
