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
      special4: {
        name: 'Penance',
        key: 'priest_penance',
        cooldown: 5000,
        damage: 2.5,
        boltCount: 5,
        boltDelay: 130,
        range: 110,
        description: 'Channel 5 rapid holy bolts at an enemy. Each heals allies via Atonement.',
      },
      special5: {
        name: 'Hymn of Hope',
        key: 'priest_hymn',
        cooldown: 9000,
        healPerTick: 25,
        tickInterval: 350,
        duration: 4000,
        description: 'Channel a radiant hymn. Hold to heal all allies to full over time.',
      },
      special6: {
        name: 'Power Word: Radiance',
        key: 'priest_radiance',
        cooldown: 8000,
        healAmount: 8,
        hotTicks: 5,
        hotInterval: 500,
        description: 'Sunburst of golden light. Heals all allies instantly and over time.',
      },
      special7: {
        name: 'Divine Storm',
        key: 'priest_divinestorm',
        cooldown: 7000,
        healAmount: 999,
        damage: 3.5,
        pillarCount: 7,
        pillarDelay: 200,
        range: 120,
        description: 'Pillars of light heal all allies to full. If already full, electrocutes enemies instead.',
      },
      special8: {
        name: 'Spirit Link',
        key: 'priest_spiritlink',
        cooldown: 15000,
        duration: 4000,
        description: 'Golden chains link all allies — equalizes HP across the party.',
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

  // ─── WARLOCK ───────────────────────────────────────────
  warlock: {
    name: 'Warlock',
    role: 'ranged-dps',
    stats: { hp: 85, speed: 84, power: 5.5, defense: 0.75 },
    combo: ['warlock_atk1', 'warlock_atk2', 'warlock_atk3'],
    rangedAttack: {
      damage: 3.5,
      healPercent: 0,
      beamColor: 0x88ff44,
      beamCount: 2,
      hitAllVisible: true,
    },
    specials: {
      special1: {
        name: 'Shadow Bolt Volley',
        key: 'warlock_shadowvolley',
        cooldown: 3000,
        damage: 2.0,
        boltCount: 4,
        boltDelay: 100,
        range: 120,
        description: 'Rapid-fire 4 shadow bolts at the target.',
      },
      special2: {
        name: 'Chaos Bolt',
        key: 'warlock_chaosbolt',
        cooldown: 6000,
        damage: 9.0,
        range: 130,
        description: 'Massive fel fireball. Huge single-target damage.',
      },
      special3: {
        name: 'Drain Life',
        key: 'warlock_drainlife',
        cooldown: 5000,
        damagePerTick: 1.5,
        healPercent: 0.5,
        tickInterval: 150,
        range: 100,
        duration: 2000,
        description: 'Channel a beam draining enemy life to heal yourself.',
      },
      special4: {
        name: 'Howl of Terror',
        key: 'warlock_fear',
        cooldown: 12000,
        radius: 55,
        duration: 2500,
        description: 'All nearby enemies flee in terror for 2.5 seconds.',
      },
      special5: {
        name: 'Rain of Fire',
        key: 'warlock_rainoffire',
        cooldown: 8000,
        damagePerTick: 2.0,
        tickInterval: 300,
        radius: 40,
        duration: 4000,
        description: 'Channel fire from the sky on a target area. Hold to continue.',
      },
      special6: {
        name: 'Summon Imp',
        key: 'warlock_summonimp',
        cooldown: 18000,
        impDuration: 8000,
        impDamage: 0.04,
        impAttackRate: 800,
        description: 'Summon a fel imp that attacks enemies for 8 seconds.',
      },
      special7: {
        name: 'Shadowfury',
        key: 'warlock_shadowfury',
        cooldown: 10000,
        damage: 4.0,
        radius: 40,
        stunDuration: 2000,
        description: 'Dark explosion stuns and damages all nearby enemies.',
      },
      special8: {
        name: 'Immolate',
        key: 'warlock_immolate',
        cooldown: 9000,
        dotDamage: 1.0,
        dotTicks: 5,
        dotInterval: 400,
        burstDamage: 5.0,
        description: 'Ignite all enemies with fire DoT, then detonate for burst damage.',
      },
    },
    passives: {
      soulSiphon: {
        name: 'Soul Siphon',
        description: 'Dealing damage heals the Warlock for 8% of damage dealt.',
        healPercent: 0.08,
      },
    },
  },

  // ─── HUNTER ────────────────────────────────────────────
  hunter: {
    name: 'Hunter',
    role: 'ranged-dps',
    stats: { hp: 95, speed: 92, power: 5.0, defense: 0.85 },
    combo: ['hunter_atk1', 'hunter_atk2', 'hunter_atk3'],
    rangedAttack: {
      damage: 4.5,
      healPercent: 0,
      beamColor: 0x44bbaa,
      beamCount: 1,
      hitAllVisible: false,
    },
    specials: {
      special1: {
        name: 'Aimed Shot',
        key: 'hunter_aimedshot',
        cooldown: 4000,
        damage: 6.0,
        range: 140,
        description: 'Powerful charged arrow. High single-target damage.',
      },
      special2: {
        name: 'Multi-Shot',
        key: 'hunter_multishot',
        cooldown: 5000,
        damage: 2.5,
        arrowCount: 5,
        spreadAngle: 0.8,
        range: 110,
        description: 'Fan of 5 arrows hitting multiple targets.',
      },
      special3: {
        name: 'Disengage',
        key: 'hunter_disengage',
        cooldown: 4000,
        distance: 70,
        description: 'Leap backward to escape danger.',
      },
      special4: {
        name: 'Freezing Trap',
        key: 'hunter_trap',
        cooldown: 10000,
        stunDuration: 3000,
        radius: 18,
        duration: 6000,
        description: 'Place a trap. First enemy to walk over it is frozen solid.',
      },
      special5: {
        name: 'Rapid Fire',
        key: 'hunter_rapidfire',
        cooldown: 7000,
        damagePerTick: 1.2,
        tickInterval: 100,
        range: 120,
        description: 'Channel a barrage of rapid arrows. Hold to continue.',
      },
      special6: {
        name: 'Call Pet',
        key: 'hunter_callpet',
        cooldown: 20000,
        petDuration: 10000,
        petDamage: 0.06,
        petAttackRate: 600,
        description: 'Summon a wolf companion that attacks enemies for 10 seconds.',
      },
      special7: {
        name: 'Volley',
        key: 'hunter_volley',
        cooldown: 8000,
        damage: 2.0,
        arrowCount: 10,
        arrowDelay: 120,
        radius: 35,
        description: 'Rain of arrows on target area. Hits all enemies.',
      },
      special8: {
        name: 'Kill Shot',
        key: 'hunter_killshot',
        cooldown: 6000,
        damage: 12.0,
        executeThreshold: 0.3,
        range: 130,
        description: 'Execute shot. 3x damage to enemies below 30% HP.',
      },
    },
    passives: {
      predatorsSwiftness: {
        name: "Predator's Swiftness",
        description: 'Killing an enemy grants 30% move speed for 3 seconds.',
        speedBoost: 0.3,
        duration: 3000,
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

  // --- WARLOCK (ranged shadow bolts) ---
  warlock_atk1: {
    frames: 6, activeStart: 2, activeEnd: 4,
    hitbox: { offsetX: 24, offsetY: -12, width: 24, height: 16 },
    damage: 10, knockback: 1.0, hitstun: 150,
    canCancel: 4, recovery: 1,
  },
  warlock_atk2: {
    frames: 6, activeStart: 2, activeEnd: 4,
    hitbox: { offsetX: 28, offsetY: -12, width: 28, height: 16 },
    damage: 12, knockback: 1.5, hitstun: 150,
    canCancel: 4, recovery: 1,
  },
  warlock_atk3: {
    frames: 7, activeStart: 2, activeEnd: 4,
    hitbox: { offsetX: 28, offsetY: -14, width: 32, height: 20 },
    damage: 18, knockback: 3.0, hitstun: 250,
    canCancel: -1, recovery: 2,
  },

  // --- HUNTER (ranged arrows) ---
  hunter_atk1: {
    frames: 5, activeStart: 2, activeEnd: 3,
    hitbox: { offsetX: 30, offsetY: -10, width: 20, height: 12 },
    damage: 12, knockback: 1.0, hitstun: 100,
    canCancel: 3, recovery: 1,
  },
  hunter_atk2: {
    frames: 5, activeStart: 2, activeEnd: 3,
    hitbox: { offsetX: 30, offsetY: -10, width: 22, height: 14 },
    damage: 14, knockback: 2.0, hitstun: 120,
    canCancel: 3, recovery: 1,
  },
  hunter_atk3: {
    frames: 6, activeStart: 2, activeEnd: 4,
    hitbox: { offsetX: 28, offsetY: -12, width: 30, height: 16 },
    damage: 20, knockback: 4.0, hitstun: 200,
    canCancel: -1, recovery: 2,
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
      { type: 'boss', boss: 'pitlord', width: 720 },
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
  // ─── DEADMINES / HELLSCAPE ─────────────────────────────────
  imp: {
    name: 'Imp',
    type: 'trash',
    size: 'small',
    stats: { hp: 300, speed: 80, power: 0.05, defense: 0.4 },
    attacks: ['imp_scratch'],
    aggroRange: 120,
    attackRange: 18,
    attackCooldown: 600,
    ai: {
      dashSpeed: 260, dashDist: 38, dashCooldown: 2200,
      dodgeChance: 0.35, dodgeDist: 28, dodgeCooldown: 1800,
      jumpHeight: 24, jumpCooldown: 4500, jumpDamage: 0.06,
      comboChance: 0, comboHits: 1,
      specialCooldown: 0, specialAbility: null,
      aggressiveness: 0.85, flankWeight: 0.7,
      canFly: false,
    },
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
    ai: {
      dashSpeed: 220, dashDist: 55, dashCooldown: 3500,
      dodgeChance: 0.18, dodgeDist: 24, dodgeCooldown: 2800,
      jumpHeight: 0, jumpCooldown: 0, jumpDamage: 0,
      comboChance: 0.5, comboHits: 2,
      specialCooldown: 7000, specialAbility: 'cleaving_spin',
      aggressiveness: 0.7, flankWeight: 0.5,
      canFly: false,
    },
  },
  pitlord: {
    name: 'Pitlord',
    type: 'boss',
    size: 'large',
    frameSize: 64,
    bossScale: 3.0,
    stats: { hp: 3000, speed: 18, power: 0.12, defense: 2.0 },
    attacks: ['pitlord_cleave', 'pitlord_stomp'],
    phases: [
      { hpThreshold: 0.7, buff: 'hellfire' },
      { hpThreshold: 0.4, buff: 'meteor_phase' },
      { hpThreshold: 0.15, buff: 'enrage' },
    ],
    aggroRange: 300,
    attackRange: 40,
    attackCooldown: 2000,
    ai: {
      dashSpeed: 0, dashDist: 0, dashCooldown: 0,
      dodgeChance: 0, dodgeDist: 0, dodgeCooldown: 0,
      jumpHeight: 40, jumpCooldown: 8000, jumpDamage: 0.25,
      comboChance: 0.35, comboHits: 2,
      specialCooldown: 6000, specialAbility: 'fire_breath',
      aggressiveness: 0.5, flankWeight: 0,
      canFly: true, flyHeight: 35, swoopCooldown: 9000, swoopDamage: 0.28,
      // Raid boss abilities — telegraphed, dodgeable
      raidBoss: true,
      abilities: {
        hellfire_rain: { cooldown: 10000, damage: 0.15, count: 12, delay: 200, radius: 22, telegraphTime: 800 },
        shadow_cleave: { cooldown: 7000, damage: 0.3, width: 120, telegraphTime: 1000 },
        fel_stomp: { cooldown: 12000, damage: 0.2, radius: 60, stunDuration: 1500, telegraphTime: 1200 },
        inferno_charge: { cooldown: 15000, damage: 0.35, speed: 300, telegraphTime: 900, trailDamage: 0.08 },
      },
    },
  },

  // ─── FROZEN CRYPT ──────────────────────────────────────────
  frozen_wraith: {
    name: 'Frozen Wraith',
    type: 'trash',
    size: 'small',
    stats: { hp: 25, speed: 55, power: 0.06, defense: 0.3 },
    attacks: ['imp_scratch'],
    aggroRange: 90,
    attackRange: 16,
    attackCooldown: 800,
    ai: {
      dashSpeed: 240, dashDist: 45, dashCooldown: 2000,
      dodgeChance: 0.4, dodgeDist: 32, dodgeCooldown: 1600,
      jumpHeight: 20, jumpCooldown: 5000, jumpDamage: 0.05,
      comboChance: 0, comboHits: 1,
      specialCooldown: 0, specialAbility: null,
      aggressiveness: 0.75, flankWeight: 0.65,
      canFly: false,
    },
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
    ai: {
      dashSpeed: 160, dashDist: 40, dashCooldown: 4000,
      dodgeChance: 0.08, dodgeDist: 18, dodgeCooldown: 4000,
      jumpHeight: 0, jumpCooldown: 0, jumpDamage: 0,
      comboChance: 0.45, comboHits: 2,
      specialCooldown: 6500, specialAbility: 'ground_pound',
      aggressiveness: 0.6, flankWeight: 0.3,
      canFly: false,
    },
  },
  frozen_giant: {
    name: 'Frozen Giant',
    type: 'boss',
    size: 'large',
    frameSize: 64,
    stats: { hp: 600, speed: 15, power: 0.12, defense: 1.8 },
    attacks: ['pitlord_cleave', 'pitlord_stomp'],
    phases: [
      { hpThreshold: 0.5, buff: 'blizzard' },
      { hpThreshold: 0.2, buff: 'enrage' },
    ],
    aggroRange: 120,
    attackRange: 28,
    attackCooldown: 2800,
    ai: {
      dashSpeed: 0, dashDist: 0, dashCooldown: 0,
      dodgeChance: 0, dodgeDist: 0, dodgeCooldown: 0,
      jumpHeight: 30, jumpCooldown: 7000, jumpDamage: 0.18,
      comboChance: 0.35, comboHits: 2,
      specialCooldown: 9000, specialAbility: 'ice_shatter',
      aggressiveness: 0.55, flankWeight: 0,
      canFly: false,
    },
  },

  // ─── INFERNAL FORGE ────────────────────────────────────────
  forge_imp: {
    name: 'Forge Imp',
    type: 'trash',
    size: 'small',
    stats: { hp: 35, speed: 50, power: 0.07, defense: 0.4 },
    attacks: ['imp_scratch'],
    aggroRange: 85,
    attackRange: 16,
    attackCooldown: 850,
    ai: {
      dashSpeed: 230, dashDist: 35, dashCooldown: 2400,
      dodgeChance: 0.3, dodgeDist: 26, dodgeCooldown: 2000,
      jumpHeight: 22, jumpCooldown: 4800, jumpDamage: 0.06,
      comboChance: 0, comboHits: 1,
      specialCooldown: 0, specialAbility: null,
      aggressiveness: 0.8, flankWeight: 0.65,
      canFly: false,
    },
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
    ai: {
      dashSpeed: 180, dashDist: 50, dashCooldown: 3800,
      dodgeChance: 0.1, dodgeDist: 20, dodgeCooldown: 3500,
      jumpHeight: 0, jumpCooldown: 0, jumpDamage: 0,
      comboChance: 0.5, comboHits: 3,
      specialCooldown: 7000, specialAbility: 'magma_slam',
      aggressiveness: 0.65, flankWeight: 0.35,
      canFly: false,
    },
  },
  forge_infernal: {
    name: 'Forge Infernal',
    type: 'boss',
    size: 'large',
    frameSize: 64,
    stats: { hp: 700, speed: 12, power: 0.15, defense: 2.0 },
    attacks: ['pitlord_cleave', 'pitlord_stomp'],
    phases: [
      { hpThreshold: 0.6, buff: 'hellfire' },
      { hpThreshold: 0.25, buff: 'enrage' },
    ],
    aggroRange: 130,
    attackRange: 30,
    attackCooldown: 2000,
    ai: {
      dashSpeed: 0, dashDist: 0, dashCooldown: 0,
      dodgeChance: 0, dodgeDist: 0, dodgeCooldown: 0,
      jumpHeight: 34, jumpCooldown: 5500, jumpDamage: 0.22,
      comboChance: 0.4, comboHits: 2,
      specialCooldown: 8500, specialAbility: 'fire_breath',
      aggressiveness: 0.6, flankWeight: 0,
      canFly: true, flyHeight: 30, swoopCooldown: 6500, swoopDamage: 0.25,
    },
  },

  // ─── SUNKEN TEMPLE ─────────────────────────────────────────
  temple_murloc: {
    name: 'Temple Murloc',
    type: 'trash',
    size: 'small',
    stats: { hp: 30, speed: 60, power: 0.05, defense: 0.35 },
    attacks: ['imp_scratch'],
    aggroRange: 95,
    attackRange: 14,
    attackCooldown: 700,
    ai: {
      dashSpeed: 280, dashDist: 42, dashCooldown: 1800,
      dodgeChance: 0.42, dodgeDist: 34, dodgeCooldown: 1400,
      jumpHeight: 26, jumpCooldown: 3800, jumpDamage: 0.05,
      comboChance: 0, comboHits: 1,
      specialCooldown: 0, specialAbility: null,
      aggressiveness: 0.9, flankWeight: 0.75,
      canFly: false,
    },
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
    ai: {
      dashSpeed: 200, dashDist: 48, dashCooldown: 3200,
      dodgeChance: 0.22, dodgeDist: 28, dodgeCooldown: 2500,
      jumpHeight: 0, jumpCooldown: 0, jumpDamage: 0,
      comboChance: 0.55, comboHits: 3,
      specialCooldown: 6000, specialAbility: 'water_surge',
      aggressiveness: 0.7, flankWeight: 0.5,
      canFly: false,
    },
  },
  temple_horror: {
    name: 'Temple Horror',
    type: 'boss',
    size: 'large',
    frameSize: 64,
    stats: { hp: 800, speed: 10, power: 0.18, defense: 2.2 },
    attacks: ['pitlord_cleave', 'pitlord_stomp'],
    phases: [
      { hpThreshold: 0.5, buff: 'void_aura' },
      { hpThreshold: 0.2, buff: 'enrage' },
    ],
    aggroRange: 140,
    attackRange: 32,
    attackCooldown: 2400,
    ai: {
      dashSpeed: 0, dashDist: 0, dashCooldown: 0,
      dodgeChance: 0, dodgeDist: 0, dodgeCooldown: 0,
      jumpHeight: 28, jumpCooldown: 6500, jumpDamage: 0.2,
      comboChance: 0.45, comboHits: 2,
      specialCooldown: 7500, specialAbility: 'void_zone',
      aggressiveness: 0.55, flankWeight: 0,
      canFly: true, flyHeight: 26, swoopCooldown: 7000, swoopDamage: 0.24,
    },
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
