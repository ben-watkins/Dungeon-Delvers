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
  knockbackDecay: 0.92,  // Knockback velocity multiplier per frame (higher = slides further)
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
    stats: { hp: 150, speed: 86, power: 2.0, defense: 1.4 },
    combo: ['warrior_atk1', 'warrior_atk2', 'warrior_atk3'],
    specials: {
      special1: {
        name: 'Mega Slash',
        key: 'warrior_megaslash',
        cooldown: 3000,
        damage: 2.5,
        range: 50,
        bleed: { damagePerTick: 2, ticks: 5, interval: 1000 },
        description: 'Huge horizontal slash. Applies bleed to all enemies hit.',
      },
      special2: {
        name: 'Shotgun Blast',
        key: 'warrior_shotgun',
        cooldown: 3000,
        damage: 4.0,
        knockback: 25,
        range: 80,
        spread: 40,
        pellets: 6,
        description: 'Fire a devastating shotgun blast. Massive damage and knockback in a cone.',
      },
      special3: {
        name: 'Heroic Leap',
        key: 'warrior_leap',
        cooldown: 5000,
        damage: 2.0,
        stun: true,
        stunDuration: 4000,
        radius: 40,
        description: 'Leap to target, stunning all nearby enemies for 4 seconds.',
      },
      special5: {
        name: 'Whirlwind',
        key: 'warrior_whirlwind',
        cooldown: 1000,
        damagePerTick: 2.5,
        tickInterval: 200,
        radius: 35,
        knockback: 1.5,
        description: 'Channel: spin and slash all nearby enemies. Hold to continue.',
      },
      special4: {
        name: 'Shield Charge',
        key: 'warrior_charge',
        cooldown: 2000,
        damage: 1.5,
        speedMultiplier: 1.2,
        knockdown: true,
        knockdownDuration: 1500,
        knockbackBySize: { small: 18, medium: 8, large: 0 },
        description: 'Dash to target at 120% speed, shield bash on arrival. Launches small enemies.',
      },
    },
    passives: {
      taunt: {
        name: 'Taunt Aura',
        description: 'Enemies within range prioritize attacking the Warrior.',
        radius: 60,
      },
    },
  },

  priest: {
    name: 'Priest',
    role: 'healer',
    stats: { hp: 90, speed: 86, power: 1.05, defense: 0.8 },
    combo: ['priest_atk1', 'priest_atk2', 'priest_atk3'],
    rangedAttack: {
      damage: 4,
      healPercent: 1.0,
      beamColor: 0xffffaa,
      beamCount: 3,
      hitAllVisible: true,
    },
    specials: {
      special1: {
        name: 'Holy Light',
        key: 'priest_holylight',
        cooldown: 4000,
        healAmount: 20,
        description: 'Heals the lowest HP party member.',
      },
      special2: {
        name: 'Divine Nova',
        key: 'priest_nova',
        cooldown: 8000,
        healAmount: 10,
        damage: 0.63,
        description: 'AoE burst: damages nearby enemies and heals all party members.',
      },
      special3: {
        name: 'Divine Ascension',
        key: 'priest_ascension',
        cooldown: 10000,
        healPerBlob: 12,
        blobCount: 6,
        duration: 3000,
        description: 'Levitate and lob healing orbs to all allies over 3 seconds.',
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

  mage: {
    name: 'Mage',
    role: 'ranged-dps',
    stats: { hp: 80, speed: 90, power: 6.0, defense: 0.7 },
    combo: ['mage_atk1', 'mage_atk2', 'mage_atk3'],
    specials: {
      special1: {
        name: 'Arcane Missiles',
        key: 'mage_missiles',
        cooldown: 2500,
        damage: 1.8,
        missileCount: 5,
        missileDelay: 120,
        range: 120,
        description: 'Rapid-fire 5 homing arcane missiles at the target.',
      },
      special2: {
        name: 'Comet Crash',
        key: 'mage_comet',
        cooldown: 6000,
        damage: 8.0,
        radius: 50,
        knockback: 20,
        description: 'Call a massive comet from the sky. Huge AoE damage and knockback.',
      },
      special3: {
        name: 'Blink',
        key: 'mage_blink',
        cooldown: 3000,
        distance: 80,
        description: 'Teleport forward instantly, dodging all damage.',
      },
      special4: {
        name: 'Frost Nova',
        key: 'mage_frostnova',
        cooldown: 5000,
        damage: 2.0,
        radius: 50,
        stun: true,
        stunDuration: 2500,
        description: 'Freeze all nearby enemies in place.',
      },
      special5: {
        name: 'Disintegrate',
        key: 'mage_disintegrate',
        cooldown: 4000,
        damagePerTick: 3.0,
        tickInterval: 100,
        range: 140,
        beamWidth: 8,
        description: 'Channel a devastating plasma beam. Hold to continue.',
      },
      special6: {
        name: 'Meteor Storm',
        key: 'mage_meteorstorm',
        cooldown: 8000,
        damagePerMeteor: 3.5,
        meteorCount: 8,
        meteorDelay: 200,
        radius: 60,
        description: 'Rain meteors across the battlefield.',
      },
      special7: {
        name: 'Chain Lightning',
        key: 'mage_chainlightning',
        cooldown: 4000,
        damage: 3.5,
        bounces: 5,
        range: 100,
        description: 'Lightning arcs between up to 5 enemies.',
      },
      special8: {
        name: 'Time Warp',
        key: 'mage_timewarp',
        cooldown: 10000,
        slowPercent: 0.4,
        duration: 4000,
        radius: 80,
        description: 'Slow all enemies to 40% speed for 4 seconds.',
      },
    },
    passives: {
      arcanePower: {
        name: 'Arcane Power',
        description: 'Spells deal 15% bonus damage to stunned enemies.',
        bonusDamage: 0.15,
      },
    },
  },

  rogue: {
    name: 'Rogue',
    role: 'dps',
    stats: { hp: 100, speed: 86, power: 8.0, defense: 0.9 },
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
  // WARRIOR COMBO — 3-swing escalating chain
  warrior_atk1: {
    frames: 6, activeStart: 2, activeEnd: 4,
    hitbox: { offsetX: 32, offsetY: -14, width: 64, height: 30 },
    damage: 20, knockback: 1, hitstun: 300,
    canCancel: 3, recovery: 1,
  },
  warrior_atk2: {
    frames: 7, activeStart: 2, activeEnd: 4,
    hitbox: { offsetX: 30, offsetY: -16, width: 72, height: 34 },
    damage: 30, knockback: 1.6, hitstun: 400,
    canCancel: 4, recovery: 1,
  },
  warrior_atk3: {
    frames: 10, activeStart: 3, activeEnd: 6,
    hitbox: { offsetX: 20, offsetY: -20, width: 100, height: 50 },
    damage: 60, knockback: 3, hitstun: 700,
    canCancel: -1, recovery: 3,  // Finisher — ground slam, massive AoE
    groundSlam: true,
  },

  // PRIEST COMBO (staff swings)
  priest_atk1: {
    frames: 6, activeStart: 2, activeEnd: 3,
    hitbox: { offsetX: 24, offsetY: -6, width: 36, height: 14 },
    damage: 6, knockback: 5, hitstun: 150,
    canCancel: 4, recovery: 2,
  },
  priest_atk2: {
    frames: 7, activeStart: 2, activeEnd: 4,
    hitbox: { offsetX: 20, offsetY: -8, width: 44, height: 16 },
    damage: 8, knockback: 8, hitstun: 200,
    canCancel: 5, recovery: 2,
  },
  priest_atk3: {
    frames: 9, activeStart: 3, activeEnd: 5,
    hitbox: { offsetX: 16, offsetY: -10, width: 52, height: 20 },
    damage: 12, knockback: 14, hitstun: 300,
    canCancel: -1, recovery: 3,
  },

  // MAGE COMBO (arcane bolt chain)
  mage_atk1: {
    frames: 5, activeStart: 2, activeEnd: 3,
    hitbox: { offsetX: 28, offsetY: -8, width: 40, height: 16 },
    damage: 10, knockback: 3, hitstun: 150,
    canCancel: 3, recovery: 1,
  },
  mage_atk2: {
    frames: 5, activeStart: 2, activeEnd: 3,
    hitbox: { offsetX: 32, offsetY: -8, width: 44, height: 16 },
    damage: 12, knockback: 4, hitstun: 180,
    canCancel: 3, recovery: 1,
  },
  mage_atk3: {
    frames: 7, activeStart: 2, activeEnd: 4,
    hitbox: { offsetX: 24, offsetY: -12, width: 52, height: 24 },
    damage: 20, knockback: 8, hitstun: 300,
    canCancel: -1, recovery: 2,
  },

  // ROGUE COMBO (fast dagger chain)
  rogue_atk1: {
    frames: 4, activeStart: 1, activeEnd: 2,
    hitbox: { offsetX: 24, offsetY: -6, width: 28, height: 12 },
    damage: 8, knockback: 6, hitstun: 100,
    canCancel: 3, recovery: 1,
  },
  rogue_atk2: {
    frames: 4, activeStart: 1, activeEnd: 2,
    hitbox: { offsetX: 28, offsetY: -6, width: 28, height: 12 },
    damage: 8, knockback: 6, hitstun: 100,
    canCancel: 3, recovery: 1,
  },
  rogue_atk3: {
    frames: 5, activeStart: 1, activeEnd: 3,
    hitbox: { offsetX: 24, offsetY: -8, width: 36, height: 14 },
    damage: 12, knockback: 10, hitstun: 150,
    canCancel: 4, recovery: 1,
  },
  rogue_atk4: {
    frames: 8, activeStart: 2, activeEnd: 4,
    hitbox: { offsetX: 20, offsetY: -10, width: 48, height: 18 },
    damage: 18, knockback: 18, hitstun: 350,
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
    timeLimit: 900,
    keystoneBase: 2,
    projectilePrefix: 'deadmines',
    environment: {
      bgLayers: [
        { key: 'dungeon_bg', scrollFactor: 0.5, y: 0, height: 160 },
      ],
      tileSheet: 'dungeon_tiles',
      tileRows: [0, 1, 2, 3],       // floor tile frames from row 0
      propSheet: 'dungeon_props',
      wallProps: [0, 4, 9],          // pillar, torch stand, candelabra
      floorProps: [1, 2, 1],         // barrel, bones, barrel
    },
    rooms: [
      { type: 'hallway', enemies: ['imp', 'imp', 'imp', 'hellknight'] },
      { type: 'arena', enemies: ['imp', 'imp', 'imp', 'imp', 'hellknight', 'hellknight'] },
      { type: 'hallway', enemies: ['imp', 'imp', 'hellknight', 'hellknight'] },
      { type: 'arena', enemies: ['imp', 'imp', 'imp', 'hellknight', 'hellknight', 'hellknight'] },
      { type: 'hallway', enemies: ['imp', 'imp', 'imp', 'hellknight', 'hellknight', 'hellknight'] },
      { type: 'arena', enemies: ['imp', 'imp', 'imp', 'imp', 'hellknight', 'hellknight', 'hellknight', 'hellknight'] },
      { type: 'boss', boss: 'pitlord' },
    ],
  },

  mythic_grove: {
    name: 'Mythic Grove',
    timeLimit: 1200,
    keystoneBase: 4,
    projectilePrefix: 'mythic',
    environment: {
      bgLayers: [
        { key: 'mythic_bg_far', scrollFactor: 0.2, y: 0, height: 200 },
        { key: 'mythic_bg_mid', scrollFactor: 0.5, y: 0, height: 200 },
        { key: 'mythic_bg_near', scrollFactor: 1.2, y: 0, height: 200, foreground: true },
      ],
      tileSheet: 'mythic_tiles',
      tileRows: [0, 1, 2, 3],       // mossy stone + root tiles from row 0
      waterTileRows: [16, 17, 18],   // glowing pool tiles from row 1 (frames 16+)
      waterChance: 0.08,             // % of floor tiles replaced with water
      propSheet: 'mythic_props',
      wallProps: [0, 1, 4],          // moss pillar, crystal cluster, crystal
      floorProps: [2, 3, 6],         // mushrooms, glowing pool, dark mushrooms
      transitionProp: 8,             // hanging vine curtain at room transitions
    },
    rooms: [
      { type: 'hallway', enemies: ['imp', 'imp', 'imp'] },
      { type: 'arena', enemies: ['imp', 'imp', 'imp', 'imp', 'hellknight', 'hellknight'] },
      { type: 'hallway', enemies: ['imp', 'hellknight', 'hellknight'] },
      { type: 'arena', enemies: ['hellknight', 'hellknight', 'hellknight', 'imp', 'imp'] },
      { type: 'hallway', enemies: ['imp', 'imp', 'hellknight'] },
      { type: 'arena', enemies: ['imp', 'imp', 'imp', 'hellknight', 'hellknight', 'hellknight'] },
      { type: 'boss', boss: 'pitlord' },
    ],
  },

  frozen_crypt: {
    name: 'Frozen Crypt',
    timeLimit: 1000,
    keystoneBase: 5,
    projectilePrefix: 'frozen',
    environment: {
      bgLayers: [
        { key: 'frozen_bg_far', scrollFactor: 0.2, y: 0, height: 200 },
        { key: 'frozen_bg_mid', scrollFactor: 0.5, y: 0, height: 200 },
        { key: 'frozen_bg_near', scrollFactor: 1.2, y: 0, height: 200, foreground: true },
      ],
      tileSheet: 'frozen_tiles',
      tileRows: [0, 1, 2, 3],
      propSheet: 'frozen_props',
      wallProps: [0, 1, 4],
      floorProps: [2, 3, 6],
    },
    rooms: [
      { type: 'hallway', enemies: ['frozen_wraith', 'frozen_wraith', 'frozen_wraith'] },
      { type: 'arena', enemies: ['frozen_wraith', 'frozen_wraith', 'frozen_wraith', 'frozen_wraith', 'frozen_golem'] },
      { type: 'hallway', enemies: ['frozen_wraith', 'frozen_golem'] },
      { type: 'arena', enemies: ['frozen_wraith', 'frozen_wraith', 'frozen_golem', 'frozen_golem', 'frozen_golem'] },
      { type: 'boss', boss: 'frozen_giant' },
    ],
  },

  infernal_forge: {
    name: 'Infernal Forge',
    timeLimit: 1100,
    keystoneBase: 7,
    projectilePrefix: 'forge',
    environment: {
      bgLayers: [
        { key: 'forge_bg_far', scrollFactor: 0.2, y: 0, height: 200 },
        { key: 'forge_bg_mid', scrollFactor: 0.5, y: 0, height: 200 },
        { key: 'forge_bg_near', scrollFactor: 1.2, y: 0, height: 200, foreground: true },
      ],
      tileSheet: 'forge_tiles',
      tileRows: [0, 1, 2, 3],
      propSheet: 'forge_props',
      wallProps: [0, 1, 4],
      floorProps: [2, 3, 6],
    },
    rooms: [
      { type: 'hallway', enemies: ['forge_imp', 'forge_imp', 'forge_imp', 'forge_imp'] },
      { type: 'arena', enemies: ['forge_imp', 'forge_imp', 'forge_imp', 'forge_golem', 'forge_golem'] },
      { type: 'hallway', enemies: ['forge_imp', 'forge_imp', 'forge_golem'] },
      { type: 'arena', enemies: ['forge_imp', 'forge_imp', 'forge_golem', 'forge_golem', 'forge_golem'] },
      { type: 'hallway', enemies: ['forge_golem', 'forge_golem'] },
      { type: 'boss', boss: 'forge_infernal' },
    ],
  },

  sunken_temple: {
    name: 'Sunken Temple',
    timeLimit: 1200,
    keystoneBase: 9,
    projectilePrefix: 'temple',
    environment: {
      bgLayers: [
        { key: 'temple_bg_far', scrollFactor: 0.2, y: 0, height: 200 },
        { key: 'temple_bg_mid', scrollFactor: 0.5, y: 0, height: 200 },
        { key: 'temple_bg_near', scrollFactor: 1.2, y: 0, height: 200, foreground: true },
      ],
      tileSheet: 'temple_tiles',
      tileRows: [0, 1, 2, 3],
      propSheet: 'temple_props',
      wallProps: [0, 1, 4],
      floorProps: [2, 3, 6],
    },
    rooms: [
      { type: 'hallway', enemies: ['temple_murloc', 'temple_murloc', 'temple_murloc', 'temple_murloc', 'temple_murloc'] },
      { type: 'arena', enemies: ['temple_murloc', 'temple_murloc', 'temple_murloc', 'temple_naga', 'temple_naga'] },
      { type: 'hallway', enemies: ['temple_murloc', 'temple_murloc', 'temple_naga'] },
      { type: 'arena', enemies: ['temple_murloc', 'temple_murloc', 'temple_naga', 'temple_naga', 'temple_naga'] },
      { type: 'hallway', enemies: ['temple_naga', 'temple_naga', 'temple_naga'] },
      { type: 'arena', enemies: ['temple_naga', 'temple_naga', 'temple_naga', 'temple_naga'] },
      { type: 'boss', boss: 'temple_horror' },
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
    size: 'small',
    stats: { hp: 300, speed: 80, power: 0.05, defense: 0.4 },
    attacks: ['imp_scratch'],
    aggroRange: 120,
    attackRange: 18,
    attackCooldown: 600,
  },
  hellknight: {
    name: 'Hellknight',
    type: 'elite',
    size: 'medium',
    stats: { hp: 200, speed: 55, power: 0.08, defense: 1.3 },
    attacks: ['hellknight_slash', 'hellknight_charge'],
    aggroRange: 140,
    attackRange: 24,
    attackCooldown: 1400,
  },
  pitlord: {
    name: 'Pitlord',
    type: 'boss',
    size: 'large',
    frameSize: 64,
    stats: { hp: 750, speed: 35, power: 0.1, defense: 1.6 },
    attacks: ['pitlord_cleave', 'pitlord_stomp'],
    phases: [
      { hpThreshold: 0.6, attack: 'pitlord_hellfire' },
      { hpThreshold: 0.3, attack: 'pitlord_enrage' },
    ],
    aggroRange: 160,
    attackRange: 30,
    attackCooldown: 1600,
  },

  // --- FROZEN CRYPT ---
  frozen_wraith: {
    name: 'Frozen Wraith',
    type: 'trash',
    size: 'small',
    stats: { hp: 25, speed: 55, power: 0.06, defense: 0.3 },
    attacks: ['imp_scratch'],
    aggroRange: 90,
    attackRange: 16,
    attackCooldown: 800,
  },
  frozen_golem: {
    name: 'Frozen Golem',
    type: 'elite',
    size: 'medium',
    stats: { hp: 150, speed: 20, power: 0.1, defense: 1.5 },
    attacks: ['hellknight_slash'],
    aggroRange: 80,
    attackRange: 22,
    attackCooldown: 2500,
  },
  frozen_giant: {
    name: 'Frozen Giant',
    type: 'boss',
    size: 'large',
    frameSize: 64,
    stats: { hp: 600, speed: 15, power: 0.12, defense: 1.8 },
    attacks: ['pitlord_cleave', 'pitlord_stomp'],
    phases: [
      { hpThreshold: 0.5, attack: 'pitlord_hellfire' },
      { hpThreshold: 0.2, attack: 'pitlord_enrage' },
    ],
    aggroRange: 120,
    attackRange: 28,
    attackCooldown: 2800,
  },

  // --- INFERNAL FORGE ---
  forge_imp: {
    name: 'Forge Imp',
    type: 'trash',
    size: 'small',
    stats: { hp: 35, speed: 50, power: 0.07, defense: 0.4 },
    attacks: ['imp_scratch'],
    aggroRange: 85,
    attackRange: 16,
    attackCooldown: 850,
  },
  forge_golem: {
    name: 'Forge Golem',
    type: 'elite',
    size: 'medium',
    stats: { hp: 180, speed: 18, power: 0.12, defense: 1.6 },
    attacks: ['hellknight_slash', 'hellknight_charge'],
    aggroRange: 90,
    attackRange: 24,
    attackCooldown: 2200,
  },
  forge_infernal: {
    name: 'Forge Infernal',
    type: 'boss',
    size: 'large',
    frameSize: 64,
    stats: { hp: 700, speed: 12, power: 0.15, defense: 2.0 },
    attacks: ['pitlord_cleave', 'pitlord_stomp'],
    phases: [
      { hpThreshold: 0.6, attack: 'pitlord_hellfire' },
      { hpThreshold: 0.25, attack: 'pitlord_enrage' },
    ],
    aggroRange: 130,
    attackRange: 30,
    attackCooldown: 2000,
  },

  // --- SUNKEN TEMPLE ---
  temple_murloc: {
    name: 'Temple Murloc',
    type: 'trash',
    size: 'small',
    stats: { hp: 30, speed: 60, power: 0.05, defense: 0.35 },
    attacks: ['imp_scratch'],
    aggroRange: 95,
    attackRange: 14,
    attackCooldown: 700,
  },
  temple_naga: {
    name: 'Temple Naga',
    type: 'elite',
    size: 'medium',
    stats: { hp: 160, speed: 25, power: 0.11, defense: 1.4 },
    attacks: ['hellknight_slash', 'hellknight_charge'],
    aggroRange: 100,
    attackRange: 22,
    attackCooldown: 1800,
  },
  temple_horror: {
    name: 'Temple Horror',
    type: 'boss',
    size: 'large',
    frameSize: 64,
    stats: { hp: 800, speed: 10, power: 0.18, defense: 2.2 },
    attacks: ['pitlord_cleave', 'pitlord_stomp'],
    phases: [
      { hpThreshold: 0.5, attack: 'pitlord_hellfire' },
      { hpThreshold: 0.2, attack: 'pitlord_enrage' },
    ],
    aggroRange: 140,
    attackRange: 32,
    attackCooldown: 2400,
  },
};

/**
 * M+ AFFIX DEFINITIONS
 * Affixes modify dungeon behavior at higher keystone levels.
 */
export const AFFIXES = {
  // TIER 1 (Keystone 1-5)
  raging: {
    name: 'Raging',
    tier: 1,
    hpThreshold: 0.3,
    damageBoost: 0.5,
    description: 'Enemies below 30% HP deal +50% damage.',
  },
  bolstering: {
    name: 'Bolstering',
    tier: 1,
    damageBoost: 0.10,
    hpBoost: 0.10,
    radius: 200,
    description: 'When an enemy dies, nearby enemies gain +10% HP and damage.',
  },

  // TIER 2 (Keystone 5-10)
  sanguine: {
    name: 'Sanguine',
    tier: 2,
    poolRadius: 40,
    poolDuration: 8000,
    enemyHealPercent: 0.03,
    playerDamagePercent: 0.02,
    description: 'Dead enemies drop a blood pool that heals enemies and damages players.',
  },
  volcanic: {
    name: 'Volcanic',
    tier: 2,
    spawnInterval: 4000,
    telegraphDuration: 1000,
    damage: 0.20,
    radius: 40,
    description: 'Volcanic plumes erupt under random players during combat.',
  },

  // TIER 3 (Keystone 10-20)
  necrotic: {
    name: 'Necrotic',
    tier: 3,
    healReductionPerStack: 0.05,
    maxStacks: 20,
    decayDelay: 3000,
    decayRate: 1000,
    description: 'Enemy melee attacks reduce healing received by 5% per stack.',
  },
  bursting: {
    name: 'Bursting',
    tier: 3,
    damagePercent: 0.02,
    burstDuration: 4000,
    description: 'Each enemy death applies Burst to all players (2% HP/sec for 4s, stacks).',
  },

  // TIER 4 (Keystone 20-30)
  afflicted: {
    name: 'Afflicted',
    tier: 4,
    spawnInterval: 12000,
    dispelWindow: 8000,
    stunDuration: 4000,
    description: 'Random player gets cursed. Dispel or heal to full within 8s or be stunned.',
  },
};

export const KEYSTONE_SCALING = {
  damagePerLevel: 0.10,
  hpPerLevel: 0.08,
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
