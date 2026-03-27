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
  warlock: 0x88ff44,   // fel green
  hunter: 0x44bbaa,    // teal/cyan
};

// Enemy swipe colors — themed per dungeon
const ENEMY_COLORS = {
  imp: 0xff6644,            // red-orange
  hellknight: 0xff8844,     // orange
  pitlord: 0xff4444,        // blood red
  frozen_wraith: 0x66ccff,  // ice blue
  frozen_golem: 0x88ddff,   // frost
  frozen_giant: 0x44aaff,   // deep ice
  forge_imp: 0xff8833,      // ember
  forge_golem: 0xff6611,    // molten
  forge_infernal: 0xff4400, // magma
  temple_murloc: 0x44dd88,  // sea green
  temple_naga: 0x22cc66,    // deep sea
  temple_horror: 0x8844cc,  // void purple
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

    // Priest ability VFX events
    scene.events.on('priestPenance', this.onPriestPenance, this);
    scene.events.on('priestHymnHeal', this.onPriestHymnHeal, this);
    scene.events.on('priestRadiance', this.onPriestRadiance, this);
    scene.events.on('priestRadianceTick', this.onPriestRadianceTick, this);
    scene.events.on('priestHolyFirePillar', this.onPriestHolyFirePillar, this);
    scene.events.on('priestSpiritLink', this.onPriestSpiritLink, this);
    scene.events.on('priestLightningSmite', this.onPriestLightningSmite, this);

    // Warlock ability VFX events
    scene.events.on('warlockDrainLife', this.onWarlockDrainLife, this);
    scene.events.on('warlockFear', this.onWarlockFear, this);
    scene.events.on('warlockRainTick', this.onWarlockRainTick, this);
    scene.events.on('warlockImpSpawn', this.onWarlockImpSpawn, this);
    scene.events.on('warlockImpAttack', this.onWarlockImpAttack, this);
    scene.events.on('warlockShadowfury', this.onWarlockShadowfury, this);
    scene.events.on('warlockImmolate', this.onWarlockImmolate, this);
    scene.events.on('warlockImmolateBurst', this.onWarlockImmolateBurst, this);

    // Hunter ability VFX events
    scene.events.on('hunterDisengage', this.onHunterDisengage, this);
    scene.events.on('hunterTrapPlace', this.onHunterTrapPlace, this);
    scene.events.on('hunterTrapTrigger', this.onHunterTrapTrigger, this);
    scene.events.on('hunterRapidFireTick', this.onHunterRapidFireTick, this);
    scene.events.on('hunterPetSpawn', this.onHunterPetSpawn, this);
    scene.events.on('hunterPetAttack', this.onHunterPetAttack, this);
    scene.events.on('hunterVolleyArrow', this.onHunterVolleyArrow, this);
    scene.events.on('hunterKillShot', this.onHunterKillShot, this);

    // Raid boss ability VFX events
    scene.events.on('raidBossTelegraph', this.onRaidBossTelegraph, this);
    scene.events.on('raidBossHellfireDrop', this.onRaidBossHellfireDrop, this);
    scene.events.on('raidBossHellfireImpact', this.onRaidBossHellfireImpact, this);
    scene.events.on('raidBossShadowCleave', this.onRaidBossShadowCleave, this);
    scene.events.on('raidBossFelStomp', this.onRaidBossFelStomp, this);
    scene.events.on('raidBossChargeTrail', this.onRaidBossChargeTrail, this);
    scene.events.on('raidBossChargeEnd', this.onRaidBossChargeEnd, this);
    scene.events.on('raidBossTrailFade', this.onRaidBossTrailFade, this);

    // Advanced enemy AI VFX events
    scene.events.on('enemyDash', this.onEnemyDash, this);
    scene.events.on('enemyDashEnd', this.onEnemyDashEnd, this);
    scene.events.on('enemyAfterimage', this.onEnemyAfterimage, this);
    scene.events.on('enemyJumpStart', this.onEnemyJumpStart, this);
    scene.events.on('enemyJumpSlam', this.onEnemyJumpSlam, this);
    scene.events.on('enemyDodge', this.onEnemyDodge, this);
    scene.events.on('enemySpecial', this.onEnemySpecial, this);
    scene.events.on('enemySwoop', this.onEnemySwoop, this);
    scene.events.on('enemyFlyStart', this.onEnemyFlyStart, this);
    scene.events.on('enemyFlyEnd', this.onEnemyFlyEnd, this);
    scene.events.on('enemyEnrage', this.onEnemyEnrage, this);
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
    } else if (cls === 'warlock' && key === 'special1') {
      this.spawnWarlockShadowBolts(player);
    } else if (cls === 'warlock' && key === 'special2') {
      this.spawnWarlockFelFireball(player);
    } else if (cls === 'warlock') {
      this.spawnNovaRing(player.x, player.groundY - 8, 0x88ff44);
    } else if (cls === 'hunter' && key === 'special1') {
      this.spawnHunterChargedArrow(player);
    } else if (cls === 'hunter' && key === 'special2') {
      this.spawnHunterArrowFan(player);
    } else if (cls === 'hunter') {
      this.spawnNovaRing(player.x, player.groundY - 8, 0x44bbaa);
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

  // ═══════════════════════════════════════════════════════════
  //  PRIEST ABILITY VFX
  // ═══════════════════════════════════════════════════════════

  /** Penance — golden bolt streaking from caster to target with sparkle trail */
  onPriestPenance(data) {
    if (!this.scene) return;
    const { source, target, boltIndex, totalBolts } = data;
    if (!source || !target) return;

    const sx = source.x;
    const sy = source.groundY - 14;
    const tx = target.x;
    const ty = target.groundY - 10;
    const dur = 150;

    // Main bolt orb
    const orb = this.scene.add.graphics();
    orb.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
    orb.fillStyle(0xffffff, 1);
    orb.fillCircle(0, 0, 2.5);
    orb.fillStyle(0xffdd44, 0.7);
    orb.fillCircle(0, 0, 4);
    orb.setPosition(sx, sy);

    this.scene.tweens.add({
      targets: orb, x: tx, y: ty,
      duration: dur, ease: 'Quad.easeIn',
      onComplete: () => {
        orb.destroy();
        // Impact flash
        const flash = this.scene.add.circle(tx, ty, 3, 0xffffcc, 0.9);
        flash.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
        this.scene.tweens.add({
          targets: flash, scaleX: 3, scaleY: 3, alpha: 0,
          duration: 150, onComplete: () => flash.destroy(),
        });
        // Impact sparkles
        for (let i = 0; i < 6; i++) {
          const sp = this.scene.add.graphics();
          sp.fillStyle([0xffffaa, 0xffdd66, 0xffffff][i % 3], 0.9);
          sp.fillCircle(0, 0, 1 + Math.random());
          sp.setPosition(tx, ty);
          sp.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
          const a = Math.random() * Math.PI * 2;
          this.scene.tweens.add({
            targets: sp,
            x: tx + Math.cos(a) * (8 + Math.random() * 12),
            y: ty + Math.sin(a) * (5 + Math.random() * 8),
            alpha: 0, duration: 200,
            onComplete: () => sp.destroy(),
          });
        }
      },
    });

    // Trailing sparkle particles along path
    const trailCount = 4;
    for (let i = 0; i < trailCount; i++) {
      this.scene.time.delayedCall(i * (dur / trailCount), () => {
        if (!this.scene) return;
        const t = i / trailCount;
        const px = sx + (tx - sx) * t;
        const py = sy + (ty - sy) * t;
        const spark = this.scene.add.graphics();
        spark.fillStyle(0xffffaa, 0.7);
        spark.fillCircle(0, 0, 1.5);
        spark.setPosition(px + (Math.random() - 0.5) * 4, py + (Math.random() - 0.5) * 4);
        spark.setDepth(GAME_CONFIG.layers.foregroundDecor);
        this.scene.tweens.add({
          targets: spark, alpha: 0, scaleX: 0.3, scaleY: 0.3,
          duration: 200, onComplete: () => spark.destroy(),
        });
      });
    }

    // Final bolt: big flash at caster
    if (boltIndex === totalBolts - 1) {
      const casterFlash = this.scene.add.circle(sx, sy, 5, 0xffffcc, 0.6);
      casterFlash.setDepth(GAME_CONFIG.layers.foregroundDecor);
      this.scene.tweens.add({
        targets: casterFlash, scaleX: 3, scaleY: 2, alpha: 0,
        duration: 300, onComplete: () => casterFlash.destroy(),
      });
    }
  }

  /** Hymn of Hope heal tick — rising golden motes on target */
  onPriestHymnHeal(data) {
    if (!this.scene) return;
    const { target, amount } = data;
    if (!target) return;

    // Green heal number
    this.spawnDamageNumber(target.x, target.y - 24, `+${amount}`, '#88ff88');

    // Rising golden sparkles
    for (let i = 0; i < 4; i++) {
      const mote = this.scene.add.graphics();
      mote.fillStyle([0xffffaa, 0xffdd66, 0xffffff, 0xffeeaa][i], 0.8);
      mote.fillCircle(0, 0, 1 + Math.random() * 1.5);
      mote.setPosition(
        target.x + (Math.random() - 0.5) * 16,
        target.groundY - 4
      );
      mote.setDepth(GAME_CONFIG.layers.foregroundDecor);
      this.scene.tweens.add({
        targets: mote,
        y: target.groundY - 20 - Math.random() * 12,
        x: mote.x + (Math.random() - 0.5) * 8,
        alpha: 0,
        duration: 400 + Math.random() * 200,
        onComplete: () => mote.destroy(),
      });
    }
  }

  /** Helper — spawns a damage/heal number (used by multiple VFX) */
  spawnDamageNumber(x, y, text, color) {
    if (!this.scene) return;
    const num = this.scene.add.text(x, y, text, {
      fontSize: '7px', fontFamily: 'monospace', color,
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(GAME_CONFIG.layers.ui).setResolution(4);
    this.scene.tweens.add({
      targets: num, y: y - 16, alpha: 0,
      duration: 800, onComplete: () => num.destroy(),
    });
  }

  /** Power Word: Radiance — massive golden sunburst */
  onPriestRadiance(data) {
    if (!this.scene) return;
    const { player } = data;
    if (!player) return;
    const cx = player.x;
    const cy = player.groundY;

    // Sunburst flash — white core expanding
    const core = this.scene.add.circle(cx, cy - 10, 4, 0xffffff, 1);
    core.setDepth(GAME_CONFIG.layers.foregroundDecor + 2);
    this.scene.tweens.add({
      targets: core, scaleX: 8, scaleY: 4, alpha: 0,
      duration: 400, ease: 'Quad.easeOut', onComplete: () => core.destroy(),
    });

    // Golden ring expanding
    const ring = this.scene.add.graphics();
    ring.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
    ring.lineStyle(3, 0xffdd44, 0.9);
    ring.strokeCircle(cx, cy - 8, 6);
    this.scene.tweens.add({
      targets: ring, scaleX: 10, scaleY: 4, alpha: 0,
      duration: 500, ease: 'Power2', onComplete: () => ring.destroy(),
    });

    // Second ring
    const ring2 = this.scene.add.graphics();
    ring2.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
    ring2.lineStyle(2, 0xffffaa, 0.6);
    ring2.strokeCircle(cx, cy - 8, 8);
    this.scene.tweens.add({
      targets: ring2, scaleX: 7, scaleY: 3, alpha: 0,
      duration: 450, delay: 60, onComplete: () => ring2.destroy(),
    });

    // Radiant rays — 12 beams of light outward
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const ray = this.scene.add.graphics();
      ray.setDepth(GAME_CONFIG.layers.foregroundDecor);
      ray.lineStyle(2, 0xffffaa, 0.7);
      ray.beginPath();
      ray.moveTo(cx, cy - 8);
      ray.lineTo(
        cx + Math.cos(angle) * 50,
        cy - 8 + Math.sin(angle) * 20
      );
      ray.strokePath();
      // Glow layer
      ray.lineStyle(4, 0xffdd44, 0.2);
      ray.beginPath();
      ray.moveTo(cx, cy - 8);
      ray.lineTo(
        cx + Math.cos(angle) * 45,
        cy - 8 + Math.sin(angle) * 18
      );
      ray.strokePath();
      this.scene.tweens.add({
        targets: ray, alpha: 0,
        duration: 350, delay: 50 + i * 15,
        onComplete: () => ray.destroy(),
      });
    }

    // Shower of golden motes falling/rising around all allies
    const party = this.scene.getPartyMembers ? this.scene.getPartyMembers() : [];
    for (const member of party) {
      if (member.hp <= 0) continue;
      for (let i = 0; i < 8; i++) {
        const mote = this.scene.add.graphics();
        mote.fillStyle([0xffffaa, 0xffdd44, 0xffffff, 0xffeecc][i % 4], 0.8);
        mote.fillCircle(0, 0, 1 + Math.random() * 1.5);
        mote.setPosition(
          member.x + (Math.random() - 0.5) * 20,
          member.groundY - 30 - Math.random() * 15
        );
        mote.setDepth(GAME_CONFIG.layers.foregroundDecor);
        this.scene.tweens.add({
          targets: mote,
          y: member.groundY - 4 + Math.random() * 4,
          x: mote.x + (Math.random() - 0.5) * 10,
          alpha: 0,
          duration: 400 + Math.random() * 300,
          delay: i * 40,
          onComplete: () => mote.destroy(),
        });
      }
    }

    this.scene.cameras.main.shake(60, 0.003);
  }

  /** Radiance HOT tick — gentle rising motes */
  onPriestRadianceTick(data) {
    if (!this.scene) return;
    const { target, amount } = data;
    if (!target || target.hp <= 0) return;

    this.spawnDamageNumber(target.x, target.y - 20, `+${amount}`, '#ffee88');
    for (let i = 0; i < 3; i++) {
      const mote = this.scene.add.graphics();
      mote.fillStyle(0xffdd44, 0.6);
      mote.fillCircle(0, 0, 1);
      mote.setPosition(target.x + (Math.random() - 0.5) * 12, target.groundY - 2);
      mote.setDepth(GAME_CONFIG.layers.foregroundDecor);
      this.scene.tweens.add({
        targets: mote, y: target.groundY - 18, alpha: 0,
        duration: 350, delay: i * 60,
        onComplete: () => mote.destroy(),
      });
    }
  }

  /** Holy Fire Pillar — blazing column of divine light slamming down */
  onPriestHolyFirePillar(data) {
    if (!this.scene) return;
    const { x, y, index, isHeal } = data;
    const coreColor = isHeal ? 0x44ff88 : 0xffffff;
    const glowColor = isHeal ? 0x44dd66 : 0xffdd44;
    const outerColor = isHeal ? 0x22bb44 : 0xffaa22;

    // Vertical beam from sky
    const beam = this.scene.add.graphics();
    beam.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
    beam.fillStyle(coreColor, 0.9);
    beam.fillRect(x - 2, y - 60, 4, 60);
    beam.fillStyle(glowColor, 0.4);
    beam.fillRect(x - 5, y - 60, 10, 60);
    beam.fillStyle(outerColor, 0.15);
    beam.fillRect(x - 8, y - 55, 16, 55);

    this.scene.tweens.add({
      targets: beam, alpha: 0,
      duration: 400, delay: 100,
      onComplete: () => beam.destroy(),
    });

    // Ground impact ring
    const ring = this.scene.add.graphics();
    ring.setDepth(GAME_CONFIG.layers.foregroundDecor);
    ring.lineStyle(2, 0xffdd44, 0.8);
    ring.strokeCircle(x, y, 3);
    this.scene.tweens.add({
      targets: ring, scaleX: 5, scaleY: 2, alpha: 0,
      duration: 300, onComplete: () => ring.destroy(),
    });

    // Flash at impact point
    const flash = this.scene.add.circle(x, y, 4, 0xffffcc, 0.9);
    flash.setDepth(GAME_CONFIG.layers.foregroundDecor + 2);
    this.scene.tweens.add({
      targets: flash, scaleX: 3, scaleY: 1.5, alpha: 0,
      duration: 200, onComplete: () => flash.destroy(),
    });

    // Upward sparks from impact
    for (let i = 0; i < 6; i++) {
      const sp = this.scene.add.graphics();
      sp.fillStyle([0xffdd44, 0xffffaa, 0xff8844, 0xffffff][i % 4], 0.8);
      sp.fillCircle(0, 0, 1 + Math.random());
      sp.setPosition(x, y);
      sp.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
      const spd = 15 + Math.random() * 25;
      this.scene.tweens.add({
        targets: sp,
        x: x + Math.cos(a) * spd,
        y: y + Math.sin(a) * spd,
        alpha: 0, duration: 250 + Math.random() * 150,
        onComplete: () => sp.destroy(),
      });
    }

    // Ember particles drifting up from pillar
    for (let i = 0; i < 4; i++) {
      const ember = this.scene.add.graphics();
      ember.fillStyle(0xffaa33, 0.7);
      ember.fillCircle(0, 0, 0.8);
      ember.setPosition(x + (Math.random() - 0.5) * 8, y - Math.random() * 40);
      ember.setDepth(GAME_CONFIG.layers.foregroundDecor);
      this.scene.tweens.add({
        targets: ember,
        y: ember.y - 15 - Math.random() * 10,
        x: ember.x + (Math.random() - 0.5) * 8,
        alpha: 0, duration: 500,
        onComplete: () => ember.destroy(),
      });
    }

    // Small screen shake per pillar
    this.scene.cameras.main.shake(40, 0.002 + index * 0.0005);
  }

  /** Spirit Link — golden chains connecting all party members + HP equalize flash */
  onPriestSpiritLink(data) {
    if (!this.scene) return;
    const { player, targets, duration } = data;
    if (!targets || targets.length < 2) return;

    // Draw chains between all pairs
    for (let i = 0; i < targets.length; i++) {
      for (let j = i + 1; j < targets.length; j++) {
        const a = targets[i];
        const b = targets[j];
        this._drawSpiritChain(a.x, a.groundY - 10, b.x, b.groundY - 10);
      }
    }

    // Golden flash on each target
    for (const t of targets) {
      const flash = this.scene.add.circle(t.x, t.groundY - 10, 5, 0xffdd44, 0.8);
      flash.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
      this.scene.tweens.add({
        targets: flash, scaleX: 3, scaleY: 2, alpha: 0,
        duration: 400, onComplete: () => flash.destroy(),
      });

      // Rising golden particles
      for (let k = 0; k < 6; k++) {
        const mote = this.scene.add.graphics();
        mote.fillStyle([0xffdd44, 0xffffaa, 0xffffff][k % 3], 0.7);
        mote.fillCircle(0, 0, 1 + Math.random());
        mote.setPosition(t.x + (Math.random() - 0.5) * 12, t.groundY - 6);
        mote.setDepth(GAME_CONFIG.layers.foregroundDecor);
        this.scene.tweens.add({
          targets: mote,
          y: t.groundY - 22 - Math.random() * 10,
          alpha: 0, duration: 400 + Math.random() * 200,
          delay: k * 30,
          onComplete: () => mote.destroy(),
        });
      }
    }

    // Persistent chain aura for duration (re-draw chains periodically)
    let tickCount = 0;
    const chainTick = this.scene.time.addEvent({
      delay: 300, repeat: Math.floor(duration / 300) - 1,
      callback: () => {
        if (!this.scene) return;
        tickCount++;
        const alive = targets.filter(t => t.hp > 0 && t.scene);
        if (alive.length < 2) { chainTick.destroy(); return; }
        for (let i = 0; i < alive.length; i++) {
          for (let j = i + 1; j < alive.length; j++) {
            this._drawSpiritChain(
              alive[i].x, alive[i].groundY - 10,
              alive[j].x, alive[j].groundY - 10,
              0.3 // lower alpha for persistent chains
            );
          }
        }
      },
    });
  }

  /** Helper — draw a jagged golden chain between two points */
  _drawSpiritChain(x1, y1, x2, y2, alpha = 0.7) {
    if (!this.scene) return;
    const chain = this.scene.add.graphics();
    chain.setDepth(GAME_CONFIG.layers.foregroundDecor);

    // Golden jagged chain
    chain.lineStyle(2, 0xffdd44, alpha);
    chain.beginPath();
    chain.moveTo(x1, y1);
    const segments = 6;
    for (let s = 1; s < segments; s++) {
      const t = s / segments;
      const px = x1 + (x2 - x1) * t + (Math.random() - 0.5) * 6;
      const py = y1 + (y2 - y1) * t + (Math.random() - 0.5) * 4;
      chain.lineTo(px, py);
    }
    chain.lineTo(x2, y2);
    chain.strokePath();

    // White inner glow
    chain.lineStyle(1, 0xffffff, alpha * 0.5);
    chain.beginPath();
    chain.moveTo(x1, y1);
    chain.lineTo(x2, y2);
    chain.strokePath();

    this.scene.tweens.add({
      targets: chain, alpha: 0,
      duration: 280,
      onComplete: () => chain.destroy(),
    });
  }

  /** Lightning Smite — jagged bolt from sky electrocutes enemy */
  onPriestLightningSmite(data) {
    if (!this.scene) return;
    const { source, target, x, y, index } = data;
    if (!target) return;

    const sx = x;
    const sy = y - 70;
    const tx = x;
    const ty = y;

    // Jagged lightning bolt from sky
    for (let layer = 0; layer < 3; layer++) {
      const bolt = this.scene.add.graphics();
      bolt.setDepth(GAME_CONFIG.layers.foregroundDecor + 2 - layer);
      const colors = [0xffffff, 0x88ccff, 0x4488ff];
      const widths = [3, 2, 1];
      bolt.lineStyle(widths[layer], colors[layer], 0.9 - layer * 0.2);
      bolt.beginPath();
      bolt.moveTo(sx, sy);
      const segs = 6 + Math.floor(Math.random() * 4);
      for (let s = 1; s < segs; s++) {
        const t = s / segs;
        bolt.lineTo(
          sx + (tx - sx) * t + (Math.random() - 0.5) * (12 - layer * 3),
          sy + (ty - sy) * t + (Math.random() - 0.5) * (6 - layer * 2)
        );
      }
      bolt.lineTo(tx, ty);
      bolt.strokePath();
      this.scene.tweens.add({
        targets: bolt, alpha: 0,
        duration: 250, delay: layer * 20,
        onComplete: () => bolt.destroy(),
      });
    }

    // Bright impact flash
    const flash = this.scene.add.circle(tx, ty, 5, 0x88ccff, 0.9);
    flash.setDepth(GAME_CONFIG.layers.foregroundDecor + 3);
    this.scene.tweens.add({
      targets: flash, scaleX: 4, scaleY: 2, alpha: 0,
      duration: 200, onComplete: () => flash.destroy(),
    });

    // Electric sparks radiating from impact
    for (let i = 0; i < 8; i++) {
      const sp = this.scene.add.graphics();
      sp.fillStyle([0x88ccff, 0xaaddff, 0xffffff, 0x4488ff][i % 4], 0.9);
      sp.fillCircle(0, 0, 1 + Math.random());
      sp.setPosition(tx, ty);
      sp.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
      const a = Math.random() * Math.PI * 2;
      const spd = 10 + Math.random() * 20;
      this.scene.tweens.add({
        targets: sp,
        x: tx + Math.cos(a) * spd,
        y: ty + Math.sin(a) * spd * 0.5,
        alpha: 0, duration: 200 + Math.random() * 150,
        onComplete: () => sp.destroy(),
      });
    }

    // Mini arcs jumping off the target (secondary lightning)
    for (let i = 0; i < 3; i++) {
      this.scene.time.delayedCall(50 + i * 40, () => {
        if (!this.scene) return;
        const arc = this.scene.add.graphics();
        arc.setDepth(GAME_CONFIG.layers.foregroundDecor);
        arc.lineStyle(1, 0x88ccff, 0.6);
        arc.beginPath();
        arc.moveTo(tx, ty - 4);
        const endX = tx + (Math.random() - 0.5) * 24;
        const endY = ty - 8 + (Math.random() - 0.5) * 12;
        arc.lineTo(
          tx + (endX - tx) * 0.5 + (Math.random() - 0.5) * 8,
          ty - 4 + (endY - ty + 4) * 0.5 + (Math.random() - 0.5) * 6
        );
        arc.lineTo(endX, endY);
        arc.strokePath();
        this.scene.tweens.add({
          targets: arc, alpha: 0, duration: 150,
          onComplete: () => arc.destroy(),
        });
      });
    }

    // Tint enemy blue briefly
    if (target.sprite) {
      target.sprite.setTint(0x88ccff);
      this.scene.time.delayedCall(200, () => {
        if (target.sprite && !target.dead) target.sprite.clearTint();
      });
    }

    this.scene.cameras.main.shake(30, 0.002 + index * 0.0003);
  }

  // ═══════════════════════════════════════════════════════════
  //  WARLOCK & HUNTER VFX
  // ═══════════════════════════════════════════════════════════

  /**
   * Warlock special1 — 4 green shadow bolts streaking to target area.
   */
  spawnWarlockShadowBolts(player) {
    if (!this.scene || !player) return;
    const dir = player.facingRight ? 1 : -1;
    for (let i = 0; i < 4; i++) {
      this.scene.time.delayedCall(i * 100, () => {
        if (!this.scene || !player || !player.scene) return;
        const bolt = this.scene.add.graphics();
        bolt.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
        // Outer green glow
        bolt.fillStyle(0x88ff44, 0.7);
        bolt.fillCircle(0, 0, 5);
        // Inner bright core
        bolt.fillStyle(0xccffaa, 1);
        bolt.fillCircle(0, 0, 2);
        // Shadow halo
        bolt.fillStyle(0x6622aa, 0.3);
        bolt.fillCircle(0, 0, 7);

        const sx = player.x + dir * 8;
        const sy = player.groundY - 16 + (i - 1.5) * 6;
        bolt.setPosition(sx, sy);

        const trail = this.scene.add.graphics();
        trail.setDepth(GAME_CONFIG.layers.foregroundDecor);

        const endX = sx + dir * (90 + Math.random() * 30);
        const endY = sy + (Math.random() - 0.5) * 16;
        this.scene.tweens.add({
          targets: bolt,
          x: endX, y: endY,
          duration: 220,
          ease: 'Quad.easeIn',
          onUpdate: () => {
            trail.clear();
            trail.lineStyle(3, 0x88ff44, 0.3);
            trail.beginPath();
            trail.moveTo(sx, sy);
            trail.lineTo(bolt.x, bolt.y);
            trail.strokePath();
            trail.lineStyle(1, 0xccffaa, 0.6);
            trail.beginPath();
            trail.moveTo(sx, sy);
            trail.lineTo(bolt.x, bolt.y);
            trail.strokePath();
          },
          onComplete: () => {
            // Impact burst — green + purple
            const impact = this.scene.add.graphics();
            impact.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
            impact.fillStyle(0x88ff44, 0.9);
            impact.fillCircle(endX, endY, 6);
            impact.fillStyle(0x6622aa, 0.4);
            impact.fillCircle(endX, endY, 10);
            this.scene.tweens.add({
              targets: impact, alpha: 0, scaleX: 2.5, scaleY: 2.5,
              duration: 180, onComplete: () => impact.destroy(),
            });
            // Green sparks
            const sparks = this.scene.add.particles(endX, endY, 'vfx_pixel_4', {
              speed: { min: 20, max: 50 },
              angle: { min: 0, max: 360 },
              lifespan: 200,
              tint: [0x88ff44, 0x44cc22, 0xccffaa],
              alpha: { start: 1, end: 0 },
              emitting: false,
            });
            sparks.setDepth(GAME_CONFIG.layers.foregroundDecor);
            sparks.explode(6);
            this.scene.time.delayedCall(250, () => sparks.destroy());
            bolt.destroy();
            trail.destroy();
          },
        });
      });
    }
  }

  /**
   * Warlock special2 — massive green fireball with trail.
   */
  spawnWarlockFelFireball(player) {
    if (!this.scene || !player) return;
    const dir = player.facingRight ? 1 : -1;
    const sx = player.x + dir * 12;
    const sy = player.groundY - 16;

    // Main fireball
    const fireball = this.scene.add.graphics();
    fireball.setDepth(GAME_CONFIG.layers.foregroundDecor + 2);
    fireball.fillStyle(0x88ff44, 0.8);
    fireball.fillCircle(0, 0, 10);
    fireball.fillStyle(0xff6600, 0.5);
    fireball.fillCircle(0, 0, 7);
    fireball.fillStyle(0xffffff, 0.9);
    fireball.fillCircle(0, 0, 3);
    fireball.setPosition(sx, sy);

    // Glow halo
    const halo = this.scene.add.circle(sx, sy, 14, 0x88ff44, 0.3);
    halo.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);

    // Trail particles
    const trail = this.scene.add.particles(sx, sy, 'vfx_circle', {
      speed: { min: 5, max: 20 },
      angle: dir > 0 ? { min: 150, max: 210 } : { min: -30, max: 30 },
      lifespan: 350,
      tint: [0x88ff44, 0x44cc22, 0xff6600],
      alpha: { start: 0.8, end: 0 },
      scale: { start: 1.2, end: 0.2 },
      frequency: 15,
      follow: fireball,
    });
    trail.setDepth(GAME_CONFIG.layers.foregroundDecor);

    // Smoke trail
    const smoke = this.scene.add.particles(sx, sy, 'vfx_pixel_4', {
      speed: { min: 5, max: 15 },
      angle: { min: 240, max: 300 },
      lifespan: 400,
      tint: 0x336622,
      alpha: { start: 0.4, end: 0 },
      scale: { start: 1, end: 2 },
      frequency: 25,
      follow: fireball,
    });
    smoke.setDepth(GAME_CONFIG.layers.foregroundDecor - 1);

    const endX = sx + dir * 160;
    this.scene.tweens.add({
      targets: [fireball, halo],
      x: endX,
      duration: 400,
      ease: 'Quad.easeIn',
      onComplete: () => {
        // Massive impact explosion
        const flash = this.scene.add.circle(endX, sy, 6, 0xffffff, 1);
        flash.setDepth(GAME_CONFIG.layers.foregroundDecor + 3);
        this.scene.tweens.add({
          targets: flash, scaleX: 5, scaleY: 5, alpha: 0,
          duration: 200, onComplete: () => flash.destroy(),
        });

        // Green explosion ring
        const ring = this.scene.add.circle(endX, sy, 10, 0x88ff44, 0);
        ring.setStrokeStyle(3, 0x88ff44, 0.9);
        ring.setDepth(GAME_CONFIG.layers.foregroundDecor + 2);
        this.scene.tweens.add({
          targets: ring, scaleX: 4, scaleY: 4, alpha: 0,
          duration: 300, onComplete: () => ring.destroy(),
        });

        // Orange fire ring
        const ring2 = this.scene.add.circle(endX, sy, 8, 0xff6600, 0);
        ring2.setStrokeStyle(2, 0xff6600, 0.7);
        ring2.setDepth(GAME_CONFIG.layers.foregroundDecor + 2);
        this.scene.tweens.add({
          targets: ring2, scaleX: 3, scaleY: 3, alpha: 0,
          duration: 250, delay: 50, onComplete: () => ring2.destroy(),
        });

        // Debris sparks
        const debris = this.scene.add.particles(endX, sy, 'vfx_pixel_4', {
          speed: { min: 40, max: 100 },
          angle: { min: 0, max: 360 },
          lifespan: 400,
          tint: [0x88ff44, 0xff6600, 0xffaa00],
          alpha: { start: 1, end: 0 },
          gravityY: 80,
          emitting: false,
        });
        debris.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
        debris.explode(16);
        this.scene.time.delayedCall(450, () => debris.destroy());

        this.scene.cameras.main.shake(120, 0.006);
        fireball.destroy();
        halo.destroy();
        trail.destroy();
        smoke.destroy();
      },
    });
  }

  /**
   * Hunter special1 — charged arrow with golden trail.
   */
  spawnHunterChargedArrow(player) {
    if (!this.scene || !player) return;
    const dir = player.facingRight ? 1 : -1;
    const sx = player.x + dir * 10;
    const sy = player.groundY - 14;

    // Muzzle flash
    const muzzle = this.scene.add.circle(sx, sy, 4, 0xffffcc, 0.9);
    muzzle.setDepth(GAME_CONFIG.layers.foregroundDecor + 2);
    this.scene.tweens.add({
      targets: muzzle, scaleX: 3, scaleY: 3, alpha: 0,
      duration: 120, onComplete: () => muzzle.destroy(),
    });

    // Arrow head
    const arrow = this.scene.add.graphics();
    arrow.setDepth(GAME_CONFIG.layers.foregroundDecor + 2);
    arrow.fillStyle(0xffdd44, 1);
    arrow.fillTriangle(dir * 6, 0, -dir * 2, -3, -dir * 2, 3);
    arrow.fillStyle(0x44bbaa, 0.8);
    arrow.fillRect(-dir * 2, -1, -dir * 12, 2);
    arrow.setPosition(sx, sy);

    // Golden trail
    const trail = this.scene.add.particles(sx, sy, 'vfx_circle', {
      speed: { min: 5, max: 15 },
      angle: dir > 0 ? { min: 160, max: 200 } : { min: -20, max: 20 },
      lifespan: 300,
      tint: [0xffdd44, 0xffaa22, 0x44bbaa],
      alpha: { start: 0.9, end: 0 },
      scale: { start: 0.8, end: 0.1 },
      frequency: 10,
      follow: arrow,
    });
    trail.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);

    // Sparkle trail
    const sparkles = this.scene.add.particles(sx, sy, 'vfx_pixel_4', {
      speed: { min: 3, max: 10 },
      angle: { min: 0, max: 360 },
      lifespan: 250,
      tint: 0xffffff,
      alpha: { start: 0.7, end: 0 },
      scale: { start: 0.5, end: 0 },
      frequency: 20,
      follow: arrow,
    });
    sparkles.setDepth(GAME_CONFIG.layers.foregroundDecor);

    const endX = sx + dir * 140;
    this.scene.tweens.add({
      targets: arrow,
      x: endX,
      duration: 200,
      ease: 'Quad.easeIn',
      onComplete: () => {
        // Golden impact flash
        const flash = this.scene.add.circle(endX, sy, 4, 0xffdd44, 1);
        flash.setDepth(GAME_CONFIG.layers.foregroundDecor + 3);
        this.scene.tweens.add({
          targets: flash, scaleX: 4, scaleY: 4, alpha: 0,
          duration: 180, onComplete: () => flash.destroy(),
        });

        // Impact ring
        const ring = this.scene.add.circle(endX, sy, 6, 0x44bbaa, 0);
        ring.setStrokeStyle(2, 0x44bbaa, 0.8);
        ring.setDepth(GAME_CONFIG.layers.foregroundDecor + 2);
        this.scene.tweens.add({
          targets: ring, scaleX: 3, scaleY: 3, alpha: 0,
          duration: 250, onComplete: () => ring.destroy(),
        });

        // Impact sparks
        const sparks = this.scene.add.particles(endX, sy, 'vfx_pixel_4', {
          speed: { min: 30, max: 60 },
          angle: { min: 0, max: 360 },
          lifespan: 250,
          tint: [0xffdd44, 0x44bbaa],
          alpha: { start: 1, end: 0 },
          gravityY: 50,
          emitting: false,
        });
        sparks.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
        sparks.explode(10);
        this.scene.time.delayedCall(300, () => sparks.destroy());

        arrow.destroy();
        trail.destroy();
        sparkles.destroy();
      },
    });
  }

  /**
   * Hunter special2 — fan of 5 teal arrows spreading outward.
   */
  spawnHunterArrowFan(player) {
    if (!this.scene || !player) return;
    const dir = player.facingRight ? 1 : -1;
    const sx = player.x + dir * 10;
    const sy = player.groundY - 14;

    // Muzzle flash
    const muzzle = this.scene.add.circle(sx, sy, 5, 0x44bbaa, 0.8);
    muzzle.setDepth(GAME_CONFIG.layers.foregroundDecor + 2);
    this.scene.tweens.add({
      targets: muzzle, scaleX: 2.5, scaleY: 2.5, alpha: 0,
      duration: 150, onComplete: () => muzzle.destroy(),
    });

    const angles = [-0.4, -0.2, 0, 0.2, 0.4];
    for (let i = 0; i < 5; i++) {
      this.scene.time.delayedCall(i * 40, () => {
        if (!this.scene) return;
        const angle = angles[i];
        const arrow = this.scene.add.graphics();
        arrow.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
        arrow.fillStyle(0x44bbaa, 1);
        arrow.fillCircle(0, 0, 2.5);
        arrow.fillStyle(0x88ffee, 0.8);
        arrow.fillCircle(0, 0, 1);
        arrow.setPosition(sx, sy);

        const trail = this.scene.add.graphics();
        trail.setDepth(GAME_CONFIG.layers.foregroundDecor);

        const dist = 100 + Math.random() * 20;
        const endX = sx + dir * dist * Math.cos(angle);
        const endY = sy + dist * Math.sin(angle);
        this.scene.tweens.add({
          targets: arrow,
          x: endX, y: endY,
          duration: 200,
          ease: 'Quad.easeIn',
          onUpdate: () => {
            trail.clear();
            trail.lineStyle(2, 0x44bbaa, 0.4);
            trail.beginPath();
            trail.moveTo(sx, sy);
            trail.lineTo(arrow.x, arrow.y);
            trail.strokePath();
            trail.lineStyle(1, 0x88ffee, 0.6);
            trail.beginPath();
            trail.moveTo(sx, sy);
            trail.lineTo(arrow.x, arrow.y);
            trail.strokePath();
          },
          onComplete: () => {
            // Small teal impact
            const impact = this.scene.add.circle(endX, endY, 3, 0x44bbaa, 0.8);
            impact.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
            this.scene.tweens.add({
              targets: impact, scaleX: 2, scaleY: 2, alpha: 0,
              duration: 150, onComplete: () => impact.destroy(),
            });
            arrow.destroy();
            trail.destroy();
          },
        });
      });
    }
  }

  // ─── WARLOCK ABILITY VFX ─────────────────────────────────────

  /**
   * Drain Life — wobbling green beam from caster to target with health orb return.
   */
  onWarlockDrainLife(data) {
    if (!this.scene) return;
    const { source, target, damage } = data;
    if (!source || !target) return;

    const sx = source.x;
    const sy = source.groundY - 14;
    const tx = target.x;
    const ty = target.groundY - 12;

    // Draw wobbling beam — outer green glow + inner white core
    const beam = this.scene.add.graphics();
    beam.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);

    let elapsed = 0;
    const beamTimer = this.scene.time.addEvent({
      delay: 16,
      repeat: 25,
      callback: () => {
        if (!this.scene) { beamTimer.destroy(); return; }
        elapsed += 16;
        beam.clear();
        const segments = 12;
        // Outer green glow
        beam.lineStyle(4, 0x88ff44, 0.4);
        beam.beginPath();
        for (let s = 0; s <= segments; s++) {
          const t = s / segments;
          const bx = sx + (tx - sx) * t;
          const by = sy + (ty - sy) * t + Math.sin(t * Math.PI * 4 + elapsed * 0.01) * 4;
          if (s === 0) beam.moveTo(bx, by);
          else beam.lineTo(bx, by);
        }
        beam.strokePath();
        // Inner white core
        beam.lineStyle(1.5, 0xffffff, 0.8);
        beam.beginPath();
        for (let s = 0; s <= segments; s++) {
          const t = s / segments;
          const bx = sx + (tx - sx) * t;
          const by = sy + (ty - sy) * t + Math.sin(t * Math.PI * 4 + elapsed * 0.01) * 3;
          if (s === 0) beam.moveTo(bx, by);
          else beam.lineTo(bx, by);
        }
        beam.strokePath();
      },
    });
    this.scene.time.delayedCall(450, () => {
      beam.destroy();
      beamTimer.destroy();
    });

    // Green sparkles at source connection
    const srcSparkle = this.scene.add.particles(sx, sy, 'vfx_pixel_4', {
      speed: { min: 8, max: 20 },
      angle: { min: 0, max: 360 },
      lifespan: 250,
      tint: [0x88ff44, 0xccffaa],
      alpha: { start: 0.8, end: 0 },
      emitting: false,
    });
    srcSparkle.setDepth(GAME_CONFIG.layers.foregroundDecor);
    srcSparkle.explode(5);
    this.scene.time.delayedCall(300, () => srcSparkle.destroy());

    // Green sparkles at target connection
    const tgtSparkle = this.scene.add.particles(tx, ty, 'vfx_pixel_4', {
      speed: { min: 8, max: 20 },
      angle: { min: 0, max: 360 },
      lifespan: 250,
      tint: [0x88ff44, 0x44cc22],
      alpha: { start: 0.8, end: 0 },
      emitting: false,
    });
    tgtSparkle.setDepth(GAME_CONFIG.layers.foregroundDecor);
    tgtSparkle.explode(5);
    this.scene.time.delayedCall(300, () => tgtSparkle.destroy());

    // Target dark tint
    if (target.sprite) {
      target.sprite.setTint(0x448844);
      this.scene.time.delayedCall(300, () => {
        if (target.sprite && !target.dead) target.sprite.clearTint();
      });
    }

    // Health orb flying BACK from target to caster
    this.scene.time.delayedCall(200, () => {
      if (!this.scene) return;
      const orb = this.scene.add.graphics();
      orb.setDepth(GAME_CONFIG.layers.foregroundDecor + 2);
      orb.fillStyle(0x88ff44, 0.9);
      orb.fillCircle(0, 0, 4);
      orb.fillStyle(0xffffff, 0.7);
      orb.fillCircle(0, 0, 1.5);
      orb.setPosition(tx, ty);

      const orbTrail = this.scene.add.particles(tx, ty, 'vfx_circle', {
        speed: { min: 3, max: 8 },
        lifespan: 200,
        tint: [0x88ff44, 0x44cc22],
        alpha: { start: 0.7, end: 0 },
        scale: { start: 0.6, end: 0 },
        frequency: 20,
        follow: orb,
      });
      orbTrail.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);

      this.scene.tweens.add({
        targets: orb,
        x: sx, y: sy,
        duration: 350,
        ease: 'Quad.easeIn',
        onComplete: () => {
          // Heal flash at caster
          const healFlash = this.scene.add.circle(sx, sy, 5, 0x88ff44, 0.8);
          healFlash.setDepth(GAME_CONFIG.layers.foregroundDecor + 2);
          this.scene.tweens.add({
            targets: healFlash, scaleX: 2.5, scaleY: 2.5, alpha: 0,
            duration: 200, onComplete: () => healFlash.destroy(),
          });
          orb.destroy();
          orbTrail.destroy();
        },
      });
    });
  }

  /**
   * Fear — purple shockwave ring + smoke + "!" over enemies.
   */
  onWarlockFear(data) {
    if (!this.scene) return;
    const { player, radius } = data;
    if (!player) return;
    const cx = player.x;
    const cy = player.groundY - 8;
    const r = radius || 60;

    // Purple shockwave ring expanding
    const ring = this.scene.add.circle(cx, cy, 10, 0x6622aa, 0);
    ring.setStrokeStyle(3, 0x8844cc, 0.9);
    ring.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
    this.scene.tweens.add({
      targets: ring,
      scaleX: r / 10,
      scaleY: (r / 10) * 0.5,
      alpha: 0,
      duration: 450,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });

    // Second ring, slightly delayed
    this.scene.time.delayedCall(80, () => {
      if (!this.scene) return;
      const ring2 = this.scene.add.circle(cx, cy, 8, 0x8844cc, 0);
      ring2.setStrokeStyle(2, 0xaa66ee, 0.7);
      ring2.setDepth(GAME_CONFIG.layers.foregroundDecor);
      this.scene.tweens.add({
        targets: ring2,
        scaleX: (r / 8) * 0.8,
        scaleY: (r / 8) * 0.4,
        alpha: 0,
        duration: 400,
        onComplete: () => ring2.destroy(),
      });
    });

    // Dark purple smoke puffs in a circle
    const puffCount = 8;
    for (let i = 0; i < puffCount; i++) {
      const angle = (i / puffCount) * Math.PI * 2;
      const px = cx + Math.cos(angle) * (r * 0.5);
      const py = cy + Math.sin(angle) * (r * 0.25);
      this.scene.time.delayedCall(i * 30, () => {
        if (!this.scene) return;
        const puff = this.scene.add.circle(px, py, 4, 0x6622aa, 0.6);
        puff.setDepth(GAME_CONFIG.layers.foregroundDecor);
        this.scene.tweens.add({
          targets: puff,
          scaleX: 3, scaleY: 3, alpha: 0, y: py - 12,
          duration: 500,
          onComplete: () => puff.destroy(),
        });
      });
    }

    // Purple mist rising from ground
    const mist = this.scene.add.particles(cx, cy + 4, 'vfx_circle', {
      speed: { min: 5, max: 15 },
      angle: { min: 250, max: 290 },
      lifespan: 600,
      tint: [0x6622aa, 0x8844cc, 0x442266],
      alpha: { start: 0.5, end: 0 },
      scale: { start: 0.8, end: 2 },
      emitting: false,
    });
    mist.setDepth(GAME_CONFIG.layers.foregroundDecor - 1);
    mist.explode(12);
    this.scene.time.delayedCall(650, () => mist.destroy());

    // Floating "!" over affected enemies
    const enemies = this.scene.getAliveEnemies ? this.scene.getAliveEnemies() : [];
    for (const enemy of enemies) {
      if (!enemy || enemy.dead) continue;
      const dx = enemy.x - cx;
      const dy = (enemy.groundY || enemy.y) - cy;
      if (dx * dx + dy * dy < r * r) {
        const exclaim = this.scene.add.text(enemy.x, (enemy.groundY || enemy.y) - 30, '!', {
          fontSize: '14px',
          fontFamily: 'monospace',
          color: '#8844cc',
          fontStyle: 'bold',
          stroke: '#220044',
          strokeThickness: 2,
        }).setOrigin(0.5);
        exclaim.setDepth(GAME_CONFIG.layers.foregroundDecor + 3);
        this.scene.tweens.add({
          targets: exclaim,
          y: exclaim.y - 16,
          alpha: 0,
          duration: 800,
          ease: 'Quad.easeOut',
          onComplete: () => exclaim.destroy(),
        });
      }
    }
  }

  /**
   * Rain of Fire tick — falling fire meteors with splash and burn.
   */
  onWarlockRainTick(data) {
    if (!this.scene) return;
    const { x, y, radius } = data;
    const r = radius || 40;

    // Random offset within radius
    const ox = x + (Math.random() - 0.5) * r;
    const gy = y;

    // Falling meteor
    const meteor = this.scene.add.graphics();
    meteor.setDepth(GAME_CONFIG.layers.foregroundDecor + 2);
    meteor.fillStyle(0xff6600, 1);
    meteor.fillCircle(0, 0, 4);
    meteor.fillStyle(0xffaa00, 0.7);
    meteor.fillCircle(0, 0, 6);
    meteor.fillStyle(0xff4400, 0.3);
    meteor.fillCircle(0, 0, 9);
    meteor.setPosition(ox, gy - 80);

    // Meteor trail
    const meteorTrail = this.scene.add.particles(ox, gy - 80, 'vfx_pixel_4', {
      speed: { min: 5, max: 15 },
      angle: { min: 250, max: 290 },
      lifespan: 200,
      tint: [0xff6600, 0xff4400, 0xffaa00],
      alpha: { start: 0.8, end: 0 },
      scale: { start: 1, end: 0.3 },
      frequency: 15,
      follow: meteor,
    });
    meteorTrail.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);

    this.scene.tweens.add({
      targets: meteor,
      y: gy,
      duration: 250,
      ease: 'Quad.easeIn',
      onComplete: () => {
        meteor.destroy();
        meteorTrail.destroy();

        // Impact splash — orange/yellow sparks
        const splash = this.scene.add.particles(ox, gy, 'vfx_pixel_4', {
          speed: { min: 30, max: 70 },
          angle: { min: 200, max: 340 },
          lifespan: 300,
          tint: [0xff6600, 0xffaa00, 0xffdd44],
          alpha: { start: 1, end: 0 },
          gravityY: 100,
          emitting: false,
        });
        splash.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
        splash.explode(10);
        this.scene.time.delayedCall(350, () => splash.destroy());

        // Impact flash
        const flash = this.scene.add.circle(ox, gy, 5, 0xffaa00, 0.9);
        flash.setDepth(GAME_CONFIG.layers.foregroundDecor + 2);
        this.scene.tweens.add({
          targets: flash, scaleX: 3, scaleY: 2, alpha: 0,
          duration: 200, onComplete: () => flash.destroy(),
        });

        // Burning ground glow (persistent, low alpha)
        const burn = this.scene.add.circle(ox, gy, r * 0.4, 0xff6600, 0.15);
        burn.setDepth(GAME_CONFIG.layers.foregroundDecor - 1);
        this.scene.tweens.add({
          targets: burn,
          alpha: 0,
          duration: 1200,
          onComplete: () => burn.destroy(),
        });

        // Smoke particles rising
        const smoke = this.scene.add.particles(ox, gy, 'vfx_circle', {
          speed: { min: 5, max: 12 },
          angle: { min: 250, max: 290 },
          lifespan: 500,
          tint: [0x553311, 0x442200],
          alpha: { start: 0.4, end: 0 },
          scale: { start: 0.6, end: 1.5 },
          emitting: false,
        });
        smoke.setDepth(GAME_CONFIG.layers.foregroundDecor);
        smoke.explode(4);
        this.scene.time.delayedCall(550, () => smoke.destroy());
      },
    });
  }

  /**
   * Imp Spawn — green summoning circle + fel fire column.
   */
  onWarlockImpSpawn(data) {
    if (!this.scene) return;
    const { x, y } = data;

    // Green summoning circle expanding
    const circle = this.scene.add.circle(x, y, 4, 0x88ff44, 0);
    circle.setStrokeStyle(2, 0x88ff44, 0.9);
    circle.setDepth(GAME_CONFIG.layers.foregroundDecor);
    this.scene.tweens.add({
      targets: circle,
      scaleX: 4, scaleY: 2, alpha: 0,
      duration: 600,
      ease: 'Quad.easeOut',
      onComplete: () => circle.destroy(),
    });

    // Inner circle glow
    const inner = this.scene.add.circle(x, y, 3, 0x44cc22, 0.3);
    inner.setDepth(GAME_CONFIG.layers.foregroundDecor);
    this.scene.tweens.add({
      targets: inner,
      scaleX: 3, scaleY: 1.5, alpha: 0,
      duration: 500, delay: 50,
      onComplete: () => inner.destroy(),
    });

    // Fel fire column rising from circle
    for (let i = 0; i < 6; i++) {
      this.scene.time.delayedCall(i * 40, () => {
        if (!this.scene) return;
        const flame = this.scene.add.circle(
          x + (Math.random() - 0.5) * 8,
          y,
          2 + Math.random() * 2,
          [0x88ff44, 0x44cc22, 0xccffaa][Math.floor(Math.random() * 3)],
          0.8
        );
        flame.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
        this.scene.tweens.add({
          targets: flame,
          y: y - 24 - Math.random() * 16,
          scaleX: 0.3, scaleY: 0.3, alpha: 0,
          duration: 350,
          onComplete: () => flame.destroy(),
        });
      });
    }

    // Green sparkle burst
    const sparkle = this.scene.add.particles(x, y, 'vfx_pixel_4', {
      speed: { min: 15, max: 40 },
      angle: { min: 0, max: 360 },
      lifespan: 300,
      tint: [0x88ff44, 0xccffaa, 0x44cc22],
      alpha: { start: 1, end: 0 },
      emitting: false,
    });
    sparkle.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
    sparkle.explode(8);
    this.scene.time.delayedCall(350, () => sparkle.destroy());

    // Green smoke puff
    const smoke = this.scene.add.particles(x, y, 'vfx_circle', {
      speed: { min: 5, max: 15 },
      angle: { min: 240, max: 300 },
      lifespan: 400,
      tint: [0x448833, 0x336622],
      alpha: { start: 0.5, end: 0 },
      scale: { start: 0.8, end: 2 },
      emitting: false,
    });
    smoke.setDepth(GAME_CONFIG.layers.foregroundDecor);
    smoke.explode(5);
    this.scene.time.delayedCall(450, () => smoke.destroy());
  }

  /**
   * Imp Attack — small green fireball from imp to target.
   */
  onWarlockImpAttack(data) {
    if (!this.scene) return;
    const { source, target, damage } = data;
    if (!source || !target) return;

    const sx = source.x;
    const sy = source.y;
    const tx = target.x;
    const ty = target.groundY ? target.groundY - 12 : target.y;

    // Small green fireball
    const bolt = this.scene.add.graphics();
    bolt.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
    bolt.fillStyle(0x88ff44, 0.9);
    bolt.fillCircle(0, 0, 3);
    bolt.fillStyle(0xffffff, 0.7);
    bolt.fillCircle(0, 0, 1.2);
    bolt.setPosition(sx, sy);

    // Trail particles
    const trail = this.scene.add.particles(sx, sy, 'vfx_pixel_4', {
      speed: { min: 3, max: 10 },
      lifespan: 150,
      tint: [0x88ff44, 0x44cc22],
      alpha: { start: 0.7, end: 0 },
      scale: { start: 0.5, end: 0 },
      frequency: 20,
      follow: bolt,
    });
    trail.setDepth(GAME_CONFIG.layers.foregroundDecor);

    this.scene.tweens.add({
      targets: bolt,
      x: tx, y: ty,
      duration: 250,
      ease: 'Quad.easeIn',
      onComplete: () => {
        // Small green impact flash
        const flash = this.scene.add.circle(tx, ty, 3, 0x88ff44, 0.9);
        flash.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
        this.scene.tweens.add({
          targets: flash, scaleX: 2.5, scaleY: 2.5, alpha: 0,
          duration: 150, onComplete: () => flash.destroy(),
        });
        bolt.destroy();
        trail.destroy();
      },
    });
  }

  /**
   * Shadowfury — massive purple explosion with lightning arcs.
   */
  onWarlockShadowfury(data) {
    if (!this.scene) return;
    const { player, radius } = data;
    if (!player) return;
    const cx = player.x;
    const cy = player.groundY - 8;
    const r = radius || 50;

    // Brief screen dim
    const overlay = this.scene.add.rectangle(
      this.scene.cameras.main.scrollX + this.scene.cameras.main.width / 2,
      this.scene.cameras.main.scrollY + this.scene.cameras.main.height / 2,
      this.scene.cameras.main.width,
      this.scene.cameras.main.height,
      0x220044, 0.3
    );
    overlay.setDepth(GAME_CONFIG.layers.foregroundDecor + 5);
    overlay.setScrollFactor(0);
    this.scene.tweens.add({
      targets: overlay, alpha: 0,
      duration: 300, onComplete: () => overlay.destroy(),
    });

    // 3 concentric purple rings
    const ringColors = [0x6622aa, 0x8844cc, 0xaa66ee];
    const ringDelays = [0, 40, 80];
    for (let i = 0; i < 3; i++) {
      this.scene.time.delayedCall(ringDelays[i], () => {
        if (!this.scene) return;
        const ring = this.scene.add.circle(cx, cy, 8, ringColors[i], 0);
        ring.setStrokeStyle(3 - i * 0.5, ringColors[i], 0.9 - i * 0.1);
        ring.setDepth(GAME_CONFIG.layers.foregroundDecor + 2);
        this.scene.tweens.add({
          targets: ring,
          scaleX: (r / 8) * (1 - i * 0.15),
          scaleY: (r / 8) * (1 - i * 0.15) * 0.5,
          alpha: 0,
          duration: 400 + i * 60,
          ease: 'Quad.easeOut',
          onComplete: () => ring.destroy(),
        });
      });
    }

    // Purple lightning arcs radiating outward (8 bolts)
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const arc = this.scene.add.graphics();
      arc.setDepth(GAME_CONFIG.layers.foregroundDecor + 3);
      arc.lineStyle(1.5, 0xaa66ee, 0.9);
      arc.beginPath();
      arc.moveTo(cx, cy);
      // Jagged bolt — 3 segments
      let px = cx, py = cy;
      for (let seg = 1; seg <= 3; seg++) {
        const t = seg / 3;
        const bx = cx + Math.cos(angle) * r * t + (Math.random() - 0.5) * 8;
        const by = cy + Math.sin(angle) * r * 0.5 * t + (Math.random() - 0.5) * 6;
        arc.lineTo(bx, by);
        px = bx;
        py = by;
      }
      arc.strokePath();
      this.scene.tweens.add({
        targets: arc, alpha: 0,
        duration: 250 + Math.random() * 100,
        onComplete: () => arc.destroy(),
      });
    }

    // Purple particle debris burst
    const debris = this.scene.add.particles(cx, cy, 'vfx_pixel_4', {
      speed: { min: 30, max: 80 },
      angle: { min: 0, max: 360 },
      lifespan: 400,
      tint: [0x6622aa, 0x8844cc, 0xaa66ee],
      alpha: { start: 1, end: 0 },
      gravityY: 60,
      emitting: false,
    });
    debris.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
    debris.explode(18);
    this.scene.time.delayedCall(450, () => debris.destroy());

    // Ground crack lines in purple
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const crack = this.scene.add.graphics();
      crack.setDepth(GAME_CONFIG.layers.foregroundDecor);
      crack.lineStyle(1, 0x6622aa, 0.7);
      crack.beginPath();
      crack.moveTo(cx, cy + 4);
      const endCx = cx + Math.cos(angle) * (r * 0.6 + Math.random() * 10);
      const endCy = cy + 4 + Math.sin(angle) * (r * 0.3);
      crack.lineTo(
        cx + Math.cos(angle) * r * 0.3 + (Math.random() - 0.5) * 4,
        cy + 4 + Math.sin(angle) * r * 0.15
      );
      crack.lineTo(endCx, endCy);
      crack.strokePath();
      this.scene.tweens.add({
        targets: crack, alpha: 0,
        duration: 600, delay: 100,
        onComplete: () => crack.destroy(),
      });
    }

    // Central flash
    const flash = this.scene.add.circle(cx, cy, 6, 0xffffff, 0.8);
    flash.setDepth(GAME_CONFIG.layers.foregroundDecor + 4);
    this.scene.tweens.add({
      targets: flash, scaleX: 3, scaleY: 3, alpha: 0,
      duration: 150, onComplete: () => flash.destroy(),
    });

    this.scene.cameras.main.shake(150, 0.008);
  }

  /**
   * Immolate — fire ignite on enemy with circling flames.
   */
  onWarlockImmolate(data) {
    if (!this.scene) return;
    const { enemy } = data;
    if (!enemy) return;
    const ex = enemy.x;
    const ey = enemy.groundY ? enemy.groundY - 12 : enemy.y;

    // Rising fire particles
    const fire = this.scene.add.particles(ex, ey, 'vfx_pixel_4', {
      speed: { min: 10, max: 25 },
      angle: { min: 250, max: 290 },
      lifespan: 400,
      tint: [0xff6600, 0xffaa00, 0xff4400],
      alpha: { start: 0.9, end: 0 },
      scale: { start: 1, end: 0.3 },
      emitting: false,
    });
    fire.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
    fire.explode(8);
    this.scene.time.delayedCall(450, () => fire.destroy());

    // Ignite flash
    const flash = this.scene.add.circle(ex, ey, 4, 0xff6600, 0.7);
    flash.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
    this.scene.tweens.add({
      targets: flash, scaleX: 2.5, scaleY: 2.5, alpha: 0,
      duration: 200, onComplete: () => flash.destroy(),
    });

    // Enemy tinted orange briefly
    if (enemy.sprite) {
      enemy.sprite.setTint(0xff8844);
      this.scene.time.delayedCall(400, () => {
        if (enemy.sprite && !enemy.dead) enemy.sprite.clearTint();
      });
    }

    // Small flame particles circling the enemy
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const flame = this.scene.add.circle(
        ex + Math.cos(angle) * 10,
        ey + Math.sin(angle) * 5,
        1.5,
        [0xff6600, 0xffaa00, 0xff4400][i % 3],
        0.8
      );
      flame.setDepth(GAME_CONFIG.layers.foregroundDecor);

      // Orbit once then fade
      this.scene.tweens.add({
        targets: flame,
        x: ex + Math.cos(angle + Math.PI * 2) * 10,
        y: ey + Math.sin(angle + Math.PI * 2) * 5 - 8,
        alpha: 0,
        duration: 600,
        onComplete: () => flame.destroy(),
      });
    }
  }

  /**
   * Immolate Burst — massive explosion on all burning enemies with fire chains.
   */
  onWarlockImmolateBurst(data) {
    if (!this.scene) return;
    const { enemies } = data;
    if (!enemies || enemies.length === 0) return;

    const positions = [];

    // Explosion on each enemy
    for (const enemy of enemies) {
      if (!enemy || enemy.dead) continue;
      const ex = enemy.x;
      const ey = enemy.groundY ? enemy.groundY - 12 : enemy.y;
      positions.push({ x: ex, y: ey });

      // Massive orange explosion
      const blast = this.scene.add.circle(ex, ey, 6, 0xff6600, 0.9);
      blast.setDepth(GAME_CONFIG.layers.foregroundDecor + 2);
      this.scene.tweens.add({
        targets: blast, scaleX: 4, scaleY: 4, alpha: 0,
        duration: 300, onComplete: () => blast.destroy(),
      });

      // Inner white-orange flash
      const core = this.scene.add.circle(ex, ey, 4, 0xffdd44, 1);
      core.setDepth(GAME_CONFIG.layers.foregroundDecor + 3);
      this.scene.tweens.add({
        targets: core, scaleX: 2, scaleY: 2, alpha: 0,
        duration: 150, onComplete: () => core.destroy(),
      });

      // Orange shockwave ring
      const ring = this.scene.add.circle(ex, ey, 8, 0xff6600, 0);
      ring.setStrokeStyle(2, 0xff6600, 0.8);
      ring.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
      this.scene.tweens.add({
        targets: ring, scaleX: 3.5, scaleY: 2, alpha: 0,
        duration: 350, onComplete: () => ring.destroy(),
      });

      // Fire debris
      const debris = this.scene.add.particles(ex, ey, 'vfx_pixel_4', {
        speed: { min: 40, max: 80 },
        angle: { min: 0, max: 360 },
        lifespan: 350,
        tint: [0xff6600, 0xffaa00, 0xff4400],
        alpha: { start: 1, end: 0 },
        gravityY: 80,
        emitting: false,
      });
      debris.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
      debris.explode(12);
      this.scene.time.delayedCall(400, () => debris.destroy());
    }

    // Fire chains connecting all burning enemies briefly
    if (positions.length >= 2) {
      for (let i = 0; i < positions.length - 1; i++) {
        const p1 = positions[i];
        const p2 = positions[i + 1];
        const chain = this.scene.add.graphics();
        chain.setDepth(GAME_CONFIG.layers.foregroundDecor + 2);
        // Outer glow chain
        chain.lineStyle(3, 0xff6600, 0.5);
        chain.beginPath();
        chain.moveTo(p1.x, p1.y);
        // Slight arc through midpoint
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2 - 8;
        chain.lineTo(mx, my);
        chain.lineTo(p2.x, p2.y);
        chain.strokePath();
        // Inner bright chain
        chain.lineStyle(1, 0xffdd44, 0.8);
        chain.beginPath();
        chain.moveTo(p1.x, p1.y);
        chain.lineTo(mx, my);
        chain.lineTo(p2.x, p2.y);
        chain.strokePath();

        this.scene.tweens.add({
          targets: chain, alpha: 0,
          duration: 400,
          onComplete: () => chain.destroy(),
        });
      }
    }

    this.scene.cameras.main.shake(180, 0.01);
  }

  // ─── HUNTER ABILITY VFX ──────────────────────────────────────

  /**
   * Disengage — dust cloud at launch, speed lines, landing puff.
   */
  onHunterDisengage(data) {
    if (!this.scene) return;
    const { player, fromX, fromY } = data;
    if (!player) return;
    const fx = fromX || player.x;
    const fy = fromY || player.groundY;

    // Dust cloud at launch point
    const launchDust = this.scene.add.particles(fx, fy, 'vfx_circle', {
      speed: { min: 15, max: 40 },
      angle: { min: 180, max: 360 },
      lifespan: 350,
      tint: [0xaa9977, 0x886644, 0xccbbaa],
      alpha: { start: 0.7, end: 0 },
      scale: { start: 0.8, end: 1.5 },
      emitting: false,
    });
    launchDust.setDepth(GAME_CONFIG.layers.foregroundDecor);
    launchDust.explode(10);
    this.scene.time.delayedCall(400, () => launchDust.destroy());

    // Brief afterimage at origin
    const ghost = this.scene.add.circle(fx, fy - 12, 6, 0x44bbaa, 0.4);
    ghost.setDepth(GAME_CONFIG.layers.foregroundDecor);
    this.scene.tweens.add({
      targets: ghost, alpha: 0, scaleX: 1.5, scaleY: 1.5,
      duration: 300, onComplete: () => ghost.destroy(),
    });

    // Speed lines behind hunter during leap
    const dir = player.facingRight ? -1 : 1; // lines go opposite of movement
    for (let i = 0; i < 6; i++) {
      this.scene.time.delayedCall(i * 30, () => {
        if (!this.scene || !player) return;
        const line = this.scene.add.graphics();
        line.setDepth(GAME_CONFIG.layers.foregroundDecor);
        const ly = (player.groundY || fy) - 8 + (Math.random() - 0.5) * 16;
        const lx = player.x + dir * 4;
        line.lineStyle(1, 0x44bbaa, 0.6);
        line.beginPath();
        line.moveTo(lx, ly);
        line.lineTo(lx + dir * (12 + Math.random() * 10), ly);
        line.strokePath();
        this.scene.tweens.add({
          targets: line, alpha: 0,
          duration: 200, onComplete: () => line.destroy(),
        });
      });
    }

    // Landing dust puff (delayed to match landing)
    this.scene.time.delayedCall(250, () => {
      if (!this.scene || !player) return;
      const lx = player.x;
      const ly = player.groundY || fy;
      const landDust = this.scene.add.particles(lx, ly, 'vfx_circle', {
        speed: { min: 10, max: 30 },
        angle: { min: 200, max: 340 },
        lifespan: 300,
        tint: [0xaa9977, 0x886644],
        alpha: { start: 0.6, end: 0 },
        scale: { start: 0.6, end: 1.2 },
        emitting: false,
      });
      landDust.setDepth(GAME_CONFIG.layers.foregroundDecor);
      landDust.explode(8);
      this.scene.time.delayedCall(350, () => landDust.destroy());
    });
  }

  /**
   * Trap Place — ice blue circle on ground with pulsing glow.
   */
  onHunterTrapPlace(data) {
    if (!this.scene) return;
    const { x, y } = data;

    // Ice blue circle on ground (persistent)
    const trap = this.scene.add.circle(x, y, 8, 0x88ccff, 0.15);
    trap.setStrokeStyle(1.5, 0x88ccff, 0.6);
    trap.setDepth(GAME_CONFIG.layers.foregroundDecor - 1);
    trap.setScale(1, 0.5);

    // Pulsing glow
    this.scene.tweens.add({
      targets: trap,
      alpha: 0.35,
      duration: 600,
      yoyo: true,
      repeat: 8,
      onComplete: () => trap.destroy(),
    });

    // Crystalline particles around trap
    const crystals = this.scene.add.particles(x, y, 'vfx_pixel_4', {
      speed: { min: 3, max: 8 },
      angle: { min: 250, max: 290 },
      lifespan: 800,
      tint: [0x88ccff, 0xaaddff, 0x66aadd],
      alpha: { start: 0.5, end: 0 },
      scale: { start: 0.4, end: 0 },
      frequency: 200,
      quantity: 1,
    });
    crystals.setDepth(GAME_CONFIG.layers.foregroundDecor - 1);
    this.scene.time.delayedCall(10000, () => crystals.destroy());

    // Placement sparkle
    const sparkle = this.scene.add.particles(x, y, 'vfx_pixel_4', {
      speed: { min: 10, max: 25 },
      angle: { min: 0, max: 360 },
      lifespan: 250,
      tint: [0x88ccff, 0xffffff],
      alpha: { start: 0.8, end: 0 },
      emitting: false,
    });
    sparkle.setDepth(GAME_CONFIG.layers.foregroundDecor);
    sparkle.explode(6);
    this.scene.time.delayedCall(300, () => sparkle.destroy());
  }

  /**
   * Trap Trigger — ice explosion burst with frost crystals.
   */
  onHunterTrapTrigger(data) {
    if (!this.scene) return;
    const { x, y, target } = data;

    // Ice explosion burst — blue/white
    const flash = this.scene.add.circle(x, y, 5, 0xffffff, 1);
    flash.setDepth(GAME_CONFIG.layers.foregroundDecor + 3);
    this.scene.tweens.add({
      targets: flash, scaleX: 4, scaleY: 4, alpha: 0,
      duration: 200, onComplete: () => flash.destroy(),
    });

    // Blue explosion ring
    const ring = this.scene.add.circle(x, y, 8, 0x88ccff, 0);
    ring.setStrokeStyle(3, 0x88ccff, 0.9);
    ring.setDepth(GAME_CONFIG.layers.foregroundDecor + 2);
    this.scene.tweens.add({
      targets: ring, scaleX: 3.5, scaleY: 2, alpha: 0,
      duration: 350, onComplete: () => ring.destroy(),
    });

    // Frost crystals radiating outward
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const crystal = this.scene.add.graphics();
      crystal.setDepth(GAME_CONFIG.layers.foregroundDecor + 2);
      crystal.fillStyle(0x88ccff, 0.9);
      // Diamond shape
      crystal.fillTriangle(0, -3, 2, 0, 0, 3);
      crystal.fillTriangle(0, -3, -2, 0, 0, 3);
      crystal.setPosition(x, y);

      const endX = x + Math.cos(angle) * 25;
      const endY = y + Math.sin(angle) * 15;
      this.scene.tweens.add({
        targets: crystal,
        x: endX, y: endY, alpha: 0, scaleX: 0.3, scaleY: 0.3,
        duration: 350,
        onComplete: () => crystal.destroy(),
      });
    }

    // Frozen vapor cloud
    const vapor = this.scene.add.particles(x, y, 'vfx_circle', {
      speed: { min: 8, max: 25 },
      angle: { min: 0, max: 360 },
      lifespan: 500,
      tint: [0x88ccff, 0xaaddff, 0xffffff],
      alpha: { start: 0.6, end: 0 },
      scale: { start: 0.6, end: 2 },
      emitting: false,
    });
    vapor.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
    vapor.explode(12);
    this.scene.time.delayedCall(550, () => vapor.destroy());

    // Target tinted blue
    if (target && target.sprite) {
      target.sprite.setTint(0x88ccff);
      this.scene.time.delayedCall(500, () => {
        if (target.sprite && !target.dead) target.sprite.clearTint();
      });
    }

    this.scene.cameras.main.shake(80, 0.004);
  }

  /**
   * Rapid Fire tick — thin teal arrow line, fast 100ms.
   */
  onHunterRapidFireTick(data) {
    if (!this.scene) return;
    const { source, target } = data;
    if (!source || !target) return;

    const sx = source.x;
    const sy = source.groundY ? source.groundY - 14 : source.y;
    const tx = target.x;
    const ty = target.groundY ? target.groundY - 12 : target.y;

    // Muzzle flash at source
    const muzzle = this.scene.add.circle(sx, sy, 2, 0x44bbaa, 0.8);
    muzzle.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
    this.scene.tweens.add({
      targets: muzzle, scaleX: 2, scaleY: 2, alpha: 0,
      duration: 80, onComplete: () => muzzle.destroy(),
    });

    // Thin teal arrow line
    const line = this.scene.add.graphics();
    line.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
    line.lineStyle(1.5, 0x44bbaa, 0.9);
    line.beginPath();
    line.moveTo(sx, sy);
    line.lineTo(tx, ty);
    line.strokePath();
    // Inner bright core line
    line.lineStyle(0.5, 0xffffff, 0.6);
    line.beginPath();
    line.moveTo(sx, sy);
    line.lineTo(tx, ty);
    line.strokePath();

    this.scene.tweens.add({
      targets: line, alpha: 0,
      duration: 100, onComplete: () => line.destroy(),
    });

    // Impact spark at target
    const spark = this.scene.add.circle(tx, ty, 2, 0x44bbaa, 0.9);
    spark.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
    this.scene.tweens.add({
      targets: spark, scaleX: 2, scaleY: 2, alpha: 0,
      duration: 120, onComplete: () => spark.destroy(),
    });
  }

  /**
   * Pet Spawn — earthy brown summoning circle with dust and paw prints.
   */
  onHunterPetSpawn(data) {
    if (!this.scene) return;
    const { x, y } = data;

    // Earthy brown summoning circle
    const circle = this.scene.add.circle(x, y, 6, 0x886644, 0);
    circle.setStrokeStyle(2, 0x886644, 0.8);
    circle.setDepth(GAME_CONFIG.layers.foregroundDecor);
    circle.setScale(0.5, 0.25);
    this.scene.tweens.add({
      targets: circle,
      scaleX: 3, scaleY: 1.5, alpha: 0,
      duration: 500,
      onComplete: () => circle.destroy(),
    });

    // Dust puff burst
    const dust = this.scene.add.particles(x, y, 'vfx_circle', {
      speed: { min: 15, max: 35 },
      angle: { min: 200, max: 340 },
      lifespan: 350,
      tint: [0x886644, 0xaa8866, 0x664422],
      alpha: { start: 0.7, end: 0 },
      scale: { start: 0.6, end: 1.2 },
      emitting: false,
    });
    dust.setDepth(GAME_CONFIG.layers.foregroundDecor);
    dust.explode(8);
    this.scene.time.delayedCall(400, () => dust.destroy());

    // Paw print particle effect — small dots in paw pattern
    const pawOffsets = [
      { dx: -4, dy: -4 }, { dx: 4, dy: -4 },
      { dx: -3, dy: 2 }, { dx: 3, dy: 2 },
      { dx: 0, dy: 5 },
    ];
    for (const off of pawOffsets) {
      const paw = this.scene.add.circle(x + off.dx, y + off.dy, 1.5, 0x886644, 0.7);
      paw.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
      this.scene.tweens.add({
        targets: paw, alpha: 0, y: paw.y - 6,
        duration: 600, delay: 100,
        onComplete: () => paw.destroy(),
      });
    }

    // Spawn flash
    const flash = this.scene.add.circle(x, y - 6, 4, 0xaa8866, 0.6);
    flash.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
    this.scene.tweens.add({
      targets: flash, scaleX: 2, scaleY: 2, alpha: 0,
      duration: 200, onComplete: () => flash.destroy(),
    });
  }

  /**
   * Pet Attack — quick slash lines at target with dust.
   */
  onHunterPetAttack(data) {
    if (!this.scene) return;
    const { source, target } = data;
    if (!source || !target) return;

    const tx = target.x;
    const ty = target.groundY ? target.groundY - 12 : target.y;

    // 3-4 claw mark lines
    const clawCount = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < clawCount; i++) {
      const claw = this.scene.add.graphics();
      claw.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
      const color = i % 2 === 0 ? 0x44bbaa : 0x886644;
      claw.lineStyle(1.5, color, 0.9);
      claw.beginPath();
      const startX = tx - 6 + i * 4;
      const startY = ty - 6;
      claw.moveTo(startX, startY);
      claw.lineTo(startX + 2, startY + 12);
      claw.strokePath();

      this.scene.tweens.add({
        targets: claw, alpha: 0,
        duration: 200 + i * 30,
        onComplete: () => claw.destroy(),
      });
    }

    // Dust puff at impact
    const dust = this.scene.add.particles(tx, ty, 'vfx_pixel_4', {
      speed: { min: 10, max: 25 },
      angle: { min: 0, max: 360 },
      lifespan: 200,
      tint: [0x886644, 0xaa9977],
      alpha: { start: 0.6, end: 0 },
      emitting: false,
    });
    dust.setDepth(GAME_CONFIG.layers.foregroundDecor);
    dust.explode(4);
    this.scene.time.delayedCall(250, () => dust.destroy());

    // Quick slash flash
    const flash = this.scene.add.circle(tx, ty, 3, 0x44bbaa, 0.7);
    flash.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
    this.scene.tweens.add({
      targets: flash, scaleX: 2, scaleY: 2, alpha: 0,
      duration: 120, onComplete: () => flash.destroy(),
    });
  }

  /**
   * Volley Arrow — single arrow falling from sky with impact ring.
   */
  onHunterVolleyArrow(data) {
    if (!this.scene) return;
    const { x, y, index } = data;
    const idx = index || 0;

    // Arrow falling from sky — thin line
    const arrow = this.scene.add.graphics();
    arrow.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
    arrow.lineStyle(1.5, 0x44bbaa, 0.9);
    arrow.beginPath();
    arrow.moveTo(0, -8);
    arrow.lineTo(0, 4);
    arrow.strokePath();
    arrow.fillStyle(0x44bbaa, 1);
    arrow.fillTriangle(0, 4, -2, 0, 2, 0);
    const startX = x + (Math.random() - 0.5) * 6;
    arrow.setPosition(startX, y - 60);

    this.scene.tweens.add({
      targets: arrow,
      y: y,
      duration: 180 + idx * 20,
      ease: 'Quad.easeIn',
      onComplete: () => {
        arrow.destroy();

        // Impact ring on ground
        const ring = this.scene.add.circle(startX, y, 4, 0x44bbaa, 0);
        ring.setStrokeStyle(1.5, 0x44bbaa, 0.7);
        ring.setDepth(GAME_CONFIG.layers.foregroundDecor);
        ring.setScale(1, 0.5);
        this.scene.tweens.add({
          targets: ring, scaleX: 2.5, scaleY: 1.2, alpha: 0,
          duration: 250, onComplete: () => ring.destroy(),
        });

        // Dust puff
        const dust = this.scene.add.particles(startX, y, 'vfx_pixel_4', {
          speed: { min: 8, max: 20 },
          angle: { min: 220, max: 320 },
          lifespan: 200,
          tint: [0xaa9977, 0x886644],
          alpha: { start: 0.5, end: 0 },
          emitting: false,
        });
        dust.setDepth(GAME_CONFIG.layers.foregroundDecor);
        dust.explode(4);
        this.scene.time.delayedCall(250, () => dust.destroy());
      },
    });
  }

  /**
   * Kill Shot — massive arrow with trail; huge red explosion if execute.
   */
  onHunterKillShot(data) {
    if (!this.scene) return;
    const { source, target, isExecute } = data;
    if (!source || !target) return;

    const sx = source.x;
    const sy = source.groundY ? source.groundY - 14 : source.y;
    const tx = target.x;
    const ty = target.groundY ? target.groundY - 12 : target.y;

    // Arrow head — large, colored based on execute
    const arrowColor = isExecute ? 0xff4422 : 0xffdd44;
    const trailColor = isExecute ? 0xff6600 : 0x44bbaa;

    const arrow = this.scene.add.graphics();
    arrow.setDepth(GAME_CONFIG.layers.foregroundDecor + 3);
    arrow.fillStyle(arrowColor, 1);
    const dir = tx > sx ? 1 : -1;
    arrow.fillTriangle(dir * 8, 0, -dir * 3, -4, -dir * 3, 4);
    arrow.fillStyle(0xffffff, 0.8);
    arrow.fillCircle(0, 0, 2);
    arrow.setPosition(sx, sy);

    // Long trail of particles
    const trail = this.scene.add.particles(sx, sy, 'vfx_circle', {
      speed: { min: 5, max: 20 },
      angle: dir > 0 ? { min: 150, max: 210 } : { min: -30, max: 30 },
      lifespan: 400,
      tint: [arrowColor, trailColor, 0xffffff],
      alpha: { start: 0.9, end: 0 },
      scale: { start: 1, end: 0.2 },
      frequency: 8,
      follow: arrow,
    });
    trail.setDepth(GAME_CONFIG.layers.foregroundDecor + 2);

    // Extra sparkle trail
    const sparkTrail = this.scene.add.particles(sx, sy, 'vfx_pixel_4', {
      speed: { min: 3, max: 12 },
      angle: { min: 0, max: 360 },
      lifespan: 250,
      tint: 0xffffff,
      alpha: { start: 0.6, end: 0 },
      scale: { start: 0.4, end: 0 },
      frequency: 12,
      follow: arrow,
    });
    sparkTrail.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);

    this.scene.tweens.add({
      targets: arrow,
      x: tx, y: ty,
      duration: 220,
      ease: 'Quad.easeIn',
      onComplete: () => {
        arrow.destroy();
        trail.destroy();
        sparkTrail.destroy();

        if (isExecute) {
          // HUGE red impact explosion
          const flash = this.scene.add.circle(tx, ty, 8, 0xffffff, 1);
          flash.setDepth(GAME_CONFIG.layers.foregroundDecor + 5);
          this.scene.tweens.add({
            targets: flash, scaleX: 5, scaleY: 5, alpha: 0,
            duration: 200, onComplete: () => flash.destroy(),
          });

          // Red explosion ring
          const ring = this.scene.add.circle(tx, ty, 10, 0xff4422, 0);
          ring.setStrokeStyle(4, 0xff4422, 1);
          ring.setDepth(GAME_CONFIG.layers.foregroundDecor + 4);
          this.scene.tweens.add({
            targets: ring, scaleX: 5, scaleY: 5, alpha: 0,
            duration: 350, onComplete: () => ring.destroy(),
          });

          // Second ring
          const ring2 = this.scene.add.circle(tx, ty, 8, 0xff6600, 0);
          ring2.setStrokeStyle(2, 0xff6600, 0.8);
          ring2.setDepth(GAME_CONFIG.layers.foregroundDecor + 3);
          this.scene.tweens.add({
            targets: ring2, scaleX: 3.5, scaleY: 3.5, alpha: 0,
            duration: 300, delay: 40, onComplete: () => ring2.destroy(),
          });

          // Skull icon flash (text-based)
          const skull = this.scene.add.text(tx, ty - 16, '\u2620', {
            fontSize: '18px',
            color: '#ff4422',
            stroke: '#000000',
            strokeThickness: 2,
          }).setOrigin(0.5);
          skull.setDepth(GAME_CONFIG.layers.foregroundDecor + 6);
          this.scene.tweens.add({
            targets: skull,
            y: ty - 36, scaleX: 1.5, scaleY: 1.5, alpha: 0,
            duration: 600, ease: 'Quad.easeOut',
            onComplete: () => skull.destroy(),
          });

          // Bonus red particles
          const redBurst = this.scene.add.particles(tx, ty, 'vfx_pixel_4', {
            speed: { min: 50, max: 120 },
            angle: { min: 0, max: 360 },
            lifespan: 500,
            tint: [0xff4422, 0xff6600, 0xffaa00, 0xff2200],
            alpha: { start: 1, end: 0 },
            gravityY: 80,
            emitting: false,
          });
          redBurst.setDepth(GAME_CONFIG.layers.foregroundDecor + 3);
          redBurst.explode(24);
          this.scene.time.delayedCall(550, () => redBurst.destroy());

          // Heavy screen shake
          this.scene.cameras.main.shake(200, 0.012);
        } else {
          // Normal arrow impact — golden flash
          const flash = this.scene.add.circle(tx, ty, 4, 0xffdd44, 0.9);
          flash.setDepth(GAME_CONFIG.layers.foregroundDecor + 3);
          this.scene.tweens.add({
            targets: flash, scaleX: 3, scaleY: 3, alpha: 0,
            duration: 180, onComplete: () => flash.destroy(),
          });

          // Impact ring
          const ring = this.scene.add.circle(tx, ty, 6, 0xffdd44, 0);
          ring.setStrokeStyle(2, 0xffdd44, 0.7);
          ring.setDepth(GAME_CONFIG.layers.foregroundDecor + 2);
          this.scene.tweens.add({
            targets: ring, scaleX: 2.5, scaleY: 2.5, alpha: 0,
            duration: 250, onComplete: () => ring.destroy(),
          });

          // Sparks
          const sparks = this.scene.add.particles(tx, ty, 'vfx_pixel_4', {
            speed: { min: 25, max: 50 },
            angle: { min: 0, max: 360 },
            lifespan: 250,
            tint: [0xffdd44, 0x44bbaa],
            alpha: { start: 0.9, end: 0 },
            gravityY: 50,
            emitting: false,
          });
          sparks.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
          sparks.explode(8);
          this.scene.time.delayedCall(300, () => sparks.destroy());

          this.scene.cameras.main.shake(60, 0.003);
        }
      },
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  RAID BOSS ABILITY VFX
  // ═══════════════════════════════════════════════════════════

  /** Main telegraph — boss charges up, warning text + danger pulse */
  onRaidBossTelegraph(data) {
    if (!this.scene) return;
    const { enemy, ability, config, x, y, dir } = data;
    if (!enemy) return;
    const dur = config.telegraphTime || 800;

    // Boss body glow pulse
    const glow = this.scene.add.graphics();
    glow.setDepth(GAME_CONFIG.layers.foregroundDecor + 2);
    glow.fillStyle(0xff2200, 0.4);
    glow.fillCircle(x, y - 20, 16);
    this.scene.tweens.add({
      targets: glow, scaleX: 3, scaleY: 2.5, alpha: 0,
      duration: dur, ease: 'Sine.easeInOut',
      onComplete: () => glow.destroy(),
    });

    // Ability name text
    const names = {
      hellfire_rain: 'HELLFIRE RAIN',
      shadow_cleave: 'SHADOW CLEAVE',
      fel_stomp: 'FEL STOMP',
      inferno_charge: 'INFERNO CHARGE',
    };
    const abilityName = names[ability] || ability.toUpperCase();
    const text = this.scene.add.text(x, y - 50, abilityName, {
      fontSize: '8px', fontFamily: 'monospace', color: '#ff4444',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(GAME_CONFIG.layers.ui + 5).setResolution(4);
    this.scene.tweens.add({
      targets: text, y: y - 65, alpha: 0,
      duration: dur + 400, onComplete: () => text.destroy(),
    });

    // Pulsing danger rings
    for (let i = 0; i < 3; i++) {
      this.scene.time.delayedCall(i * (dur / 4), () => {
        if (!this.scene) return;
        const ring = this.scene.add.graphics();
        ring.setDepth(GAME_CONFIG.layers.foregroundDecor);
        ring.lineStyle(2, 0xff4422, 0.6);
        ring.strokeCircle(x, y - 10, 8);
        this.scene.tweens.add({
          targets: ring, scaleX: 5, scaleY: 2.5, alpha: 0,
          duration: dur / 2, onComplete: () => ring.destroy(),
        });
      });
    }

    // Shadow cleave: show frontal danger zone
    if (ability === 'shadow_cleave') {
      const zone = this.scene.add.graphics();
      zone.setDepth(GAME_CONFIG.layers.groundDecor + 2);
      zone.fillStyle(0xff2200, 0.08);
      zone.fillRect(x, y - 30, dir * (config.width || 120), 60);
      zone.setAlpha(0);
      this.scene.tweens.add({
        targets: zone, alpha: 1,
        duration: dur, ease: 'Sine.easeIn',
        onComplete: () => {
          this.scene.tweens.add({
            targets: zone, alpha: 0, duration: 200,
            onComplete: () => zone.destroy(),
          });
        },
      });
      // Pulsing line at cleave boundary
      const line = this.scene.add.graphics();
      line.setDepth(GAME_CONFIG.layers.foregroundDecor);
      line.lineStyle(2, 0xff4444, 0.5);
      line.beginPath();
      line.moveTo(x, y - 30);
      line.lineTo(x + dir * (config.width || 120), y - 30);
      line.lineTo(x + dir * (config.width || 120), y + 30);
      line.lineTo(x, y + 30);
      line.closePath();
      line.strokePath();
      this.scene.tweens.add({
        targets: line, alpha: 0, duration: dur + 200,
        onComplete: () => line.destroy(),
      });
    }

    // Fel stomp: show circular danger zone
    if (ability === 'fel_stomp') {
      const zone = this.scene.add.graphics();
      zone.setDepth(GAME_CONFIG.layers.groundDecor + 2);
      zone.fillStyle(0x44ff22, 0.1);
      zone.fillCircle(x, y, 8);
      zone.setScale(0.5);
      this.scene.tweens.add({
        targets: zone,
        scaleX: (config.radius || 60) / 8,
        scaleY: (config.radius || 60) / 16,
        alpha: 0.35,
        duration: dur, ease: 'Quad.easeIn',
        onComplete: () => {
          this.scene.tweens.add({
            targets: zone, alpha: 0, duration: 150,
            onComplete: () => zone.destroy(),
          });
        },
      });
    }

    // Inferno charge: show charge line
    if (ability === 'inferno_charge') {
      const line = this.scene.add.graphics();
      line.setDepth(GAME_CONFIG.layers.groundDecor + 2);
      line.fillStyle(0xff4400, 0.15);
      line.fillRect(x, y - 10, dir * 200, 20);
      line.setAlpha(0);
      this.scene.tweens.add({
        targets: line, alpha: 1,
        duration: dur,
        onComplete: () => {
          this.scene.tweens.add({
            targets: line, alpha: 0, duration: 300,
            onComplete: () => line.destroy(),
          });
        },
      });
      // Arrow indicators
      for (let i = 0; i < 4; i++) {
        const arrow = this.scene.add.text(x + dir * (40 + i * 40), y - 4, dir > 0 ? '>>>' : '<<<', {
          fontSize: '6px', fontFamily: 'monospace', color: '#ff6644',
        }).setOrigin(0.5).setDepth(GAME_CONFIG.layers.foregroundDecor).setResolution(4).setAlpha(0);
        this.scene.tweens.add({
          targets: arrow, alpha: 0.8,
          duration: dur * 0.6, delay: i * 100,
          yoyo: true,
          onComplete: () => arrow.destroy(),
        });
      }
    }
  }

  /** Hellfire drop — telegraph circle on ground before impact */
  onRaidBossHellfireDrop(data) {
    if (!this.scene) return;
    const { x, y, radius, delay } = data;

    // Warning circle on ground — grows to full size
    const warn = this.scene.add.graphics();
    warn.setDepth(GAME_CONFIG.layers.groundDecor + 3);
    warn.fillStyle(0xff4400, 0.2);
    warn.fillCircle(0, 0, radius);
    warn.setPosition(x, y);
    warn.setScale(0.2);
    warn.lineStyle(1, 0xff6644, 0.6);
    warn.strokeCircle(0, 0, radius);

    this.scene.tweens.add({
      targets: warn, scaleX: 1, scaleY: 0.4,
      alpha: 0.5, duration: delay,
      ease: 'Quad.easeIn',
      onComplete: () => warn.destroy(),
    });
  }

  /** Hellfire impact — explosion at impact point */
  onRaidBossHellfireImpact(data) {
    if (!this.scene) return;
    const { x, y, radius } = data;

    // Flash
    const flash = this.scene.add.circle(x, y, 4, 0xffaa22, 0.9);
    flash.setDepth(GAME_CONFIG.layers.foregroundDecor + 2);
    this.scene.tweens.add({
      targets: flash, scaleX: 4, scaleY: 2, alpha: 0,
      duration: 200, onComplete: () => flash.destroy(),
    });

    // Fire burst
    for (let i = 0; i < 8; i++) {
      const flame = this.scene.add.graphics();
      flame.fillStyle([0xff2200, 0xff6600, 0xffaa00, 0xffdd44][i % 4], 0.8);
      flame.fillCircle(0, 0, 1.5 + Math.random() * 2);
      flame.setPosition(x, y);
      flame.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
      const a = Math.random() * Math.PI * 2;
      const spd = 8 + Math.random() * 16;
      this.scene.tweens.add({
        targets: flame,
        x: x + Math.cos(a) * spd, y: y + Math.sin(a) * spd * 0.4 - 6,
        alpha: 0, scaleX: 2, scaleY: 2,
        duration: 250 + Math.random() * 150,
        onComplete: () => flame.destroy(),
      });
    }

    // Ground scorch
    const scorch = this.scene.add.graphics();
    scorch.fillStyle(0x331100, 0.4);
    scorch.fillCircle(0, 0, radius * 0.5);
    scorch.setPosition(x, y);
    scorch.setDepth(GAME_CONFIG.layers.groundDecor + 1);
    scorch.setScale(1, 0.4);
    this.scene.tweens.add({
      targets: scorch, alpha: 0, delay: 1500, duration: 1000,
      onComplete: () => scorch.destroy(),
    });

    this.scene.cameras.main.shake(50, 0.003);
  }

  /** Shadow Cleave — massive frontal sweep VFX */
  onRaidBossShadowCleave(data) {
    if (!this.scene) return;
    const { enemy, dir, width, x, y } = data;

    // Giant sweeping arc (3 layers)
    for (let layer = 0; layer < 3; layer++) {
      const gfx = this.scene.add.graphics();
      gfx.setDepth(GAME_CONFIG.layers.foregroundDecor + 2 - layer);
      const colors = [0xffffff, 0xff4444, 0xff8844];
      const widths = [6, 4, 2];
      const alphas = [0.9, 0.7, 0.4];
      gfx.lineStyle(widths[layer], colors[layer], alphas[layer]);
      const start = dir > 0 ? -2.2 : Math.PI - 0.6;
      gfx.beginPath();
      gfx.arc(x + dir * 10, y - 15, 40 + layer * 6, start, start + 3.0);
      gfx.strokePath();
      this.scene.tweens.add({
        targets: gfx, alpha: 0, scaleX: 1.3, scaleY: 1.1,
        duration: 350, delay: layer * 30,
        onComplete: () => gfx.destroy(),
      });
    }

    // Fire trail along arc
    for (let i = 0; i < 12; i++) {
      const a = (dir > 0 ? -2.2 : Math.PI - 0.6) + (i / 12) * 3.0;
      const fx = x + dir * 10 + Math.cos(a) * 42;
      const fy = y - 15 + Math.sin(a) * 42;
      const flame = this.scene.add.graphics();
      flame.fillStyle([0xff2222, 0xff6644, 0xffaa44][i % 3], 0.8);
      flame.fillCircle(0, 0, 2 + Math.random() * 2);
      flame.setPosition(fx, fy);
      flame.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
      this.scene.tweens.add({
        targets: flame, y: fy - 8, alpha: 0, scaleX: 2, scaleY: 2,
        duration: 250 + Math.random() * 150, delay: i * 15,
        onComplete: () => flame.destroy(),
      });
    }

    // Ground shockwave
    const ring = this.scene.add.graphics();
    ring.setDepth(GAME_CONFIG.layers.foregroundDecor);
    ring.lineStyle(3, 0xff4444, 0.8);
    ring.strokeCircle(x + dir * 20, y, 6);
    this.scene.tweens.add({
      targets: ring, scaleX: 10, scaleY: 3, alpha: 0,
      duration: 500, onComplete: () => ring.destroy(),
    });

    // Spark explosion
    for (let i = 0; i < 16; i++) {
      const sp = this.scene.add.graphics();
      sp.fillStyle([0xff4444, 0xffaa44, 0xffffff][i % 3], 0.9);
      sp.fillCircle(0, 0, 1 + Math.random() * 1.5);
      sp.setPosition(x + dir * 30, y - 10);
      sp.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
      const a = Math.random() * Math.PI * 2;
      this.scene.tweens.add({
        targets: sp,
        x: sp.x + Math.cos(a) * (15 + Math.random() * 25),
        y: sp.y + Math.sin(a) * (10 + Math.random() * 15),
        alpha: 0, duration: 300 + Math.random() * 200,
        onComplete: () => sp.destroy(),
      });
    }
  }

  /** Fel Stomp — concentric shockwaves + fel green fire */
  onRaidBossFelStomp(data) {
    if (!this.scene) return;
    const { enemy, x, y, radius } = data;

    // White impact flash
    const flash = this.scene.add.circle(x, y, 8, 0xffffff, 1);
    flash.setDepth(GAME_CONFIG.layers.foregroundDecor + 3);
    this.scene.tweens.add({
      targets: flash, scaleX: 6, scaleY: 3, alpha: 0,
      duration: 300, onComplete: () => flash.destroy(),
    });

    // Multiple concentric shockwave rings
    for (let i = 0; i < 4; i++) {
      const ring = this.scene.add.graphics();
      ring.setDepth(GAME_CONFIG.layers.foregroundDecor + 2 - i);
      const colors = [0x44ff22, 0x22cc11, 0x88ff44, 0xffffff];
      ring.lineStyle(3 - Math.min(i, 2), colors[i], 0.8 - i * 0.15);
      ring.strokeCircle(x, y, 5 + i * 2);
      this.scene.tweens.add({
        targets: ring,
        scaleX: (radius / 5) * (1 + i * 0.3),
        scaleY: (radius / 12) * (1 + i * 0.2),
        alpha: 0, duration: 450 + i * 80,
        delay: i * 60, ease: 'Quad.easeOut',
        onComplete: () => ring.destroy(),
      });
    }

    // Ground cracks with green glow
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const len = radius * 0.6 + Math.random() * radius * 0.4;
      const crack = this.scene.add.graphics();
      crack.setDepth(GAME_CONFIG.layers.groundDecor + 3);
      crack.lineStyle(1.5, 0x44ff22, 0.8);
      crack.beginPath();
      crack.moveTo(x, y);
      const segs = 3 + Math.floor(Math.random() * 3);
      for (let s = 1; s <= segs; s++) {
        const t = s / segs;
        crack.lineTo(
          x + Math.cos(angle) * len * t + (Math.random() - 0.5) * 6,
          y + Math.sin(angle) * len * t * 0.35 + (Math.random() - 0.5) * 3
        );
      }
      crack.strokePath();
      this.scene.tweens.add({
        targets: crack, alpha: 0, delay: 1200, duration: 800,
        onComplete: () => crack.destroy(),
      });
    }

    // Debris chunks
    for (let i = 0; i < 14; i++) {
      const chunk = this.scene.add.graphics();
      chunk.fillStyle([0x44ff22, 0x887766, 0x665544, 0x22cc11][i % 4], 0.9);
      chunk.fillRect(-1, -1, 2 + Math.random() * 3, 2 + Math.random() * 3);
      chunk.setPosition(x + (Math.random() - 0.5) * 20, y);
      chunk.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
      const la = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
      const spd = 30 + Math.random() * 80;
      const dur = 400 + Math.random() * 400;
      this.scene.tweens.add({
        targets: chunk,
        x: chunk.x + Math.cos(la) * spd * (dur / 1000),
        angle: Phaser.Math.Between(-360, 360),
        duration: dur,
      });
      this.scene.tweens.add({
        targets: chunk,
        y: chunk.y + Math.sin(la) * spd * 0.4 * (dur / 1000),
        duration: dur * 0.4, ease: 'Quad.easeOut',
        onComplete: () => {
          this.scene.tweens.add({
            targets: chunk, y: y + 4, duration: dur * 0.6, ease: 'Quad.easeIn',
          });
        },
      });
      this.scene.tweens.add({
        targets: chunk, alpha: 0, delay: dur * 0.7, duration: dur * 0.3,
        onComplete: () => chunk.destroy(),
      });
    }

    // Fel green fire column
    for (let i = 0; i < 10; i++) {
      const flame = this.scene.add.graphics();
      flame.fillStyle([0x44ff22, 0x88ff44, 0x22cc11][i % 3], 0.7);
      flame.fillCircle(0, 0, 2 + Math.random() * 3);
      flame.setPosition(x + (Math.random() - 0.5) * 30, y);
      flame.setDepth(GAME_CONFIG.layers.foregroundDecor + 1);
      this.scene.tweens.add({
        targets: flame,
        y: y - 20 - Math.random() * 30,
        x: flame.x + (Math.random() - 0.5) * 10,
        alpha: 0, scaleX: 0.5, scaleY: 2,
        duration: 400 + Math.random() * 300,
        delay: i * 30,
        onComplete: () => flame.destroy(),
      });
    }
  }

  /** Charge trail — fire left on ground during inferno charge */
  onRaidBossChargeTrail(data) {
    if (!this.scene) return;
    const { x, y } = data;

    // Small fire puff
    const fire = this.scene.add.graphics();
    fire.fillStyle([0xff4400, 0xff6600, 0xff8800][Phaser.Math.Between(0, 2)], 0.6);
    fire.fillCircle(0, 0, 2 + Math.random() * 2);
    fire.setPosition(x + (Math.random() - 0.5) * 8, y);
    fire.setDepth(GAME_CONFIG.layers.groundDecor + 2);
    this.scene.tweens.add({
      targets: fire, y: y - 6, alpha: 0.3, scaleY: 1.5,
      duration: 2500,
    });
    this.scene.tweens.add({
      targets: fire, alpha: 0, delay: 2500, duration: 1000,
      onComplete: () => fire.destroy(),
    });
  }

  /** Charge end — skid + impact VFX */
  onRaidBossChargeEnd(data) {
    if (!this.scene) return;
    const { enemy } = data;
    if (!enemy) return;

    // Skid dust burst
    for (let i = 0; i < 8; i++) {
      const dust = this.scene.add.graphics();
      dust.fillStyle(0xaa8866, 0.5);
      dust.fillCircle(0, 0, 2 + Math.random() * 3);
      dust.setPosition(enemy.x + (Math.random() - 0.5) * 20, enemy.groundY);
      dust.setDepth(GAME_CONFIG.layers.foregroundDecor);
      this.scene.tweens.add({
        targets: dust,
        x: dust.x + (Math.random() - 0.5) * 25,
        y: dust.y - 5 - Math.random() * 10,
        alpha: 0, scaleX: 1.5, scaleY: 1,
        duration: 400, onComplete: () => dust.destroy(),
      });
    }
    this.scene.cameras.main.shake(150, 0.008);
  }

  /** Trail fade — fire trail dissipates */
  onRaidBossTrailFade(data) {
    // Trail fires auto-fade via their own tweens — this is a placeholder for cleanup
  }

  // ═══════════════════════════════════════════════════════════
  //  ADVANCED ENEMY AI VFX
  // ═══════════════════════════════════════════════════════════

  /** Dash start — dust kick + speed lines */
  onEnemyDash(data) {
    if (!this.scene) return;
    const { enemy } = data;
    if (!enemy || enemy.dead) return;
    const color = ENEMY_COLORS[enemy.enemyKey] || 0xff6644;

    // Dust puff at start
    for (let i = 0; i < 6; i++) {
      const dust = this.scene.add.graphics();
      dust.fillStyle(0x887766, 0.6);
      dust.fillCircle(0, 0, Phaser.Math.Between(1, 3));
      dust.setPosition(enemy.x, enemy.groundY);
      dust.setDepth(GAME_CONFIG.layers.entities + enemy.groundY - 1);
      this.scene.tweens.add({
        targets: dust,
        x: enemy.x + (Math.random() - 0.5) * 20,
        y: enemy.groundY - Math.random() * 8,
        alpha: 0, scaleX: 2, scaleY: 2,
        duration: 250 + Math.random() * 150,
        onComplete: () => dust.destroy(),
      });
    }

    // Speed lines behind enemy
    const dir = enemy.facingRight ? -1 : 1;
    for (let i = 0; i < 4; i++) {
      const line = this.scene.add.graphics();
      line.setDepth(GAME_CONFIG.layers.foregroundDecor);
      line.lineStyle(1, color, 0.7);
      const lx = enemy.x + dir * 6;
      const ly = enemy.groundY - 8 + (i - 1.5) * 5;
      line.beginPath();
      line.moveTo(lx, ly);
      line.lineTo(lx + dir * Phaser.Math.Between(12, 25), ly);
      line.strokePath();
      this.scene.tweens.add({
        targets: line, alpha: 0, duration: 200,
        delay: i * 30,
        onComplete: () => line.destroy(),
      });
    }
  }

  /** Dash end — skid dust */
  onEnemyDashEnd(data) {
    if (!this.scene) return;
    const { enemy } = data;
    if (!enemy || enemy.dead) return;
    for (let i = 0; i < 4; i++) {
      const dust = this.scene.add.graphics();
      dust.fillStyle(0x998877, 0.5);
      dust.fillCircle(0, 0, 1 + Math.random() * 2);
      dust.setPosition(enemy.x, enemy.groundY);
      dust.setDepth(GAME_CONFIG.layers.entities + enemy.groundY - 1);
      this.scene.tweens.add({
        targets: dust,
        x: enemy.x + (Math.random() - 0.5) * 16,
        y: enemy.groundY - Math.random() * 6,
        alpha: 0,
        duration: 200,
        onComplete: () => dust.destroy(),
      });
    }
  }

  /** Afterimage — ghostly trailing copy of enemy */
  onEnemyAfterimage(data) {
    if (!this.scene) return;
    const { enemy } = data;
    if (!enemy || enemy.dead) return;
    const color = ENEMY_COLORS[enemy.enemyKey] || 0xff6644;

    const ghost = this.scene.add.graphics();
    ghost.setDepth(GAME_CONFIG.layers.entities + enemy.groundY - 1);
    ghost.fillStyle(color, 0.4);
    ghost.fillRect(-6, -20, 12, 20);
    ghost.setPosition(enemy.x, enemy.groundY);
    this.scene.tweens.add({
      targets: ghost,
      alpha: 0, scaleX: 1.3, scaleY: 1.1,
      duration: 180,
      onComplete: () => ghost.destroy(),
    });
  }

  /** Jump start — growing shadow on ground */
  onEnemyJumpStart(data) {
    if (!this.scene) return;
    const { enemy, targetX, targetY } = data;
    if (!enemy) return;

    // Shadow at landing zone
    const shadow = this.scene.add.graphics();
    shadow.setDepth(GAME_CONFIG.layers.groundDecor + 1);
    shadow.fillStyle(0x000000, 0.15);
    shadow.fillCircle(0, 0, 6);
    shadow.setPosition(targetX, targetY + 2);
    shadow.setScale(0.3);

    this.scene.tweens.add({
      targets: shadow,
      scaleX: 2.5, scaleY: 1,
      alpha: 0.35,
      duration: 400,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.scene.tweens.add({
          targets: shadow, alpha: 0, duration: 150,
          onComplete: () => shadow.destroy(),
        });
      },
    });

    // Launch particles at origin
    const color = ENEMY_COLORS[enemy.enemyKey] || 0xff6644;
    for (let i = 0; i < 5; i++) {
      const p = this.scene.add.graphics();
      p.fillStyle(color, 0.6);
      p.fillCircle(0, 0, 1);
      p.setPosition(enemy.x, enemy.groundY);
      p.setDepth(GAME_CONFIG.layers.foregroundDecor);
      this.scene.tweens.add({
        targets: p,
        x: enemy.x + (Math.random() - 0.5) * 20,
        y: enemy.groundY + Math.random() * 6,
        alpha: 0,
        duration: 300,
        onComplete: () => p.destroy(),
      });
    }
  }

  /** Jump slam impact — massive shockwave + debris + cracks */
  onEnemyJumpSlam(data) {
    if (!this.scene) return;
    const { enemy, x, y, radius } = data;
    if (!enemy) return;
    const color = ENEMY_COLORS[enemy.enemyKey] || 0xff6644;
    const isBoss = enemy.enemyData?.type === 'boss';
    const scale = isBoss ? 1.6 : 1.0;

    // White impact flash
    const flash = this.scene.add.circle(x, y, 5 * scale, 0xffffff, 0.9);
    flash.setDepth(GAME_CONFIG.layers.foregroundDecor);
    this.scene.tweens.add({
      targets: flash, scaleX: 4 * scale, scaleY: 2 * scale, alpha: 0,
      duration: 200, onComplete: () => flash.destroy(),
    });

    // Shockwave ring
    const ring = this.scene.add.graphics();
    ring.setDepth(GAME_CONFIG.layers.foregroundDecor);
    ring.lineStyle(isBoss ? 3 : 2, color, 0.8);
    ring.strokeCircle(x, y, 4);
    this.scene.tweens.add({
      targets: ring,
      scaleX: 8 * scale, scaleY: 3 * scale,
      alpha: 0, duration: 400,
      onComplete: () => ring.destroy(),
    });

    // Secondary ring (bosses only)
    if (isBoss) {
      const ring2 = this.scene.add.graphics();
      ring2.setDepth(GAME_CONFIG.layers.foregroundDecor);
      ring2.lineStyle(2, 0xffffff, 0.5);
      ring2.strokeCircle(x, y, 6);
      this.scene.tweens.add({
        targets: ring2,
        scaleX: 6, scaleY: 2.5, alpha: 0,
        duration: 350, delay: 60,
        onComplete: () => ring2.destroy(),
      });
    }

    // Ground crack lines radiating outward
    const crackCount = isBoss ? 8 : 5;
    for (let i = 0; i < crackCount; i++) {
      const angle = (i / crackCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const len = (radius * 0.8 + Math.random() * radius * 0.5) * scale;
      const crack = this.scene.add.graphics();
      crack.setDepth(GAME_CONFIG.layers.groundDecor + 2);
      crack.lineStyle(1, 0x444444, 0.7);
      crack.beginPath();
      crack.moveTo(x, y);
      // Jagged crack line
      const segments = 3 + Math.floor(Math.random() * 3);
      for (let s = 1; s <= segments; s++) {
        const t = s / segments;
        const px = x + Math.cos(angle) * len * t + (Math.random() - 0.5) * 4;
        const py = y + Math.sin(angle) * len * t * 0.4 + (Math.random() - 0.5) * 2;
        crack.lineTo(px, py);
      }
      crack.strokePath();
      this.scene.tweens.add({
        targets: crack, alpha: 0, delay: 800, duration: 600,
        onComplete: () => crack.destroy(),
      });
    }

    // Debris chunks launching upward
    const debrisCount = isBoss ? 10 : 6;
    for (let i = 0; i < debrisCount; i++) {
      const rock = this.scene.add.graphics();
      rock.setDepth(GAME_CONFIG.layers.foregroundDecor);
      const rc = [0x887766, 0x776655, 0x665544, color][Phaser.Math.Between(0, 3)];
      rock.fillStyle(rc, 1);
      rock.fillRect(-1, -1, 2 + Math.random() * 2, 2 + Math.random() * 2);
      rock.setPosition(x + (Math.random() - 0.5) * radius * 0.6, y);

      const launchAngle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
      const speed = Phaser.Math.Between(40, 120) * scale;
      const dur = Phaser.Math.Between(300, 600);
      const endX = rock.x + Math.cos(launchAngle) * speed * (dur / 1000);
      const peakY = y - Math.abs(Math.sin(launchAngle)) * speed * 0.4;

      this.scene.tweens.add({
        targets: rock, x: endX, angle: Phaser.Math.Between(-360, 360),
        duration: dur, ease: 'Linear',
      });
      this.scene.tweens.add({
        targets: rock, y: peakY,
        duration: dur * 0.4, ease: 'Quad.easeOut',
        onComplete: () => {
          this.scene.tweens.add({
            targets: rock, y: y + 2, duration: dur * 0.6, ease: 'Quad.easeIn',
          });
        },
      });
      this.scene.tweens.add({
        targets: rock, alpha: 0, delay: dur * 0.7, duration: dur * 0.3,
        onComplete: () => rock.destroy(),
      });
    }

    // Dust cloud
    for (let i = 0; i < 8; i++) {
      const dust = this.scene.add.graphics();
      dust.fillStyle(0xaa9988, 0.4);
      dust.fillCircle(0, 0, 2 + Math.random() * 3);
      dust.setPosition(x + (Math.random() - 0.5) * 20, y);
      dust.setDepth(GAME_CONFIG.layers.foregroundDecor);
      this.scene.tweens.add({
        targets: dust,
        x: dust.x + (Math.random() - 0.5) * 30,
        y: dust.y - 5 - Math.random() * 10,
        alpha: 0, scaleX: 2, scaleY: 1.5,
        duration: 300 + Math.random() * 200,
        onComplete: () => dust.destroy(),
      });
    }
  }

  /** Dodge — smoke puff + blur at origin */
  onEnemyDodge(data) {
    if (!this.scene) return;
    const { enemy, fromX, fromY } = data;
    if (!enemy) return;
    const color = ENEMY_COLORS[enemy.enemyKey] || 0xff6644;

    // Smoke puff at dodge origin
    for (let i = 0; i < 5; i++) {
      const puff = this.scene.add.graphics();
      puff.fillStyle(0xaaaaaa, 0.4);
      puff.fillCircle(0, 0, 2 + Math.random() * 2);
      puff.setPosition(fromX, fromY - 8);
      puff.setDepth(GAME_CONFIG.layers.foregroundDecor);
      this.scene.tweens.add({
        targets: puff,
        x: fromX + (Math.random() - 0.5) * 16,
        y: fromY - 12 - Math.random() * 8,
        alpha: 0, scaleX: 1.5, scaleY: 1.5,
        duration: 200 + Math.random() * 100,
        onComplete: () => puff.destroy(),
      });
    }

    // Ghost silhouette at origin
    const ghost = this.scene.add.graphics();
    ghost.fillStyle(color, 0.35);
    ghost.fillRect(-6, -20, 12, 20);
    ghost.setPosition(fromX, fromY);
    ghost.setDepth(GAME_CONFIG.layers.entities + fromY - 1);
    this.scene.tweens.add({
      targets: ghost,
      alpha: 0, scaleX: 1.5, scaleY: 1.2,
      duration: 250,
      onComplete: () => ghost.destroy(),
    });
  }

  /** Enemy special ability — type-specific spectacular VFX */
  onEnemySpecial(data) {
    if (!this.scene) return;
    const { enemy, ability, x, y, dir } = data;
    if (!enemy) return;
    const color = ENEMY_COLORS[enemy.enemyKey] || 0xff6644;

    if (ability === 'cleaving_spin') {
      this._vfxCleavingSpin(x, y, color, enemy);
    } else if (ability === 'fire_breath') {
      this._vfxFireBreath(x, y, dir || 1, color, enemy);
    } else if (ability === 'ground_pound' || ability === 'ice_shatter') {
      this._vfxGroundPound(x, y, color, enemy, ability === 'ice_shatter');
    } else if (ability === 'magma_slam') {
      this._vfxMagmaSlam(x, y, dir || 1, color, enemy);
    } else if (ability === 'water_surge') {
      this._vfxWaterSurge(x, y, dir || 1, color, enemy);
    } else if (ability === 'void_zone') {
      this._vfxVoidZone(x, y, enemy);
    }
  }

  // ── Cleaving Spin: whirling 360° slash arcs ──
  _vfxCleavingSpin(cx, cy, color, enemy) {
    // Double rotating arcs
    for (let ring = 0; ring < 2; ring++) {
      const gfx = this.scene.add.graphics();
      gfx.setDepth(GAME_CONFIG.layers.foregroundDecor);
      const r = 24 + ring * 8;
      gfx.lineStyle(3 - ring, ring === 0 ? 0xffffff : color, 0.8 - ring * 0.3);
      gfx.beginPath();
      const start = ring * 1.2;
      gfx.arc(cx, cy - 10, r, start, start + 4.5);
      gfx.strokePath();
      this.scene.tweens.add({
        targets: gfx, alpha: 0, angle: 90 * (ring === 0 ? 1 : -1),
        duration: 350, onComplete: () => gfx.destroy(),
      });
    }
    // Spark ring burst
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const spark = this.scene.add.graphics();
      spark.fillStyle(color, 0.9);
      spark.fillCircle(0, 0, 1.5);
      spark.setPosition(cx, cy - 10);
      spark.setDepth(GAME_CONFIG.layers.foregroundDecor);
      this.scene.tweens.add({
        targets: spark,
        x: cx + Math.cos(angle) * 30,
        y: cy - 10 + Math.sin(angle) * 12,
        alpha: 0, duration: 250,
        onComplete: () => spark.destroy(),
      });
    }
  }

  // ── Fire Breath: cone of layered fire particles ──
  _vfxFireBreath(cx, cy, dir, color, enemy) {
    const fireColors = [0xff2200, 0xff6600, 0xffaa00, 0xffdd44];
    const coneLen = 55;
    const spread = 35;
    for (let i = 0; i < 20; i++) {
      const t = Math.random();
      const angle = (Math.random() - 0.5) * 0.8;
      const fx = cx + dir * coneLen * t;
      const fy = cy - 12 + Math.sin(angle) * spread * t;
      const flame = this.scene.add.graphics();
      flame.setDepth(GAME_CONFIG.layers.foregroundDecor);
      const fc = fireColors[Phaser.Math.Between(0, fireColors.length - 1)];
      flame.fillStyle(fc, 0.8);
      flame.fillCircle(0, 0, 1.5 + t * 2.5);
      flame.setPosition(cx + dir * 8, cy - 12);
      this.scene.tweens.add({
        targets: flame,
        x: fx, y: fy - Math.random() * 6,
        alpha: 0, scaleX: 1.5 + t, scaleY: 1.2 + t * 0.5,
        duration: 200 + t * 250,
        delay: i * 15,
        onComplete: () => flame.destroy(),
      });
    }
    // Ground scorch
    const scorch = this.scene.add.graphics();
    scorch.fillStyle(0x332200, 0.3);
    scorch.fillCircle(0, 0, 4);
    scorch.setPosition(cx + dir * 30, cy);
    scorch.setDepth(GAME_CONFIG.layers.groundDecor + 1);
    scorch.setScale(3, 0.8);
    this.scene.tweens.add({
      targets: scorch, alpha: 0, delay: 1000, duration: 1500,
      onComplete: () => scorch.destroy(),
    });
  }

  // ── Ground Pound: concentric shockwaves + ice variant ──
  _vfxGroundPound(cx, cy, color, enemy, isIce) {
    const tint = isIce ? 0x88ddff : color;
    // Concentric rings
    for (let i = 0; i < 3; i++) {
      const ring = this.scene.add.graphics();
      ring.setDepth(GAME_CONFIG.layers.foregroundDecor);
      ring.lineStyle(2, i === 0 ? 0xffffff : tint, 0.7 - i * 0.15);
      ring.strokeCircle(cx, cy, 4 + i * 2);
      this.scene.tweens.add({
        targets: ring,
        scaleX: 6 + i * 2, scaleY: 2.5 + i * 0.5,
        alpha: 0, duration: 350 + i * 80,
        delay: i * 60,
        onComplete: () => ring.destroy(),
      });
    }
    // Ice crystals or rock debris
    const count = isIce ? 8 : 6;
    for (let i = 0; i < count; i++) {
      const shard = this.scene.add.graphics();
      shard.setDepth(GAME_CONFIG.layers.foregroundDecor);
      if (isIce) {
        shard.fillStyle(0xaaddff, 0.8);
        shard.fillTriangle(0, -4, -2, 2, 2, 2);
      } else {
        shard.fillStyle(0x887766, 0.8);
        shard.fillRect(-1, -1, 3, 3);
      }
      const angle = (i / count) * Math.PI * 2;
      shard.setPosition(cx, cy - 2);
      this.scene.tweens.add({
        targets: shard,
        x: cx + Math.cos(angle) * 28,
        y: cy + Math.sin(angle) * 10 - 8,
        angle: Phaser.Math.Between(-180, 180),
        alpha: 0, duration: 350,
        onComplete: () => shard.destroy(),
      });
    }
  }

  // ── Magma Slam: fire + molten ground pool ──
  _vfxMagmaSlam(cx, cy, dir, color, enemy) {
    this._vfxFireBreath(cx, cy, dir, color, enemy);
    // Molten pool
    const pool = this.scene.add.graphics();
    pool.fillStyle(0xff4400, 0.4);
    pool.fillCircle(0, 0, 5);
    pool.setPosition(cx + dir * 20, cy);
    pool.setDepth(GAME_CONFIG.layers.groundDecor + 1);
    pool.setScale(0.5, 0.3);
    this.scene.tweens.add({
      targets: pool, scaleX: 4, scaleY: 1.5, alpha: 0.6,
      duration: 300,
    });
    this.scene.tweens.add({
      targets: pool, alpha: 0, delay: 1500, duration: 1000,
      onComplete: () => pool.destroy(),
    });
  }

  // ── Water Surge: rushing wave line ──
  _vfxWaterSurge(cx, cy, dir, color, enemy) {
    for (let i = 0; i < 12; i++) {
      const drop = this.scene.add.graphics();
      drop.setDepth(GAME_CONFIG.layers.foregroundDecor);
      drop.fillStyle([0x44ddaa, 0x33ccbb, 0x88eeff][i % 3], 0.7);
      drop.fillCircle(0, 0, 1.5 + Math.random() * 2);
      drop.setPosition(cx + dir * 8, cy - 10 + (Math.random() - 0.5) * 14);
      this.scene.tweens.add({
        targets: drop,
        x: cx + dir * (20 + i * 6 + Math.random() * 10),
        y: drop.y + (Math.random() - 0.5) * 8 - 4,
        alpha: 0, scaleX: 1.3, scaleY: 0.8,
        duration: 200 + i * 30,
        delay: i * 25,
        onComplete: () => drop.destroy(),
      });
    }
    // Splash at end
    this.scene.time.delayedCall(200, () => {
      const splash = this.scene.add.graphics();
      splash.setDepth(GAME_CONFIG.layers.foregroundDecor);
      splash.lineStyle(2, 0x44ddaa, 0.6);
      splash.strokeCircle(cx + dir * 60, cy - 6, 3);
      this.scene.tweens.add({
        targets: splash, scaleX: 4, scaleY: 2, alpha: 0,
        duration: 250, onComplete: () => splash.destroy(),
      });
    });
  }

  // ── Void Zone: dark persistent pool with reaching tendrils ──
  _vfxVoidZone(cx, cy, enemy) {
    // Dark pool
    const pool = this.scene.add.graphics();
    pool.setDepth(GAME_CONFIG.layers.groundDecor + 2);
    pool.fillStyle(0x220044, 0.5);
    pool.fillCircle(0, 0, 8);
    pool.setPosition(cx, cy);
    pool.setScale(0.3, 0.2);
    this.scene.tweens.add({
      targets: pool, scaleX: 3.5, scaleY: 1.5, alpha: 0.6,
      duration: 400,
    });
    this.scene.tweens.add({
      targets: pool, alpha: 0, delay: 3000, duration: 800,
      onComplete: () => pool.destroy(),
    });

    // Tendril particles rising from pool
    const tendrilEvent = this.scene.time.addEvent({
      delay: 200, repeat: 14,
      callback: () => {
        if (!this.scene) return;
        for (let i = 0; i < 3; i++) {
          const t = this.scene.add.graphics();
          t.fillStyle([0x6622aa, 0x8844cc, 0x4411aa][i], 0.6);
          t.fillCircle(0, 0, 1 + Math.random());
          t.setPosition(cx + (Math.random() - 0.5) * 20, cy + (Math.random() - 0.5) * 6);
          t.setDepth(GAME_CONFIG.layers.foregroundDecor);
          this.scene.tweens.add({
            targets: t, y: t.y - 10 - Math.random() * 12,
            alpha: 0, scaleX: 0.5, scaleY: 2,
            duration: 300 + Math.random() * 200,
            onComplete: () => t.destroy(),
          });
        }
      },
    });
    this.scene.time.delayedCall(3200, () => tendrilEvent.destroy());
  }

  /** Boss swoop — bright dive streak */
  onEnemySwoop(data) {
    if (!this.scene) return;
    const { enemy, targetX, targetY } = data;
    if (!enemy) return;
    const color = ENEMY_COLORS[enemy.enemyKey] || 0xff6644;

    // Dive streak line from current position to target
    const gfx = this.scene.add.graphics();
    gfx.setDepth(GAME_CONFIG.layers.foregroundDecor);
    gfx.lineStyle(3, color, 0.8);
    gfx.beginPath();
    gfx.moveTo(enemy.x, enemy.y);
    gfx.lineTo(targetX, targetY);
    gfx.strokePath();
    gfx.lineStyle(1, 0xffffff, 0.6);
    gfx.beginPath();
    gfx.moveTo(enemy.x, enemy.y);
    gfx.lineTo(targetX, targetY);
    gfx.strokePath();
    this.scene.tweens.add({
      targets: gfx, alpha: 0, duration: 400,
      onComplete: () => gfx.destroy(),
    });
  }

  /** Boss flight start — rising particles + wing glow */
  onEnemyFlyStart(data) {
    if (!this.scene) return;
    const { enemy } = data;
    if (!enemy) return;
    const color = ENEMY_COLORS[enemy.enemyKey] || 0xff6644;

    // Updraft particles
    for (let i = 0; i < 10; i++) {
      const p = this.scene.add.graphics();
      p.fillStyle(color, 0.5);
      p.fillCircle(0, 0, 1 + Math.random());
      p.setPosition(
        enemy.x + (Math.random() - 0.5) * 20,
        enemy.groundY + 4
      );
      p.setDepth(GAME_CONFIG.layers.foregroundDecor);
      this.scene.tweens.add({
        targets: p,
        y: enemy.groundY - 20 - Math.random() * 15,
        alpha: 0,
        duration: 400 + Math.random() * 300,
        delay: i * 40,
        onComplete: () => p.destroy(),
      });
    }

    // Ground dust ring
    const ring = this.scene.add.graphics();
    ring.setDepth(GAME_CONFIG.layers.groundDecor + 1);
    ring.lineStyle(1, 0x998877, 0.5);
    ring.strokeCircle(enemy.x, enemy.groundY, 4);
    this.scene.tweens.add({
      targets: ring, scaleX: 4, scaleY: 1.5, alpha: 0,
      duration: 500, onComplete: () => ring.destroy(),
    });
  }

  /** Boss flight end — landing dust */
  onEnemyFlyEnd(data) {
    if (!this.scene) return;
    const { enemy } = data;
    if (!enemy) return;
    for (let i = 0; i < 6; i++) {
      const dust = this.scene.add.graphics();
      dust.fillStyle(0x998877, 0.4);
      dust.fillCircle(0, 0, 1.5 + Math.random() * 2);
      dust.setPosition(enemy.x + (Math.random() - 0.5) * 16, enemy.groundY);
      dust.setDepth(GAME_CONFIG.layers.entities + enemy.groundY - 1);
      this.scene.tweens.add({
        targets: dust,
        x: dust.x + (Math.random() - 0.5) * 20,
        y: dust.y - Math.random() * 6,
        alpha: 0, scaleX: 1.5, scaleY: 1,
        duration: 300,
        onComplete: () => dust.destroy(),
      });
    }
  }

  /** Boss enrage — red pulse + body aura */
  onEnemyEnrage(data) {
    if (!this.scene) return;
    const { enemy } = data;
    if (!enemy) return;

    // Red pulse expanding
    const pulse = this.scene.add.graphics();
    pulse.setDepth(GAME_CONFIG.layers.foregroundDecor);
    pulse.fillStyle(0xff2222, 0.3);
    pulse.fillCircle(enemy.x, enemy.groundY - 12, 8);
    this.scene.tweens.add({
      targets: pulse, scaleX: 6, scaleY: 4, alpha: 0,
      duration: 600, onComplete: () => pulse.destroy(),
    });

    // Warning text
    const text = this.scene.add.text(enemy.x, enemy.y - 36, 'ENRAGED!', {
      fontSize: '7px', fontFamily: 'monospace', color: '#ff4444',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(GAME_CONFIG.layers.ui).setResolution(4);
    this.scene.tweens.add({
      targets: text, y: enemy.y - 48, alpha: 0,
      duration: 1200, onComplete: () => text.destroy(),
    });

    // Rage particles for 2 seconds
    const rageEvent = this.scene.time.addEvent({
      delay: 100, repeat: 19,
      callback: () => {
        if (!this.scene || !enemy || enemy.dead) return;
        const p = this.scene.add.graphics();
        p.fillStyle([0xff2222, 0xff6644, 0xff4444][Phaser.Math.Between(0, 2)], 0.7);
        p.fillCircle(0, 0, 1 + Math.random());
        p.setPosition(
          enemy.x + (Math.random() - 0.5) * 16,
          enemy.groundY - Math.random() * 24
        );
        p.setDepth(GAME_CONFIG.layers.foregroundDecor);
        this.scene.tweens.add({
          targets: p, y: p.y - 8, alpha: 0,
          duration: 300, onComplete: () => p.destroy(),
        });
      },
    });
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
    this.scene.events.off('raidBossTelegraph', this.onRaidBossTelegraph, this);
    this.scene.events.off('raidBossHellfireDrop', this.onRaidBossHellfireDrop, this);
    this.scene.events.off('raidBossHellfireImpact', this.onRaidBossHellfireImpact, this);
    this.scene.events.off('raidBossShadowCleave', this.onRaidBossShadowCleave, this);
    this.scene.events.off('raidBossFelStomp', this.onRaidBossFelStomp, this);
    this.scene.events.off('raidBossChargeTrail', this.onRaidBossChargeTrail, this);
    this.scene.events.off('raidBossChargeEnd', this.onRaidBossChargeEnd, this);
    this.scene.events.off('raidBossTrailFade', this.onRaidBossTrailFade, this);
    this.scene.events.off('priestPenance', this.onPriestPenance, this);
    this.scene.events.off('priestHymnHeal', this.onPriestHymnHeal, this);
    this.scene.events.off('priestRadiance', this.onPriestRadiance, this);
    this.scene.events.off('priestRadianceTick', this.onPriestRadianceTick, this);
    this.scene.events.off('priestHolyFirePillar', this.onPriestHolyFirePillar, this);
    this.scene.events.off('priestSpiritLink', this.onPriestSpiritLink, this);
    this.scene.events.off('priestLightningSmite', this.onPriestLightningSmite, this);
    this.scene.events.off('warlockDrainLife', this.onWarlockDrainLife, this);
    this.scene.events.off('warlockFear', this.onWarlockFear, this);
    this.scene.events.off('warlockRainTick', this.onWarlockRainTick, this);
    this.scene.events.off('warlockImpSpawn', this.onWarlockImpSpawn, this);
    this.scene.events.off('warlockImpAttack', this.onWarlockImpAttack, this);
    this.scene.events.off('warlockShadowfury', this.onWarlockShadowfury, this);
    this.scene.events.off('warlockImmolate', this.onWarlockImmolate, this);
    this.scene.events.off('warlockImmolateBurst', this.onWarlockImmolateBurst, this);
    this.scene.events.off('hunterDisengage', this.onHunterDisengage, this);
    this.scene.events.off('hunterTrapPlace', this.onHunterTrapPlace, this);
    this.scene.events.off('hunterTrapTrigger', this.onHunterTrapTrigger, this);
    this.scene.events.off('hunterRapidFireTick', this.onHunterRapidFireTick, this);
    this.scene.events.off('hunterPetSpawn', this.onHunterPetSpawn, this);
    this.scene.events.off('hunterPetAttack', this.onHunterPetAttack, this);
    this.scene.events.off('hunterVolleyArrow', this.onHunterVolleyArrow, this);
    this.scene.events.off('hunterKillShot', this.onHunterKillShot, this);
    this.scene.events.off('enemyDash', this.onEnemyDash, this);
    this.scene.events.off('enemyDashEnd', this.onEnemyDashEnd, this);
    this.scene.events.off('enemyAfterimage', this.onEnemyAfterimage, this);
    this.scene.events.off('enemyJumpStart', this.onEnemyJumpStart, this);
    this.scene.events.off('enemyJumpSlam', this.onEnemyJumpSlam, this);
    this.scene.events.off('enemyDodge', this.onEnemyDodge, this);
    this.scene.events.off('enemySpecial', this.onEnemySpecial, this);
    this.scene.events.off('enemySwoop', this.onEnemySwoop, this);
    this.scene.events.off('enemyFlyStart', this.onEnemyFlyStart, this);
    this.scene.events.off('enemyFlyEnd', this.onEnemyFlyEnd, this);
    this.scene.events.off('enemyEnrage', this.onEnemyEnrage, this);
  }
}
