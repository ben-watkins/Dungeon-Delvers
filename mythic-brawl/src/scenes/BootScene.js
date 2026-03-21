/**
 * BOOT SCENE — Asset loading and initialization
 *
 * This scene runs first. It loads all sprite sheets, environment art,
 * and defines animation frame mappings.
 *
 * SPRITE SHEET CONVENTION:
 *   All character sprites are 14 columns × 12 rows.
 *   Frame size: 48x48 (64x64 for pitlord)
 *   Each row is one animation:
 *     Row 0: Idle (8 frames)
 *     Row 1: Walk (8 frames)
 *     Row 2: Attack 1 (8 frames)
 *     Row 3: Attack 2 (8 frames)
 *     Row 4: Attack 3 (12 frames)
 *     Row 5: Special 1 (10 frames)
 *     Row 6: Special 2 (10 frames)
 *     Row 7: Hitstun (4 frames)
 *     Row 8: Knockdown (6 frames)
 *     Row 9: Getup (6 frames)
 *     Row 10: Death (8 frames)
 *     Row 11: Block (4 frames)
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
    // REAL SPRITE SHEETS — 14 columns × 12 rows, 48×48 per frame
    // =====================================================
    this.load.spritesheet('warrior', 'assets/sprites/warrior_side_right.png', { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet('priest', 'assets/sprites/priest_side_right.png', { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet('rogue', 'assets/sprites/rogue_side_right.png', { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet('mage', 'assets/sprites/mage_side_right.png', { frameWidth: 48, frameHeight: 48 });

    // =====================================================
    // ENEMY SPRITE SHEETS — 14 columns × 12 rows
    // =====================================================
    this.load.spritesheet('imp', 'assets/sprites/imp_side_right.png', { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet('hellknight', 'assets/sprites/hellknight_side_right.png', { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet('pitlord', 'assets/sprites/pitlord_side_right.png', { frameWidth: 64, frameHeight: 64 });

    // =====================================================
    // DUNGEON ENVIRONMENT ART
    // =====================================================
    this.load.image('dungeon_bg', 'assets/dungeon_bg.png');
    this.load.spritesheet('dungeon_tiles', 'assets/dungeon_tiles.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('dungeon_props', 'assets/dungeon_props.png', { frameWidth: 32, frameHeight: 64 });
  }

  create() {
    // Generate UI helper textures
    this.generateUITextures();
    this.generateVFXTextures();

    // Define animations
    this.createAnimations();

    // Move to main menu
    this.scene.start('MainMenuScene');
  }

  /**
   * Generate small utility textures (shadow, health bars) that don't need sprite sheets.
   */
  generateUITextures() {
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
   * Generate tiny canvas textures used by the VFX particle system.
   */
  generateVFXTextures() {
    // 2x2 white pixel (tintable by particle emitters)
    const px2 = this.textures.createCanvas('vfx_pixel', 2, 2);
    const px2ctx = px2.getContext();
    px2ctx.fillStyle = '#ffffff';
    px2ctx.fillRect(0, 0, 2, 2);
    px2.refresh();

    // 4x4 white square (larger particles)
    const px4 = this.textures.createCanvas('vfx_pixel_4', 4, 4);
    const px4ctx = px4.getContext();
    px4ctx.fillStyle = '#ffffff';
    px4ctx.fillRect(0, 0, 4, 4);
    px4.refresh();

    // 6x6 circle (heal/glow particles)
    const c6 = this.textures.createCanvas('vfx_circle', 6, 6);
    const c6ctx = c6.getContext();
    c6ctx.fillStyle = '#ffffff';
    c6ctx.beginPath();
    c6ctx.arc(3, 3, 3, 0, Math.PI * 2);
    c6ctx.fill();
    c6.refresh();

    // 3x3 blood droplet (round-ish red particle)
    const bl3 = this.textures.createCanvas('vfx_blood', 3, 3);
    const bl3ctx = bl3.getContext();
    bl3ctx.fillStyle = '#cc2222';
    bl3ctx.fillRect(0, 0, 3, 3);
    bl3ctx.fillStyle = '#881111';
    bl3ctx.fillRect(0, 0, 1, 1);
    bl3.refresh();

    // 2x2 blood speck (smaller droplets)
    const bl2 = this.textures.createCanvas('vfx_blood_sm', 2, 2);
    const bl2ctx = bl2.getContext();
    bl2ctx.fillStyle = '#aa1111';
    bl2ctx.fillRect(0, 0, 2, 2);
    bl2.refresh();
  }

  /**
   * Create animation definitions for all characters.
   * All sheets are 14 columns × 12 rows. Frame counts per row match the sprite sheet spec.
   */
  createAnimations() {
    const FRAMES_PER_ROW = 14;
    const characters = ['warrior', 'priest', 'rogue', 'mage', 'imp', 'hellknight', 'pitlord'];

    // Helper: generate frame numbers for a row
    const rowFrames = (row, count) => {
      const frames = [];
      for (let i = 0; i < count; i++) {
        frames.push(row * FRAMES_PER_ROW + i);
      }
      return frames;
    };

    for (const char of characters) {
      // Row 0: Idle (8 frames)
      this.anims.create({
        key: `${char}_idle`,
        frames: this.anims.generateFrameNumbers(char, { frames: rowFrames(0, 8) }),
        frameRate: 6,
        repeat: -1,
      });

      // Row 1: Walk (8 frames)
      this.anims.create({
        key: `${char}_walk`,
        frames: this.anims.generateFrameNumbers(char, { frames: rowFrames(1, 8) }),
        frameRate: 8,
        repeat: -1,
      });

      // Rows 2-4: Attack combo (8, 8, 12 frames)
      const atkFrameCounts = [8, 8, 12];
      for (let i = 0; i < 3; i++) {
        this.anims.create({
          key: `${char}_atk${i + 1}`,
          frames: this.anims.generateFrameNumbers(char, { frames: rowFrames(2 + i, atkFrameCounts[i]) }),
          frameRate: 12,
          repeat: 0,
        });
      }

      // Row 5: Special 1 (10 frames)
      this.anims.create({
        key: `${char}_special1`,
        frames: this.anims.generateFrameNumbers(char, { frames: rowFrames(5, 10) }),
        frameRate: 10,
        repeat: 0,
      });

      // Row 6: Special 2 (10 frames)
      this.anims.create({
        key: `${char}_special2`,
        frames: this.anims.generateFrameNumbers(char, { frames: rowFrames(6, 10) }),
        frameRate: 10,
        repeat: 0,
      });

      // Row 7: Hitstun (4 frames)
      this.anims.create({
        key: `${char}_hitstun`,
        frames: this.anims.generateFrameNumbers(char, { frames: rowFrames(7, 4) }),
        frameRate: 8,
        repeat: 0,
      });

      // Row 8: Knockdown (6 frames)
      this.anims.create({
        key: `${char}_knockdown`,
        frames: this.anims.generateFrameNumbers(char, { frames: rowFrames(8, 6) }),
        frameRate: 8,
        repeat: 0,
      });

      // Row 9: Getup (6 frames)
      this.anims.create({
        key: `${char}_getup`,
        frames: this.anims.generateFrameNumbers(char, { frames: rowFrames(9, 6) }),
        frameRate: 8,
        repeat: 0,
      });

      // Row 10: Death (8 frames)
      this.anims.create({
        key: `${char}_death`,
        frames: this.anims.generateFrameNumbers(char, { frames: rowFrames(10, 8) }),
        frameRate: 6,
        repeat: 0,
      });
    }
  }
}
