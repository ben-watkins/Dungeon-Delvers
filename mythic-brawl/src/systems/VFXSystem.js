/**
 * VFX SYSTEM — Procedural visual effects for combat
 *
 * Listens to combat events and spawns visual effects using Phaser
 * Graphics, particles, and tweens. No external sprite assets required.
 *
 * All effects are self-cleaning via tween onComplete callbacks.
 */

import { GAME_CONFIG } from '../config/game.js';

// Slash arc colors per class
const CLASS_COLORS = {
  warrior: 0xcccccc,   // steel
  priest: 0xeedd88,    // golden
  rogue: 0x88ccff,     // icy blue
  mage: 0xaa66ff,      // arcane purple
};

// Enemy swipe colors
const ENEMY_COLORS = {
  imp: 0xff6644,       // red-orange
  hellknight: 0xff8844, // orange
  pitlord: 0xff4444,   // blood red
};

export class VFXSystem {
  constructor(scene) {
    this.scene = scene;

    scene.events.on('hitboxActive', this.onHitboxActive, this);
    scene.events.on('enemyAttack', this.onEnemyAttack, this);
    scene.events.on('aiAttack', this.onAIAttack, this);
    scene.events.on('playerSpecial', this.onPlayerSpecial, this);
    scene.events.on('aiHeal', this.onAIHeal, this);
    scene.events.on('entityDamaged', this.onEntityDamaged, this);
    scene.events.on('priestBeam', this.onPriestBeam, this);
    scene.events.on('priestHealBlob', this.onPriestHealBlob, this);
    scene.events.on('priestHealLightning', this.onPriestHealLightning, this);
  }

  // ─── EVENT HANDLERS ───────────────────────────────────────

  onHitboxActive(hitbox) {
    // Only spawn once per attack activation
    if (hitbox._vfxSpawned) return;
    hitbox._vfxSpawned = true;

    const owner = hitbox.owner;
    const color = CLASS_COLORS[owner.classKey] || 0xcccccc;
    const dir = owner.facingRight ? 1 : -1;
    const combo = owner.comboIndex || 0;

    // Warrior gets dramatic escalating combo VFX
    if (owner.classKey === 'warrior') {
      this.spawnWarriorComboSlash(owner, dir, combo, color);
    } else {
      const cx = owner.x + dir * 12;
      const cy = owner.groundY - 14;
      const radius = combo >= 2 ? 14 : 10;
      this.spawnSlashArc(cx, cy, dir, radius, color);
    }
  }

  onEnemyAttack(data) {
    const { enemy, hitbox } = data;
    const color = ENEMY_COLORS[enemy.enemyKey] || 0xff6644;
    const dir = enemy.facingRight ? 1 : -1;
    const cx = hitbox.x + hitbox.width / 2;
    const cy = hitbox.y + hitbox.height / 2;

    if (enemy.enemyKey === 'imp') {
      this.spawnScratchMarks(cx, cy, dir, color);
    } else {
      const radius = enemy.enemyKey === 'pitlord' ? 18 : 12;
      this.spawnSlashArc(cx, cy, dir, radius, color);
    }
  }

  onAIAttack(data) {
    const { companion, target } = data;
    if (!target || target.hp <= 0) return;
    const color = CLASS_COLORS[companion.classKey] || 0xcccccc;
    const dir = companion.facingRight ? 1 : -1;
    this.spawnSlashArc(target.x, target.groundY - 14, dir, 10, color);
  }

  onPlayerSpecial(data) {
    const { player, special, key } = data;
    const cls = player.classKey;

    if (cls === 'warrior' && key === 'special1') {
      this.spawnMegaSlash(player);
    } else if (cls === 'warrior' && key === 'special2') {
      this.spawnShieldBashWave(player);
    } else if (cls === 'warrior' && key === 'special3') {
      this.spawnLeapImpact(player);
    } else if (cls === 'warrior' && key === 'special4') {
      this.spawnShieldChargeImpact(player);
    } else if (cls === 'priest' && key === 'special1') {
      this.spawnHolyLight(player);
    } else if (cls === 'priest' && key === 'special2') {
      this.spawnNovaRing(player.x, player.groundY - 8, 0xffdd44);
    } else if (cls === 'rogue' && key === 'special1') {
      this.spawnDaggerFlurry(player);
    } else if (cls === 'rogue' && key === 'special2') {
      this.spawnShadowStrike(player);
    } else if (cls === 'mage') {
      // Generic arcane burst for mage specials
      this.spawnNovaRing(player.x, player.groundY - 8, 0xaa66ff);
    }
  }

  onAIHeal(data) {
    const { healer, target } = data;
    if (!target) return;
    this.spawnHealGlow(target.x, target.groundY - 16);

    // Draw heal beam from healer to target
    if (healer) {
      this.spawnHealBeam(healer.x, healer.groundY - 12, target.x, target.groundY - 12);
    }
  }

