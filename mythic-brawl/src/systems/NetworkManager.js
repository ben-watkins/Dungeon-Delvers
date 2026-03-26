/**
 * NETWORK MANAGER — Client-side Colyseus networking for co-op multiplayer.
 *
 * Handles: connection, room creation/joining, input sending, state sync.
 * Used by DungeonScene and MainMenuScene when in multiplayer mode.
 */

import { Client } from 'colyseus.js';

function getServerUrl() {
  const host = window.location.hostname;
  if (host.includes('ngrok')) {
    // Ngrok tunnel — use wss via Vite proxy
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${protocol}://${window.location.host}/colyseus`;
  }
  // Local development
  return 'ws://localhost:2567';
}

export class NetworkManager {
  constructor() {
    this.client = null;
    this.room = null;
    this.isConnected = false;
    this.isHost = false;
    this.localPlayerId = null;
    this.serverUrl = getServerUrl();

    // Callbacks
    this._onStateChange = null;
    this._onPlayerJoin = null;
    this._onPlayerLeave = null;
    this._onGameStarted = null;
    this._onPlayerAbility = null;
    this._onHostMigrated = null;
    this._onEnemyDamageRequest = null;
    this._onRoomCleared = null;
    this._onDungeonComplete = null;
  }

  async connect() {
    try {
      this.client = new Client(this.serverUrl);
      // Note: Client constructor doesn't actually connect — connection happens on create/join
      console.log('Colyseus client initialized:', this.serverUrl);
      return true;
    } catch (err) {
      console.error('Failed to initialize client:', err);
      return false;
    }
  }

  async createRoom(className, dungeon = 'deadmines', keystoneLevel = 2) {
    if (!this.client) await this.connect();

    try {
      const roomCode = this.generateRoomCode();
      this.room = await this.client.create('dungeon', {
        className,
        dungeon,
        keystoneLevel,
        roomCode,
      });
      this.localPlayerId = this.room.sessionId;
      this.isHost = true;
      this.isConnected = true;
      this._setupRoomListeners();
      this._roomCode = roomCode;
      console.log(`Created room: ${roomCode}`);
      return this.room;
    } catch (err) {
      console.error('Failed to create room:', err);
      this.isConnected = false;
      return null;
    }
  }

  async joinRoom(roomCode, className) {
    if (!this.client) await this.connect();

    try {
      this.room = await this.client.join('dungeon', { className, roomCode });
      this.localPlayerId = this.room.sessionId;
      this.isHost = false;
      this.isConnected = true;
      this._roomCode = roomCode;
      this._setupRoomListeners();
      console.log(`Joined room: ${roomCode}`);
      return this.room;
    } catch (err) {
      console.error('Failed to join room:', err);
      this.isConnected = false;
      return null;
    }
  }

  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  _setupRoomListeners() {
    if (!this.room) return;

    this.room.onStateChange((state) => {
      if (this._onStateChange) this._onStateChange(state);
    });

    this.room.onMessage('playerJoined', (data) => {
      if (data.id === this.localPlayerId && data.isHost) {
        this.isHost = true;
      }
      if (this._onPlayerJoin) this._onPlayerJoin(data);
    });

    this.room.onMessage('playerLeft', (data) => {
      if (this._onPlayerLeave) this._onPlayerLeave(data);
    });

    this.room.onMessage('gameStarted', (data) => {
      if (this._onGameStarted) this._onGameStarted(data);
    });

    this.room.onMessage('playerAbility', (data) => {
      if (this._onPlayerAbility) this._onPlayerAbility(data);
    });

    this.room.onMessage('hostMigrated', (data) => {
      this.isHost = data.newHostId === this.localPlayerId;
      if (this._onHostMigrated) this._onHostMigrated(data);
    });

    this.room.onMessage('applyEnemyDamage', (data) => {
      if (this._onEnemyDamageRequest) this._onEnemyDamageRequest(data);
    });

    this.room.onMessage('roomCleared', (data) => {
      if (this._onRoomCleared) this._onRoomCleared(data);
    });

    this.room.onMessage('dungeonComplete', (data) => {
      if (this._onDungeonComplete) this._onDungeonComplete(data);
    });

    this.room.onError((code, message) => {
      console.error(`Room error [${code}]:`, message);
    });

    this.room.onLeave((code) => {
      console.log(`Left room (code: ${code})`);
      this.room = null;
    });
  }

  /**
   * Send player input state to server each frame.
   */
  sendInput(inputState) {
    if (!this.room) return;
    this.room.send('input', inputState);
  }

  /**
   * Send ability usage to server for broadcast to other clients.
   */
  sendAbility(ability, targetX, targetY) {
    if (!this.room) return;
    this.room.send('ability', { ability, targetX, targetY });
  }

  /**
   * Host starts the game.
   */
  startGame() {
    if (!this.room || !this.isHost) return;
    this.room.send('startGame');
  }

  sendEnemySync(enemies) {
    if (!this.room || !this.isHost) return;
    this.room.send('enemySync', { enemies });
  }

  sendEnemyDamage(enemyId, damage, knockbackX, knockbackY, hitstun) {
    if (!this.room) return;
    this.room.send('enemyDamage', { enemyId, damage, knockbackX, knockbackY, hitstun });
  }

  sendEnemySpawn(enemies) {
    if (!this.room || !this.isHost) return;
    this.room.send('enemySpawn', { enemies });
  }

  sendRoomCleared(roomIndex) {
    if (!this.room || !this.isHost) return;
    this.room.send('roomCleared', { roomIndex });
  }

  sendRoomAdvance(roomIndex) {
    if (!this.room || !this.isHost) return;
    this.room.send('roomAdvance', { roomIndex });
  }

  sendDungeonComplete(data) {
    if (!this.room || !this.isHost) return;
    this.room.send('dungeonComplete', data);
  }

  /**
   * Get the room code for sharing.
   */
  getRoomCode() {
    return this._roomCode || this.room?.state?.roomCode || '';
  }

  /**
   * Get all player states from server.
   */
  getPlayers() {
    if (!this.room?.state?.players) return new Map();
    return this.room.state.players;
  }

  /**
   * Check if a player ID is the local player.
   */
  isLocalPlayer(id) {
    return id === this.localPlayerId;
  }

  // --- Callback setters ---
  onStateChange(cb) { this._onStateChange = cb; }
  onPlayerJoin(cb) { this._onPlayerJoin = cb; }
  onPlayerLeave(cb) { this._onPlayerLeave = cb; }
  onGameStarted(cb) { this._onGameStarted = cb; }
  onPlayerAbility(cb) { this._onPlayerAbility = cb; }
  onHostMigrated(cb) { this._onHostMigrated = cb; }
  onEnemyDamageRequest(cb) { this._onEnemyDamageRequest = cb; }
  onRoomCleared(cb) { this._onRoomCleared = cb; }
  onDungeonComplete(cb) { this._onDungeonComplete = cb; }

  disconnect() {
    if (this.room) {
      this.room.leave();
      this.room = null;
    }
    this.isConnected = false;
    this.isHost = false;
    this.localPlayerId = null;
    this._roomCode = null;
    // Clear all callbacks to prevent references to destroyed scenes
    this._onStateChange = null;
    this._onPlayerJoin = null;
    this._onPlayerLeave = null;
    this._onGameStarted = null;
    this._onPlayerAbility = null;
    this._onHostMigrated = null;
    this._onEnemyDamageRequest = null;
    this._onRoomCleared = null;
    this._onDungeonComplete = null;
  }
}

// Singleton instance
export const networkManager = new NetworkManager();
