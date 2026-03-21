/**
 * AFFIX MANAGER — M+ Affix system with tiered random selection and full mechanics.
 */

import Phaser from 'phaser';
import { AFFIXES, KEYSTONE_SCALING, GAME_CONFIG } from '../config/game.js';

export class AffixManager {
  constructor(scene, keystoneLevel) {
    this.scene = scene;
    this.keystoneLevel = keystoneLevel;
    this.activeAffixes = this.selectAffixes(keystoneLevel);
    this.groundEffects = [];
    this.volcanicTimer = 0;
    this.afflictedTimer = 0;
    this.burstStacks = 0;
    this.burstTimer = 0;

    scene.events.on('enemyDeath', this.onEnemyDeath, this);
    scene.events.on('enemyAttack', this.onEnemyAttack, this);
  }

  selectAffixes(level) {
    const affixes = [];
    const pick = (pool) => pool[Math.floor(Math.random() * pool.length)];

    // Tier 1: keystone 1+
    if (level >= 1) {
      affixes.push(pick(['raging', 'bolstering']));
    }
    // Tier 2: keystone 5+
    if (level >= 5) {
      affixes.push(pick(['sanguine', 'volcanic']));
    }
    // Tier 3: keystone 10+
    if (level >= 10) {
      affixes.push(pick(['necrotic', 'bursting']));
    }
    // Tier 4: keystone 20+
    if (level >= 20) {
      affixes.push('afflicted');
    }

    return affixes;
  }

  applySpawnModifiers(enemy) {
    // Keystone scaling
    const lvl = this.keystoneLevel;
    const hpScale = 1 + lvl * KEYSTONE_SCALING.hpPerLevel;
    const dmgScale = 1 + lvl * KEYSTONE_SCALING.damagePerLevel;
    enemy.maxHp = Math.round(enemy.maxHp * hpScale);
    enemy.hp = enemy.maxHp;
    enemy.power *= dmgScale;
  }

  onEnemyDeath(enemy) {
    for (const key of this.activeAffixes) {
      if (key === 'bolstering') this.triggerBolstering(enemy);
      if (key === 'sanguine') this.triggerSanguine(enemy);
      if (key === 'bursting') this.triggerBursting();
    }
  }

  onEnemyAttack(data) {
    if (!this.activeAffixes.includes('necrotic')) return;
    const { enemy, hitbox } = data;
    const party = this.scene.getPartyMembers();
    const affix = AFFIXES.necrotic;

    for (const member of party) {
      if (member.hp <= 0) continue;
      const dist = Phaser.Math.Distance.Between(
        hitbox.x + hitbox.width / 2, hitbox.y + hitbox.height / 2,
        member.x, member.groundY || member.y
      );
      if (dist <= 30) {
        if (!member.necroticStacks) member.necroticStacks = 0;
        if (!member.necroticDecayTimer) member.necroticDecayTimer = 0;
        member.necroticStacks = Math.min(affix.maxStacks, member.necroticStacks + 1);
        member.necroticDecayTimer = affix.decayDelay;
      }
    }
  }

  // --- RAGING ---
  checkRaging() {
    if (!this.activeAffixes.includes('raging')) return;
    const affix = AFFIXES.raging;
    const enemies = this.scene.getAliveEnemies();
    for (const enemy of enemies) {
      const pct = enemy.hp / enemy.maxHp;
      if (pct <= affix.hpThreshold && !enemy._raging) {
        enemy._raging = true;
        enemy._ragingBasePower = enemy.power;
        enemy.power *= (1 + affix.damageBoost);
        // Raging VFX sprite
        if (this.scene.textures.exists('raging_fx')) {
          enemy._ragingSprite = this.scene.add.sprite(0, -enemy.sprite.height - 8, 'raging_fx');
          enemy._ragingSprite.play('raging_fx_anim');
          enemy.add(enemy._ragingSprite);
        }
      }
    }
  }