  onEntityDamaged(data) {
    // White flash on the damaged entity's sprite
    const entity = data.entity;
    if (entity.sprite) {
      entity.sprite.setTintFill(0xffffff);
      this.scene.time.delayedCall(50, () => {
        if (entity.sprite && !entity.sprite.scene) return;
        entity.sprite.clearTint();
      });
    }

    // Small impact flash at damage position
    this.spawnImpactFlash(data.x, data.y);

    // BLOOD — comical amounts, only on enemies
    if (entity.enemyKey) {
      this.spawnBloodBurst(data.x, data.y, data.damage, entity);
    }
  }

  onPriestBeam(data) {
    const { source, target, color, beamCount } = data;
    this.spawnHolyBeams(source, target, color || 0xffffaa, beamCount || 3);
  }

  onPriestHealBlob(data) {
    const { source, target, healAmount } = data;
    this.spawnHealingBlob(source, target, healAmount);
  }

  onPriestHealLightning(data) {
    const { source, target, healAmount } = data;
    this.spawnHealLightning(source, target);
  }

  // ─── EFFECT SPAWNERS ──────────────────────────────────────

  /**
   * Arc-shaped slash trail — used for all melee attacks.
   */
  spawnSlashArc(x, y, dir, radius, color) {
    const gfx = this.scene.add.graphics();
    gfx.setDepth(GAME_CONFIG.layers.foregroundDecor);

    const startAngle = dir > 0 ? -1.2 : Math.PI - 0.8;
    const endAngle = startAngle + 2.0;

    gfx.lineStyle(2, color, 0.9);
    gfx.beginPath();
    gfx.arc(x, y, radius, startAngle, endAngle);
    gfx.strokePath();

    this.scene.tweens.add({
      targets: gfx,
      alpha: 0,
      duration: 150,
      onComplete: () => gfx.destroy(),
    });
  }

  /**
   * Warrior combo slash — escalating size and drama per hit.
   * Hit 1: side slash, Hit 2: reverse backhand, Hit 3: massive overhead finisher.
   */
  spawnWarriorComboSlash(owner, dir, combo, color) {
    const cx = owner.x + dir * 16;
    const cy = owner.groundY - 16;

    if (combo === 0) {
      // Hit 1 — wide horizontal slash
      const gfx = this.scene.add.graphics();
      gfx.setDepth(GAME_CONFIG.layers.foregroundDecor);
      gfx.lineStyle(3, 0xeeeeff, 0.95);
      const start = dir > 0 ? -0.8 : Math.PI - 1.2;
      gfx.beginPath();
      gfx.arc(cx, cy, 20, start, start + 2.0);
      gfx.strokePath();
      // Secondary thinner trail
      gfx.lineStyle(1, color, 0.6);
      gfx.beginPath();
      gfx.arc(cx, cy, 22, start + 0.2, start + 1.8);
      gfx.strokePath();

      this.scene.tweens.add({
        targets: gfx, alpha: 0, duration: 180,
        onComplete: () => gfx.destroy(),
      });

      // Small spark particles
      const sparks = this.scene.add.particles(cx, cy, 'vfx_pixel', {
        speed: { min: 20, max: 40 },
        angle: dir > 0 ? { min: -40, max: 40 } : { min: 140, max: 220 },
        lifespan: 150, tint: 0xccccdd,
        alpha: { start: 0.8, end: 0 },
        emitting: false,
      });
      sparks.setDepth(GAME_CONFIG.layers.foregroundDecor);
      sparks.explode(4);
      this.scene.time.delayedCall(200, () => sparks.destroy());

    } else if (combo === 1) {
      // Hit 2 — reverse backhand, bigger arc + wind trail
      const gfx = this.scene.add.graphics();
      gfx.setDepth(GAME_CONFIG.layers.foregroundDecor);
      // Main arc (reversed direction for backhand feel)
      gfx.lineStyle(3, 0xffffff, 1.0);
      const start = dir > 0 ? 0.5 : Math.PI - 2.5;
      gfx.beginPath();
      gfx.arc(cx - dir * 4, cy - 2, 24, start, start + 2.4);
      gfx.strokePath();
      // Outer glow
      gfx.lineStyle(2, color, 0.5);
      gfx.beginPath();
      gfx.arc(cx - dir * 4, cy - 2, 27, start + 0.3, start + 2.1);
      gfx.strokePath();

      this.scene.tweens.add({
        targets: gfx, alpha: 0, duration: 200,
        onComplete: () => gfx.destroy(),
      });

      // Wind trail particles
      const wind = this.scene.add.particles(cx, cy, 'vfx_pixel', {
        speed: { min: 30, max: 60 },
        angle: dir > 0 ? { min: -50, max: 50 } : { min: 130, max: 230 },
        lifespan: 200, tint: 0xaabbcc,
        alpha: { start: 0.7, end: 0 },
        emitting: false,
      });
      wind.setDepth(GAME_CONFIG.layers.foregroundDecor);
      wind.explode(6);
      this.scene.time.delayedCall(250, () => wind.destroy());

      // Small screen shake for impact
      this.scene.cameras.main.shake(50, 0.002);

    } else {
      // Hit 3 — MASSIVE overhead finisher, multiple layered arcs
      const gfx = this.scene.add.graphics();
      gfx.setDepth(GAME_CONFIG.layers.foregroundDecor);

      // Thick white core arc
      gfx.lineStyle(4, 0xffffff, 1.0);
      const start = dir > 0 ? -1.8 : Math.PI - 1.0;
      gfx.beginPath();
      gfx.arc(cx + dir * 4, cy - 4, 30, start, start + 2.8);
      gfx.strokePath();

      // Blue-white outer glow
      gfx.lineStyle(2, 0x88bbff, 0.7);
      gfx.beginPath();
      gfx.arc(cx + dir * 4, cy - 4, 34, start + 0.2, start + 2.6);
      gfx.strokePath();

      // Inner hot core
      gfx.lineStyle(2, 0xffeedd, 0.6);
      gfx.beginPath();
      gfx.arc(cx + dir * 4, cy - 4, 26, start + 0.4, start + 2.4);
      gfx.strokePath();

      this.scene.tweens.add({
        targets: gfx, alpha: 0, duration: 250,
        onComplete: () => gfx.destroy(),
      });

      // Horizontal slash line extending far
      const line = this.scene.add.graphics();
      line.setDepth(GAME_CONFIG.layers.foregroundDecor);
      line.lineStyle(2, 0xffffff, 0.8);
      line.beginPath();
      line.moveTo(owner.x - dir * 5, cy);
      line.lineTo(owner.x + dir * 45, cy);
      line.strokePath();
      this.scene.tweens.add({
        targets: line, alpha: 0, duration: 200,
        onComplete: () => line.destroy(),
      });

      // Big particle burst
      const burst = this.scene.add.particles(cx, cy, 'vfx_pixel_4', {
        speed: { min: 40, max: 90 },
        angle: dir > 0 ? { min: -60, max: 60 } : { min: 120, max: 240 },
        lifespan: 300, tint: 0xccddff,
        alpha: { start: 1, end: 0 },
        gravityY: 40,
        emitting: false,
      });
      burst.setDepth(GAME_CONFIG.layers.foregroundDecor);
      burst.explode(10);
      this.scene.time.delayedCall(350, () => burst.destroy());

      // Screen shake — big impact
      this.scene.cameras.main.shake(120, 0.005);
    }
  }

