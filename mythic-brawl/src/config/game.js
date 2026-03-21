/**
 * GAME CONFIG — Central constants for the entire game.
 * 
 * Resolution: 480x270 is 16:9 at a pixel-friendly size.
 * Scaled up 4x to 1920x1080 by Phaser's FIT mode.
 * This means every pixel you place is a crisp 4x4 block on a 1080p screen.
 */

export const GAME_CONFIG = {
  // Display
  width: 480,
  height: 270,
  tileSize: 16,
  debug: false,

  // 2.5D ground plane — the Y range where characters can walk
  // Characters at groundMinY appear "far away", at groundMaxY appear "close"
  groundMinY: 160,
  groundMaxY: 240,

  // Depth sorting layer base values
  layers: {
    background: 0,
    groundDecor: 100,
    entities: 200,       // Entities sort dynamically within this range
    foregroundDecor: 900,
    ui: 1000,
  },

  // Physics
  hitStopFrames: 3,      // Freeze frames on hit for impact feel
  knockbackDecay: 0.85,  // Knockback velocity multiplier per frame
};

/**
 * CLASS DEFINITIONS
 * Each class defines base stats, movement speed, combo chains, and specials.
 * 
 * Stats:
 *   hp        — Max health
 *   speed     — Walk speed in pixels/frame
 *   power     — Base damage multiplier
 *   defense   — Damage reduction multiplier
 * 
 * Combo chain: array of attack keys executed in sequence on repeated attack input.
 * Each attack references an animation key and has its own hitbox/damage/timing data.
 */
export const CLASSES = {
  warrior: {
    name: 'Warrior',
    role: 'tank',
    stats: { hp: 150, speed: 55, power: 0.15, defense: 1.4 },
    combo: ['warrior_atk1', 'warrior_atk2', 'warrior_atk3'],
    specials: {
      special1: {
        name: 'Overhead Cleave',
        key: 'warrior_cleave',
        cooldown: 3000,
        damage: 2.5,
        description: 'Massive overhead swing. Hits all enemies in front.',
      },
      special2: {
        name: 'Shield Bash',
        key: 'warrior_shieldbash',
        cooldown: 5000,
        damage: 1.5,
        knockback: 3.0,
        stun: 1500,
        description: 'Stuns target and knocks back nearby enemies.',
      },
    },
    passives: {
      taunt: {
        name: 'Taunt Aura',
        description: 'Enemies within range prioritize attacking the Warrior.',
        radius: 60,
      },
      block: {
        name: 'Shield Block',
        description: 'Hold block to reduce incoming damage by 50%. Cannot attack while blocking.',
        reduction: 0.5,
      },
    },
  },

  priest: {
    name: 'Priest',
    role: 'healer',
    stats: { hp: 90, speed: 50, power: 0.1, defense: 0.8 },
    combo: ['priest_atk1', 'priest_atk2', 'priest_atk3'],
    specials: {
      special1: {
        name: 'Holy Light',
        key: 'priest_holylight',
        cooldown: 4000,
        healAmount: 40,
        description: 'Heals the lowest HP party member.',
      },
      special2: {
        name: 'Divine Nova',
        key: 'priest_nova',
        cooldown: 8000,
        healAmount: 20,
        damage: 1.8,
        description: 'AoE burst: damages nearby enemies and heals all party members.',
      },
    },
    passives: {
      atonement: {
        name: 'Atonement',
        description: 'Dealing damage heals the lowest HP ally for 15% of damage dealt.',
        healPercent: 0.15,
      },
    },
  },

  rogue: {
    name: 'Rogue',
    role: 'dps',
    stats: { hp: 100, speed: 70, power: 0.2, defense: 0.9 },
    combo: ['rogue_atk1', 'rogue_atk2', 'rogue_atk3', 'rogue_atk4'],
    specials: {
      special1: {
        name: 'Dagger Flurry',
        key: 'rogue_flurry',
        cooldown: 3000,
        hits: 5,
        damagePerHit: 0.6,
        description: 'Rapid 5-hit combo. Each hit has a chance to crit.',
      },
      special2: {
        name: 'Shadow Strike',
        key: 'rogue_shadowstrike',
        cooldown: 6000,
        damage: 3.0,
        teleport: true,
        description: 'Teleport behind the target and strike for massive damage.',
      },
    },
    passives: {
      criticalStrikes: {
        name: 'Critical Strikes',
        description: '20% chance for attacks to deal 2x damage.',
        chance: 0.2,
        multiplier: 2.0,
      },
      evasion: {
        name: 'Evasion',
        description: '15% chance to dodge incoming attacks entirely.',
        chance: 0.15,
      },
    },
  },
};

