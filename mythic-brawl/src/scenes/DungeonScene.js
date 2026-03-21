/**
 * DUNGEON SCENE — Main gameplay
 * 
 * This is where the beat-em-up action happens.
 * Manages:
 * - Player, AI companions, and enemies
 * - Room progression (scroll-lock arenas, hallways, boss rooms)
 * - Camera scrolling and screen-lock triggers
 * - Combat system, affix manager, dungeon timer
 * - Depth sorting every frame
 * 
 * ROOM FLOW:
 *   1. Player walks right through a hallway
 *   2. Hits a trigger zone → camera locks, enemies spawn
 *   3. All enemies defeated → camera unlocks, proceed
 *   4. Repeat until boss room
 *   5. Boss defeated → dungeon complete, show results
 */

import Phaser from 'phaser';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { AICompanion } from '../entities/AICompanion.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { VFXSystem } from '../systems/VFXSystem.js';
import { AffixManager } from '../systems/AffixManager.js';
import { DungeonTimer } from '../systems/DungeonTimer.js';
import { sortGroup } from '../utils/DepthSort.js';
import { GAME_CONFIG, DUNGEONS, CLASSES } from '../config/game.js';

export class DungeonScene extends Phaser.Scene {
  constructor() {
    super({ key: 'DungeonScene' });
  }

  init(data) {
    this.playerClass = data.playerClass || 'warrior';
    this.dungeonKey = data.dungeon || 'deadmines';
    this.keystoneLevel = data.keystoneLevel || 2;
  }

  create() {
    const dungeon = DUNGEONS[this.dungeonKey];

    // Entity tracking
    this.partyMembers = [];
    this.enemies = [];
    this.allEntities = this.add.group();

    // AI companions wait until the player attacks before engaging
    this.combatStarted = false;
    this.events.on('playerAttack', () => { this.combatStarted = true; });

    // Background (placeholder — solid color with ground line)
    this.createBackground();

    // Systems
    this.combatSystem = new CombatSystem(this);
    this.vfxSystem = new VFXSystem(this);
    this.affixManager = new AffixManager(this, this.keystoneLevel);
    this.dungeonTimer = new DungeonTimer(this, dungeon.timeLimit);

    // Create player
    this.player = new Player(this, 40, 200, this.playerClass);
    this.partyMembers.push(this.player);
    this.allEntities.add(this.player);

    // Create AI companions (the 2 classes the player didn't pick)
    const allClasses = ['warrior', 'priest', 'rogue'];
    const aiClasses = allClasses.filter(c => c !== this.playerClass);
    aiClasses.forEach((cls, i) => {
      const companion = new AICompanion(this, 30 + i * 15, 195 + i * 10, cls);
      companion.followIndex = i;  // Stagger formation position behind player
      this.partyMembers.push(companion);
      this.allEntities.add(companion);
    });

    // Physics collision groups — prevent walk-through
    this.partyGroup = this.physics.add.group();
    this.enemyGroup = this.physics.add.group();

    // Add existing party members to physics group
    for (const member of this.partyMembers) {
      this.partyGroup.add(member);
    }

    // Colliders: party vs enemies, enemies vs enemies
    this.physics.add.collider(this.partyGroup, this.enemyGroup);
    this.physics.add.collider(this.enemyGroup, this.enemyGroup);
    this.physics.add.collider(this.partyGroup, this.partyGroup);

    // Tab targeting
    this.tabTargetIndex = -1;
    this.tabTarget = null;
    this.tabTargetIndicator = this.add.graphics();
    this.tabTargetIndicator.setDepth(GAME_CONFIG.layers.foregroundDecor);

    // Room system
    this.currentRoomIndex = 0;
    this.roomLocked = false;
    this.roomEnemiesCleared = false;

    // Spawn first room's enemies
    this.spawnRoom(dungeon.rooms[0]);

    // Camera
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, this.worldWidth, GAME_CONFIG.height);

    // Start UI scene in parallel
    this.scene.launch('UIScene', {
      dungeonTimer: this.dungeonTimer,
      affixManager: this.affixManager,
      player: this.player,
      partyMembers: this.partyMembers,
      keystoneLevel: this.keystoneLevel,
      dungeonName: dungeon.name,
    });