  /**
   * Three short parallel scratch lines — imp attacks.
   */
  spawnScratchMarks(x, y, dir, color) {
    for (let i = -1; i <= 1; i++) {
      const gfx = this.scene.add.graphics();
      gfx.setDepth(GAME_CONFIG.layers.foregroundDecor);
      gfx.lineStyle(1, color, 0.8);
      gfx.beginPath();
      gfx.moveTo(x + dir * 2, y + i * 3 - 2);
      gfx.lineTo(x + dir * 6, y + i * 3 + 2);
      gfx.strokePath();

      this.scene.tweens.add({
        targets: gfx,
        alpha: 0,
        duration: 120,
        onComplete: () => gfx.destroy(),
      });
    }
  }

  /**
   * Small white burst at the point of damage.
   */
  spawnImpactFlash(x, y) {
    const flash = this.scene.add.circle(x, y, 3, 0xffffff, 0.9);
    flash.setDepth(GAME_CONFIG.layers.foregroundDecor);

    this.scene.tweens.add({
      targets: flash,
      scaleX: 2.5,
      scaleY: 2.5,
      alpha: 0,
      duration: 100,
      onComplete: () => flash.destroy(),
    });
  }

  /**
   * Comical blood burst — sprays particles in all directions with gravity.
   * Scales with damage for even more ridiculous splatter on big hits.
   */
  spawnBloodBurst(x, y, damage, entity) {
    // Scale particle count with damage — minimum 12, caps at 40
    const baseCount = 15;
    const bonusCount = Math.min(25, Math.floor(damage * 0.5));
    const totalCount = baseCount + bonusCount;

    // Main blood spray — big droplets flying everywhere
    const bloodBig = this.scene.add.particles(x, y, 'vfx_blood', {
      speed: { min: 30, max: 100 },
      angle: { min: 0, max: 360 },
      lifespan: { min: 300, max: 600 },
      gravityY: 120,
      alpha: { start: 1, end: 0.6 },
      scale: { start: 1.2, end: 0.4 },
      emitting: false,
    });
    bloodBig.setDepth(GAME_CONFIG.layers.foregroundDecor);
    bloodBig.explode(totalCount);
    this.scene.time.delayedCall(700, () => bloodBig.destroy());

    // Smaller blood specks — faster, more scattered
    const bloodSmall = this.scene.add.particles(x, y, 'vfx_blood_sm', {
      speed: { min: 50, max: 140 },
      angle: { min: 0, max: 360 },
      lifespan: { min: 200, max: 500 },
      gravityY: 150,
      alpha: { start: 0.9, end: 0.3 },
      emitting: false,
    });
    bloodSmall.setDepth(GAME_CONFIG.layers.foregroundDecor);
    bloodSmall.explode(Math.floor(totalCount * 0.8));
    this.scene.time.delayedCall(600, () => bloodSmall.destroy());

    // Upward spray — blood arcing up like a fountain
    const bloodUp = this.scene.add.particles(x, y - 4, 'vfx_blood', {
      speed: { min: 40, max: 80 },
      angle: { min: 230, max: 310 },
      lifespan: { min: 400, max: 700 },
      gravityY: 100,
      alpha: { start: 1, end: 0.4 },
      scale: { start: 1, end: 0.6 },
      emitting: false,
    });
    bloodUp.setDepth(GAME_CONFIG.layers.foregroundDecor);
    bloodUp.explode(Math.floor(totalCount * 0.5));
    this.scene.time.delayedCall(800, () => bloodUp.destroy());

    // Blood splatter decals on the ground — small red circles that linger
    const splatterCount = Math.min(8, 3 + Math.floor(damage * 0.2));
    for (let i = 0; i < splatterCount; i++) {
      const sx = x + Phaser.Math.Between(-20, 20);
      const sy = (entity.groundY || y + 10) + Phaser.Math.Between(-2, 4);
      const radius = Phaser.Math.Between(1, 3);
      const splat = this.scene.add.circle(sx, sy, radius, 0x991111, 0.7);
      splat.setDepth(GAME_CONFIG.layers.groundDecor + sy);

      // Splats fade over a few seconds
      this.scene.tweens.add({
        targets: splat,
        alpha: 0,
        duration: Phaser.Math.Between(3000, 6000),
        delay: Phaser.Math.Between(500, 1500),
        onComplete: () => splat.destroy(),
      });
    }
  }