/**
 * ATTACK DATA
 * Defines hitbox geometry, timing, damage, and animation info for every attack.
 * 
 * Fields:
 *   frames       — Total animation frames
 *   activeStart  — Frame when hitbox becomes active
 *   activeEnd    — Frame when hitbox deactivates
 *   hitbox       — { offsetX, offsetY, width, height } relative to entity origin
 *   damage       — Base damage value (multiplied by class power stat)
 *   knockback    — Knockback force applied to target
 *   hitstun      — Duration in ms that target is stunned
 *   canCancel    — Frame after which this attack can be cancelled into next combo hit
 *   recovery     — Frames of recovery after active frames (can't act)
 */
export const ATTACKS = {
  // WARRIOR COMBO
  warrior_atk1: {
    frames: 6, activeStart: 2, activeEnd: 3,
    hitbox: { offsetX: 14, offsetY: -8, width: 20, height: 16 },
    damage: 10, knockback: 1.0, hitstun: 200,
    canCancel: 4, recovery: 2,
  },
  warrior_atk2: {
    frames: 7, activeStart: 2, activeEnd: 4,
    hitbox: { offsetX: 12, offsetY: -10, width: 24, height: 18 },
    damage: 14, knockback: 1.5, hitstun: 250,
    canCancel: 5, recovery: 2,
  },
  warrior_atk3: {
    frames: 10, activeStart: 3, activeEnd: 5,
    hitbox: { offsetX: 10, offsetY: -12, width: 28, height: 22 },
    damage: 22, knockback: 3.0, hitstun: 400,
    canCancel: -1, recovery: 4,  // Finisher — no cancel
  },

  // PRIEST COMBO (staff swings)
  priest_atk1: {
    frames: 6, activeStart: 2, activeEnd: 3,
    hitbox: { offsetX: 12, offsetY: -6, width: 18, height: 14 },
    damage: 6, knockback: 0.5, hitstun: 150,
    canCancel: 4, recovery: 2,
  },
  priest_atk2: {
    frames: 7, activeStart: 2, activeEnd: 4,
    hitbox: { offsetX: 10, offsetY: -8, width: 22, height: 16 },
    damage: 8, knockback: 0.8, hitstun: 200,
    canCancel: 5, recovery: 2,
  },
  priest_atk3: {
    frames: 9, activeStart: 3, activeEnd: 5,
    hitbox: { offsetX: 8, offsetY: -10, width: 26, height: 20 },
    damage: 12, knockback: 1.5, hitstun: 300,
    canCancel: -1, recovery: 3,
  },

  // ROGUE COMBO (fast dagger chain)
  rogue_atk1: {
    frames: 4, activeStart: 1, activeEnd: 2,
    hitbox: { offsetX: 12, offsetY: -6, width: 14, height: 12 },
    damage: 8, knockback: 0.3, hitstun: 100,
    canCancel: 3, recovery: 1,
  },
  rogue_atk2: {
    frames: 4, activeStart: 1, activeEnd: 2,
    hitbox: { offsetX: 14, offsetY: -6, width: 14, height: 12 },
    damage: 8, knockback: 0.3, hitstun: 100,
    canCancel: 3, recovery: 1,
  },
  rogue_atk3: {
    frames: 5, activeStart: 1, activeEnd: 3,
    hitbox: { offsetX: 12, offsetY: -8, width: 18, height: 14 },
    damage: 12, knockback: 0.8, hitstun: 150,
    canCancel: 4, recovery: 1,
  },
  rogue_atk4: {
    frames: 8, activeStart: 2, activeEnd: 4,
    hitbox: { offsetX: 10, offsetY: -10, width: 24, height: 18 },
    damage: 18, knockback: 2.5, hitstun: 350,
    canCancel: -1, recovery: 3,
  },
};

/**
 * DUNGEON DEFINITIONS
 * Each dungeon has a name, time limit, room sequence, and enemy composition.
 */