  // --- BOLSTERING ---
  triggerBolstering(deadEnemy) {
    const affix = AFFIXES.bolstering;
    const enemies = this.scene.getAliveEnemies();
    for (const enemy of enemies) {
      const dist = Phaser.Math.Distance.Between(
        deadEnemy.x, deadEnemy.groundY, enemy.x, enemy.groundY
      );
      if (dist <= affix.radius) {
        enemy.maxHp = Math.round(enemy.maxHp * (1 + affix.hpBoost));
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + Math.round(enemy.maxHp * affix.hpBoost));
        enemy.power *= (1 + affix.damageBoost);
        if (!enemy._bolsterStacks) enemy._bolsterStacks = 0;
        enemy._bolsterStacks++;
        // Bolster VFX
        if (this.scene.textures.exists('bolstering_fx')) {
          const fx = this.scene.add.sprite(enemy.x, enemy.groundY - 20, 'bolstering_fx');
          fx.play('bolstering_fx_anim');
          fx.setDepth(GAME_CONFIG.layers.foregroundDecor);
          fx.once('animationcomplete', () => fx.destroy());
        }
      }
    }
  }

  // --- SANGUINE ---
  triggerSanguine(deadEnemy) {
    const affix = AFFIXES.sanguine;
    const pool = {
      x: deadEnemy.x,
      y: deadEnemy.groundY || deadEnemy.y,
      radius: affix.poolRadius,
      timer: affix.poolDuration,
    };
    this.groundEffects.push(pool);

    if (this.scene.textures.exists('sanguine_fx')) {
      pool._visual = this.scene.add.sprite(pool.x, pool.y, 'sanguine_fx');
      pool._visual.play('sanguine_fx_anim');
      pool._visual.setDepth(GAME_CONFIG.layers.groundDecor);
    } else {
      pool._visual = this.scene.add.circle(pool.x, pool.y, affix.poolRadius, 0xcc2020, 0.3);
      pool._visual.setDepth(GAME_CONFIG.layers.groundDecor);
    }
  }

  // --- VOLCANIC ---
  updateVolcanic(dt) {
    if (!this.activeAffixes.includes('volcanic')) return;
    const affix = AFFIXES.volcanic;
    const enemies = this.scene.getAliveEnemies();
    if (enemies.length === 0) return;

    this.volcanicTimer += dt;
    if (this.volcanicTimer < affix.spawnInterval) return;
    this.volcanicTimer -= affix.spawnInterval;

    const party = this.scene.getPartyMembers();
    if (party.length === 0) return;
    const target = party[Phaser.Math.Between(0, party.length - 1)];
    const vx = target.x;
    const vy = target.groundY || target.y;

    // Telegraph warning
    let telegraph;
    if (this.scene.textures.exists('volcanic_fx')) {
      telegraph = this.scene.add.sprite(vx, vy, 'volcanic_fx');
      telegraph.play('volcanic_telegraph_anim');
      telegraph.setDepth(GAME_CONFIG.layers.groundDecor + 5);
    } else {
      telegraph = this.scene.add.circle(vx, vy, 8, 0xff8844, 0.4);
      telegraph.setDepth(GAME_CONFIG.layers.groundDecor + 5);
      this.scene.tweens.add({
        targets: telegraph, scaleX: 5, scaleY: 5, alpha: 0.6,
        duration: affix.telegraphDuration,
      });
    }

    // Eruption after telegraph
    this.scene.time.delayedCall(affix.telegraphDuration, () => {
      telegraph.destroy();
      // Play eruption VFX
      if (this.scene.textures.exists('volcanic_fx')) {
        const eruption = this.scene.add.sprite(vx, vy, 'volcanic_fx');
        eruption.play('volcanic_eruption_anim');
        eruption.setDepth(GAME_CONFIG.layers.foregroundDecor);
        eruption.once('animationcomplete', () => eruption.destroy());
      }

      // Deal damage
      for (const member of this.scene.getPartyMembers()) {
        if (member.hp <= 0) continue;
        const dist = Phaser.Math.Distance.Between(vx, vy, member.x, member.groundY || member.y);
        if (dist <= affix.radius) {
          const dmg = Math.round(member.maxHp * affix.damage);
          member.takeDamage(dmg, null, 0);
        }
      }
    });
  }

  // --- BURSTING ---
  triggerBursting() {
    const affix = AFFIXES.bursting;
    this.burstStacks++;
    this.burstTimer = affix.burstDuration;
  }

  updateBursting(dt) {
    if (!this.activeAffixes.includes('bursting')) return;
    if (this.burstStacks <= 0 || this.burstTimer <= 0) return;

    const affix = AFFIXES.bursting;
    this.burstTimer -= dt;

    // Tick damage every second
    this._burstTickTimer = (this._burstTickTimer || 0) + dt;
    if (this._burstTickTimer >= 1000) {
      this._burstTickTimer -= 1000;
      const party = this.scene.getPartyMembers();
      for (const member of party) {
        if (member.hp <= 0) continue;
        const dmg = Math.round(member.maxHp * affix.damagePercent * this.burstStacks);
        member.takeDamage(dmg, null, 0);
      }
    }

    if (this.burstTimer <= 0) {
      this.burstStacks = 0;
    }
  }

  // --- NECROTIC ---
  updateNecrotic(dt) {
    if (!this.activeAffixes.includes('necrotic')) return;
    const affix = AFFIXES.necrotic;
    const party = this.scene.getPartyMembers();

    for (const member of party) {
      if (!member.necroticStacks || member.necroticStacks <= 0) continue;

      member.necroticDecayTimer -= dt;
      if (member.necroticDecayTimer <= 0) {
        // Decay 1 stack per second
        member._necroticDecayTick = (member._necroticDecayTick || 0) + dt;
        if (member._necroticDecayTick >= affix.decayRate) {
          member._necroticDecayTick -= affix.decayRate;
          member.necroticStacks = Math.max(0, member.necroticStacks - 1);
        }
      }

      // Store healing reduction for CombatSystem to read
      member.healingReduction = member.necroticStacks * affix.healReductionPerStack;
    }
  }

  // --- AFFLICTED ---
  updateAfflicted(dt) {
    if (!this.activeAffixes.includes('afflicted')) return;
    const affix = AFFIXES.afflicted;
    const enemies = this.scene.getAliveEnemies();
    if (enemies.length === 0) return;

    this.afflictedTimer += dt;
    if (this.afflictedTimer < affix.spawnInterval) return;
    this.afflictedTimer -= affix.spawnInterval;

    const party = this.scene.getPartyMembers();
    if (party.length === 0) return;
    const target = party[Phaser.Math.Between(0, party.length - 1)];
    if (target.hp <= 0) return;

    target._afflictedTimer = affix.dispelWindow;

    // Afflicted VFX
    if (this.scene.textures.exists('afflicted_fx')) {
      target._afflictedSprite = this.scene.add.sprite(0, -target.sprite.height - 16, 'afflicted_fx');
      target._afflictedSprite.play('afflicted_fx_anim');
      target.add(target._afflictedSprite);
    }

    // Countdown — stun if not dispelled
    this.scene.time.delayedCall(affix.dispelWindow, () => {
      if (target._afflictedTimer !== undefined && target._afflictedTimer <= 0) return; // Dispelled
      if (target.hp <= 0) return;
      // Check if healed to full (dispel condition)
      if (target.hp >= target.maxHp) {
        if (target._afflictedSprite) { target._afflictedSprite.destroy(); target._afflictedSprite = null; }
        return;
      }
      // Stun the player
      if (target._afflictedSprite) { target._afflictedSprite.destroy(); target._afflictedSprite = null; }
      target._afflictedTimer = undefined;
      // Force hitstun for stun duration
      if (!target.isAI) {
        target.knockbackVelocity = { x: 0, y: 0 };
        target.hitstunDuration = affix.stunDuration;
        target.fsm.locked = false;
        target.fsm.forceState('hitstun');
      }
    });
  }

  // --- SANGUINE GROUND EFFECTS ---
  updateSanguine(dt) {
    const affix = AFFIXES.sanguine;
    for (let i = this.groundEffects.length - 1; i >= 0; i--) {
      const pool = this.groundEffects[i];
      pool.timer -= dt;

      // Heal enemies in pool
      const enemies = this.scene.getAliveEnemies();
      for (const enemy of enemies) {
        const dist = Phaser.Math.Distance.Between(pool.x, pool.y, enemy.x, enemy.groundY);
        if (dist <= pool.radius) {
          enemy.hp = Math.min(enemy.maxHp, enemy.hp + Math.round(enemy.maxHp * affix.enemyHealPercent * (dt / 1000)));
        }
      }

      // Damage players in pool
      const party = this.scene.getPartyMembers();
      for (const member of party) {
        if (member.hp <= 0) continue;
        const dist = Phaser.Math.Distance.Between(pool.x, pool.y, member.x, member.groundY || member.y);
        if (dist <= pool.radius) {
          const dmg = Math.round(member.maxHp * affix.playerDamagePercent * (dt / 1000));
          if (dmg > 0) member.takeDamage(dmg, null, 0);
        }
      }

      if (pool.timer <= 0) {
        if (pool._visual) pool._visual.destroy();
        this.groundEffects.splice(i, 1);
      }
    }
  }

  update(dt) {
    this.checkRaging();
    this.updateSanguine(dt);
    this.updateVolcanic(dt);
    this.updateBursting(dt);
    this.updateNecrotic(dt);
    this.updateAfflicted(dt);
  }

  getActiveAffixNames() {
    return this.activeAffixes.map(key => AFFIXES[key]?.name || key);
  }

  getActiveAffixKeys() {
    return [...this.activeAffixes];
  }

  destroy() {
    this.scene.events.off('enemyDeath', this.onEnemyDeath, this);
    this.scene.events.off('enemyAttack', this.onEnemyAttack, this);
    for (const effect of this.groundEffects) {
      if (effect._visual) effect._visual.destroy();
    }
  }
}