  /**
   * Warrior Mega Slash — wide horizontal slash line + shockwave trail.
   */
  spawnMegaSlash(player) {
    const dir = player.facingRight ? 1 : -1;
    const cx = player.x;
    const cy = player.groundY - 14;

    // Wide horizontal slash line
    const gfx = this.scene.add.graphics();
    gfx.setDepth(GAME_CONFIG.layers.foregroundDecor);
    gfx.lineStyle(3, 0xffffff, 1.0);
    gfx.beginPath();
    gfx.moveTo(cx, cy);
    gfx.lineTo(cx + dir * 50, cy);
    gfx.strokePath();

    // Secondary thinner line slightly offset
    gfx.lineStyle(1, 0x88ccff, 0.7);
    gfx.beginPath();
    gfx.moveTo(cx, cy - 3);
    gfx.lineTo(cx + dir * 45, cy - 3);
    gfx.strokePath();
    gfx.beginPath();
    gfx.moveTo(cx, cy + 3);
    gfx.lineTo(cx + dir * 45, cy + 3);
    gfx.strokePath();

    this.scene.tweens.add({
      targets: gfx,
      alpha: 0,
      duration: 250,
      onComplete: () => gfx.destroy(),
    });

    // Shockwave particles trailing the slash direction
    const particles = this.scene.add.particles(cx + dir * 25, cy, 'vfx_pixel', {
      speed: { min: 30, max: 60 },
      angle: dir > 0 ? { min: -30, max: 30 } : { min: 150, max: 210 },
      lifespan: 300,
      tint: 0xccddff,
      alpha: { start: 0.9, end: 0 },
      emitting: false,
    });
    particles.setDepth(GAME_CONFIG.layers.foregroundDecor);
    particles.explode(8);
    this.scene.time.delayedCall(350, () => particles.destroy());
  }

  /**
   * Warrior Shield Bash — shockwave ring + radial force lines.
   */
  spawnShieldBashWave(player) {
    const dir = player.facingRight ? 1 : -1;
    const cx = player.x + dir * 10;
    const cy = player.groundY - 10;

    // Expanding ring
    const ring = this.scene.add.circle(cx, cy, 6, 0x88aaff, 0.6);
    ring.setDepth(GAME_CONFIG.layers.foregroundDecor);
    this.scene.tweens.add({
      targets: ring,
      scaleX: 3.5,
      scaleY: 3.5,
      alpha: 0,
      duration: 250,
      onComplete: () => ring.destroy(),
    });

    // Radial force lines
    for (let a = -0.6; a <= 0.6; a += 0.6) {
      const gfx = this.scene.add.graphics();
      gfx.setDepth(GAME_CONFIG.layers.foregroundDecor);
      gfx.lineStyle(2, 0xaaccff, 0.7);
      const angle = (dir > 0 ? 0 : Math.PI) + a;
      gfx.beginPath();
      gfx.moveTo(cx, cy);
      gfx.lineTo(cx + Math.cos(angle) * 12, cy + Math.sin(angle) * 6);
      gfx.strokePath();

      this.scene.tweens.add({
        targets: gfx,
        alpha: 0,
        x: Math.cos(angle) * 8,
        y: Math.sin(angle) * 4,
        duration: 200,
        onComplete: () => gfx.destroy(),
      });
    }
  }

