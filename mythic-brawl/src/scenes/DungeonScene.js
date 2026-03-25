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
import { GhostEnemy } from '../entities/GhostEnemy.js';
import { AICompanion } from '../entities/AICompanion.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { VFXSystem } from '../systems/VFXSystem.js';
import { ProjectileSystem } from '../systems/ProjectileSystem.js';
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
    this.isMultiplayer = data.multiplayer || false;
    this.isHost = data.isHost || false;
    this.remotePlayers = new Map();  // sessionId -> Player instance
    this.ghostEnemies = new Map();   // networkId -> GhostEnemy (non-host only)
    this.enemySyncTimer = 0;
    this.enemySyncInterval = 50;     // Host broadcasts enemy state every ~50ms
    this.nextEnemyId = 0;
  }

  create() {
    const dungeon = DUNGEONS[this.dungeonKey];

    // Seeded random for deterministic backgrounds across clients
    this.seededRandom = this.createSeededRandom(this.dungeonKey);

    // Entity tracking
    this.partyMembers = [];
    this.enemies = [];
    this.allEntities = this.add.group();

    // AI companions wait until the player attacks before engaging
    this.combatStarted = false;
    this.dungeonComplete = false;
    this.events.on('playerAttack', () => { this.combatStarted = true; });

    // Background — uses seeded random so all clients see identical layout
    this.createBackground();

    // Host or solo runs full simulation; non-host renders ghosts
    const runFullSim = !this.isMultiplayer || this.isHost;

    // Systems — combat/AI only on host or solo
    this.combatSystem = runFullSim ? new CombatSystem(this) : null;
    this.vfxSystem = new VFXSystem(this);
    this.projectileSystem = runFullSim ? new ProjectileSystem(this, this.dungeonKey) : null;
    this.affixManager = runFullSim ? new AffixManager(this, this.keystoneLevel) : {
      update() {}, applySpawnModifiers() {}, getActiveAffixNames() { return []; },
      getActiveAffixKeys() { return []; }, destroy() {},
    };
    this.dungeonTimer = new DungeonTimer(this, dungeon.timeLimit);

    // Create local player
    this.player = new Player(this, 40, 200, this.playerClass);
    this.partyMembers.push(this.player);
    this.allEntities.add(this.player);

    if (this.isMultiplayer) {
      this.setupMultiplayer();
    } else {
      // AI companions (solo only)
      const allClasses = ['warrior', 'priest', 'rogue'];
      const aiClasses = allClasses.filter(c => c !== this.playerClass);
      aiClasses.forEach((cls, i) => {
        const companion = new AICompanion(this, 30 + i * 15, 195 + i * 10, cls);
        companion.followIndex = i;
        this.partyMembers.push(companion);
        this.allEntities.add(companion);
      });
    }

    // Entity tracking groups (non-physics — hitbox detection is manual in CombatSystem)
    this.partyGroup = [];
    this.enemyGroup = [];

    // Tab targeting
    this.tabTargetIndex = -1;
    this.tabTarget = null;
    this.tabTargetIndicator = this.add.graphics();
    this.tabTargetIndicator.setDepth(GAME_CONFIG.layers.foregroundDecor);

    // Room system
    this.currentRoomIndex = 0;
    this.roomLocked = false;
    this.roomCleared = false;
    this.roomLeftBound = 0;
    this.roomRightBound = 480;

    this.goIndicator = this.add.text(0, 0, 'GO →', {
      fontSize: '14px', fontFamily: 'monospace', color: '#44ff44',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setResolution(4).setDepth(GAME_CONFIG.layers.ui).setVisible(false);

    // Only host/solo spawns real enemies — non-host gets ghosts from server
    if (runFullSim) {
      this.spawnRoom(dungeon.rooms[0]);
    }

    // Camera
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, this.worldWidth, GAME_CONFIG.height);

    // Start UI scene
    this.scene.launch('UIScene', {
      dungeonTimer: this.dungeonTimer,
      affixManager: this.affixManager,
      player: this.player,
      partyMembers: this.partyMembers,
      keystoneLevel: this.keystoneLevel,
      dungeonName: dungeon.name,
    });

    this.dungeonTimer.start();

    // Room clear — host/solo only
    if (runFullSim) {
      this.events.on('enemyDeath', this.checkRoomClear, this);
    }
  }

  /**
   * Seeded random number generator for deterministic backgrounds.
   * Same seed = same tile/prop placement on all clients.
   */
  createSeededRandom(seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
    }
    return () => {
      h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
      h = Math.imul(h ^ (h >>> 13), 0x45d9f3b);
      h = (h ^ (h >>> 16)) >>> 0;
      return h / 4294967296;
    };
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

    const rng = this.seededRandom;
    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) {
        let frame;
        if (waterFrames && rng() < waterChance) {
          frame = waterFrames[Math.floor(rng() * waterFrames.length)];
        } else {
          frame = rng() < 0.75
            ? tileFrames[0]
            : tileFrames[1 + Math.floor(rng() * (tileFrames.length - 1))];
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
    const rng = this.seededRandom;
    const rngBetween = (min, max) => min + Math.floor(rng() * (max - min + 1));

    // Wall props — spaced along the back wall
    for (let x = 60; x < this.worldWidth - 60; x += rngBetween(70, 120)) {
      const frame = wallProps[Math.floor(rng() * wallProps.length)];
      const prop = this.add.image(x, GAME_CONFIG.groundMinY, propSheet, frame);
      prop.setOrigin(0.5, 1);
      prop.setDepth(GAME_CONFIG.layers.groundDecor);
    }

    // Floor props — scattered across the walkable area
    for (let x = 100; x < this.worldWidth - 60; x += rngBetween(90, 200)) {
      const frame = floorProps[Math.floor(rng() * floorProps.length)];
      const propY = rngBetween(GAME_CONFIG.groundMinY + 15, GAME_CONFIG.groundMaxY - 10);
      const prop = this.add.image(
        x + rngBetween(-20, 20),
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

    this.roomCleared = false;
    this.goIndicator.setVisible(false);
    this.combatStarted = false;

    // Calculate room position based on index
    const roomWidth = roomDef.width || 480;
    let roomStartX = 0;
    const dungeon = DUNGEONS[this.dungeonKey];
    for (let i = 0; i < this.currentRoomIndex; i++) {
      roomStartX += dungeon.rooms[i].width || 480;
    }

    this.roomLeftBound = roomStartX;
    this.roomRightBound = roomStartX + roomWidth;

    // Boss arena — special wide room with custom environment
    if (roomDef.type === 'bossArena') {
      this.createBossArena(roomDef);
      // If bossArena has no enemies, it's a victory room
      if (!roomDef.enemies && !roomDef.boss) {
        this.roomLocked = false;
        this.time.delayedCall(1500, () => this.completeDungeon());
      } else {
        this.roomLocked = true;
      }
      return;
    }

    // Spawn enemies in the right half of the room
    const spawnCenter = roomStartX + roomWidth * 0.65;

    if (roomDef.enemies) {
      const rng = this.seededRandom;
      roomDef.enemies.forEach((enemyKey, i) => {
        const ex = spawnCenter + (i - roomDef.enemies.length / 2) * 25 + rng() * 15;
        const ey = GAME_CONFIG.groundMinY + 10 + rng() * (GAME_CONFIG.groundMaxY - GAME_CONFIG.groundMinY - 20);
        const enemy = new Enemy(this, ex, ey, enemyKey, this.keystoneLevel);
        enemy.networkId = `e_${this.currentRoomIndex}_${this.nextEnemyId++}`;
        this.affixManager.applySpawnModifiers(enemy);
        this.enemies.push(enemy);
        this.allEntities.add(enemy);
        this.enemyGroup.push(enemy);
      });
    }

    if (roomDef.boss) {
      const bx = spawnCenter + 40;
      const by = (GAME_CONFIG.groundMinY + GAME_CONFIG.groundMaxY) / 2;
      const boss = new Enemy(this, bx, by, roomDef.boss, this.keystoneLevel);
      boss.networkId = `e_${this.currentRoomIndex}_${this.nextEnemyId++}`;
      this.affixManager.applySpawnModifiers(boss);
      this.enemies.push(boss);
      this.allEntities.add(boss);
      this.enemyGroup.push(boss);
    }

    // Lock room — player can't leave until enemies are dead
    this.roomLocked = true;

    // Host: notify server of enemy spawn so non-host clients create ghosts
    if (this.isMultiplayer && this.isHost && this.networkManager) {
      const spawnData = this.enemies.filter(e => e.hp > 0).map(e => ({
        id: e.networkId, type: e.enemyKey,
        x: e.x, y: e.y, groundY: e.groundY,
        hp: e.hp, maxHp: e.maxHp,
      }));
      this.networkManager.sendEnemySpawn(spawnData);
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
        const rng = this.seededRandom;
        if (dist > radiusOuter) {
          frame = env.arenaEdge[Math.floor(rng() * env.arenaEdge.length)];
        } else if (dist > radiusMid) {
          frame = env.floorEdge[Math.floor(rng() * env.floorEdge.length)];
        } else if (dist > radiusInner) {
          frame = env.floorRadial[Math.floor(rng() * env.floorRadial.length)];
        } else {
          frame = env.floorCenter[Math.floor(rng() * env.floorCenter.length)];
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
    // Remove dead/destroyed enemies from tracked list
    this.enemies = this.enemies.filter(e => e !== deadEnemy && e.hp > 0 && !e.dead);

    if (this.enemies.length === 0 && this.roomLocked) {
      this.roomLocked = false;
      this.roomCleared = true;

      const dungeon = DUNGEONS[this.dungeonKey];
      if (this.currentRoomIndex < dungeon.rooms.length - 1) {
        this.goIndicator.setVisible(true);
        this.roomRightBound = this.worldWidth;
        // Host: notify non-host clients that room is cleared
        if (this.isMultiplayer && this.isHost && this.networkManager) {
          this.networkManager.sendRoomCleared(this.currentRoomIndex);
        }
      } else {
        this.time.delayedCall(1500, () => this.completeDungeon());
      }
    }
  }

  /**
   * Check if the player has walked into the next room zone.
   * Called every frame from update().
   */
  checkRoomTransition() {
    if (!this.roomCleared) return;

    const dungeon = DUNGEONS[this.dungeonKey];

    // Calculate where the next room starts
    let nextRoomX = 0;
    for (let i = 0; i <= this.currentRoomIndex; i++) {
      nextRoomX += dungeon.rooms[i].width || 480;
    }

    // Player crossed into the next room zone
    if (this.player.x >= nextRoomX - 60) {
      this.currentRoomIndex++;
      this.goIndicator.setVisible(false);

      // Teleport AI companions that are too far behind
      for (const member of this.partyMembers) {
        if (member !== this.player && member.hp > 0) {
          if (member.x < this.player.x - 80) {
            member.x = this.player.x - 30;
            member.groundY = this.player.groundY;
            member.y = member.groundY;
          }
        }
      }

      if (this.currentRoomIndex < dungeon.rooms.length) {
        this.spawnRoom(dungeon.rooms[this.currentRoomIndex]);
        // Host: notify server of room advance
        if (this.isMultiplayer && this.isHost && this.networkManager) {
          this.networkManager.sendRoomAdvance(this.currentRoomIndex);
        }
      }
    }
  }

  completeDungeon() {
    if (this.dungeonComplete) return; // Prevent double-fire
    this.dungeonComplete = true;
    this.dungeonTimer.complete();
    const upgrade = this.dungeonTimer.getKeyUpgrade();
    this.goIndicator.setVisible(false);

    // Host: notify non-host clients
    if (this.isMultiplayer && this.isHost && this.networkManager) {
      this.networkManager.sendDungeonComplete({ upgrade });
    }

    // Victory overlay
    const { width, height } = this.cameras.main;
    const cx = this.cameras.main.scrollX + width / 2;
    const cy = height / 2;

    // Dark overlay
    const overlay = this.add.rectangle(cx, cy, width, height, 0x000000, 0.7);
    overlay.setDepth(GAME_CONFIG.layers.ui + 10).setScrollFactor(0);

    // Victory text
    this.add.text(width / 2, height * 0.3, 'DUNGEON COMPLETE!', {
      fontSize: '20px', fontFamily: 'monospace', color: '#44ff44',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setResolution(4).setDepth(GAME_CONFIG.layers.ui + 11).setScrollFactor(0);

    const timeStr = this.dungeonTimer.getTimeString();
    const deaths = this.dungeonTimer.deaths;
    const results = [
      `Time: ${timeStr}`,
      `Deaths: ${deaths} (-${deaths * 5}s penalty)`,
      `Key Upgrade: +${upgrade}`,
      `Keystone Level: M+${this.keystoneLevel}`,
    ].join('\n');

    this.add.text(width / 2, height * 0.55, results, {
      fontSize: '10px', fontFamily: 'monospace', color: '#b0b0c8',
      align: 'center', lineSpacing: 6,
    }).setOrigin(0.5).setResolution(4).setDepth(GAME_CONFIG.layers.ui + 11).setScrollFactor(0);

    this.add.text(width / 2, height * 0.82, 'Press ENTER to return to menu', {
      fontSize: '10px', fontFamily: 'monospace', color: '#707090',
    }).setOrigin(0.5).setResolution(4).setDepth(GAME_CONFIG.layers.ui + 11).setScrollFactor(0);

    this.input.keyboard.once('keydown-ENTER', () => {
      this.scene.stop('UIScene');
      this.scene.start('MainMenuScene');
    });
  }

  /**
   * PUBLIC: Get alive party members (player + AI companions)
   */
  async setupMultiplayer() {
    try {
      const { networkManager } = await import('../systems/NetworkManager.js');
      this.networkManager = networkManager;

      if (!networkManager.room) {
        console.error('No room connection in setupMultiplayer');
        return;
      }

      // Wait for state to be available
      if (!networkManager.room.state || !networkManager.room.state.players) {
        await new Promise((resolve) => {
          const unsub = networkManager.room.onStateChange(() => {
            unsub();
            resolve();
          });
        });
      }

      console.log('Multiplayer state ready, setting up listeners');

      // Track known player/enemy IDs to detect additions/removals
      this._knownPlayerIds = new Set();
      this._knownEnemyIds = new Set();

      // Use onStateChange to sync players and enemies (works in all Colyseus versions)
      networkManager.room.onStateChange((state) => {
        if (!state) return;

        // ─── SYNC REMOTE PLAYERS ───
        if (state.players) {
          const currentIds = new Set();
          state.players.forEach((player, sessionId) => {
            currentIds.add(sessionId);
            if (networkManager.isLocalPlayer(sessionId)) return;

            let remote = this.remotePlayers.get(sessionId);
            if (!remote) {
              // New player — spawn remote
              try {
                remote = new Player(this, player.x || 40, player.y || 200, player.className || 'warrior');
                remote.isLocal = false;
                remote.isRemote = true;
                remote.networkId = sessionId;
                this.remotePlayers.set(sessionId, remote);
                this.partyMembers.push(remote);
                this.allEntities.add(remote);
                console.log(`Remote player spawned: ${sessionId} as ${player.className}`);
              } catch (e) {
                console.error('Error spawning remote player:', e);
              }
            }

            // Update remote player position/state
            if (remote && remote.sprite) {
              try {
                remote.x = player.x;
                remote.groundY = player.groundY;
                remote.y = remote.groundY;
                remote.facingRight = player.facingRight;
                remote.sprite.setFlipX(!player.facingRight);
                if (player.state === 'walk' && !remote.sprite.anims.currentAnim?.key?.includes('walk')) {
                  remote.sprite.play(`${remote.classKey}_walk`, true);
                } else if (player.state === 'idle' && !remote.sprite.anims.currentAnim?.key?.includes('idle')) {
                  remote.sprite.play(`${remote.classKey}_idle`, true);
                }
              } catch (e) {}
            }
          });

          // Remove players that left
          this.remotePlayers.forEach((remote, sessionId) => {
            if (!currentIds.has(sessionId)) {
              this.partyMembers = this.partyMembers.filter(m => m !== remote);
              try { remote.destroy(); } catch (e) {}
              this.remotePlayers.delete(sessionId);
              console.log(`Remote player removed: ${sessionId}`);
            }
          });
        }

        // ─── SYNC GHOST ENEMIES (non-host only) ───
        if (!networkManager.isHost && state.enemies) {
          const currentEnemyIds = new Set();
          state.enemies.forEach((enemyState, key) => {
            currentEnemyIds.add(key);

            let ghost = this.ghostEnemies.get(key);
            if (!ghost) {
              // New enemy — spawn ghost
              try {
                ghost = new GhostEnemy(this, enemyState.x, enemyState.groundY, enemyState.type);
                ghost.networkId = key;
                ghost.hp = enemyState.hp;
                ghost.maxHp = enemyState.maxHp;
                this.ghostEnemies.set(key, ghost);
                this.allEntities.add(ghost);
                console.log(`Ghost enemy spawned: ${key} (${enemyState.type})`);
              } catch (e) {
                console.error('Error spawning ghost enemy:', e);
              }
            }

            // Update ghost from server state
            if (ghost) ghost.updateFromServer(enemyState);
          });

          // Remove ghosts for enemies that died
          this.ghostEnemies.forEach((ghost, key) => {
            if (!currentEnemyIds.has(key)) {
              try { ghost.sprite.play(`${ghost.enemyKey}_death`, true); } catch(e) {}
              this.time.delayedCall(800, () => {
                try { ghost.destroy(); } catch(e) {}
              });
              this.ghostEnemies.delete(key);
            }
          });
        }
      });

      // ─── NON-HOST: intercept attacks and route damage to host ───
      if (!networkManager.isHost) {
        this.events.on('hitboxActive', (hitbox) => {
          if (hitbox._netChecked) return;
          hitbox._netChecked = true;
          const ghosts = [...this.ghostEnemies.values()];
          for (const ghost of ghosts) {
            if (ghost.hp <= 0) continue;
            const ex = ghost.x - 8;
            const ey = ghost.groundY - 16;
            if (hitbox.x < ex + 16 && hitbox.x + hitbox.width > ex &&
                hitbox.y < ey + 16 && hitbox.y + hitbox.height > ey) {
              if (!hitbox._hitEntities) hitbox._hitEntities = new Set();
              if (hitbox._hitEntities.has(ghost)) continue;
              hitbox._hitEntities.add(ghost);
              const dir = { x: (ghost.x - hitbox.owner.x) / 30, y: 0 };
              networkManager.sendEnemyDamage(
                ghost.networkId, hitbox.damage,
                dir.x * hitbox.knockback, dir.y * hitbox.knockback,
                hitbox.hitstun
              );
            }
          }
        });

        // Non-host: intercept specials and route damage to host
        this.events.on('playerSpecial', (data) => {
          const { player, special } = data;
          if (!special.damage) return;
          const ghosts = [...this.ghostEnemies.values()];
          for (const ghost of ghosts) {
            if (ghost.hp <= 0) continue;
            const dist = Phaser.Math.Distance.Between(player.x, player.groundY, ghost.x, ghost.groundY);
            if (dist <= (special.range || 40)) {
              networkManager.sendEnemyDamage(
                ghost.networkId, special.damage * player.power * 10,
                0, 0, special.stun || 300
              );
            }
          }
        });

        // Non-host: room cleared notification from host
        networkManager.onRoomCleared((data) => {
          this.roomLocked = false;
          this.roomCleared = true;
          this.goIndicator.setVisible(true);
          this.roomRightBound = this.worldWidth;
        });

        // Non-host: dungeon complete from host
        networkManager.onDungeonComplete(() => {
          this.completeDungeon();
        });
      }

      // ─── HOST: receive damage from non-host clients ───
      if (networkManager.isHost) {
        networkManager.onEnemyDamageRequest((data) => {
          const enemy = this.enemies.find(e => e.networkId === data.enemyId && e.hp > 0);
          if (enemy) {
            enemy.takeDamage(data.damage, { x: data.knockbackX || 0, y: data.knockbackY || 0 }, data.hitstun || 200);
          }
        });
      }

      // Spawn any players already in the room state (joined before our listeners)
      if (networkManager.room?.state?.players) {
        networkManager.room.state.players.forEach((player, sessionId) => {
          if (networkManager.isLocalPlayer(sessionId)) return;
          if (this.remotePlayers.has(sessionId)) return;

          try {
            const remotePlayer = new Player(this, player.x || 40, player.y || 200, player.className || 'warrior');
            remotePlayer.isLocal = false;
            remotePlayer.isRemote = true;
            remotePlayer.networkId = sessionId;
            this.remotePlayers.set(sessionId, remotePlayer);
            this.partyMembers.push(remotePlayer);
            this.allEntities.add(remotePlayer);
            console.log(`Remote player already in room: ${sessionId} as ${player.className}`);
          } catch (e) {
            console.error('Error spawning existing remote player:', e);
          }
        });
      }

    } catch (err) {
      console.error('setupMultiplayer failed:', err);
    }
  }

  getPartyMembers() {
    return this.partyMembers.filter(m => m.hp > 0);
  }

  /**
   * PUBLIC: Get alive enemies
   */
  applySoftSeparation() {
    const minDist = 14;
    const pushForce = 0.8;
    const allUnits = [...this.getPartyMembers(), ...this.getAliveEnemies()];

    for (let i = 0; i < allUnits.length; i++) {
      for (let j = i + 1; j < allUnits.length; j++) {
        const a = allUnits[i];
        const b = allUnits[j];
        const dx = b.x - a.x;
        const dy = (b.groundY || b.y) - (a.groundY || a.y);
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < minDist && dist > 0) {
          const overlap = (minDist - dist) * pushForce;
          const nx = dx / dist;
          const ny = dy / dist;

          // Never push the local player — only push AI/enemies away from them
          const aIsPlayer = a === this.player;
          const bIsPlayer = b === this.player;
          if (aIsPlayer) {
            b.x += nx * overlap;
          } else if (bIsPlayer) {
            a.x -= nx * overlap;
          } else {
            a.x -= nx * overlap * 0.5;
            b.x += nx * overlap * 0.5;
          }
        }
      }
    }
  }

  getAliveEnemies() {
    // Non-host clients return ghost enemies for targeting
    if (this.isMultiplayer && !this.isHost) {
      return [...this.ghostEnemies.values()].filter(g => g.hp > 0);
    }
    return this.enemies.filter(e => e.hp > 0 && !e.dead);
  }

  update(time, delta) {
    if (this.dungeonComplete) return;

    const runFullSim = !this.isMultiplayer || this.isHost;

    // Update local player
    this.player.update(time, delta);

    // Update AI companions (solo) or skip remote players
    for (const member of this.partyMembers) {
      if (member !== this.player && member.hp > 0 && !member.isRemote) {
        member.update(time, delta);
      }
    }

    // Enemies: host/solo runs full AI, non-host updates ghost interpolation
    if (runFullSim) {
      for (const enemy of this.enemies) {
        if (enemy.hp > 0 && !enemy.dead) enemy.update(time, delta);
      }
    } else {
      this.ghostEnemies.forEach((ghost) => ghost.update(time, delta));
    }

    // Timer: non-host syncs from server, host/solo runs locally
    if (this.isMultiplayer && !this.isHost && this.networkManager?.room?.state) {
      this.dungeonTimer.setTime(this.networkManager.room.state.timer);
    } else {
      this.dungeonTimer.update(delta);
    }
    if (runFullSim) {
      if (this.affixManager?.update) this.affixManager.update(delta);
      if (this.projectileSystem?.update) this.projectileSystem.update(delta);
    }

    // Soft separation (host/solo only — non-host has no real enemies)
    if (runFullSim) this.applySoftSeparation();

    // Tab targeting (all modes — non-host targets ghosts)
    this.updateTabTarget();

    // Room boundaries + transitions (host/solo only)
    if (runFullSim) {
      this.player.x = Phaser.Math.Clamp(this.player.x, this.roomLeftBound + 16, this.roomRightBound - 16);
      this.checkRoomTransition();
    }

    // GO indicator
    if (this.goIndicator.visible) {
      const screenRight = this.cameras.main.scrollX + GAME_CONFIG.width - 30;
      const screenMidY = GAME_CONFIG.height / 2;
      this.goIndicator.setPosition(screenRight, screenMidY);
      this.goIndicator.setAlpha(0.6 + Math.sin(time * 0.006) * 0.4);
    }

    // ─── MULTIPLAYER SYNC ───
    if (this.isMultiplayer && this.networkManager) {
      // All clients: send local input to server
      this.networkManager.sendInput(this.player.getInputState());

      // All clients: update remote player visuals
      this.remotePlayers.forEach((remote) => {
        if (remote.hp > 0) {
          remote.updateHpBar();
          remote.y = remote.groundY - (remote.jumpZ || 0);
          remote.setDepth(GAME_CONFIG.layers.entities + remote.groundY);
        }
      });

      // Host: broadcast enemy state periodically
      if (this.isHost) {
        this.enemySyncTimer += delta;
        if (this.enemySyncTimer >= this.enemySyncInterval) {
          this.enemySyncTimer = 0;
          const syncData = this.enemies.filter(e => e.hp > 0).map(e => ({
            id: e.networkId, type: e.enemyKey,
            x: Math.round(e.x), y: Math.round(e.y),
            groundY: Math.round(e.groundY),
            hp: e.hp, maxHp: e.maxHp,
            state: e.fsm?.currentStateName || 'idle',
            facingRight: e.facingRight,
          }));
          this.networkManager.sendEnemySync(syncData);
        }
      }
    }

    // Depth sort (all modes)
    sortGroup(this.allEntities);

    // Parallax (all modes)
    const scrollX = this.cameras.main.scrollX;
    for (const layer of this.bgLayers) {
      layer.sprite.tilePositionX = scrollX * layer.scrollFactor;
    }
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

  /**
   * Clean up network listeners and resources when scene shuts down.
   */
  shutdown() {
    if (this.isMultiplayer && this.networkManager) {
      // Clear singleton callbacks so they don't reference this destroyed scene
      this.networkManager.onStateChange(null);
      this.networkManager.onPlayerJoin(null);
      this.networkManager.onPlayerLeave(null);
      this.networkManager.onGameStarted(null);
      this.networkManager.onPlayerAbility(null);
      this.networkManager.onHostMigrated(null);
    }
    this.remotePlayers?.clear();
  }
}
