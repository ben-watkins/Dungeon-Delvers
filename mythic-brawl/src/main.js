/**
 * MYTHIC BRAWL — Main Entry Point
 * 
 * 2.5D side-scrolling beat-em-up with WoW M+ dungeon mechanics.
 * Built with Phaser 3 + Vite.
 * 
 * ARCHITECTURE OVERVIEW:
 * - Scenes handle game states (boot, menu, gameplay, UI overlay)
 * - Entities are game objects (Player, Enemy, AICompanion)
 * - Systems handle cross-cutting logic (Combat, Combos, Affixes, Timer)
 * - Config files define data (classes, dungeons, affixes, enemies)
 * 
 * COORDINATE SYSTEM (2.5D):
 * - X axis: left/right (horizontal movement)
 * - Y axis: depth into screen (up = farther away, down = closer)
 * - Visual Y: actual screen position = Y + sprite height offset
 * - Z axis: simulated via Y-offset for jumps (shadow stays on ground plane)
 * - Depth sorting: entities sort by their ground Y position each frame
 */

import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { MainMenuScene } from './scenes/MainMenuScene.js';
import { DungeonScene } from './scenes/DungeonScene.js';
import { UIScene } from './scenes/UIScene.js';
import { GAME_CONFIG } from './config/game.js';

const config = {
  type: Phaser.AUTO,
  width: GAME_CONFIG.width,
  height: GAME_CONFIG.height,
  parent: document.body,
  pixelArt: true,                    // Critical: prevents anti-aliasing on pixel art
  roundPixels: true,                 // Prevents sub-pixel rendering artifacts
  antialias: false,
  backgroundColor: '#0d0d18',
  scale: {
    mode: Phaser.Scale.FIT,          // Scale to fit window while maintaining aspect ratio
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    gamepad: true,                   // Enable Xbox / generic gamepad support
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },            // No gravity — we handle jump Z-offset manually
      debug: GAME_CONFIG.debug,
    },
  },
  scene: [BootScene, MainMenuScene, DungeonScene, UIScene],
};

const game = new Phaser.Game(config);