  /**
   * Warrior Shield Charge — directional shockwave + impact ring on arrival.
   */
  spawnShieldChargeImpact(player) {
    const dir = player.facingRight ? 1 : -1;
    const x = player.x + dir * 6;
    const y = player.groundY - 10;

    // Expanding impact ring
    const ring = this.scene.add.circle(x, y, 6, 0x88aaff, 0.7);
    ring.setDepth(GAME_CONFIG.layers.foregroundDecor);
    this.scene.tweens.add({
      targets: ring,
      scaleX: 4,
      scaleY: 2,
      alpha: 0,
      duration: 300,
      onComplete: () => ring.destroy(),
    });

    // Directional force particles
    const particles = this.scene.add.particles(x, y, 'vfx_pixel_4', {
      speed: { min: 40, max: 80 },
      angle: dir > 0 ? { min: -20, max: 20 } : { min: 160, max: 200 },
      lifespan: 250,
      tint: 0xaaccff,
      alpha: { start: 0.9, end: 0 },
      emitting: false,
    });
    particles.setDepth(GAME_CONFIG.layers.foregroundDecor);
    particles.explode(8);
    this.scene.time.delayedCall(300, () => particles.destroy());

    this.spawnImpactFlash(x, y);
  }

  /**
   * Priest Holy Light — vertical beam on lowest HP ally + green sparkles.
   */
  spawnHolyLight(player) {
    // Find heal target (lowest HP party member)
    const party = this.scene.getPartyMembers();
    const target = party.reduce((low, m) => {
      if (m.hp <= 0) return low;
      return (!low || m.hp < low.hp) ? m : low;
    }, null);
    if (!target) return;

    const tx = target.x;
    const ty = target.groundY;

    // Vertical light beam
    const gfx = this.scene.add.graphics();
    gfx.setDepth(GAME_CONFIG.layers.foregroundDecor);
    gfx.fillStyle(0xffffaa, 0.6);
    gfx.fillRect(tx - 2, ty - 44, 4, 34);

    this.scene.tweens.add({
      targets: gfx,
      alpha: 0,
      y: 4,
      duration: 400,
      onComplete: () => gfx.destroy(),
    });

    // Green heal sparkles
    this.spawnHealGlow(tx, ty - 16);
  }

  /**
   * Expanding ring — used for Priest Divine Nova and Mage spells.
   */
  spawnNovaRing(x, y, color) {
    // Outer ring
    const ring = this.scene.add.circle(x, y, 20, color, 0.0);
    ring.setStrokeStyle(2, color, 0.8);
    ring.setDepth(GAME_CONFIG.layers.foregroundDecor);
    ring.setScale(0.2);

    this.scene.tweens.add({
      targets: ring,
      scaleX: 2.2,
      scaleY: 2.2,
      alpha: 0,
      duration: 350,
      onComplete: () => ring.destroy(),
    });

    // Inner glow ring (slightly delayed)
    this.scene.time.delayedCall(50, () => {
      const inner = this.scene.add.circle(x, y, 20, color, 0.15);
      inner.setDepth(GAME_CONFIG.layers.foregroundDecor);
      inner.setScale(0.15);

      this.scene.tweens.add({
        targets: inner,
        scaleX: 1.6,
        scaleY: 1.6,
        alpha: 0,
        duration: 300,
        onComplete: () => inner.destroy(),
      });
    });

    // Heal sparkles on each party member if it's a heal nova
    if (color === 0xffdd44) {
      const party = this.scene.getPartyMembers();
      for (const member of party) {
        if (member.hp <= 0) continue;
        this.spawnHealGlow(member.x, member.groundY - 16);
      }
    }
  }

