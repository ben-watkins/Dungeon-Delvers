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

    // Background (placeholder — solid color with ground line)
    this.createBackground();

    // Systems
    this.combatSystem = new CombatSystem(this);
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
      this.partyMembers.push(companion);
      this.allEntities.add(companion);
    });

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

    // Sky gradient
    const sky = this.add.graphics();
    sky.fillStyle(0x0d0d18);
    sky.fillRect(0, 0, this.worldWidth, GAME_CONFIG.groundMinY);
    sky.setDepth(GAME_CONFIG.layers.background);

    // Ground
    const ground = this.add.graphics();
    ground.fillStyle(0x1a1a30);
    ground.fillRect(0, GAME_CONFIG.groundMinY, this.worldWidth, GAME_CONFIG.height - GAME_CONFIG.groundMinY);
    ground.fillStyle(0x141428);
    ground.fillRect(0, GAME_CONFIG.groundMinY, this.worldWidth, 3);
    ground.setDepth(GAME_CONFIG.layers.background + 1);

    // TODO: Replace with tilemap-based backgrounds
    // Tile layers: far background (parallax), mid buildings, near ground, foreground details
    // Use Tiled editor to create .json tilemaps and load them in BootScene
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
      });
    }

    if (roomDef.boss) {
      const bx = spawnX + 80;
      const by = (GAME_CONFIG.groundMinY + GAME_CONFIG.groundMaxY) / 2;
      const boss = new Enemy(this, bx, by, roomDef.boss, this.keystoneLevel);
      this.affixManager.applySpawnModifiers(boss);
      this.enemies.push(boss);
      this.allEntities.add(boss);
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

    // Camera bounds (prevent scrolling past world edge)
    this.player.x = Phaser.Math.Clamp(this.player.x, 16, this.worldWidth - 16);
  }
}
