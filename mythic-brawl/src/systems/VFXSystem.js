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
  mage: 0xaa66ff,      // arcane purple — combo attacks glow purple
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
    scene.events.on('enemyWindup', this.onEnemyWindup, this);
    scene.events.on('aiAttack', this.onAIAttack, this);
    scene.events.on('playerSpecial', this.onPlayerSpecial, this);
    scene.events.on('aiHeal', this.onAIHeal, this);
    scene.events.on('entityDamaged', this.onEntityDamaged, this);
    scene.events.on('priestBeam', this.onPriestBeam, this);
    scene.events.on('priestHealBlob', this.onPriestHealBlob, this);
    scene.events.on('priestHealLightning', this.onPriestHealLightning, this);
    scene.events.on('meteorImpact', this.onMeteorImpact, this);
    scene.events.on('chainLightning', this.onChainLightning, this);
    scene.events.on('timeWarp', this.onTimeWarp, this);
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
    const baseKey = enemy.enemyKey.replace(/^(frozen_|forge_|temple_)/, '');

    if (baseKey === 'imp' || baseKey === 'wraith' || baseKey === 'murloc') {
      this.spawnImpSwipe(enemy, cx, cy, dir, color);
    } else if (baseKey === 'hellknight' || baseKey === 'golem' || baseKey === 'naga') {
      this.spawnHeavySlam(enemy, cx, cy, dir, color);
    } else {
      // Boss attacks
      this.spawnBossCleave(enemy, cx, cy, dir, color);
    }
  }

  onEnemyWindup(data) {
    if (!this.scene) return;
    const { enemy, duration } = data;
    if (!enemy || enemy.dead) return;
    const baseKey = enemy.enemyKey.replace(/^(frozen_|forge_|temple_)/, '');

    if (baseKey === 'imp' || baseKey === 'wraith' || baseKey === 'murloc') {
      this.spawnSmallTelegraph(enemy, duration);
    } else if (baseKey === 'hellknight' || baseKey === 'golem' || baseKey === 'naga') {
      this.spawnHeavyTelegraph(enemy, duration);
    } else {
      this.spawnBossTelegraph(enemy, duration);
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
      this.spawnShotgunBlast(player);
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
    } else if (cls === 'mage' && key === 'special1') {
      this.spawnArcaneMissiles(player);
    } else if (cls === 'mage' && key === 'special2') {
      this.spawnCometCrash(player);
    } else if (cls === 'mage' && key === 'special3') {
      this.spawnBlinkEffect(player);
    } else if (cls === 'mage' && key === 'special4') {
      this.spawnFrostNova(player);
    } else if (cls === 'mage' && key === 'special5') {
      // Disintegrate beam handled in update loop VFX
      this.spawnDisintegrateStart(player);
    } else if (cls === 'mage' && key === 'special7') {
      // Chain lightning VFX handled by chainLightning event
    } else if (cls === 'mage' && key === 'special8') {
      // Time Warp handled by timeWarp event
    } else if (cls === 'mage') {
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
      // Hit 1 — BIG horizontal slash
      const gfx = this.scene.add.graphics();
      gfx.setDepth(GAME_CONFIG.layers.foregroundDecor);
      gfx.lineStyle(4, 0xeeeeff, 0.95);
      const start = dir > 0 ? -0.8 : Math.PI - 1.2;
      gfx.beginPath();
      gfx.arc(cx, cy, 30, start, start + 2.2);
      gfx.strokePath();
      // Secondary thinner trail
      gfx.lineStyle(2, color, 0.6);
      gfx.beginPath();
      gfx.arc(cx, cy, 34, start + 0.2, start + 2.0);
      gfx.strokePath();

      this.scene.tweens.add({
        targets: gfx, alpha: 0, duration: 200,
        onComplete: () => gfx.destroy(),
      });

      // Spark particles
      const sparks = this.scene.add.particles(cx, cy, 'vfx_pixel', {
        speed: { min: 30, max: 60 },
        angle: dir > 0 ? { min: -40, max: 40 } : { min: 140, max: 220 },
        lifespan: 200, tint: 0xccccdd,
        alpha: { start: 0.9, end: 0 },
        emitting: false,
      });
      sparks.setDepth(GAME_CONFIG.layers.foregroundDecor);
      sparks.explode(6);
      this.scene.time.delayedCall(250, () => sparks.destroy());

      // Screen shake on every hit
      this.scene.cameras.main.shake(60, 0.003);

    } else if (combo === 1) {
      // Hit 2 — reverse backhand, even bigger arc + wind trail
      const gfx = this.scene.add.graphics();
      gfx.setDepth(GAME_CONFIG.layers.foregroundDecor);
      // Main arc (reversed direction for backhand feel)
      gfx.lineStyle(4, 0xffffff, 1.0);
      const start = dir > 0 ? 0.5 : Math.PI - 2.5;
      gfx.beginPath();
      gfx.arc(cx - dir * 4, cy - 2, 34, start, start + 2.6);
      gfx.strokePath();
      // Outer glow
      gfx.lineStyle(2, color, 0.5);
      gfx.beginPath();
      gfx.arc(cx - dir * 4, cy - 2, 38, start + 0.3, start + 2.3);
      gfx.strokePath();

      this.scene.tweens.add({
        targets: gfx, alpha: 0, duration: 220,
        onComplete: () => gfx.destroy(),
      });

      // Wind trail particles
      const wind = this.scene.add.particles(cx, cy, 'vfx_pixel', {
        speed: { min: 40, max: 80 },
        angle: dir > 0 ? { min: -50, max: 50 } : { min: 130, max: 230 },
        lifespan: 250, tint: 0xaabbcc,
        alpha: { start: 0.8, end: 0 },
        emitting: false,
      });
      wind.setDepth(GAME_CONFIG.layers.foregroundDecor);
      wind.explode(8);
      this.scene.time.delayedCall(300, () => wind.destroy());

      // Screen shake for impact
      this.scene.cameras.main.shake(80, 0.004);

    } else {
      // Hit 3 — GROUND SLAM FINISHER — sword smashes into the earth
      const slamX = owner.x + dir * 20;
      const slamY = owner.groundY;

      // ── Impact flash (white circle that expands and fades) ──
      const flash = this.scene.add.graphics();
      flash.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
      flash.fillStyle(0xffffff, 0.9);
      flash.fillCircle(slamX, slamY - 8, 8);
      this.scene.tweens.add({
        targets: flash,
        scaleX: 6, scaleY: 3,
        alpha: 0,
        duration: 300,
        ease: 'Power2',
        onComplete: () => flash.destroy(),
      });

      // ── Ground crack lines radiating outward ──
      const crackColors = [0xffddaa, 0xffcc77, 0xeebb66];
      for (let i = 0; i < 10; i++) {
        const crack = this.scene.add.graphics();
        crack.setDepth(GAME_CONFIG.layers.foregroundDecor);
        const angle = (i / 10) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const len = 20 + Math.random() * 40;
        const endX = slamX + Math.cos(angle) * len;
        const endY = slamY + Math.sin(angle) * len * 0.4; // Flatten for 2.5D
        const midX = slamX + Math.cos(angle) * len * 0.5 + (Math.random() - 0.5) * 8;
        const midY = slamY + Math.sin(angle) * len * 0.25 + (Math.random() - 0.5) * 3;

        const clr = crackColors[Math.floor(Math.random() * crackColors.length)];
        crack.lineStyle(2, clr, 0.9);
        crack.beginPath();
        crack.moveTo(slamX, slamY);
        crack.lineTo(midX, midY);
        crack.lineTo(endX, endY);
        crack.strokePath();

        // Glow line underneath
        crack.lineStyle(4, 0xff8833, 0.3);
        crack.beginPath();
        crack.moveTo(slamX, slamY);
        crack.lineTo(midX, midY);
        crack.lineTo(endX, endY);
        crack.strokePath();

        this.scene.tweens.add({
          targets: crack,
          alpha: 0,
          duration: 500 + Math.random() * 300,
          delay: 50,
          onComplete: () => crack.destroy(),
        });
      }

      // ── Rock/debris chunks flying upward ──
      const rockColors = [0x887766, 0x665544, 0x998877, 0x554433, 0xaa9988];
      for (let i = 0; i < 14; i++) {
        const rock = this.scene.add.graphics();
        rock.setDepth(GAME_CONFIG.layers.foregroundDecor + 2);
        const rc = rockColors[Math.floor(Math.random() * rockColors.length)];
        const size = 1 + Math.random() * 4;
        rock.fillStyle(rc, 1);
        rock.fillRect(-size / 2, -size / 2, size, size);
        rock.setPosition(slamX + (Math.random() - 0.5) * 30, slamY);

        const throwAngle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
        const throwSpeed = 40 + Math.random() * 100;
        const dur = 400 + Math.random() * 500;
        const t = dur / 1000;
        const endRX = rock.x + Math.cos(throwAngle) * throwSpeed * t;
        const peakRY = rock.y + Math.sin(throwAngle) * throwSpeed * t * 0.4;
        const endRY = rock.y + 10 + Math.random() * 20;

        this.scene.tweens.add({
          targets: rock,
          x: endRX,
          angle: Phaser.Math.Between(-360, 360),
          duration: dur,
          ease: 'Linear',
        });
        this.scene.tweens.add({
          targets: rock,
          y: peakRY,
          duration: dur * 0.35,
          ease: 'Quad.easeOut',
          onComplete: () => {
            this.scene.tweens.add({
              targets: rock,
              y: endRY,
              duration: dur * 0.65,
              ease: 'Quad.easeIn',
            });
          },
        });
        this.scene.tweens.add({
          targets: rock,
          alpha: 0,
          delay: dur * 0.5,
          duration: dur * 0.5,
          onComplete: () => rock.destroy(),
        });
      }

      // ── Dust cloud (expanding ellipse at ground level) ──
      const dust = this.scene.add.graphics();
      dust.setDepth(GAME_CONFIG.layers.foregroundDecor);
      dust.fillStyle(0x998877, 0.4);
      dust.fillCircle(slamX, slamY, 10);
      this.scene.tweens.add({
        targets: dust,
        scaleX: 8,
        scaleY: 2.5,
        alpha: 0,
        duration: 600,
        ease: 'Power1',
        onComplete: () => dust.destroy(),
      });

      // ── Shockwave ring ──
      const ring = this.scene.add.graphics();
      ring.setDepth(GAME_CONFIG.layers.foregroundDecor);
      ring.lineStyle(3, 0xffeedd, 0.8);
      ring.strokeCircle(slamX, slamY - 4, 6);
      this.scene.tweens.add({
        targets: ring,
        scaleX: 8,
        scaleY: 3,
        alpha: 0,
        duration: 400,
        ease: 'Power2',
        onComplete: () => ring.destroy(),
      });

      // ── Spark particles ──
      const sparks = this.scene.add.particles(slamX, slamY - 4, 'vfx_pixel_4', {
        speed: { min: 50, max: 120 },
        angle: { min: 0, max: 360 },
        lifespan: 400,
        tint: [0xffcc44, 0xffaa22, 0xffffff],
        alpha: { start: 1, end: 0 },
        gravityY: 80,
        emitting: false,
      });
      sparks.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
      sparks.explode(16);
      this.scene.time.delayedCall(500, () => sparks.destroy());

      // ── BIG screen shake ──
      this.scene.cameras.main.shake(200, 0.012);
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

  // ─── MAGE SPELL VFX ──────────────────────────────────────

  /**
   * Arcane Missiles — homing purple bolts streaking to enemies.
   */
  spawnArcaneMissiles(player) {
    if (!this.scene || !player) return;
    const dir = player.facingRight ? 1 : -1;
    const count = 5;
    for (let i = 0; i < count; i++) {
      this.scene.time.delayedCall(i * 120, () => {
        const bolt = this.scene.add.graphics();
        bolt.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
        bolt.fillStyle(0xaa66ff, 1);
        bolt.fillCircle(0, 0, 3);
        bolt.fillStyle(0xddaaff, 0.8);
        bolt.fillCircle(0, 0, 1.5);
        const sx = player.x + dir * 10;
        const sy = player.groundY - 14 + (Math.random() - 0.5) * 8;
        bolt.setPosition(sx, sy);

        // Trail
        const trail = this.scene.add.graphics();
        trail.setDepth(GAME_CONFIG.layers.foregroundDecor);
        trail.lineStyle(2, 0x8844cc, 0.5);

        const endX = sx + dir * (80 + Math.random() * 40);
        const endY = sy + (Math.random() - 0.5) * 20;
        this.scene.tweens.add({
          targets: bolt,
          x: endX, y: endY,
          duration: 250,
          ease: 'Quad.easeIn',
          onUpdate: () => {
            trail.clear();
            trail.lineStyle(2, 0x8844cc, 0.4);
            trail.beginPath();
            trail.moveTo(sx, sy);
            trail.lineTo(bolt.x, bolt.y);
            trail.strokePath();
          },
          onComplete: () => {
            // Impact burst
            const impact = this.scene.add.graphics();
            impact.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
            impact.fillStyle(0xcc88ff, 0.8);
            impact.fillCircle(endX, endY, 4);
            this.scene.tweens.add({
              targets: impact, alpha: 0, scaleX: 3, scaleY: 3,
              duration: 150, onComplete: () => impact.destroy(),
            });
            bolt.destroy();
            trail.destroy();
          },
        });
      });
    }
  }

  /**
   * Comet Crash — massive fiery comet falling from the sky.
   */
  spawnCometCrash(player) {
    if (!this.scene || !player) return;
    const dir = player.facingRight ? 1 : -1;
    const impactX = player.x + dir * 60;
    const impactY = player.groundY;

    // Shadow/target circle on ground
    const shadow = this.scene.add.graphics();
    shadow.setDepth(GAME_CONFIG.layers.entities + impactY - 1);
    shadow.fillStyle(0xff4422, 0.2);
    shadow.fillCircle(0, 0, 4);
    shadow.setPosition(impactX, impactY);
    this.scene.tweens.add({
      targets: shadow,
      scaleX: 8, scaleY: 4,
      alpha: 0.6,
      duration: 500,
      ease: 'Quad.easeIn',
      onComplete: () => shadow.destroy(),
    });

    // Comet falling from top
    const comet = this.scene.add.graphics();
    comet.setDepth(GAME_CONFIG.layers.foregroundDecor + 5);
    comet.fillStyle(0xff6644, 1);
    comet.fillCircle(0, 0, 8);
    comet.fillStyle(0xffcc44, 0.9);
    comet.fillCircle(0, 0, 5);
    comet.fillStyle(0xffffff, 0.8);
    comet.fillCircle(0, 0, 2);
    comet.setPosition(impactX + dir * 60, impactY - 180);

    this.scene.tweens.add({
      targets: comet,
      x: impactX, y: impactY - 8,
      duration: 500,
      ease: 'Quad.easeIn',
      onComplete: () => {
        comet.destroy();

        // EXPLOSION
        const flash = this.scene.add.graphics();
        flash.setDepth(GAME_CONFIG.layers.foregroundDecor + 5);
        flash.fillStyle(0xffffff, 1);
        flash.fillCircle(impactX, impactY - 4, 12);
        this.scene.tweens.add({
          targets: flash, alpha: 0, scaleX: 5, scaleY: 3,
          duration: 300, onComplete: () => flash.destroy(),
        });

        // Fire ring
        const ring = this.scene.add.graphics();
        ring.setDepth(GAME_CONFIG.layers.foregroundDecor + 3);
        ring.lineStyle(4, 0xff6644, 0.9);
        ring.strokeCircle(impactX, impactY, 8);
        this.scene.tweens.add({
          targets: ring, scaleX: 6, scaleY: 3, alpha: 0,
          duration: 400, onComplete: () => ring.destroy(),
        });

        // Debris
        for (let i = 0; i < 16; i++) {
          const chunk = this.scene.add.graphics();
          chunk.setDepth(GAME_CONFIG.layers.foregroundDecor + 4);
          const c = [0xff4422, 0xff8844, 0xffcc44, 0x887766][i % 4];
          chunk.fillStyle(c, 1);
          chunk.fillCircle(0, 0, 1 + Math.random() * 3);
          chunk.setPosition(impactX, impactY);
          const angle = (i / 16) * Math.PI * 2;
          const speed = 30 + Math.random() * 80;
          this.scene.tweens.add({
            targets: chunk,
            x: impactX + Math.cos(angle) * speed,
            y: impactY + Math.sin(angle) * speed * 0.5 - Math.random() * 20,
            alpha: 0, duration: 400 + Math.random() * 300,
            onComplete: () => chunk.destroy(),
          });
        }

        // Sparks
        const sparks = this.scene.add.particles(impactX, impactY, 'vfx_pixel_4', {
          speed: { min: 60, max: 150 }, angle: { min: 0, max: 360 },
          lifespan: 400, tint: [0xff4422, 0xff8844, 0xffcc44],
          alpha: { start: 1, end: 0 }, gravityY: 80, emitting: false,
        });
        sparks.setDepth(GAME_CONFIG.layers.foregroundDecor + 4);
        sparks.explode(20);
        this.scene.time.delayedCall(500, () => sparks.destroy());

        this.scene.cameras.main.shake(250, 0.015);
      },
    });

    // Comet trail
    this.scene.time.addEvent({
      delay: 30, repeat: 15,
      callback: () => {
        if (!comet || !comet.active || !this.scene) return;
        const trail = this.scene.add.graphics();
        trail.setDepth(GAME_CONFIG.layers.foregroundDecor + 4);
        trail.fillStyle(0xff8844, 0.6);
        trail.fillCircle(comet.x + (Math.random() - 0.5) * 4, comet.y + (Math.random() - 0.5) * 4, 2 + Math.random() * 3);
        this.scene.tweens.add({
          targets: trail, alpha: 0, scaleX: 0.3, scaleY: 0.3,
          duration: 200, onComplete: () => trail.destroy(),
        });
      },
    });
  }

  /**
   * Blink — vanish + reappear sparkle effect.
   */
  spawnBlinkEffect(player) {
    if (!this.scene || !player) return;
    const sx = player.x;
    const sy = player.groundY;

    // Departure burst
    for (let i = 0; i < 12; i++) {
      const p = this.scene.add.graphics();
      p.setDepth(GAME_CONFIG.layers.foregroundDecor);
      p.fillStyle(0x8866ff, 0.9);
      p.fillCircle(0, 0, 1 + Math.random() * 2);
      p.setPosition(sx, sy - 10);
      const angle = (i / 12) * Math.PI * 2;
      this.scene.tweens.add({
        targets: p,
        x: sx + Math.cos(angle) * 20,
        y: sy - 10 + Math.sin(angle) * 12,
        alpha: 0, duration: 300,
        onComplete: () => p.destroy(),
      });
    }

    // Arrival sparkles (delayed slightly)
    this.scene.time.delayedCall(100, () => {
      if (!this.scene || !player || !player.scene) return;
      for (let i = 0; i < 8; i++) {
        const p = this.scene.add.graphics();
        p.setDepth(GAME_CONFIG.layers.foregroundDecor);
        p.fillStyle(0xaa88ff, 0.9);
        p.fillCircle(0, 0, 1 + Math.random() * 2);
        p.setPosition(player.x + (Math.random() - 0.5) * 16, player.groundY - 10 + (Math.random() - 0.5) * 10);
        this.scene.tweens.add({
          targets: p, alpha: 0, y: p.y - 8, scaleX: 2, scaleY: 2,
          duration: 250, onComplete: () => p.destroy(),
        });
      }
    });
  }

  /**
   * Frost Nova — expanding ice ring that freezes.
   */
  spawnFrostNova(player) {
    if (!this.scene || !player) return;
    const cx = player.x;
    const cy = player.groundY;

    // Inner flash
    const flash = this.scene.add.graphics();
    flash.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
    flash.fillStyle(0xaaddff, 0.8);
    flash.fillCircle(cx, cy - 6, 6);
    this.scene.tweens.add({
      targets: flash, alpha: 0, scaleX: 6, scaleY: 3,
      duration: 400, onComplete: () => flash.destroy(),
    });

    // Ice ring expanding
    const ring = this.scene.add.graphics();
    ring.setDepth(GAME_CONFIG.layers.foregroundDecor);
    ring.lineStyle(3, 0x88ccff, 0.9);
    ring.strokeCircle(cx, cy, 6);
    this.scene.tweens.add({
      targets: ring, scaleX: 8, scaleY: 4, alpha: 0,
      duration: 500, ease: 'Power2', onComplete: () => ring.destroy(),
    });

    // Second ring
    const ring2 = this.scene.add.graphics();
    ring2.setDepth(GAME_CONFIG.layers.foregroundDecor);
    ring2.lineStyle(2, 0xcceeFF, 0.7);
    ring2.strokeCircle(cx, cy, 8);
    this.scene.tweens.add({
      targets: ring2, scaleX: 6, scaleY: 3, alpha: 0, delay: 80,
      duration: 450, onComplete: () => ring2.destroy(),
    });

    // Ice crystal shards
    for (let i = 0; i < 10; i++) {
      const shard = this.scene.add.graphics();
      shard.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
      shard.fillStyle(0xcceeFF, 0.9);
      const h = 3 + Math.random() * 4;
      shard.fillTriangle(0, -h, -2, h, 2, h);
      shard.setPosition(cx, cy);
      const angle = (i / 10) * Math.PI * 2;
      const dist = 25 + Math.random() * 25;
      this.scene.tweens.add({
        targets: shard,
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist * 0.4,
        angle: Phaser.Math.Between(-90, 90),
        alpha: 0, duration: 500, delay: 50,
        onComplete: () => shard.destroy(),
      });
    }

    // Ground frost circle
    const frost = this.scene.add.graphics();
    frost.setDepth(GAME_CONFIG.layers.entities + cy - 1);
    frost.fillStyle(0x88bbff, 0.3);
    frost.fillCircle(cx, cy, 40);
    frost.setScale(1, 0.5);
    this.scene.tweens.add({
      targets: frost, alpha: 0, delay: 800, duration: 1500,
      onComplete: () => frost.destroy(),
    });

    this.scene.cameras.main.shake(100, 0.006);
  }

  /**
   * Disintegrate — start of the channeled beam.
   */
  spawnDisintegrateStart(player) {
    if (!this.scene || !player) return;
    const dir = player.facingRight ? 1 : -1;
    // Charge-up glow on hands
    const glow = this.scene.add.graphics();
    glow.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
    glow.fillStyle(0xff44aa, 0.8);
    glow.fillCircle(0, 0, 3);
    glow.setPosition(player.x + dir * 12, player.groundY - 14);
    this.scene.tweens.add({
      targets: glow, scaleX: 4, scaleY: 4, alpha: 0,
      duration: 300, onComplete: () => glow.destroy(),
    });
  }

  /**
   * Meteor Storm — individual meteor impact VFX.
   */
  onMeteorImpact(data) {
    if (!this.scene) return;
    const { x, y } = data;

    // Meteor falling
    const meteor = this.scene.add.graphics();
    meteor.setDepth(GAME_CONFIG.layers.foregroundDecor + 3);
    meteor.fillStyle(0xff6633, 1);
    meteor.fillCircle(0, 0, 5);
    meteor.fillStyle(0xffaa44, 0.8);
    meteor.fillCircle(0, 0, 3);
    meteor.setPosition(x + Phaser.Math.Between(-20, 20), y - 100);

    this.scene.tweens.add({
      targets: meteor, x: x, y: y - 4,
      duration: 200, ease: 'Quad.easeIn',
      onComplete: () => {
        meteor.destroy();
        // Impact flash
        const flash = this.scene.add.graphics();
        flash.setDepth(GAME_CONFIG.layers.foregroundDecor + 3);
        flash.fillStyle(0xffaa33, 0.9);
        flash.fillCircle(x, y, 6);
        this.scene.tweens.add({
          targets: flash, alpha: 0, scaleX: 4, scaleY: 2,
          duration: 250, onComplete: () => flash.destroy(),
        });

        // Sparks
        for (let i = 0; i < 6; i++) {
          const s = this.scene.add.graphics();
          s.setDepth(GAME_CONFIG.layers.foregroundDecor + 2);
          s.fillStyle([0xff4422, 0xff8844, 0xffcc44][i % 3], 1);
          s.fillCircle(0, 0, 1 + Math.random());
          s.setPosition(x, y);
          this.scene.tweens.add({
            targets: s,
            x: x + (Math.random() - 0.5) * 40,
            y: y - Math.random() * 20,
            alpha: 0, duration: 250,
            onComplete: () => s.destroy(),
          });
        }
        this.scene.cameras.main.shake(60, 0.004);
      },
    });
  }

  /**
   * Chain Lightning — electric arcs between points.
   */
  onChainLightning(data) {
    if (!this.scene) return;
    const { points } = data;
    if (!points || points.length < 2) return;

    for (let i = 0; i < points.length - 1; i++) {
      this.scene.time.delayedCall(i * 60, () => {
        const a = points[i];
        const b = points[i + 1];
        if (!a || !b) return;

        // Jagged lightning bolt
        const bolt = this.scene.add.graphics();
        bolt.setDepth(GAME_CONFIG.layers.foregroundDecor + 2);

        // Main bright bolt
        bolt.lineStyle(3, 0x88ccff, 1);
        bolt.beginPath();
        bolt.moveTo(a.x, a.y);
        const segments = 4 + Math.floor(Math.random() * 3);
        for (let s = 1; s < segments; s++) {
          const t = s / segments;
          const mx = a.x + (b.x - a.x) * t + (Math.random() - 0.5) * 12;
          const my = a.y + (b.y - a.y) * t + (Math.random() - 0.5) * 8;
          bolt.lineTo(mx, my);
        }
        bolt.lineTo(b.x, b.y);
        bolt.strokePath();

        // Glow
        bolt.lineStyle(6, 0x4488ff, 0.3);
        bolt.beginPath();
        bolt.moveTo(a.x, a.y);
        bolt.lineTo(b.x, b.y);
        bolt.strokePath();

        // Impact flash at target
        const flash = this.scene.add.graphics();
        flash.setDepth(GAME_CONFIG.layers.foregroundDecor + 2);
        flash.fillStyle(0xaaddff, 0.9);
        flash.fillCircle(b.x, b.y, 4);
        this.scene.tweens.add({
          targets: flash, alpha: 0, scaleX: 3, scaleY: 3,
          duration: 150, onComplete: () => flash.destroy(),
        });

        this.scene.tweens.add({
          targets: bolt, alpha: 0, duration: 200,
          onComplete: () => bolt.destroy(),
        });
      });
    }
  }

  /**
   * Time Warp — expanding purple time distortion field.
   */
  onTimeWarp(data) {
    if (!this.scene) return;
    const { player, duration, radius } = data;
    if (!player) return;

    // Distortion ring
    const ring = this.scene.add.graphics();
    ring.setDepth(GAME_CONFIG.layers.foregroundDecor);
    ring.lineStyle(2, 0x6644cc, 0.6);
    ring.strokeCircle(player.x, player.groundY, 10);
    this.scene.tweens.add({
      targets: ring, scaleX: 8, scaleY: 4, alpha: 0.3,
      duration: 600, ease: 'Power2',
    });

    // Pulsing field that persists
    const field = this.scene.add.graphics();
    field.setDepth(GAME_CONFIG.layers.entities + player.groundY - 1);
    field.fillStyle(0x6644cc, 0.15);
    field.fillCircle(player.x, player.groundY, radius || 80);
    field.setScale(1, 0.5);

    // Clock tick particles
    const tickEvent = this.scene.time.addEvent({
      delay: 300, repeat: Math.floor(duration / 300),
      callback: () => {
        for (let i = 0; i < 3; i++) {
          const p = this.scene.add.graphics();
          p.setDepth(GAME_CONFIG.layers.foregroundDecor);
          p.fillStyle(0x8866ff, 0.7);
          p.fillCircle(0, 0, 1);
          p.setPosition(
            player.x + (Math.random() - 0.5) * 100,
            player.groundY + (Math.random() - 0.5) * 40,
          );
          this.scene.tweens.add({
            targets: p, y: p.y - 8, alpha: 0,
            duration: 400, onComplete: () => p.destroy(),
          });
        }
      },
    });

    // Fade out field and ring after duration
    this.scene.time.delayedCall(duration, () => {
      this.scene.tweens.add({
        targets: [field, ring], alpha: 0, duration: 500,
        onComplete: () => { field.destroy(); ring.destroy(); },
      });
      tickEvent.destroy();
    });

    this.scene.cameras.main.shake(80, 0.003);
  }

  // ─── ENEMY TELEGRAPH VFX ──────────────────────────────────

  /**
   * Small telegraph — red flash under enemy before imp/trash attack.
   */
  spawnSmallTelegraph(enemy, duration) {
    const gfx = this.scene.add.graphics();
    gfx.setDepth(GAME_CONFIG.layers.entities + enemy.groundY - 1);
    gfx.fillStyle(0xff4444, 0.3);
    gfx.fillEllipse ? gfx.fillEllipse(0, 0, 20, 8) : gfx.fillCircle(0, 0, 8);
    gfx.setPosition(enemy.x, enemy.groundY + 2);
    gfx.setScale(0.3, 0.3);

    this.scene.tweens.add({
      targets: gfx,
      scaleX: 1.2, scaleY: 1,
      alpha: 0.6,
      duration: duration * 0.8,
      ease: 'Quad.easeIn',
      yoyo: true,
      onComplete: () => gfx.destroy(),
    });

    // Exclamation flash above head
    const warn = this.scene.add.text(enemy.x, enemy.y - 28, '!', {
      fontSize: '8px', fontFamily: 'monospace', color: '#ff4444',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(GAME_CONFIG.layers.ui).setResolution(4);
    this.scene.tweens.add({
      targets: warn,
      y: enemy.y - 34,
      alpha: 0,
      duration: duration,
      onComplete: () => warn.destroy(),
    });
  }

  /**
   * Heavy telegraph — ground glow + charging effect for elites.
   */
  spawnHeavyTelegraph(enemy, duration) {
    const dir = enemy.facingRight ? 1 : -1;
    const tx = enemy.x + dir * 16;

    // Danger zone on ground
    const zone = this.scene.add.graphics();
    zone.setDepth(GAME_CONFIG.layers.entities + enemy.groundY - 1);
    zone.fillStyle(0xff6600, 0.15);
    zone.fillCircle(0, 0, 20);
    zone.setPosition(tx, enemy.groundY);
    zone.setScale(0.2);

    this.scene.tweens.add({
      targets: zone,
      scaleX: 2.5, scaleY: 1.2,
      alpha: 0.5,
      duration: duration,
      ease: 'Quad.easeIn',
      onComplete: () => zone.destroy(),
    });

    // Weapon glow on enemy
    const glow = this.scene.add.graphics();
    glow.setDepth(GAME_CONFIG.layers.foregroundDecor);
    glow.fillStyle(0xff8844, 0.6);
    glow.fillCircle(0, 0, 4);
    glow.setPosition(enemy.x + dir * 10, enemy.groundY - 14);
    this.scene.tweens.add({
      targets: glow,
      scaleX: 3, scaleY: 3,
      alpha: 0,
      duration: duration,
      ease: 'Quad.easeIn',
      onComplete: () => glow.destroy(),
    });

    // Warning text
    const warn = this.scene.add.text(enemy.x, enemy.y - 32, '!!', {
      fontSize: '9px', fontFamily: 'monospace', color: '#ff8844',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(GAME_CONFIG.layers.ui).setResolution(4);
    this.scene.tweens.add({
      targets: warn,
      y: enemy.y - 38,
      alpha: 0,
      duration: duration,
      onComplete: () => warn.destroy(),
    });
  }

  /**
   * Boss telegraph — massive danger zone + screen flash.
   */
  spawnBossTelegraph(enemy, duration) {
    const dir = enemy.facingRight ? 1 : -1;

    // Large danger area
    const zone = this.scene.add.graphics();
    zone.setDepth(GAME_CONFIG.layers.entities + enemy.groundY - 1);
    zone.fillStyle(0xff2222, 0.1);
    zone.fillCircle(0, 0, 30);
    zone.setPosition(enemy.x + dir * 20, enemy.groundY);
    zone.setScale(0.3);

    this.scene.tweens.add({
      targets: zone,
      scaleX: 3, scaleY: 1.5,
      alpha: 0.5,
      duration: duration,
      ease: 'Quad.easeIn',
      onComplete: () => zone.destroy(),
    });

    // Pulsing body glow
    const bodyGlow = this.scene.add.graphics();
    bodyGlow.setDepth(GAME_CONFIG.layers.foregroundDecor);
    bodyGlow.fillStyle(0xff4444, 0.3);
    bodyGlow.fillCircle(0, 0, 12);
    bodyGlow.setPosition(enemy.x, enemy.groundY - 16);
    this.scene.tweens.add({
      targets: bodyGlow,
      scaleX: 2.5, scaleY: 2.5,
      alpha: 0,
      duration: duration,
      yoyo: false,
      onComplete: () => bodyGlow.destroy(),
    });

    // Danger lines radiating outward
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const line = this.scene.add.graphics();
      line.setDepth(GAME_CONFIG.layers.foregroundDecor);
      line.lineStyle(1, 0xff4444, 0.6);
      line.beginPath();
      line.moveTo(enemy.x, enemy.groundY - 10);
      line.lineTo(enemy.x + Math.cos(angle) * 30, enemy.groundY - 10 + Math.sin(angle) * 15);
      line.strokePath();
      this.scene.tweens.add({
        targets: line, alpha: 0, duration: duration,
        onComplete: () => line.destroy(),
      });
    }
  }

  // ─── ENEMY ATTACK IMPACT VFX ───────────────────────────────

  /**
   * Imp/trash swipe — fast triple claw slash with sparks.
   */
  spawnImpSwipe(enemy, cx, cy, dir, color) {
    // Triple claw marks — big and dramatic
    for (let i = -1; i <= 1; i++) {
      const gfx = this.scene.add.graphics();
      gfx.setDepth(GAME_CONFIG.layers.foregroundDecor);
      gfx.lineStyle(2, color, 0.9);
      const sx = cx - dir * 4;
      const sy = cy + i * 5 - 4;
      const ex = cx + dir * 16;
      const ey = cy + i * 5 + 4;
      gfx.beginPath();
      gfx.moveTo(sx, sy);
      gfx.lineTo(ex, ey);
      gfx.strokePath();
      // Glow line
      gfx.lineStyle(4, color, 0.3);
      gfx.beginPath();
      gfx.moveTo(sx, sy);
      gfx.lineTo(ex, ey);
      gfx.strokePath();

      this.scene.tweens.add({
        targets: gfx, alpha: 0, duration: 200,
        delay: i * 30 + 30,
        onComplete: () => gfx.destroy(),
      });
    }

    // Spark burst at impact
    const sparks = this.scene.add.particles(cx + dir * 8, cy, 'vfx_pixel', {
      speed: { min: 30, max: 70 },
      angle: dir > 0 ? { min: -50, max: 50 } : { min: 130, max: 230 },
      lifespan: 200,
      tint: [color, 0xffaa44],
      alpha: { start: 0.9, end: 0 },
      emitting: false,
    });
    sparks.setDepth(GAME_CONFIG.layers.foregroundDecor);
    sparks.explode(5);
    this.scene.time.delayedCall(250, () => sparks.destroy());
  }

  /**
   * Elite heavy slam — big arc with ground impact and shockwave.
   */
  spawnHeavySlam(enemy, cx, cy, dir, color) {
    // Massive overhead arc
    const gfx = this.scene.add.graphics();
    gfx.setDepth(GAME_CONFIG.layers.foregroundDecor);
    const start = dir > 0 ? -1.5 : Math.PI - 1.3;
    gfx.lineStyle(4, 0xffffff, 0.9);
    gfx.beginPath();
    gfx.arc(cx, cy, 22, start, start + 2.6);
    gfx.strokePath();
    gfx.lineStyle(2, color, 0.6);
    gfx.beginPath();
    gfx.arc(cx, cy, 26, start + 0.2, start + 2.4);
    gfx.strokePath();
    this.scene.tweens.add({
      targets: gfx, alpha: 0, duration: 250,
      onComplete: () => gfx.destroy(),
    });

    // Ground impact ring at feet
    const ring = this.scene.add.graphics();
    ring.setDepth(GAME_CONFIG.layers.foregroundDecor);
    ring.lineStyle(2, color, 0.7);
    ring.strokeCircle(cx, enemy.groundY, 4);
    this.scene.tweens.add({
      targets: ring,
      scaleX: 5, scaleY: 2,
      alpha: 0,
      duration: 300,
      onComplete: () => ring.destroy(),
    });

    // Debris chunks
    for (let i = 0; i < 4; i++) {
      const rock = this.scene.add.graphics();
      rock.setDepth(GAME_CONFIG.layers.foregroundDecor);
      rock.fillStyle(0x887766, 1);
      rock.fillRect(-1, -1, 2 + Math.random() * 2, 2 + Math.random() * 2);
      rock.setPosition(cx + (Math.random() - 0.5) * 10, enemy.groundY);
      const endY = enemy.groundY - 10 - Math.random() * 20;
      this.scene.tweens.add({
        targets: rock,
        x: rock.x + (Math.random() - 0.5) * 30,
        y: endY,
        alpha: 0,
        duration: 300 + Math.random() * 200,
        ease: 'Quad.easeOut',
        onComplete: () => rock.destroy(),
      });
    }

    // Screen shake
    this.scene.cameras.main.shake(80, 0.004);

    // Spark burst
    const sparks = this.scene.add.particles(cx, cy, 'vfx_pixel_4', {
      speed: { min: 40, max: 80 },
      angle: { min: 0, max: 360 },
      lifespan: 250,
      tint: [color, 0xffcc44],
      alpha: { start: 1, end: 0 },
      gravityY: 50,
      emitting: false,
    });
    sparks.setDepth(GAME_CONFIG.layers.foregroundDecor);
    sparks.explode(8);
    this.scene.time.delayedCall(300, () => sparks.destroy());
  }

  /**
   * Boss cleave — massive sweeping attack with fire trail.
   */
  spawnBossCleave(enemy, cx, cy, dir, color) {
    // Huge sweeping arc
    const gfx = this.scene.add.graphics();
    gfx.setDepth(GAME_CONFIG.layers.foregroundDecor);
    const start = dir > 0 ? -2.0 : Math.PI - 0.8;
    gfx.lineStyle(5, 0xffffff, 1);
    gfx.beginPath();
    gfx.arc(cx, cy, 32, start, start + 2.8);
    gfx.strokePath();
    gfx.lineStyle(3, color, 0.7);
    gfx.beginPath();
    gfx.arc(cx, cy, 36, start + 0.2, start + 2.6);
    gfx.strokePath();
    gfx.lineStyle(2, 0xff8844, 0.4);
    gfx.beginPath();
    gfx.arc(cx, cy, 40, start + 0.4, start + 2.4);
    gfx.strokePath();
    this.scene.tweens.add({
      targets: gfx, alpha: 0, duration: 300,
      onComplete: () => gfx.destroy(),
    });

    // Fire trail along the arc
    for (let i = 0; i < 8; i++) {
      const a = start + (i / 8) * 2.8;
      const fx = cx + Math.cos(a) * 34;
      const fy = cy + Math.sin(a) * 34;
      const flame = this.scene.add.graphics();
      flame.setDepth(GAME_CONFIG.layers.foregroundDecor);
      flame.fillStyle([0xff4444, 0xff8844, 0xffcc44][i % 3], 0.8);
      flame.fillCircle(0, 0, 2 + Math.random() * 2);
      flame.setPosition(fx, fy);
      this.scene.tweens.add({
        targets: flame,
        y: fy - 6 - Math.random() * 8,
        alpha: 0,
        scaleX: 2, scaleY: 2,
        duration: 200 + Math.random() * 150,
        onComplete: () => flame.destroy(),
      });
    }

    // Ground shockwave
    const ring = this.scene.add.graphics();
    ring.setDepth(GAME_CONFIG.layers.foregroundDecor);
    ring.lineStyle(3, 0xff6644, 0.8);
    ring.strokeCircle(enemy.x + dir * 10, enemy.groundY, 6);
    this.scene.tweens.add({
      targets: ring,
      scaleX: 7, scaleY: 2.5,
      alpha: 0,
      duration: 400,
      onComplete: () => ring.destroy(),
    });

    // Big spark burst
    const sparks = this.scene.add.particles(cx, cy, 'vfx_pixel_4', {
      speed: { min: 50, max: 120 },
      angle: { min: 0, max: 360 },
      lifespan: 350,
      tint: [0xff4444, 0xff8844, 0xffcc44],
      alpha: { start: 1, end: 0 },
      gravityY: 60,
      emitting: false,
    });
    sparks.setDepth(GAME_CONFIG.layers.foregroundDecor);
    sparks.explode(14);
    this.scene.time.delayedCall(400, () => sparks.destroy());

    // Heavy screen shake
    this.scene.cameras.main.shake(150, 0.008);
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
  spawnShotgunBlast(player) {
    const dir = player.facingRight ? 1 : -1;
    const muzzleX = player.x + dir * 14;
    const muzzleY = player.groundY - 12;

    // ── Muzzle flash (bright white-yellow burst) ──
    const flash = this.scene.add.graphics();
    flash.setDepth(GAME_CONFIG.layers.foregroundDecor + 2);
    flash.fillStyle(0xffffcc, 1);
    flash.fillCircle(muzzleX + dir * 4, muzzleY, 6);
    flash.fillStyle(0xffaa33, 0.8);
    flash.fillCircle(muzzleX + dir * 6, muzzleY, 10);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 2,
      scaleY: 1.5,
      duration: 100,
      onComplete: () => flash.destroy(),
    });

    // ── Shotgun pellet trails (cone of lines) ──
    const pelletCount = 8;
    const spreadAngle = 0.5; // radians spread
    const baseAngle = dir > 0 ? 0 : Math.PI;
    for (let i = 0; i < pelletCount; i++) {
      const angle = baseAngle + (Math.random() - 0.5) * spreadAngle;
      const len = 40 + Math.random() * 50;
      const endX = muzzleX + Math.cos(angle) * len;
      const endY = muzzleY + Math.sin(angle) * len * 0.4;

      // Pellet trail line
      const trail = this.scene.add.graphics();
      trail.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
      trail.lineStyle(1, 0xffeeaa, 0.9);
      trail.beginPath();
      trail.moveTo(muzzleX, muzzleY);
      trail.lineTo(endX, endY);
      trail.strokePath();
      this.scene.tweens.add({
        targets: trail,
        alpha: 0,
        duration: 150 + Math.random() * 100,
        onComplete: () => trail.destroy(),
      });

      // Small impact spark at pellet end
      const spark = this.scene.add.graphics();
      spark.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
      spark.fillStyle(0xffcc44, 1);
      spark.fillCircle(0, 0, 1 + Math.random() * 2);
      spark.setPosition(endX, endY);
      this.scene.tweens.add({
        targets: spark,
        alpha: 0,
        scaleX: 2,
        scaleY: 2,
        duration: 200,
        delay: 50,
        onComplete: () => spark.destroy(),
      });
    }

    // ── Smoke cloud from muzzle ──
    for (let i = 0; i < 5; i++) {
      const smoke = this.scene.add.graphics();
      smoke.setDepth(GAME_CONFIG.layers.foregroundDecor);
      const gray = 0x888888 + Math.floor(Math.random() * 0x444444);
      smoke.fillStyle(gray, 0.5);
      smoke.fillCircle(0, 0, 3 + Math.random() * 4);
      smoke.setPosition(muzzleX + dir * (Math.random() * 8), muzzleY + (Math.random() - 0.5) * 6);
      this.scene.tweens.add({
        targets: smoke,
        x: smoke.x + dir * (10 + Math.random() * 15),
        y: smoke.y - 3 - Math.random() * 5,
        alpha: 0,
        scaleX: 2,
        scaleY: 2,
        duration: 300 + Math.random() * 200,
        onComplete: () => smoke.destroy(),
      });
    }

    // ── Spark particles ──
    const sparks = this.scene.add.particles(muzzleX, muzzleY, 'vfx_pixel', {
      speed: { min: 60, max: 140 },
      angle: dir > 0 ? { min: -30, max: 30 } : { min: 150, max: 210 },
      lifespan: 200,
      tint: [0xffcc44, 0xffaa22, 0xff8800],
      alpha: { start: 1, end: 0 },
      emitting: false,
    });
    sparks.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
    sparks.explode(10);
    this.scene.time.delayedCall(250, () => sparks.destroy());

    // ── Screen shake — recoil ──
    this.scene.cameras.main.shake(100, 0.008);
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
    this.scene.events.off('enemyWindup', this.onEnemyWindup, this);
    this.scene.events.off('aiAttack', this.onAIAttack, this);
    this.scene.events.off('playerSpecial', this.onPlayerSpecial, this);
    this.scene.events.off('aiHeal', this.onAIHeal, this);
    this.scene.events.off('entityDamaged', this.onEntityDamaged, this);
    this.scene.events.off('priestBeam', this.onPriestBeam, this);
    this.scene.events.off('priestHealBlob', this.onPriestHealBlob, this);
    this.scene.events.off('priestHealLightning', this.onPriestHealLightning, this);
  }
}
