// Vehicle Configurations, Physics Constants, and Upgrade Formulas

export type VehicleCategory =
  | 'Speed & Agility'
  | 'Heavy Brawler'
  | 'Nitro Overcharger'
  | 'Le Mans Hypercar'
  | 'Electric Prototype'
  | 'Monster Off-Roader';

export type SoundProfile =
  | 'f1_scream'
  | 'muscle_rumble'
  | 'rocket_jet'
  | 'v8_hypercar'
  | 'ev_turbine'
  | 'heavy_diesel';

export interface VehicleDefinition {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: VehicleCategory;
  soundProfile: SoundProfile;
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
    tagline: 'Hyper-Aero Open-Wheel Demon',
    description: 'Ultra-lightweight open-wheel chassis engineered for blinding acceleration and laser-sharp lane switches.',
    category: 'Speed & Agility',
    soundProfile: 'f1_scream',
    unlockPrice: 0, // Starter car
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
    soundProfile: 'muscle_rumble',
    unlockPrice: 1000,
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
    tagline: 'Twin-Turbine Jet Cruiser',
    description: 'Futuristic hyper-cruiser equipped with dual compressed-plasma tanks for extended, earth-shattering nitro burn.',
    category: 'Nitro Overcharger',
    soundProfile: 'rocket_jet',
    unlockPrice: 2200,
    primaryColor: '#06b6d4',
    accentColor: '#8b5cf6',
    glowColor: '#38bdf8',
    baseStats: {
      topSpeed: 155,
      acceleration: 7.2,
      heavyArmor: 5.0,
      nitroDuration: 4.8,
      nitroPower: 1.55,
    },
  },
  phantom_gt: {
    id: 'phantom_gt',
    name: 'Phantom GT Hypercar',
    tagline: 'Le Mans V8 Carbon Monster',
    description: 'Sleek carbon-monocoque endurance prototype with active ground-effect diffusers, dominating straightaways at supreme top velocity.',
    category: 'Le Mans Hypercar',
    soundProfile: 'v8_hypercar',
    unlockPrice: 3500,
    primaryColor: '#a855f7',
    accentColor: '#f43f5e',
    glowColor: '#c084fc',
    baseStats: {
      topSpeed: 185,
      acceleration: 8.8,
      heavyArmor: 5.5,
      nitroDuration: 3.2,
      nitroPower: 1.45,
    },
  },
  vortex_electric: {
    id: 'vortex_electric',
    name: 'Vortex EV Prototype',
    tagline: 'Instant Torque Lightning Hypercar',
    description: 'Quad-motor electric hypercar delivering explosive instant wheel torque, catapulting from 0 to top speed in an eye-blink.',
    category: 'Electric Prototype',
    soundProfile: 'ev_turbine',
    unlockPrice: 4800,
    primaryColor: '#10b981',
    accentColor: '#06b6d4',
    glowColor: '#34d399',
    baseStats: {
      topSpeed: 172,
      acceleration: 9.8,
      heavyArmor: 6.0,
      nitroDuration: 3.0,
      nitroPower: 1.4,
    },
  },
  titan_crusher: {
    id: 'titan_crusher',
    name: 'Titan Trophy Crusher',
    tagline: 'Steel-Cage Heavy Bumper Rig',
    description: 'Colossal off-road trophy rig with double shock suspension and hardened push-bars designed to crush through any traffic gridlock.',
    category: 'Monster Off-Roader',
    soundProfile: 'heavy_diesel',
    unlockPrice: 4200,
    primaryColor: '#f97316',
    accentColor: '#172554',
    glowColor: '#fb923c',
    baseStats: {
      topSpeed: 148,
      acceleration: 6.8,
      heavyArmor: 10.0,
      nitroDuration: 3.8,
      nitroPower: 1.35,
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
    description: 'Increases top linear velocity (km/h) across the straightaway.',
    icon: 'gauge',
    maxLevel: 5,
  },
  {
    key: 'acceleration',
    name: 'Torque Transmission',
    description: 'Reduces time to reach peak speed and recovers quickly after collisions.',
    icon: 'zap',
    maxLevel: 5,
  },
  {
    key: 'heavyArmor',
    name: 'Heavy Ramming Bumper',
    description: 'Increases vehicle mass and lateral shove distance when bumping opponents.',
    icon: 'shield',
    maxLevel: 5,
  },
  {
    key: 'nitroDuration',
    name: 'Overcharged Fuel Cell',
    description: 'Expands nitro fuel capacity, sustaining longer continuous boost times.',
    icon: 'battery-charging',
    maxLevel: 5,
  },
  {
    key: 'nitroPower',
    name: 'Afterburner Injector',
    description: 'Increases top speed multiplier while burning nitro boost.',
    icon: 'flame',
    maxLevel: 5,
  },
];

export const UPGRADE_BASE_COSTS: Record<number, number> = {
  1: 150,
  2: 300,
  3: 650,
  4: 1200,
  5: 2200,
};

export function getUpgradeCost(currentLevel: number): number {
  return UPGRADE_BASE_COSTS[currentLevel] || 500;
}

export interface ActivePhysicsStats {
  maxSpeedUnitsPerSec: number;
  maxSpeedKmh: number;
  accelerationRate: number;
  dragCoefficient: number;
  armorWeight: number;
  bumpKnockbackPower: number;
  nitroDurationSeconds: number;
  nitroSpeedMultiplier: number;
  nitroRefillRate: number;
}

export function computePhysicsStats(
  carId: string,
  upgrades: { [key: string]: number } = {}
): ActivePhysicsStats {
  const def = VEHICLES[carId] || VEHICLES.red_storm;
  const topSpeedLvl = upgrades.topSpeed || 1;
  const accelLvl = upgrades.acceleration || 1;
  const armorLvl = upgrades.heavyArmor || 1;
  const nitroDurLvl = upgrades.nitroDuration || 1;
  const nitroPowLvl = upgrades.nitroPower || 1;

  const effectiveTopSpeedKmh = def.baseStats.topSpeed + (topSpeedLvl - 1) * 8;
  const maxSpeedUnitsPerSec = (effectiveTopSpeedKmh / 180) * 58;
  const accelerationRate = 28 + (def.baseStats.acceleration + (accelLvl - 1) * 1.5) * 2.2;
  const armorWeight = (def.baseStats.heavyArmor + (armorLvl - 1) * 1.4) * 0.22;
  const bumpKnockbackPower = 5.0 + armorWeight * 3.5;
  const nitroDurationSeconds = def.baseStats.nitroDuration + (nitroDurLvl - 1) * 0.6;
  const nitroSpeedMultiplier = def.baseStats.nitroPower + (nitroPowLvl - 1) * 0.06;
  const nitroRefillRate = 0.08 + (nitroDurLvl - 1) * 0.015;

  return {
    maxSpeedUnitsPerSec,
    maxSpeedKmh: Math.round(effectiveTopSpeedKmh),
    accelerationRate,
    dragCoefficient: 0.985,
    armorWeight,
    bumpKnockbackPower,
    nitroDurationSeconds,
    nitroSpeedMultiplier,
    nitroRefillRate,
  };
}
