/**
 * MAIN MENU SCENE — Title, class select, dungeon select, multiplayer lobby.
 */

import Phaser from 'phaser';
import { DUNGEONS } from '../config/game.js';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create() {
    this.menuPhase = 'classSelect'; // classSelect -> modeSelect -> lobby
    this.lobbyElements = [];
    this.selectedClass = 'warrior';
    this.createClassSelect();
  }

  clearLobbyElements() {
    for (const el of this.lobbyElements) {
      if (el.destroy) el.destroy();
    }
    this.lobbyElements = [];
    // Remove any DOM elements
    if (this.roomCodeInput) {
      this.roomCodeInput.destroy();
      this.roomCodeInput = null;
    }
  }

  // ─── PHASE 1: CLASS + DUNGEON SELECT ────────────────────

  createClassSelect() {
    const { width, height } = this.cameras.main;

    // Title
    this.add.text(width / 2, height * 0.15, 'MYTHIC BRAWL', {
      fontSize: '32px', fontFamily: 'monospace', color: '#80d8ff',
    }).setOrigin(0.5).setResolution(4);

    this.add.text(width / 2, height * 0.28, 'Streets of Rage meets Mythic+', {
      fontSize: '10px', fontFamily: 'monospace', color: '#606080',
    }).setOrigin(0.5).setResolution(4);

    this.add.text(width / 2, height * 0.38, 'Choose your class', {
      fontSize: '10px', fontFamily: 'monospace', color: '#808098',
    }).setOrigin(0.5).setResolution(4);

    // Class selection — 6 classes in two rows
    this.classes = [
      { key: 'warrior', name: 'WARRIOR', role: 'Tank', color: '#8898b8' },
      { key: 'priest', name: 'PRIEST', role: 'Healer', color: '#90a8d8' },
      { key: 'rogue', name: 'ROGUE', role: 'DPS', color: '#cc6666' },
      { key: 'mage', name: 'MAGE', role: 'Ranged DPS', color: '#aa66ff' },
      { key: 'warlock', name: 'WARLOCK', role: 'DoT Caster', color: '#88cc44' },
      { key: 'hunter', name: 'HUNTER', role: 'Ranged DPS', color: '#44bbaa' },
    ];

    this.selectedIndex = 0;
    this.classSlots = [];

    this.classes.forEach((cls, i) => {
      // Top row: 0-2, Bottom row: 3-5
      const row = Math.floor(i / 3);
      const col = i % 3;
      const x = width * 0.25 + col * (width * 0.25);
      const spriteY = height * 0.44 + row * 62;
      const labelY = spriteY + 18;

      const sprite = this.add.sprite(x, spriteY, cls.key, 0);
      sprite.play(`${cls.key}_idle`);

      const box = this.add.rectangle(x, spriteY, 64, 64, 0xffffff, 0)
        .setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(cls.color).color, 0);

      const label = this.add.text(x, labelY, `${cls.name}\n${cls.role}`, {
        fontSize: '10px', fontFamily: 'monospace', color: cls.color,
        align: 'center', lineSpacing: 2,
      }).setOrigin(0.5).setResolution(4).setInteractive();

      label.on('pointerdown', () => {
        this.selectedIndex = i;
        this.updateSelection();
      });

      this.classSlots.push({ sprite, box, label, cls });
    });

    this.updateSelection();

    // Navigation hint
    this.add.text(width / 2, height * 0.36, '[A/D] or [LEFT/RIGHT] to select', {
      fontSize: '7px', fontFamily: 'monospace', color: '#505068',
    }).setOrigin(0.5).setResolution(4);

    // Dungeon selector
    this.dungeonKeys = Object.keys(DUNGEONS);
    this.dungeonIndex = 0;
    this.dungeonText = this.add.text(width / 2, height * 0.78, this.getDungeonLabel(), {
      fontSize: '10px', fontFamily: 'monospace', color: '#60cc80',
    }).setOrigin(0.5).setResolution(4);

    // Keystone level
    this.keystoneLevel = 2;
    this.keystoneText = this.add.text(width / 2, height * 0.84, `Keystone Level: +${this.keystoneLevel}   [UP/DOWN]`, {
      fontSize: '10px', fontFamily: 'monospace', color: '#d4b040',
    }).setOrigin(0.5).setResolution(4);

    // Mode buttons — Solo and Multiplayer
    const soloBtn = this.add.text(width * 0.3, height * 0.92, '[ SOLO PLAY ]', {
      fontSize: '10px', fontFamily: 'monospace', color: '#44cc44',
    }).setOrigin(0.5).setResolution(4).setInteractive({ useHandCursor: true });
    soloBtn.on('pointerdown', () => this.startSolo());
    soloBtn.on('pointerover', () => soloBtn.setColor('#88ff88'));
    soloBtn.on('pointerout', () => soloBtn.setColor('#44cc44'));

    const mpBtn = this.add.text(width * 0.7, height * 0.92, '[ MULTIPLAYER ]', {
      fontSize: '10px', fontFamily: 'monospace', color: '#80d8ff',
    }).setOrigin(0.5).setResolution(4).setInteractive({ useHandCursor: true });
    mpBtn.on('pointerdown', () => this.showModeSelect());
    mpBtn.on('pointerover', () => mpBtn.setColor('#aaeeff'));
    mpBtn.on('pointerout', () => mpBtn.setColor('#80d8ff'));

    // Keyboard shortcuts
    this.input.keyboard.on('keydown-LEFT', () => {
      this.selectedIndex = (this.selectedIndex - 1 + this.classes.length) % this.classes.length;
      this.updateSelection();
    });
    this.input.keyboard.on('keydown-RIGHT', () => {
      this.selectedIndex = (this.selectedIndex + 1) % this.classes.length;
      this.updateSelection();
    });
    this.input.keyboard.on('keydown-A', () => {
      if (this.menuPhase !== 'classSelect') return;
      this.selectedIndex = (this.selectedIndex - 1 + this.classes.length) % this.classes.length;
      this.updateSelection();
    });
    this.input.keyboard.on('keydown-D', () => {
      if (this.menuPhase !== 'classSelect') return;
      this.selectedIndex = (this.selectedIndex + 1) % this.classes.length;
      this.updateSelection();
    });
    this.input.keyboard.on('keydown-W', () => {
      this.dungeonIndex = (this.dungeonIndex + 1) % this.dungeonKeys.length;
      this.dungeonText.setText(this.getDungeonLabel());
    });
    this.input.keyboard.on('keydown-S', () => {
      this.dungeonIndex = (this.dungeonIndex - 1 + this.dungeonKeys.length) % this.dungeonKeys.length;
      this.dungeonText.setText(this.getDungeonLabel());
    });
    this.input.keyboard.on('keydown-UP', () => {
      this.keystoneLevel = Math.min(30, this.keystoneLevel + 1);
      this.keystoneText.setText(`Keystone Level: +${this.keystoneLevel}   [UP/DOWN]`);
    });
    this.input.keyboard.on('keydown-DOWN', () => {
      this.keystoneLevel = Math.max(2, this.keystoneLevel - 1);
      this.keystoneText.setText(`Keystone Level: +${this.keystoneLevel}   [UP/DOWN]`);
    });
    this.input.keyboard.on('keydown-ENTER', () => {
      if (this.menuPhase === 'classSelect') this.startSolo();
    });

    this.padPrev = {};
  }

  // ─── PHASE 2: MULTIPLAYER MODE SELECT ───────────────────

  showModeSelect() {
    this.menuPhase = 'modeSelect';
    this.clearLobbyElements();
    const { width, height } = this.cameras.main;

    // Overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8)
      .setDepth(10);
    this.lobbyElements.push(overlay);

    const title = this.add.text(width / 2, height * 0.2, 'MULTIPLAYER', {
      fontSize: '18px', fontFamily: 'monospace', color: '#80d8ff',
    }).setOrigin(0.5).setResolution(4).setDepth(11);
    this.lobbyElements.push(title);

    const classInfo = this.add.text(width / 2, height * 0.35, `Playing as: ${this.selectedClass.toUpperCase()}`, {
      fontSize: '10px', fontFamily: 'monospace', color: '#b0b0c8',
    }).setOrigin(0.5).setResolution(4).setDepth(11);
    this.lobbyElements.push(classInfo);

    // Host button
    const hostBtn = this.add.text(width / 2, height * 0.50, '[ HOST GAME ]', {
      fontSize: '12px', fontFamily: 'monospace', color: '#44cc44',
    }).setOrigin(0.5).setResolution(4).setDepth(11).setInteractive({ useHandCursor: true });
    hostBtn.on('pointerdown', () => this.hostGame());
    hostBtn.on('pointerover', () => hostBtn.setColor('#88ff88'));
    hostBtn.on('pointerout', () => hostBtn.setColor('#44cc44'));
    this.lobbyElements.push(hostBtn);

    // Join button
    const joinBtn = this.add.text(width / 2, height * 0.65, '[ JOIN GAME ]', {
      fontSize: '12px', fontFamily: 'monospace', color: '#d4b040',
    }).setOrigin(0.5).setResolution(4).setDepth(11).setInteractive({ useHandCursor: true });
    joinBtn.on('pointerdown', () => this.showJoinInput());
    joinBtn.on('pointerover', () => joinBtn.setColor('#ffdd66'));
    joinBtn.on('pointerout', () => joinBtn.setColor('#d4b040'));
    this.lobbyElements.push(joinBtn);

    // Back button
    const backBtn = this.add.text(width / 2, height * 0.82, '[ BACK ]', {
      fontSize: '10px', fontFamily: 'monospace', color: '#707090',
    }).setOrigin(0.5).setResolution(4).setDepth(11).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => {
      this.clearLobbyElements();
      this.menuPhase = 'classSelect';
    });
    this.lobbyElements.push(backBtn);
  }

  // ─── PHASE 3a: HOST GAME → LOBBY ───────────────────────

  async hostGame() {
    this.clearLobbyElements();
    const { width, height } = this.cameras.main;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85)
      .setDepth(10);
    this.lobbyElements.push(overlay);

    const connecting = this.add.text(width / 2, height / 2, 'Connecting...', {
      fontSize: '12px', fontFamily: 'monospace', color: '#80d8ff',
    }).setOrigin(0.5).setResolution(4).setDepth(11);
    this.lobbyElements.push(connecting);

    const { networkManager } = await import('../systems/NetworkManager.js');
    const room = await networkManager.createRoom(
      this.selectedClass,
      this.dungeonKeys[this.dungeonIndex],
      this.keystoneLevel
    );

    connecting.destroy();

    if (!room) {
      const err = this.add.text(width / 2, height / 2, 'Failed to connect!\nIs the server running?', {
        fontSize: '10px', fontFamily: 'monospace', color: '#cc4444', align: 'center',
      }).setOrigin(0.5).setResolution(4).setDepth(11);
      this.lobbyElements.push(err);
      this.time.delayedCall(2000, () => this.showModeSelect());
      return;
    }

    this.networkManager = networkManager;
    this.showLobby(true);
  }

  // ─── PHASE 3b: JOIN GAME → CODE INPUT → LOBBY ──────────

  showJoinInput() {
    this.clearLobbyElements();
    const { width, height } = this.cameras.main;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85)
      .setDepth(10);
    this.lobbyElements.push(overlay);

    const title = this.add.text(width / 2, height * 0.25, 'ENTER ROOM CODE', {
      fontSize: '14px', fontFamily: 'monospace', color: '#d4b040',
    }).setOrigin(0.5).setResolution(4).setDepth(11);
    this.lobbyElements.push(title);

    // Room code display (typed by player)
    this.joinCode = '';
    this.joinCodeText = this.add.text(width / 2, height * 0.45, '_ _ _ _', {
      fontSize: '24px', fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(0.5).setResolution(4).setDepth(11);
    this.lobbyElements.push(this.joinCodeText);

    const hint = this.add.text(width / 2, height * 0.60, 'Type the 4-character code', {
      fontSize: '8px', fontFamily: 'monospace', color: '#707090',
    }).setOrigin(0.5).setResolution(4).setDepth(11);
    this.lobbyElements.push(hint);

    // Back button
    const backBtn = this.add.text(width / 2, height * 0.80, '[ BACK ]', {
      fontSize: '10px', fontFamily: 'monospace', color: '#707090',
    }).setOrigin(0.5).setResolution(4).setDepth(11).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => {
      if (this.handleJoinKeydown) {
        this.input.keyboard.off('keydown', this.handleJoinKeydown);
        this.handleJoinKeydown = null;
      }
      this.showModeSelect();
    });
    this.lobbyElements.push(backBtn);

    // Listen for typed characters
    this.menuPhase = 'joinInput';
    this.input.keyboard.on('keydown', this.handleJoinKeydown = (event) => {
      if (this.menuPhase !== 'joinInput') return;

      if (event.key === 'Backspace') {
        this.joinCode = this.joinCode.slice(0, -1);
      } else if (event.key.length === 1 && this.joinCode.length < 4) {
        this.joinCode += event.key.toUpperCase();
      }

      // Update display
      const display = this.joinCode.padEnd(4, '_').split('').join(' ');
      this.joinCodeText.setText(display);

      // Auto-submit when 4 characters entered
      if (this.joinCode.length === 4) {
        this.joinGame(this.joinCode);
      }
    });
  }

  async joinGame(roomCode) {
    this.menuPhase = 'joining';
    this.input.keyboard.off('keydown', this.handleJoinKeydown);
    this.clearLobbyElements();
    const { width, height } = this.cameras.main;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85)
      .setDepth(10);
    this.lobbyElements.push(overlay);

    const connecting = this.add.text(width / 2, height / 2, `Joining ${roomCode}...`, {
      fontSize: '12px', fontFamily: 'monospace', color: '#d4b040',
    }).setOrigin(0.5).setResolution(4).setDepth(11);
    this.lobbyElements.push(connecting);

    const { networkManager } = await import('../systems/NetworkManager.js');
    const room = await networkManager.joinRoom(roomCode, this.selectedClass);

    connecting.destroy();

    if (!room) {
      const err = this.add.text(width / 2, height / 2, 'Failed to join!\nInvalid code or room full.', {
        fontSize: '10px', fontFamily: 'monospace', color: '#cc4444', align: 'center',
      }).setOrigin(0.5).setResolution(4).setDepth(11);
      this.lobbyElements.push(err);
      this.time.delayedCall(2000, () => this.showModeSelect());
      return;
    }

    this.networkManager = networkManager;
    this.showLobby(false);
  }

  // ─── PHASE 4: LOBBY (HOST + JOIN) ──────────────────────

  showLobby(isHost) {
    this.clearLobbyElements();
    this.menuPhase = 'lobby';
    const { width, height } = this.cameras.main;
    const nm = this.networkManager;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85)
      .setDepth(10);
    this.lobbyElements.push(overlay);

    // Room code — large and prominent
    const codeLabel = this.add.text(width / 2, height * 0.12, 'ROOM CODE', {
      fontSize: '10px', fontFamily: 'monospace', color: '#707090',
    }).setOrigin(0.5).setResolution(4).setDepth(11);
    this.lobbyElements.push(codeLabel);

    const codeText = this.add.text(width / 2, height * 0.22, nm.getRoomCode() || '...', {
      fontSize: '28px', fontFamily: 'monospace', color: '#44ff44',
    }).setOrigin(0.5).setResolution(4).setDepth(11);
    this.lobbyElements.push(codeText);

    const shareHint = this.add.text(width / 2, height * 0.32, 'Share this code with friends', {
      fontSize: '8px', fontFamily: 'monospace', color: '#505068',
    }).setOrigin(0.5).setResolution(4).setDepth(11);
    this.lobbyElements.push(shareHint);

    const codePoller = this.time.addEvent({
      delay: 200,
      loop: true,
      callback: () => {
        const code = nm.getRoomCode();
        if (code) {
          codeText.setText(code);
          codePoller.remove();
        }
      },
    });
    this.lobbyElements.push({ destroy: () => codePoller.remove() });

    // Player list
    const playersLabel = this.add.text(width / 2, height * 0.42, 'PLAYERS', {
      fontSize: '10px', fontFamily: 'monospace', color: '#b0b0c8',
    }).setOrigin(0.5).setResolution(4).setDepth(11);
    this.lobbyElements.push(playersLabel);

    // Player slots (up to 4)
    this.playerSlotTexts = [];
    for (let i = 0; i < 4; i++) {
      const slotY = height * 0.50 + i * 14;
      const slot = this.add.text(width / 2, slotY, `${i + 1}. Waiting...`, {
        fontSize: '9px', fontFamily: 'monospace', color: '#404060',
      }).setOrigin(0.5).setResolution(4).setDepth(11);
      this.playerSlotTexts.push(slot);
      this.lobbyElements.push(slot);
    }

    // Start button (host only)
    if (isHost) {
      const startBtn = this.add.text(width / 2, height * 0.88, '[ START GAME ]', {
        fontSize: '12px', fontFamily: 'monospace', color: '#44cc44',
      }).setOrigin(0.5).setResolution(4).setDepth(11).setInteractive({ useHandCursor: true });
      startBtn.on('pointerdown', () => {
        nm.startGame();
      });
      startBtn.on('pointerover', () => startBtn.setColor('#88ff88'));
      startBtn.on('pointerout', () => startBtn.setColor('#44cc44'));
      this.lobbyElements.push(startBtn);
    } else {
      const waitText = this.add.text(width / 2, height * 0.88, 'Waiting for host to start...', {
        fontSize: '9px', fontFamily: 'monospace', color: '#707090',
      }).setOrigin(0.5).setResolution(4).setDepth(11);
      this.lobbyElements.push(waitText);
    }

    // Update player list from server state
    this.updateLobbyPlayers();

    // Use multiple approaches to catch player joins — schema listeners + broadcast + polling
    try {
      if (nm.room.state && nm.room.state.players) {
        nm.room.state.players.onAdd(() => this.updateLobbyPlayers());
        nm.room.state.players.onRemove(() => this.updateLobbyPlayers());
      }
    } catch (e) {
      console.warn('Could not set onAdd/onRemove listeners:', e);
    }

    // Broadcast message fallback
    nm.onPlayerJoin(() => this.updateLobbyPlayers());
    nm.onPlayerLeave(() => this.updateLobbyPlayers());

    // Polling fallback — check every 500ms
    const playerPoller = this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => this.updateLobbyPlayers(),
    });
    this.lobbyElements.push({ destroy: () => playerPoller.remove() });

    // Guard against double scene transition
    this._transitioning = false;

    // Prevent disconnect on scene shutdown when transitioning to game
    this.isTransitioningToGame = false;
    this.events.on('shutdown', () => {
      if (!this.isTransitioningToGame && this.networkManager) {
        this.networkManager.disconnect();
      }
    });

    const startMultiplayerGame = (dungeonKey, keystoneLevel) => {
      if (this._transitioning) return;
      this._transitioning = true;
      this.isTransitioningToGame = true;
      this.clearLobbyElements();
      // Clear singleton callbacks before transitioning but do NOT disconnect
      nm.onPlayerJoin(null);
      nm.onPlayerLeave(null);
      nm.onStateChange(null);
      nm.onGameStarted(null);
      this.scene.start('DungeonScene', {
        playerClass: this.selectedClass,
        dungeon: dungeonKey || 'deadmines',
        keystoneLevel: keystoneLevel || 2,
        multiplayer: true,
        isHost: nm.isHost,
      });
    };

    // Listen for game start — broadcast message
    nm.onGameStarted((data) => {
      startMultiplayerGame(data.dungeonKey, data.keystoneLevel);
    });

    // Also watch for gamePhase state change as backup
    nm.onStateChange((state) => {
      if (state.gamePhase === 'playing' && this.menuPhase === 'lobby') {
        startMultiplayerGame(state.dungeonKey, state.keystoneLevel);
      }
    });
  }

  updateLobbyPlayers() {
    if (!this.playerSlotTexts) return;
    const players = this.networkManager?.room?.state?.players;
    if (!players) return;

    const classColors = {
      warrior: '#8898b8', priest: '#90a8d8', rogue: '#cc6666', mage: '#aa66ff', warlock: '#88cc44', hunter: '#44bbaa',
    };

    let i = 0;
    try {
      players.forEach((player) => {
        if (i >= this.playerSlotTexts.length) return;
        const isLocal = this.networkManager.isLocalPlayer(player.id);
        const youMark = isLocal ? ' ← YOU' : '';
        const hostMark = i === 0 ? ' (Host)' : '';
        this.playerSlotTexts[i].setText(
          `${i + 1}. ${player.className.toUpperCase()}${hostMark}${youMark}`
        );
        this.playerSlotTexts[i].setColor(classColors[player.className] || '#b0b0c8');
        i++;
      });
    } catch (e) {
      // State may not be fully synced yet
    }

    // Clear remaining slots
    for (; i < this.playerSlotTexts.length; i++) {
      this.playerSlotTexts[i].setText(`${i + 1}. Waiting...`);
      this.playerSlotTexts[i].setColor('#404060');
    }
  }

  // ─── SHARED METHODS ────────────────────────────────────

  update() {
    const pad = this.input.gamepad && this.input.gamepad.total > 0
      ? this.input.gamepad.pad1 : null;
    if (!pad) return;

    const stickX = Math.abs(pad.leftStick.x) > 0.5 ? Math.sign(pad.leftStick.x) : 0;
    const left = pad.left || stickX < 0;
    const right = pad.right || stickX > 0;

    if (left && !this.padPrev.left) {
      this.selectedIndex = (this.selectedIndex - 1 + this.classes.length) % this.classes.length;
      this.updateSelection();
    }
    if (right && !this.padPrev.right) {
      this.selectedIndex = (this.selectedIndex + 1) % this.classes.length;
      this.updateSelection();
    }

    const btnA = pad.buttons[0] && pad.buttons[0].pressed;
    if (btnA && !this.padPrev.a && this.menuPhase === 'classSelect') {
      this.startSolo();
    }

    this.padPrev.left = left;
    this.padPrev.right = right;
    this.padPrev.a = btnA;
  }

  updateSelection() {
    this.classes.forEach((cls, i) => {
      const slot = this.classSlots[i];
      const selected = i === this.selectedIndex;
      const clsColor = Phaser.Display.Color.HexStringToColor(cls.color).color;
      slot.box.setStrokeStyle(selected ? 2 : 1, clsColor, selected ? 1 : 0);
      slot.box.setFillStyle(0xffffff, selected ? 0.05 : 0);
      slot.sprite.setAlpha(selected ? 1 : 0.4);
      slot.label.setColor(selected ? '#ffffff' : cls.color);
    });
    this.selectedClass = this.classes[this.selectedIndex].key;
  }

  getDungeonLabel() {
    const key = this.dungeonKeys[this.dungeonIndex];
    return `Dungeon: ${DUNGEONS[key].name}   [W/S]`;
  }

  startSolo() {
    this.scene.start('DungeonScene', {
      playerClass: this.selectedClass,
      dungeon: this.dungeonKeys[this.dungeonIndex],
      keystoneLevel: this.keystoneLevel,
      multiplayer: false,
    });
  }
}