export const DUNGEONS = {
  deadmines: {
    name: 'The Deadmines',
    timeLimit: 900,          // seconds
    keystoneBase: 2,         // base keystone level
    rooms: [
      { type: 'hallway', enemies: ['imp', 'imp', 'imp'] },
      { type: 'arena', enemies: ['imp', 'imp', 'imp', 'hellknight', 'hellknight'] },
      { type: 'hallway', enemies: ['imp', 'hellknight'] },
      { type: 'boss', boss: 'pitlord' },
      { type: 'hallway', enemies: ['imp', 'imp', 'imp', 'hellknight'] },
      { type: 'arena', enemies: ['imp', 'imp', 'hellknight', 'hellknight', 'hellknight'] },
      { type: 'boss', boss: 'pitlord' },
    ],
  },
};

/**
 * ENEMY DEFINITIONS
 * Base stats for enemy types. Scaled by keystone level.
 */
export const ENEMIES = {
  imp: {
    name: 'Imp',
    type: 'trash',
    stats: { hp: 300, speed: 50, power: 0.05, defense: 0.4 },
    attacks: ['imp_scratch'],
    aggroRange: 80,
    attackRange: 16,
    attackCooldown: 900,
  },
  hellknight: {
    name: 'Hellknight',
    type: 'elite',
    stats: { hp: 800, speed: 30, power: 0.08, defense: 1.3 },
    attacks: ['hellknight_slash', 'hellknight_charge'],
    aggroRange: 100,
    attackRange: 22,
    attackCooldown: 2000,
  },
  pitlord: {
    name: 'Pitlord',
    type: 'boss',
    frameSize: 64,
    stats: { hp: 3000, speed: 20, power: 0.1, defense: 1.6 },
    attacks: ['pitlord_cleave', 'pitlord_stomp'],
    phases: [
      { hpThreshold: 0.6, attack: 'pitlord_hellfire' },
      { hpThreshold: 0.3, attack: 'pitlord_enrage' },
    ],
    aggroRange: 120,
    attackRange: 28,
    attackCooldown: 2200,
  },
};

/**
 * M+ AFFIX DEFINITIONS
 * Affixes modify dungeon behavior at higher keystone levels.
 */
export const AFFIXES = {
  fortified: {
    name: 'Fortified',
    description: 'Non-boss enemies have increased health and damage.',
    hpMultiplier: 1.2,
    damageMultiplier: 1.15,
    appliesTo: ['trash', 'elite'],
  },
  tyrannical: {
    name: 'Tyrannical',
    description: 'Boss enemies have increased health and damage.',
    hpMultiplier: 1.3,
    damageMultiplier: 1.2,
    appliesTo: ['boss'],
  },
  bursting: {
    name: 'Bursting',
    description: 'When enemies die, they explode dealing AoE damage after 2 seconds.',
    delay: 2000,
    damage: 15,
    radius: 40,
  },
  bolstering: {
    name: 'Bolstering',
    description: 'When an enemy dies, nearby enemies gain 10% increased damage and size.',
    damageBoost: 0.10,
    scaleBoost: 0.05,
    radius: 60,
  },
  sanguine: {
    name: 'Sanguine',
    description: 'Enemies leave a healing pool on death that heals other enemies.',
    healPerSecond: 8,
    duration: 6000,
    radius: 24,
  },
  explosive: {
    name: 'Explosive',
    description: 'Enemies periodically spawn explosive orbs that must be killed.',
    spawnInterval: 8000,
    orbHp: 10,
    orbDamage: 30,
    orbFuseTime: 4000,
  },
  necrotic: {
    name: 'Necrotic',
    description: 'Enemy melee hits stack a debuff reducing healing received by 3% per stack.',
    healingReductionPerStack: 0.03,
    maxStacks: 30,
    duration: 6000,
  },
};

/**
 * INPUT MAPPING
 * Default keyboard bindings. Can be remapped.
 *
 * Xbox controller mapping (active when gamepad connected):
 *   Left stick / D-pad — Move
 *   A button   — Attack
 *   X button   — Special 1
 *   Y button   — Special 2
 *   B button   — Block
 *   RB         — Dodge
 *   Start      — Pause / Confirm
 */
export const INPUT_MAP = {
  moveLeft: 'A',
  moveRight: 'D',
  moveUp: 'W',
  moveDown: 'S',
  attack: 'NUMPAD_ONE',
  special1: 'NUMPAD_TWO',
  special2: 'NUMPAD_THREE',
  block: 'NUMPAD_FOUR',
  dodge: 'NUMPAD_FIVE',
  interact: 'E',
  pause: 'ESC',
};
