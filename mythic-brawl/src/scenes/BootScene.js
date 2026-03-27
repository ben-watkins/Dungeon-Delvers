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
    this.load.spritesheet('warlock', 'assets/sprites/warlock_side_right.png', { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet('hunter', 'assets/sprites/hunter_side_right.png', { frameWidth: 48, frameHeight: 48 });

    // =====================================================
    // ENEMY SPRITE SHEETS — 14 columns × 12 rows
    // =====================================================
    this.load.spritesheet('imp', 'assets/sprites/imp_side_right.png', { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet('hellknight', 'assets/sprites/hellknight_side_right.png', { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet('pitlord', 'assets/sprites/pitlord_side_right.png', { frameWidth: 64, frameHeight: 64 });

    // Frozen Crypt enemies
    this.load.spritesheet('frozen_wraith', 'assets/sprites/frozen_wraith.png', { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet('frozen_golem', 'assets/sprites/frozen_golem.png', { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet('frozen_giant', 'assets/sprites/frozen_giant.png', { frameWidth: 64, frameHeight: 64 });

    // Infernal Forge enemies
    this.load.spritesheet('forge_imp', 'assets/sprites/forge_imp.png', { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet('forge_golem', 'assets/sprites/forge_golem.png', { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet('forge_infernal', 'assets/sprites/forge_infernal.png', { frameWidth: 64, frameHeight: 64 });

    // Sunken Temple enemies
    this.load.spritesheet('temple_murloc', 'assets/sprites/temple_murloc.png', { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet('temple_naga', 'assets/sprites/temple_naga.png', { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet('temple_horror', 'assets/sprites/temple_horror.png', { frameWidth: 64, frameHeight: 64 });

    // =====================================================
    // DUNGEON ENVIRONMENT ART — The Deadmines
    // =====================================================
    this.load.image('dungeon_bg', 'assets/dungeon_bg.png');
    this.load.spritesheet('dungeon_tiles', 'assets/dungeon_tiles.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('dungeon_props', 'assets/dungeon_props.png', { frameWidth: 32, frameHeight: 64 });

    // =====================================================
    // DUNGEON ENVIRONMENT ART — Mythic Grove (3-layer parallax)
    // =====================================================
    this.load.image('mythic_bg_far', 'assets/mythic_bg_far.png');
    this.load.image('mythic_bg_mid', 'assets/mythic_bg_mid.png');
    this.load.image('mythic_bg_near', 'assets/mythic_bg_near.png');
    this.load.spritesheet('mythic_tiles', 'assets/mythic_tiles.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('mythic_props', 'assets/mythic_props.png', { frameWidth: 32, frameHeight: 64 });

    // =====================================================
    // BOSS ROOM ENVIRONMENT ART
    // =====================================================
    this.load.image('bossroom_bg', 'assets/bossroom_bg.png');
    this.load.spritesheet('bossroom_tiles', 'assets/bossroom_tiles.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('bossroom_props', 'assets/bossroom_props.png', { frameWidth: 32, frameHeight: 64 });

    // =====================================================
    // AFFIX VISUAL EFFECTS
    // =====================================================
    this.load.spritesheet('raging_fx', 'assets/ui/raging_fx.png', { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet('bolstering_fx', 'assets/ui/bolstering_fx.png', { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet('sanguine_fx', 'assets/ui/sanguine_fx.png', { frameWidth: 80, frameHeight: 32 });
    this.load.spritesheet('volcanic_fx', 'assets/ui/volcanic_fx.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('necrotic_fx', 'assets/ui/necrotic_fx.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('bursting_fx', 'assets/ui/bursting_fx.png', { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet('afflicted_fx', 'assets/ui/afflicted_fx.png', { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet('affix_icons', 'assets/ui/affix_icons.png', { frameWidth: 24, frameHeight: 24 });

    // =====================================================
    // PROJECTILES — per dungeon
    // =====================================================
    const dungeonPrefixes = ['deadmines', 'mythic', 'frozen', 'forge', 'temple'];
    for (const prefix of dungeonPrefixes) {
      this.load.spritesheet(`${prefix}_proj_small`, `assets/projectiles/${prefix}_proj_small.png`, { frameWidth: 16, frameHeight: 16 });
      this.load.spritesheet(`${prefix}_proj_med`, `assets/projectiles/${prefix}_proj_med.png`, { frameWidth: 24, frameHeight: 24 });
      this.load.spritesheet(`${prefix}_proj_large`, `assets/projectiles/${prefix}_proj_large.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`${prefix}_impact`, `assets/projectiles/${prefix}_impact.png`, { frameWidth: 32, frameHeight: 32 });
    }

    // =====================================================
    // DUNGEON ENVIRONMENT ART — Frozen Crypt
    // =====================================================
    this.load.image('frozen_bg_far', 'assets/frozen_bg_far.png');
    this.load.image('frozen_bg_mid', 'assets/frozen_bg_mid.png');
    this.load.image('frozen_bg_near', 'assets/frozen_bg_near.png');
    this.load.spritesheet('frozen_tiles', 'assets/frozen_tiles.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('frozen_props', 'assets/frozen_props.png', { frameWidth: 32, frameHeight: 64 });

    // =====================================================
    // DUNGEON ENVIRONMENT ART — Infernal Forge
    // =====================================================
    this.load.image('forge_bg_far', 'assets/forge_bg_far.png');
    this.load.image('forge_bg_mid', 'assets/forge_bg_mid.png');
    this.load.image('forge_bg_near', 'assets/forge_bg_near.png');
    this.load.spritesheet('forge_tiles', 'assets/forge_tiles.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('forge_props', 'assets/forge_props.png', { frameWidth: 32, frameHeight: 64 });

    // =====================================================
    // DUNGEON ENVIRONMENT ART — Sunken Temple
    // =====================================================
    this.load.image('temple_bg_far', 'assets/temple_bg_far.png');
    this.load.image('temple_bg_mid', 'assets/temple_bg_mid.png');
    this.load.image('temple_bg_near', 'assets/temple_bg_near.png');
    this.load.spritesheet('temple_tiles', 'assets/temple_tiles.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('temple_props', 'assets/temple_props.png', { frameWidth: 32, frameHeight: 64 });
  }

  create() {
    // Generate UI helper textures
    this.generateUITextures();
    this.generateVFXTextures();
    this.generatePlaceholderSheets();
    this.createAffixAnimations();

    // Define animations
    this.createAnimations();
    this.createProjectileAnimations();

    // Move to main menu
    this.scene.start('MainMenuScene');
  }

  /**
   * Generate placeholder sprite sheets for classes that don't have PNGs yet.
   * Creates a 14×12 grid of colored frames (48×48 each) that the animation system can use.
   */
  generatePlaceholderSheets() {
    // Add new classes here if they don't have sprite sheets yet
    const placeholders = [
    ];

    for (const { key, color, accent, label } of placeholders) {
      // Skip if a real spritesheet was already loaded
      if (this.textures.exists(key)) continue;

      const cols = 14;
      const rows = 12;
      const fw = 48;
      const fh = 48;
      const canvas = this.textures.createCanvas(key, cols * fw, rows * fh);
      const ctx = canvas.getContext();

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * fw;
          const y = row * fh;

          // Body
          ctx.fillStyle = color;
          ctx.fillRect(x + 16, y + 12, 16, 24);

          // Head
          ctx.fillStyle = accent;
          ctx.fillRect(x + 18, y + 4, 12, 12);

          // Legs (slight variation per frame for walk illusion)
          ctx.fillStyle = color;
          ctx.fillRect(x + 16, y + 36, 7, 10);
          ctx.fillRect(x + 25, y + 36, 7, 10);

          // Label
          ctx.fillStyle = '#ffffff';
          ctx.font = '8px monospace';
          ctx.fillText(label, x + 17, y + 30);
        }
      }
      canvas.refresh();

      // Register as spritesheet
      this.textures.get(key).add(0, 0, 0, 0, cols * fw, rows * fh);
      // Add individual frames
      for (let i = 0; i < cols * rows; i++) {
        const fx = (i % cols) * fw;
        const fy = Math.floor(i / cols) * fh;
        this.textures.get(key).add(i, 0, fx, fy, fw, fh);
      }
    }
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

  createAffixAnimations() {
    // Raging — looping red pulse
    this.anims.create({ key: 'raging_fx_anim', frames: this.anims.generateFrameNumbers('raging_fx', { start: 0, end: 7 }), frameRate: 10, repeat: -1 });
    // Bolstering — play once
    this.anims.create({ key: 'bolstering_fx_anim', frames: this.anims.generateFrameNumbers('bolstering_fx', { start: 0, end: 7 }), frameRate: 10, repeat: 0 });
    // Sanguine — looping pool
    this.anims.create({ key: 'sanguine_fx_anim', frames: this.anims.generateFrameNumbers('sanguine_fx', { start: 0, end: 7 }), frameRate: 8, repeat: -1 });
    // Volcanic — telegraph (frames 0-3), eruption (4-7), fade (8-11)
    this.anims.create({ key: 'volcanic_telegraph_anim', frames: this.anims.generateFrameNumbers('volcanic_fx', { start: 0, end: 3 }), frameRate: 4, repeat: 0 });
    this.anims.create({ key: 'volcanic_eruption_anim', frames: this.anims.generateFrameNumbers('volcanic_fx', { start: 4, end: 11 }), frameRate: 12, repeat: 0 });
    // Necrotic — looping tendrils
    this.anims.create({ key: 'necrotic_fx_anim', frames: this.anims.generateFrameNumbers('necrotic_fx', { start: 0, end: 7 }), frameRate: 8, repeat: -1 });
    // Bursting — play once per tick
    this.anims.create({ key: 'bursting_fx_anim', frames: this.anims.generateFrameNumbers('bursting_fx', { start: 0, end: 7 }), frameRate: 10, repeat: 0 });
    // Afflicted — looping with urgency
    this.anims.create({ key: 'afflicted_fx_anim', frames: this.anims.generateFrameNumbers('afflicted_fx', { start: 0, end: 9 }), frameRate: 8, repeat: -1 });
  }

  createProjectileAnimations() {
    const dungeonPrefixes = ['deadmines', 'mythic', 'frozen', 'forge', 'temple'];
    for (const prefix of dungeonPrefixes) {
      this.anims.create({ key: `${prefix}_proj_small_anim`, frames: this.anims.generateFrameNumbers(`${prefix}_proj_small`, { start: 0, end: 7 }), frameRate: 12, repeat: -1 });
      this.anims.create({ key: `${prefix}_proj_med_anim`, frames: this.anims.generateFrameNumbers(`${prefix}_proj_med`, { start: 0, end: 7 }), frameRate: 12, repeat: -1 });
      this.anims.create({ key: `${prefix}_proj_large_anim`, frames: this.anims.generateFrameNumbers(`${prefix}_proj_large`, { start: 0, end: 7 }), frameRate: 12, repeat: -1 });
      this.anims.create({ key: `${prefix}_impact_anim`, frames: this.anims.generateFrameNumbers(`${prefix}_impact`, { start: 0, end: 5 }), frameRate: 15, repeat: 0 });
    }
  }

  /**
   * Create animation definitions for all characters.
   * All sheets are 14 columns × 12 rows. Frame counts per row match the sprite sheet spec.
   */
  createAnimations() {
    const FRAMES_PER_ROW = 14;
    const characters = [
      'warrior', 'priest', 'rogue', 'mage', 'warlock', 'hunter',
      'imp', 'hellknight', 'pitlord',
      'frozen_wraith', 'frozen_golem', 'frozen_giant',
      'forge_imp', 'forge_golem', 'forge_infernal',
      'temple_murloc', 'temple_naga', 'temple_horror',
    ];

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