    // Start timer
    this.dungeonTimer.start();

    // Listen for room clear
    this.events.on('enemyDeath', this.checkRoomClear, this);
  }

  createBackground() {
    const dungeon = DUNGEONS[this.dungeonKey];
    const env = dungeon.environment;

    // World width — calculate from rooms, boss arenas are wider
    let totalWidth = 0;
    for (const room of dungeon.rooms) {
      totalWidth += room.width || 480;
    }
    this.worldWidth = Math.max(totalWidth, 480 * 4);

    // 1. Parallax background layers — data-driven from dungeon config
    this.bgLayers = [];
    for (const layer of env.bgLayers) {
      if (layer.foreground) continue; // Foreground layers added after props

      const bgHeight = layer.height || GAME_CONFIG.groundMinY;
      const bgY = layer.y || 0;
      const bg = this.add.tileSprite(
        GAME_CONFIG.width / 2,
        bgY + bgHeight / 2,
        GAME_CONFIG.width,
        bgHeight,
        layer.key
      );
      bg.setScrollFactor(0);
      bg.setDepth(GAME_CONFIG.layers.background + this.bgLayers.length);
      this.bgLayers.push({ sprite: bg, scrollFactor: layer.scrollFactor });
    }

    // 2. Tiled ground plane
    const groundY = GAME_CONFIG.groundMinY;
    const groundH = GAME_CONFIG.height - groundY;
    const tileSize = GAME_CONFIG.tileSize;
    const cols = Math.ceil(this.worldWidth / tileSize);
    const rows = Math.ceil(groundH / tileSize);

    const groundRT = this.add.renderTexture(0, groundY, this.worldWidth, rows * tileSize);
    groundRT.setOrigin(0, 0);
    groundRT.setDepth(GAME_CONFIG.layers.background + 10);

    const tileFrames = env.tileRows || [0, 1, 2, 3];
    const waterFrames = env.waterTileRows || null;
    const waterChance = env.waterChance || 0;

    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) {
        let frame;
        if (waterFrames && Math.random() < waterChance) {
          frame = waterFrames[Phaser.Math.Between(0, waterFrames.length - 1)];
        } else {
          frame = Math.random() < 0.75
            ? tileFrames[0]
            : tileFrames[Phaser.Math.Between(1, tileFrames.length - 1)];
        }
        groundRT.drawFrame(env.tileSheet, frame, x * tileSize, y * tileSize);
      }
    }

    // 3. Props
    this.placeProps(env);

    // 4. Foreground parallax layers (render in front of sprites)
    for (const layer of env.bgLayers) {
      if (!layer.foreground) continue;

      const bgHeight = layer.height || GAME_CONFIG.groundMinY;
      const bgY = layer.y || 0;
      const fg = this.add.tileSprite(
        GAME_CONFIG.width / 2,
        bgY + bgHeight / 2,
        GAME_CONFIG.width,
        bgHeight,
        layer.key
      );
      fg.setScrollFactor(0);
      fg.setAlpha(0.7);
      fg.setDepth(GAME_CONFIG.layers.foregroundDecor + 50);
      this.bgLayers.push({ sprite: fg, scrollFactor: layer.scrollFactor });
    }
  }

  placeProps(env) {
    const propSheet = env.propSheet;
    const wallProps = env.wallProps || [];
    const floorProps = env.floorProps || [];
    const transitionProp = env.transitionProp;

    // Wall props — spaced along the back wall
    for (let x = 60; x < this.worldWidth - 60; x += Phaser.Math.Between(70, 120)) {
      const frame = wallProps[Phaser.Math.Between(0, wallProps.length - 1)];
      const prop = this.add.image(x, GAME_CONFIG.groundMinY, propSheet, frame);
      prop.setOrigin(0.5, 1);
      prop.setDepth(GAME_CONFIG.layers.groundDecor);
    }

    // Floor props — scattered across the walkable area
    for (let x = 100; x < this.worldWidth - 60; x += Phaser.Math.Between(90, 200)) {
      const frame = floorProps[Phaser.Math.Between(0, floorProps.length - 1)];
      const propY = Phaser.Math.Between(GAME_CONFIG.groundMinY + 15, GAME_CONFIG.groundMaxY - 10);
      const prop = this.add.image(
        x + Phaser.Math.Between(-20, 20),
        propY,
        propSheet,
        frame
      );
      prop.setOrigin(0.5, 1);
      prop.setDepth(GAME_CONFIG.layers.entities + propY);
    }

    // Room transition props (e.g. hanging vine curtain) — placed at screen boundaries
    if (transitionProp !== undefined) {
      const dungeon = DUNGEONS[this.dungeonKey];
      for (let r = 1; r < dungeon.rooms.length; r++) {
        const tx = 480 * r;
        const prop = this.add.image(tx, GAME_CONFIG.groundMinY + 20, propSheet, transitionProp);
        prop.setOrigin(0.5, 1);
        prop.setDepth(GAME_CONFIG.layers.foregroundDecor + 10);
      }
    }
  }

  spawnRoom(roomDef) {
    if (!roomDef) return;

    // Boss arena — special wide room with custom environment
    if (roomDef.type === 'bossArena') {
      this.createBossArena(roomDef);
      this.roomLocked = true;

      // Lock camera to the arena bounds
      const arenaX = this.bossArenaX;
      const arenaW = roomDef.width;
      this.cameras.main.stopFollow();
      this.cameras.main.setBounds(arenaX, 0, arenaW, GAME_CONFIG.height);
      this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
      return;
    }

    const spawnX = this.player.x + 120;

    if (roomDef.enemies) {
      roomDef.enemies.forEach((enemyKey, i) => {
        const ex = spawnX + 30 + i * 25 + Math.random() * 20;
        const ey = GAME_CONFIG.groundMinY + 10 + Math.random() * (GAME_CONFIG.groundMaxY - GAME_CONFIG.groundMinY - 20);
        const enemy = new Enemy(this, ex, ey, enemyKey, this.keystoneLevel);
        this.affixManager.applySpawnModifiers(enemy);
        this.enemies.push(enemy);
        this.allEntities.add(enemy);
        this.enemyGroup.add(enemy);
      });
    }

    if (roomDef.boss) {
      const bx = spawnX + 80;
      const by = (GAME_CONFIG.groundMinY + GAME_CONFIG.groundMaxY) / 2;
      const boss = new Enemy(this, bx, by, roomDef.boss, this.keystoneLevel);
      this.affixManager.applySpawnModifiers(boss);
      this.enemies.push(boss);
      this.allEntities.add(boss);
      this.enemyGroup.add(boss);
    }

    // Lock camera if arena room
    if (roomDef.type === 'arena' || roomDef.type === 'boss') {
      this.roomLocked = true;
    }
  }

  /**
   * Build the Pit Lord boss arena — wide circular room with custom tiles and props.
   */
  createBossArena(roomDef) {
    const env = roomDef.environment;
    const arenaW = roomDef.width;
    // Place arena at the end of the current world
    const arenaX = this.worldWidth - arenaW;
    this.bossArenaX = arenaX;
    const arenaCenterX = arenaX + arenaW / 2;
    const arenaCenterY = (GAME_CONFIG.groundMinY + GAME_CONFIG.groundMaxY) / 2;

    // Boss arena background — parallax behind everything
    const arenaBg = this.add.tileSprite(
      GAME_CONFIG.width / 2, 100,
      GAME_CONFIG.width, 200,
      env.bgKey
    );
    arenaBg.setScrollFactor(0);
    arenaBg.setDepth(GAME_CONFIG.layers.background - 1);
    this.bgLayers.push({ sprite: arenaBg, scrollFactor: 0.3 });

    // Tiled floor — circular pattern
    const tileSize = GAME_CONFIG.tileSize;
    const groundY = GAME_CONFIG.groundMinY;
    const groundH = GAME_CONFIG.height - groundY;
    const floorCols = Math.ceil(arenaW / tileSize);
    const floorRows = Math.ceil(groundH / tileSize);

    const arenaRT = this.add.renderTexture(arenaX, groundY, arenaW, floorRows * tileSize);
    arenaRT.setOrigin(0, 0);
    arenaRT.setDepth(GAME_CONFIG.layers.background + 11);

    const radiusOuter = arenaW / 2;
    const radiusInner = radiusOuter * 0.25;
    const radiusMid = radiusOuter * 0.55;

    for (let tx = 0; tx < floorCols; tx++) {
      for (let ty = 0; ty < floorRows; ty++) {
        const px = tx * tileSize + tileSize / 2;
        const py = ty * tileSize + tileSize / 2;
        const cx = arenaW / 2;
        const cy = groundH / 2;
        const dist = Math.sqrt((px - cx) ** 2 + ((py - cy) * 2) ** 2); // Squash Y for 2.5D

        let frame;
        if (dist > radiusOuter) {
          // Arena edge boundary
          frame = env.arenaEdge[Phaser.Math.Between(0, env.arenaEdge.length - 1)];
        } else if (dist > radiusMid) {
          // Blood-stained stone outer ring
          frame = env.floorEdge[Phaser.Math.Between(0, env.floorEdge.length - 1)];
        } else if (dist > radiusInner) {
          // Blood channels radiating outward
          frame = env.floorRadial[Phaser.Math.Between(0, env.floorRadial.length - 1)];
        } else {
          // Fire grate center
          frame = env.floorCenter[Phaser.Math.Between(0, env.floorCenter.length - 1)];
        }
        arenaRT.drawFrame(env.tileSheet, frame, tx * tileSize, ty * tileSize);
      }
    }

    // --- PROPS ---
    const propSheet = env.propSheet;

    // Demonic rune circle at dead center
    const rune = this.add.image(arenaCenterX, arenaCenterY + 10, propSheet, env.runeCircle);
    rune.setOrigin(0.5, 0.5);
    rune.setDepth(GAME_CONFIG.layers.background + 12);

    // Fire braziers at cardinal points
    const brazierPositions = [
      { x: arenaCenterX - arenaW * 0.35, y: arenaCenterY },        // west
      { x: arenaCenterX + arenaW * 0.35, y: arenaCenterY },        // east
      { x: arenaCenterX, y: GAME_CONFIG.groundMinY + 8 },          // north
      { x: arenaCenterX, y: GAME_CONFIG.groundMaxY - 4 },          // south
      // Diagonal positions
      { x: arenaCenterX - arenaW * 0.25, y: GAME_CONFIG.groundMinY + 12 },
      { x: arenaCenterX + arenaW * 0.25, y: GAME_CONFIG.groundMinY + 12 },
      { x: arenaCenterX - arenaW * 0.25, y: GAME_CONFIG.groundMaxY - 8 },
      { x: arenaCenterX + arenaW * 0.25, y: GAME_CONFIG.groundMaxY - 8 },
    ];
    for (const pos of brazierPositions) {
      const brazier = this.add.image(pos.x, pos.y, propSheet, env.brazier);
      brazier.setOrigin(0.5, 1);
      brazier.setDepth(GAME_CONFIG.layers.entities + pos.y);
    }

    // Skull piles and weapon racks around perimeter
    const perimeterProps = [env.skullPile, env.weaponRack, env.skullPile, env.weaponRack];
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const px = arenaCenterX + Math.cos(angle) * arenaW * 0.38;
      const py = arenaCenterY + Math.sin(angle) * 30;
      const pyC = Phaser.Math.Clamp(py, GAME_CONFIG.groundMinY + 5, GAME_CONFIG.groundMaxY - 5);
      const frame = perimeterProps[i % perimeterProps.length];
      const prop = this.add.image(px, pyC, propSheet, frame);
      prop.setOrigin(0.5, 1);
      prop.setDepth(GAME_CONFIG.layers.entities + pyC);
    }

    // Hanging chains and meat hooks overhead (behind walkable area)
    for (let i = 0; i < 8; i++) {
      const cx = arenaX + 80 + i * (arenaW - 160) / 7;
      const frame = i % 2 === 0 ? env.hangingChains : env.meatHook;
      const chain = this.add.image(cx, GAME_CONFIG.groundMinY - 10, propSheet, frame);
      chain.setOrigin(0.5, 1);
      chain.setDepth(GAME_CONFIG.layers.groundDecor);
    }
  }

  checkRoomClear(deadEnemy) {
    // Remove from tracked enemies
    this.enemies = this.enemies.filter(e => e !== deadEnemy && e.hp > 0);

    if (this.enemies.length === 0 && this.roomLocked) {
      this.roomLocked = false;
      this.currentRoomIndex++;

      const dungeon = DUNGEONS[this.dungeonKey];
      if (this.currentRoomIndex < dungeon.rooms.length) {
        // Brief pause then spawn next room
        this.time.delayedCall(1000, () => {
          this.spawnRoom(dungeon.rooms[this.currentRoomIndex]);
        });
      } else {
        // Dungeon complete!
        this.completeDungeon();
      }
    }
  }

  completeDungeon() {
    this.dungeonTimer.complete();
    const upgrade = this.dungeonTimer.getKeyUpgrade();

    // TODO: Show results screen with:
    // - Time remaining
    // - Deaths
    // - Key upgrade level
    // - Damage/healing done per party member
    // - Loot drops

    console.log(`Dungeon complete! Key upgrade: +${upgrade}, Deaths: ${this.dungeonTimer.deaths}`);
  }

  /**
   * PUBLIC: Get alive party members (player + AI companions)
   */
  getPartyMembers() {
    return this.partyMembers.filter(m => m.hp > 0);
  }

  /**
   * PUBLIC: Get alive enemies
   */
  getAliveEnemies() {
    return this.enemies.filter(e => e.hp > 0);
  }

  update(time, delta) {
    // Update all entities
    this.player.update(time, delta);
    for (const member of this.partyMembers) {
      if (member !== this.player && member.hp > 0) {
        member.update(time, delta);
      }
    }
    for (const enemy of this.enemies) {
      if (enemy.hp > 0) {
        enemy.update(time, delta);
      }
    }

    // Systems
    this.dungeonTimer.update(delta);
    this.affixManager.update(delta);

    // Depth sort all entities
    sortGroup(this.allEntities);

    // Tab targeting — cycle and render indicator
    this.updateTabTarget();

    // Parallax background layers — each scrolls at its own rate
    const scrollX = this.cameras.main.scrollX;
    for (const layer of this.bgLayers) {
      layer.sprite.tilePositionX = scrollX * layer.scrollFactor;
    }

    // Camera bounds (prevent scrolling past world edge)
    this.player.x = Phaser.Math.Clamp(this.player.x, 16, this.worldWidth - 16);
  }

  /**
   * Tab targeting: cycle through alive enemies, draw indicator on current target.
   */
  updateTabTarget() {
    const alive = this.getAliveEnemies();

    // Clear indicator if no enemies or target died
    if (alive.length === 0) {
      this.tabTarget = null;
      this.tabTargetIndex = -1;
      this.tabTargetIndicator.clear();
      return;
    }

    // Validate current target is still alive
    if (this.tabTarget && (this.tabTarget.hp <= 0 || !alive.includes(this.tabTarget))) {
      this.tabTarget = null;
      this.tabTargetIndex = -1;
    }

    // Draw target indicator
    this.tabTargetIndicator.clear();
    if (this.tabTarget) {
      const t = this.tabTarget;
      const tx = t.x;
      const ty = t.groundY;

      // Arrow above enemy
      this.tabTargetIndicator.fillStyle(0xff4444, 0.8);
      this.tabTargetIndicator.fillTriangle(
        tx, ty - 32,
        tx - 4, ty - 38,
        tx + 4, ty - 38
      );

      // Circle at feet
      this.tabTargetIndicator.lineStyle(1, 0xff4444, 0.5);
      this.tabTargetIndicator.strokeEllipse(tx, ty, 20, 8);

      // Expose to player for auto-facing
      this.player.tabTarget = this.tabTarget;
    } else {
      this.player.tabTarget = null;
    }
  }

  /**
   * Cycle to next enemy target. Called by Player on Tab press.
   */
  cycleTabTarget() {
    const alive = this.getAliveEnemies();
    if (alive.length === 0) {
      this.tabTarget = null;
      this.tabTargetIndex = -1;
      return;
    }

    this.tabTargetIndex = (this.tabTargetIndex + 1) % alive.length;
    this.tabTarget = alive[this.tabTargetIndex];
  }
}