  /**
   * Warrior Heroic Leap — ground slam ring + dust particles.
   */
  spawnLeapImpact(player) {
    const x = player.x;
    const y = player.groundY;

    // Large expanding ground ring
    const ring = this.scene.add.circle(x, y, 8, 0xffaa44, 0.0);
    ring.setStrokeStyle(3, 0xffaa44, 0.9);
    ring.setDepth(GAME_CONFIG.layers.foregroundDecor);

    this.scene.tweens.add({
      targets: ring,
      scaleX: 5,
      scaleY: 2.5,
      alpha: 0,
      duration: 400,
      onComplete: () => ring.destroy(),
    });

    // Dust/debris particles
    const dust = this.scene.add.particles(x, y, 'vfx_pixel_4', {
      speed: { min: 30, max: 70 },
      angle: { min: 180, max: 360 },
      lifespan: 350,
      tint: 0xccaa88,
      alpha: { start: 0.8, end: 0 },
      gravityY: 60,
      emitting: false,
    });
    dust.setDepth(GAME_CONFIG.layers.foregroundDecor);
    dust.explode(10);
    this.scene.time.delayedCall(400, () => dust.destroy());

    // Central impact flash
    this.spawnImpactFlash(x, y - 4);
  }

  /**
   * Rogue Dagger Flurry — 5 rapid slash arcs in sequence.
   */
  spawnDaggerFlurry(player) {
    const dir = player.facingRight ? 1 : -1;
    const cx = player.x + dir * 12;
    const cy = player.groundY - 14;

    for (let i = 0; i < 5; i++) {
      this.scene.time.delayedCall(i * 60, () => {
        const gfx = this.scene.add.graphics();
        gfx.setDepth(GAME_CONFIG.layers.foregroundDecor);

        const radius = i === 4 ? 10 : 6;
        const angle = dir > 0
          ? -1.0 + (i % 2 === 0 ? 0 : 1.0)
          : Math.PI - 0.5 + (i % 2 === 0 ? 0 : 1.0);

        gfx.lineStyle(2, 0x88ccff, 0.9);
        gfx.beginPath();
        gfx.arc(cx + (i % 2) * dir * 3, cy + (i % 2) * 3 - 2, radius, angle, angle + 1.4);
        gfx.strokePath();

        this.scene.tweens.add({
          targets: gfx,
          alpha: 0,
          duration: 100,
          onComplete: () => gfx.destroy(),
        });
      });
    }

    // Final impact flash on the 5th hit
    this.scene.time.delayedCall(280, () => {
      this.spawnImpactFlash(cx, cy);
    });
  }

  /**
   * Rogue Shadow Strike — vanish smoke, shadow trail, impact burst.
   */
  spawnShadowStrike(player) {
    const startX = player.x;
    const startY = player.groundY;

    // 1. Vanish smoke at current position
    const smoke = this.scene.add.particles(startX, startY - 12, 'vfx_pixel_4', {
      speed: { min: 15, max: 30 },
      lifespan: 300,
      tint: 0x332255,
      alpha: { start: 0.7, end: 0 },
      emitting: false,
    });
    smoke.setDepth(GAME_CONFIG.layers.foregroundDecor);
    smoke.explode(8);
    this.scene.time.delayedCall(350, () => smoke.destroy());

    // 2. Shadow afterimage trail (3 fading copies)
    const dir = player.facingRight ? 1 : -1;
    for (let i = 1; i <= 3; i++) {
      const ax = startX + dir * i * 16;
      const afterimage = this.scene.add.rectangle(ax, startY - 12, 8, 18, 0x442266, 0.5 / i);
      afterimage.setDepth(GAME_CONFIG.layers.foregroundDecor);

      this.scene.tweens.add({
        targets: afterimage,
        alpha: 0,
        duration: 250,
        delay: i * 30,
        onComplete: () => afterimage.destroy(),
      });
    }

    // 3. Impact burst at destination (delayed to match teleport timing)
    this.scene.time.delayedCall(150, () => {
      const impactX = startX + dir * 60;
      const impactY = startY - 12;

      // Purple slash arc
      const gfx = this.scene.add.graphics();
      gfx.setDepth(GAME_CONFIG.layers.foregroundDecor);
      gfx.lineStyle(3, 0x9966cc, 0.9);
      const angle = dir > 0 ? -1.5 : Math.PI - 0.8;
      gfx.beginPath();
      gfx.arc(impactX, impactY, 14, angle, angle + 2.6);
      gfx.strokePath();

      this.scene.tweens.add({
        targets: gfx,
        alpha: 0,
        duration: 200,
        onComplete: () => gfx.destroy(),
      });

      // Impact flash
      this.spawnImpactFlash(impactX, impactY);

      // Dark particles
      const burst = this.scene.add.particles(impactX, impactY, 'vfx_pixel', {
        speed: { min: 20, max: 45 },
        lifespan: 250,
        tint: 0x9966cc,
        alpha: { start: 0.8, end: 0 },
        emitting: false,
      });
      burst.setDepth(GAME_CONFIG.layers.foregroundDecor);
      burst.explode(6);
      this.scene.time.delayedCall(300, () => burst.destroy());
    });
  }

