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
    // World width based on number of rooms
    this.worldWidth = 480 * 4;  // 4 screens wide for now

    // 1. Parallax background — dungeon_bg (480×160) tiles horizontally, scrolls at half camera speed
    this.bgLayer = this.add.tileSprite(
      GAME_CONFIG.width / 2,
      GAME_CONFIG.groundMinY / 2,
      GAME_CONFIG.width,
      GAME_CONFIG.groundMinY,
      'dungeon_bg'
    );
    this.bgLayer.setScrollFactor(0);
    this.bgLayer.setDepth(GAME_CONFIG.layers.background);

    // 2. Tiled ground plane — stone floor from groundMinY to screen bottom
    const groundY = GAME_CONFIG.groundMinY;
    const groundH = GAME_CONFIG.height - groundY;
    const tileSize = GAME_CONFIG.tileSize;
    const cols = Math.ceil(this.worldWidth / tileSize);
    const rows = Math.ceil(groundH / tileSize);

    const groundRT = this.add.renderTexture(0, groundY, this.worldWidth, rows * tileSize);
    groundRT.setOrigin(0, 0);
    groundRT.setDepth(GAME_CONFIG.layers.background + 1);

    // Use stone floor tiles from row 0 of dungeon_tiles
    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) {
        // Mostly tile 0, with occasional variants for visual interest
        const frame = Math.random() < 0.75 ? 0 : Phaser.Math.Between(1, 3);
        groundRT.drawFrame('dungeon_tiles', frame, x * tileSize, y * tileSize);
      }
    }

    // 3. Randomly placed props along the level
    this.placeProps();
  }

  placeProps() {
    // Prop frame indices in dungeon_props (32×64 cells, row 0 only has content)
    // 0=pillar, 1=barrel, 2=bones, 3=cage, 4=torch stand, 5=rug, 6=frame, 7=torch, 9=candelabra
    const WALL_PROPS = [0, 4, 9];   // pillar, torch stand, candelabra
    const FLOOR_PROPS = [1, 2, 1];  // barrel, bones, barrel (weighted)

    // Wall props — spaced along the back wall behind the walkable area
    for (let x = 60; x < this.worldWidth - 60; x += Phaser.Math.Between(70, 120)) {
      const frame = WALL_PROPS[Phaser.Math.Between(0, WALL_PROPS.length - 1)];
      const prop = this.add.image(x, GAME_CONFIG.groundMinY, 'dungeon_props', frame);
      prop.setOrigin(0.5, 1);
      prop.setDepth(GAME_CONFIG.layers.groundDecor);
    }

    // Floor props — scattered across the walkable ground plane
    for (let x = 100; x < this.worldWidth - 60; x += Phaser.Math.Between(90, 200)) {
      const frame = FLOOR_PROPS[Phaser.Math.Between(0, FLOOR_PROPS.length - 1)];
      const propY = Phaser.Math.Between(GAME_CONFIG.groundMinY + 15, GAME_CONFIG.groundMaxY - 10);
      const prop = this.add.image(
        x + Phaser.Math.Between(-20, 20),
        propY,
        'dungeon_props',
        frame
      );
      prop.setOrigin(0.5, 1);
      // Same depth formula as entities so props interleave with characters by Y position
      prop.setDepth(GAME_CONFIG.layers.entities + propY);
    }
  }

  spawnRoom(roomDef) {
    if (!roomDef) return;

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
      // TODO: Lock camera scroll boundaries to current screen
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

    // Parallax background — scroll at half camera speed
    this.bgLayer.tilePositionX = this.cameras.main.scrollX * 0.5;

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
