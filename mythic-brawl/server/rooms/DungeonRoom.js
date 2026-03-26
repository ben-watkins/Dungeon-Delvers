/**
 * DUNGEON ROOM — Colyseus room for co-op dungeon runs.
 *
 * State schema:
 *   players: Map<sessionId, PlayerState>
 *   enemies: Map<id, EnemyState>
 *   timer: number (ms remaining)
 *   roomIndex: number (current dungeon room)
 *   affixes: string[] (active affix keys)
 *   gamePhase: 'waiting' | 'playing' | 'complete'
 *   dungeonKey: string
 *   keystoneLevel: number
 *   roomCode: string (4-char join code)
 */

import { Room } from 'colyseus';
import { Schema, MapSchema, ArraySchema, type, defineTypes } from '@colyseus/schema';

// --- Schema Definitions ---

class PlayerState extends Schema {}
defineTypes(PlayerState, {
  id: 'string',
  className: 'string',
  x: 'number',
  y: 'number',
  groundY: 'number',
  hp: 'number',
  maxHp: 'number',
  state: 'string',
  facingRight: 'boolean',
  power: 'number',
  defense: 'number',
  speed: 'number',
});

class EnemyState extends Schema {}
defineTypes(EnemyState, {
  id: 'string',
  type: 'string',
  x: 'number',
  y: 'number',
  groundY: 'number',
  hp: 'number',
  maxHp: 'number',
  state: 'string',
  facingRight: 'boolean',
});

class DungeonState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
    this.enemies = new MapSchema();
    this.affixes = new ArraySchema();
    this.timer = 0;
    this.roomIndex = 0;
    this.gamePhase = 'waiting';
    this.dungeonKey = 'deadmines';
    this.keystoneLevel = 2;
    this.roomCode = '';
  }
}
defineTypes(DungeonState, {
  players: { map: PlayerState },
  enemies: { map: EnemyState },
  affixes: ['string'],
  timer: 'number',
  roomIndex: 'number',
  gamePhase: 'string',
  dungeonKey: 'string',
  keystoneLevel: 'number',
  roomCode: 'string',
  hostId: 'string',
});

// --- Class stats (mirrors client config) ---
const CLASS_STATS = {
  warrior: { hp: 150, speed: 86, power: 2.0, defense: 1.4 },
  priest: { hp: 90, speed: 86, power: 1.05, defense: 0.8 },
  rogue: { hp: 100, speed: 86, power: 8.0, defense: 0.9 },
};

const AVAILABLE_CLASSES = ['warrior', 'priest', 'rogue'];

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// --- Room Implementation ---

export class DungeonRoom extends Room {
  maxClients = 4;

  onCreate(options) {
    this.setState(new DungeonState());
    this.roomCode = options.roomCode || generateRoomCode();
    this.state.roomCode = this.roomCode;
    this.state.dungeonKey = options.dungeon || 'deadmines';
    this.state.keystoneLevel = options.keystoneLevel || 2;
    this.state.gamePhase = 'waiting';
    this.state.hostId = '';

    // Track which classes are taken
    this.takenClasses = new Set();
    this.hostId = null;
    this.tickRate = 60;
    this.enemyIdCounter = 0;

    // Input buffer per player
    this.playerInputs = {};

    // Handle player input messages
    this.onMessage('input', (client, data) => {
      this.playerInputs[client.sessionId] = data;
    });

    // Host starts the game
    this.onMessage('startGame', (client) => {
      if (client.sessionId === this.hostId && this.state.gamePhase === 'waiting') {
        this.startGame();
      }
    });

    // Chat / ability use messages
    this.onMessage('ability', (client, data) => {
      // Broadcast ability usage to all clients for VFX
      this.broadcast('playerAbility', {
        playerId: client.sessionId,
        ability: data.ability,
        targetX: data.targetX,
        targetY: data.targetY,
      });
    });

    // Host broadcasts enemy state periodically
    this.onMessage('enemySync', (client, data) => {
      if (client.sessionId !== this.hostId) return;
      for (const e of data.enemies) {
        let es = this.state.enemies.get(e.id);
        if (!es) {
          es = new EnemyState();
          es.id = e.id;
          es.type = e.type;
          es.maxHp = e.maxHp;
          this.state.enemies.set(e.id, es);
        }
        es.x = e.x;
        es.y = e.y;
        es.groundY = e.groundY;
        es.hp = e.hp;
        es.state = e.state;
        es.facingRight = e.facingRight;
      }
      const hostIds = new Set(data.enemies.map(e => e.id));
      const toRemove = [];
      this.state.enemies.forEach((_, key) => {
        if (!hostIds.has(key)) toRemove.push(key);
      });
      toRemove.forEach(key => this.state.enemies.delete(key));
    });

    // Forward damage from any client to host
    this.onMessage('enemyDamage', (client, data) => {
      const hostClient = this.clients.find(c => c.sessionId === this.hostId);
      if (hostClient) {
        hostClient.send('applyEnemyDamage', { ...data, sourceId: client.sessionId });
      }
    });

    // Host reports enemy spawn
    this.onMessage('enemySpawn', (client, data) => {
      if (client.sessionId !== this.hostId) return;
      console.log(`Host spawned ${data.enemies.length} enemies in room ${this.state.roomCode}`);
      this.state.enemies.clear();
      for (const e of data.enemies) {
        const es = new EnemyState();
        es.id = e.id; es.type = e.type; es.x = e.x; es.y = e.y;
        es.groundY = e.groundY; es.hp = e.hp; es.maxHp = e.maxHp;
        es.state = 'idle'; es.facingRight = false;
        this.state.enemies.set(e.id, es);
      }
    });

    // Host reports room advance
    this.onMessage('roomAdvance', (client, data) => {
      if (client.sessionId !== this.hostId) return;
      this.state.roomIndex = data.roomIndex;
    });

    // Host reports room cleared
    this.onMessage('roomCleared', (client, data) => {
      if (client.sessionId !== this.hostId) return;
      this.broadcast('roomCleared', { roomIndex: data.roomIndex });
    });

    // Host reports dungeon complete
    this.onMessage('dungeonComplete', (client, data) => {
      if (client.sessionId !== this.hostId) return;
      this.state.gamePhase = 'complete';
      this.broadcast('dungeonComplete', data);
    });

    // Set up the game loop
    this.setSimulationInterval((dt) => this.gameLoop(dt), 1000 / this.tickRate);

    console.log(`Room created: ${this.state.roomCode} (${this.state.dungeonKey} M+${this.state.keystoneLevel})`);
  }

