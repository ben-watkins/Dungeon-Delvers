/**
 * BOOT SCENE — Asset loading and initialization
 * 
 * This scene runs first. It loads all sprites, tilesets, audio, and
 * generates placeholder assets for development.
 * 
 * SPRITE SHEET CONVENTION:
 *   All character sprites are loaded as sprite sheets with consistent frame sizes.
 *   Frame size: 48x48 pixels (gives good detail at 4x scale)
 *   Each row is one animation:
 *     Row 0: Idle (4 frames)
 *     Row 1: Walk (6 frames)
 *     Row 2: Attack 1 (6 frames)
 *     Row 3: Attack 2 (7 frames)
 *     Row 4: Attack 3 (8-10 frames)
 *     Row 5: Special 1 (8 frames)
 *     Row 6: Special 2 (8 frames)
 *     Row 7: Hitstun (3 frames)
 *     Row 8: Knockdown (4 frames)
 *     Row 9: Getup (4 frames)
 *     Row 10: Death (6 frames)
 *     Row 11: Block (2 frames) [warrior only]
 * 
 * Until real sprites are created, we generate colored rectangle placeholders.
 */

import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Show loading bar
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222244, 0.8);
    progressBox.fillRect(width / 2 - 80, height / 2 - 6, 160, 12);

    this.load.on('progress', (value) => {
      progressBar.clear();
      progressBar.fillStyle(0x80d8ff, 1);
      progressBar.fillRect(width / 2 - 78, height / 2 - 4, 156 * value, 8);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
    });

    // =====================================================
    // LOAD REAL ASSETS HERE
    // When sprite sheets are ready, load them like:
    //   this.load.spritesheet('warrior', 'assets/sprites/warrior.png', { frameWidth: 48, frameHeight: 48 });
    //   this.load.spritesheet('priest', 'assets/sprites/priest.png', { frameWidth: 48, frameHeight: 48 });
    //   this.load.spritesheet('rogue', 'assets/sprites/rogue.png', { frameWidth: 48, frameHeight: 48 });
    //   this.load.image('tileset_dungeon', 'assets/tilesets/dungeon.png');
    //   this.load.tilemapTiledJSON('map_deadmines', 'assets/tilesets/deadmines.json');
    //   this.load.audio('bgm_dungeon', 'assets/audio/dungeon_bgm.ogg');
    //   this.load.audio('sfx_hit', 'assets/audio/hit.wav');
    // =====================================================
  }

  create() {
    // Generate placeholder sprites for development
    this.generatePlaceholders();

    // Define animations
    this.createAnimations();

    // Move to main menu
    this.scene.start('MainMenuScene');
  }

  /**
   * Generate colored rectangle sprites for each class.
   * These are replaced by real pixel art sprite sheets later.
   * 
   * Each placeholder is a 48x48 canvas with the class color and a label.
   */
  generatePlaceholders() {
    const classes = [
      { key: 'warrior', color: 0x7888a8, label: 'W' },
      { key: 'priest', color: 0xc8c8e8, label: 'P' },
      { key: 'rogue', color: 0x4a4868, label: 'R' },
      { key: 'goblin', color: 0x6a8a40, label: 'g' },
      { key: 'bandit', color: 0x8a6040, label: 'b' },
      { key: 'enforcer', color: 0x884444, label: 'E' },
      { key: 'mr_smite', color: 0xcc4444, label: 'B' },
    ];

    for (const cls of classes) {
      const size = cls.key === 'mr_smite' ? 64 : 48;
      const frameCount = 12; // Max frames for any animation row
      const rowCount = 12;   // Animation rows

      // Create a texture with all animation frames
      const canvas = this.textures.createCanvas(cls.key, size * frameCount, size * rowCount);
      const ctx = canvas.getContext();

      for (let row = 0; row < rowCount; row++) {
        for (let frame = 0; frame < frameCount; frame++) {
          const x = frame * size;
          const y = row * size;

          // Body rectangle
          ctx.fillStyle = `#${cls.color.toString(16).padStart(6, '0')}`;
          const bodyW = size * 0.5;
          const bodyH = size * 0.7;
          ctx.fillRect(x + (size - bodyW) / 2, y + (size - bodyH), bodyW, bodyH);

          // Head circle
          const headR = size * 0.15;
          ctx.beginPath();
          ctx.arc(x + size / 2, y + size * 0.2, headR, 0, Math.PI * 2);
          ctx.fill();

          // Slight variation per frame for idle bob
          if (row === 0 && frame % 2 === 1) {
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.fillRect(x + (size - bodyW) / 2, y + (size - bodyH), bodyW, bodyH);
          }

          // Attack frames — extend arm
          if (row >= 2 && row <= 6 && frame >= 2 && frame <= 4) {
            ctx.fillStyle = `#${cls.color.toString(16).padStart(6, '0')}`;
            ctx.fillRect(x + size * 0.75, y + size * 0.35, size * 0.2, size * 0.1);
          }

          // Label
          ctx.fillStyle = '#ffffff';
          ctx.font = `${Math.floor(size * 0.25)}px monospace`;
          ctx.textAlign = 'center';
          ctx.fillText(cls.label, x + size / 2, y + size * 0.55);
        }
      }

      canvas.refresh();
    }

    // Shadow ellipse
    const shadowCanvas = this.textures.createCanvas('shadow', 24, 8);
    const sctx = shadowCanvas.getContext();
    sctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    sctx.beginPath();
    sctx.ellipse(12, 4, 10, 3, 0, 0, Math.PI * 2);
    sctx.fill();
    shadowCanvas.refresh();

    // Health bar backgrounds
    const hpBg = this.textures.createCanvas('hp_bar_bg', 32, 4);
    const hctx = hpBg.getContext();
    hctx.fillStyle = '#1a1a2e';
    hctx.fillRect(0, 0, 32, 4);
    hpBg.refresh();

    const hpFill = this.textures.createCanvas('hp_bar_fill', 30, 2);
    const hfctx = hpFill.getContext();
    hfctx.fillStyle = '#44cc44';
    hfctx.fillRect(0, 0, 30, 2);
    hpFill.refresh();
  }

  /**
   * Create animation definitions for all characters.
   * When real sprite sheets are loaded, update frame ranges here.
   */
  createAnimations() {
    const frameSize = 48;
    const characters = ['warrior', 'priest', 'rogue', 'goblin', 'bandit', 'enforcer', 'mr_smite'];

    for (const char of characters) {
      const size = char === 'mr_smite' ? 64 : 48;
      const framesPerRow = 12;

      // Helper: generate frame numbers for a row
      const rowFrames = (row, count) => {
        const frames = [];
        for (let i = 0; i < count; i++) {
          frames.push(row * framesPerRow + i);
        }
        return frames;
      };

      // Add the spritesheet config to the texture
      this.textures.get(char).add(0, 0, 0, 0, size * framesPerRow, size * 12);

      // Idle
      this.anims.create({
        key: `${char}_idle`,
        frames: this.anims.generateFrameNumbers(char, {
          frames: rowFrames(0, 4),
        }),
        frameRate: 6,
        repeat: -1,
      });

      // Walk
      this.anims.create({
        key: `${char}_walk`,
        frames: this.anims.generateFrameNumbers(char, {
          frames: rowFrames(1, 6),
        }),
        frameRate: 8,
        repeat: -1,
      });

      // Attack combo (rows 2-4)
      for (let i = 0; i < 3; i++) {
        const frameCount = [6, 7, 10][i];
        this.anims.create({
          key: `${char}_atk${i + 1}`,
          frames: this.anims.generateFrameNumbers(char, {
            frames: rowFrames(2 + i, frameCount),
          }),
          frameRate: 12,
          repeat: 0,
        });
      }

      // Specials (rows 5-6)
      this.anims.create({
        key: `${char}_special1`,
        frames: this.anims.generateFrameNumbers(char, { frames: rowFrames(5, 8) }),
        frameRate: 10,
        repeat: 0,
      });
      this.anims.create({
        key: `${char}_special2`,
        frames: this.anims.generateFrameNumbers(char, { frames: rowFrames(6, 8) }),
        frameRate: 10,
        repeat: 0,
      });

      // Hitstun
      this.anims.create({
        key: `${char}_hitstun`,
        frames: this.anims.generateFrameNumbers(char, { frames: rowFrames(7, 3) }),
        frameRate: 8,
        repeat: 0,
      });

      // Knockdown
      this.anims.create({
        key: `${char}_knockdown`,
        frames: this.anims.generateFrameNumbers(char, { frames: rowFrames(8, 4) }),
        frameRate: 8,
        repeat: 0,
      });

      // Getup
      this.anims.create({
        key: `${char}_getup`,
        frames: this.anims.generateFrameNumbers(char, { frames: rowFrames(9, 4) }),
        frameRate: 8,
        repeat: 0,
      });

      // Death
      this.anims.create({
        key: `${char}_death`,
        frames: this.anims.generateFrameNumbers(char, { frames: rowFrames(10, 6) }),
        frameRate: 6,
        repeat: 0,
      });
    }
  }
}