  /**
   * Green sparkle particles — heals.
   */
  spawnHealGlow(x, y) {
    const particles = this.scene.add.particles(x, y, 'vfx_circle', {
      speed: { min: 8, max: 18 },
      lifespan: 400,
      tint: 0x44ff44,
      alpha: { start: 0.8, end: 0 },
      gravityY: -20,
      emitting: false,
    });
    particles.setDepth(GAME_CONFIG.layers.foregroundDecor);
    particles.explode(6);
    this.scene.time.delayedCall(450, () => particles.destroy());
  }

  /**
   * Thin beam line from healer to target.
   */
  spawnHealBeam(sx, sy, tx, ty) {
    const gfx = this.scene.add.graphics();
    gfx.setDepth(GAME_CONFIG.layers.foregroundDecor);
    gfx.lineStyle(1, 0x44cc44, 0.5);
    gfx.beginPath();
    gfx.moveTo(sx, sy);
    gfx.lineTo(tx, ty);
    gfx.strokePath();

    this.scene.tweens.add({
      targets: gfx,
      alpha: 0,
      duration: 300,
      onComplete: () => gfx.destroy(),
    });
  }

  /**
   * Priest holy beams — multiple thin lines from caster to target with sparkle on hit.
   */
  spawnHolyBeams(source, target, color, beamCount) {
    const sx = source.x;
    const sy = source.groundY - 16;
    const tx = target.x;
    const ty = target.groundY - 12;

    for (let i = 0; i < beamCount; i++) {
      // Offset each beam slightly for a multi-ray look
      const offsetY = (i - Math.floor(beamCount / 2)) * 3;
      const offsetX = (i - Math.floor(beamCount / 2)) * 2;

      const gfx = this.scene.add.graphics();
      gfx.setDepth(GAME_CONFIG.layers.foregroundDecor);

      // Core beam — bright thin line
      gfx.lineStyle(1, 0xffffff, 0.9);
      gfx.beginPath();
      gfx.moveTo(sx, sy + offsetY);
      gfx.lineTo(tx + offsetX, ty + offsetY);
      gfx.strokePath();

      // Glow beam — wider, colored, semi-transparent
      gfx.lineStyle(2, color, 0.4);
      gfx.beginPath();
      gfx.moveTo(sx, sy + offsetY);
      gfx.lineTo(tx + offsetX, ty + offsetY);
      gfx.strokePath();

      // Stagger the fade for a flickering effect
      this.scene.tweens.add({
        targets: gfx,
        alpha: 0,
        duration: 200 + i * 40,
        delay: i * 30,
        onComplete: () => gfx.destroy(),
      });
    }

    // Sparkle burst at the impact point on each target
    const sparkle = this.scene.add.particles(tx, ty, 'vfx_circle', {
      speed: { min: 10, max: 25 },
      angle: { min: 0, max: 360 },
      lifespan: 250,
      tint: color,
      alpha: { start: 0.9, end: 0 },
      scale: { start: 0.8, end: 0.2 },
      emitting: false,
    });
    sparkle.setDepth(GAME_CONFIG.layers.foregroundDecor);
    sparkle.explode(4);
    this.scene.time.delayedCall(300, () => sparkle.destroy());

    // Small flash at source (caster's hands)
    const flash = this.scene.add.circle(sx, sy, 2, 0xffffff, 0.8);
    flash.setDepth(GAME_CONFIG.layers.foregroundDecor);
    this.scene.tweens.add({
      targets: flash,
      scaleX: 2, scaleY: 2, alpha: 0,
      duration: 150,
      onComplete: () => flash.destroy(),
    });
  }