  onJoin(client, options) {
    const requestedClass = options.className || 'warrior';

    // Assign class — requested if available, otherwise first available
    let assignedClass = requestedClass;
    if (this.takenClasses.has(assignedClass)) {
      assignedClass = AVAILABLE_CLASSES.find(c => !this.takenClasses.has(c)) || 'warrior';
    }
    this.takenClasses.add(assignedClass);

    // First player is the host
    if (!this.hostId) {
      this.hostId = client.sessionId;
    }
      this.state.hostId = this.hostId;

    // Create player state
    const stats = CLASS_STATS[assignedClass] || CLASS_STATS.warrior;
    const player = new PlayerState();
    player.id = client.sessionId;
    player.className = assignedClass;
    player.x = 40 + this.state.players.size * 20;
    player.y = 200;
    player.groundY = 200;
    player.hp = stats.hp;
    player.maxHp = stats.hp;
    player.state = 'idle';
    player.facingRight = true;
    player.power = stats.power;
    player.defense = stats.defense;
    player.speed = stats.speed;

    this.state.players.set(client.sessionId, player);

    // Notify all clients
    this.broadcast('playerJoined', {
      id: client.sessionId,
      className: assignedClass,
      isHost: client.sessionId === this.hostId,
    });

    console.log(`Player joined: ${client.sessionId} as ${assignedClass} (${this.state.players.size}/${this.maxClients})`);
  }

  onLeave(client, consented) {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      this.takenClasses.delete(player.className);
      this.state.players.delete(client.sessionId);
    }
    delete this.playerInputs[client.sessionId];

    // Migrate host
    if (client.sessionId === this.hostId) {
      const remaining = [...this.state.players.keys()];
      this.hostId = remaining.length > 0 ? remaining[0] : null;
      if (this.hostId) {
        this.broadcast('hostMigrated', { newHostId: this.hostId });
      }
      if (this.hostId) this.state.hostId = this.hostId;
    }

    this.broadcast('playerLeft', { id: client.sessionId });

    console.log(`Player left: ${client.sessionId} (${this.state.players.size} remaining)`);

    // End room if empty during play
    if (this.state.players.size === 0 && this.state.gamePhase === 'playing') {
      this.disconnect();
    }
  }

  startGame() {
    this.state.gamePhase = 'playing';
    this.state.timer = 900 * 1000; // 15 min default
    this.state.roomIndex = 0;

    this.broadcast('gameStarted', {
      dungeonKey: this.state.dungeonKey,
      keystoneLevel: this.state.keystoneLevel,
    });

    console.log(`Game started in room ${this.state.roomCode}`);
  }

  gameLoop(dt) {
    if (this.state.gamePhase !== 'playing') return;

    // Update timer
    if (this.state.timer > 0) {
      this.state.timer = Math.max(0, this.state.timer - dt);
    }

    // Process player inputs — update positions server-side
    this.state.players.forEach((player, sessionId) => {
      const input = this.playerInputs[sessionId];
      if (!input || player.hp <= 0) return;

      const speed = player.speed * (dt / 1000);
      let dx = 0, dy = 0;

      if (input.left) dx -= speed;
      if (input.right) dx += speed;
      if (input.up) dy -= speed * 0.6;
      if (input.down) dy += speed * 0.6;

      if (dx !== 0 || dy !== 0) {
        player.x += dx;
        player.groundY = Math.max(160, Math.min(240, player.groundY + dy));
        player.y = player.groundY;
        player.facingRight = dx > 0 ? true : dx < 0 ? false : player.facingRight;
        player.state = 'walk';
      } else if (player.state === 'walk') {
        player.state = 'idle';
      }
    });

    // Enemy AI and combat are handled client-side for now (authoritative server TODO)
    // The server primarily syncs player positions and game phase
  }

  onDispose() {
    console.log(`Room ${this.state.roomCode} disposed`);
  }
}