  /**
   * Priest Divine Ascension — arcing healing orb from caster to ally.
   * A glowing yellow/white blob arcs through the air and bursts on the target.
   */
  spawnHealingBlob(source, target, healAmount) {
    const sx = source.x;
    const sy = source.groundY - source.jumpZ - 12;
    const tx = target.x;
    const ty = target.groundY - 12;

    // Create the orb — glowing circle
    const orb = this.scene.add.circle(sx, sy, 4, 0xffffaa, 0.9);
    orb.setDepth(GAME_CONFIG.layers.foregroundDecor + 10);

    // Inner bright core
    const core = this.scene.add.circle(sx, sy, 2, 0xffffff, 1);
    core.setDepth(GAME_CONFIG.layers.foregroundDecor + 11);

    // Trailing sparkle particles that follow the orb
    const trail = this.scene.add.particles(sx, sy, 'vfx_circle', {
      speed: { min: 5, max: 15 },
      lifespan: 200,
      tint: 0xffffaa,
      alpha: { start: 0.7, end: 0 },
      scale: { start: 0.6, end: 0.1 },
      frequency: 30,
      emitting: true,
    });
    trail.setDepth(GAME_CONFIG.layers.foregroundDecor + 9);

    // Arc from source to target
    const dx = tx - sx;
    const dist = Math.abs(dx);
    const duration = Math.max(300, Math.min(600, dist * 3));
    const arcHeight = 25 + Math.random() * 15;
    const midX = sx + dx * 0.5;
    const midY = Math.min(sy, ty) - arcHeight;

    // Use a counter tween to animate along a parabolic path
    const tweenObj = { t: 0 };
    this.scene.tweens.add({
      targets: tweenObj,
      t: 1,
      duration: duration,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const t = tweenObj.t;
        // Quadratic bezier: S -> M -> T
        const mt = 1 - t;
        const px = mt * mt * sx + 2 * mt * t * midX + t * t * tx;
        const py = mt * mt * sy + 2 * mt * t * midY + t * t * ty;
        orb.setPosition(px, py);
        core.setPosition(px, py);
        trail.setPosition(px, py);

        // Pulse the orb size
        const pulse = 1 + Math.sin(t * Math.PI * 4) * 0.2;
        orb.setScale(pulse);
      },
      onComplete: () => {
        // Burst on arrival
        orb.destroy();
        core.destroy();
        trail.stop();
        this.scene.time.delayedCall(250, () => trail.destroy());

        // Heal sparkle burst at target
        this.spawnHealGlow(tx, ty);

        // Expanding ring at impact
        const ring = this.scene.add.circle(tx, ty, 6, 0xffffaa, 0.6);
        ring.setDepth(GAME_CONFIG.layers.foregroundDecor);
        this.scene.tweens.add({
          targets: ring,
          scaleX: 2.5, scaleY: 2.5, alpha: 0,
          duration: 250,
          onComplete: () => ring.destroy(),
        });
      },
    });
  }

  /**
   * Priest healing lightning — jagged bolt from caster to ally with sparkle burst.
   */
  spawnHealLightning(source, target) {
    const sx = source.x;
    const sy = source.groundY - source.jumpZ - 8;
    const tx = target.x;
    const ty = target.groundY - 12;

    // Build jagged lightning path
    const gfx = this.scene.add.graphics();
    gfx.setDepth(GAME_CONFIG.layers.foregroundDecor + 10);

    const segments = 8;
    const dx = tx - sx;
    const dy = ty - sy;

    // Core bolt — bright white
    gfx.lineStyle(2, 0xffffff, 1.0);
    gfx.beginPath();
    gfx.moveTo(sx, sy);
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const px = sx + dx * t + Phaser.Math.Between(-8, 8);
      const py = sy + dy * t + Phaser.Math.Between(-6, 6);
      gfx.lineTo(px, py);
    }
    gfx.lineTo(tx, ty);
    gfx.strokePath();

    // Outer glow bolt — yellow, thicker
    gfx.lineStyle(4, 0xffffaa, 0.4);
    gfx.beginPath();
    gfx.moveTo(sx, sy);
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const px = sx + dx * t + Phaser.Math.Between(-10, 10);
      const py = sy + dy * t + Phaser.Math.Between(-8, 8);
      gfx.lineTo(px, py);
    }
    gfx.lineTo(tx, ty);
    gfx.strokePath();

    // Flash and fade
    this.scene.tweens.add({
      targets: gfx,
      alpha: 0,
      duration: 150,
      onComplete: () => gfx.destroy(),
    });

    // Impact sparkle on the healed target
    const sparkle = this.scene.add.particles(tx, ty, 'vfx_circle', {
      speed: { min: 12, max: 30 },
      angle: { min: 200, max: 340 },
      lifespan: 300,
      tint: 0xffffaa,
      alpha: { start: 0.9, end: 0 },
      scale: { start: 0.7, end: 0.1 },
      emitting: false,
    });
    sparkle.setDepth(GAME_CONFIG.layers.foregroundDecor);
    sparkle.explode(5);
    this.scene.time.delayedCall(350, () => sparkle.destroy());

    // Flash at target
    const flash = this.scene.add.circle(tx, ty, 4, 0xffffcc, 0.8);
    flash.setDepth(GAME_CONFIG.layers.foregroundDecor);
    this.scene.tweens.add({
      targets: flash,
      scaleX: 2, scaleY: 2, alpha: 0,
      duration: 120,
      onComplete: () => flash.destroy(),
    });

    // Heal number
    this.spawnHealGlow(tx, ty);
  }

  destroy() {
    this.scene.events.off('hitboxActive', this.onHitboxActive, this);
    this.scene.events.off('enemyAttack', this.onEnemyAttack, this);
    this.scene.events.off('aiAttack', this.onAIAttack, this);
    this.scene.events.off('playerSpecial', this.onPlayerSpecial, this);
    this.scene.events.off('aiHeal', this.onAIHeal, this);
    this.scene.events.off('entityDamaged', this.onEntityDamaged, this);
    this.scene.events.off('priestBeam', this.onPriestBeam, this);
    this.scene.events.off('priestHealBlob', this.onPriestHealBlob, this);
    this.scene.events.off('priestHealLightning', this.onPriestHealLightning, this);
  }
}
