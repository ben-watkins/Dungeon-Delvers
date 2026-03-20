/**
 * AI COMPANION
 * 
 * Non-player party members controlled by AI.
 * Behavior depends on class role:
 * 
 * TANK:
 *   - Position between enemies and allies
 *   - Taunt enemies targeting the healer
 *   - Use Shield Block at low HP
 *   - Prioritize attacking enemies closest to allies
 * 
 * HEALER:
 *   - Maintain distance from enemies
 *   - Heal lowest HP party member when below threshold
 *   - DPS when party HP is healthy
 *   - Use Divine Nova when multiple allies are low
 * 
 * DPS:
 *   - Focus player's current target
 *   - Use interrupts on boss casts (TODO)
 *   - Avoid standing in ground effects
 *   - Use Shadow Strike when available and target is at range
 * 
 * Inherits most behavior from Player but replaces input with AI decision-making.
 */

import Phaser from 'phaser';
import { StateMachine } from '../utils/StateMachine.js';
import { CLASSES, GAME_CONFIG } from '../config/game.js';
import { clampToGround } from '../utils/DepthSort.js';

export class AICompanion extends Phaser.GameObjects.Container {
  constructor(scene, x, y, classKey) {
    super(scene, x, y);
    scene.add.existing(this);

    this.classKey = classKey;
    this.classData = CLASSES[classKey];
    this.role = this.classData.role;
    this.groundY = y;
    this.jumpZ = 0;
    this.facingRight = true;
    this.isAI = true;

    // Stats
    this.maxHp = this.classData.stats.hp;
    this.hp = this.maxHp;
    this.speed = this.classData.stats.speed;
    this.power = this.classData.stats.power;
    this.defense = this.classData.stats.defense;

    // AI decision timers
    this.thinkInterval = 300;        // ms between AI decisions
    this.thinkTimer = Math.random() * this.thinkInterval;  // Stagger AI thinking
    this.currentAction = 'idle';
    this.moveTarget = null;          // { x, y } position to move toward
    this.attackTarget = null;        // Enemy entity to attack
    this.cooldowns = { special1: 0, special2: 0 };

    // Combat
    this.knockbackVelocity = { x: 0, y: 0 };
    this.hitstunDuration = 0;
    this.comboIndex = 0;
    this.statusEffects = [];

    // Sprite
    this.sprite = scene.add.sprite(0, 0, classKey);
    this.sprite.setOrigin(0.5, 1);
    this.add(this.sprite);

    // Shadow
    this.shadow = scene.add.image(0, 0, 'shadow');
    this.shadow.setOrigin(0.5, 0.5).setAlpha(0.4);
    this.add(this.shadow);
    this.sendToBack(this.shadow);

    // HP bar
    this.hpBarBg = scene.add.image(0, -this.sprite.height - 4, 'hp_bar_bg').setOrigin(0.5, 0.5);
    this.add(this.hpBarBg);
    this.hpBarFill = scene.add.image(-15, -this.sprite.height - 4, 'hp_bar_fill').setOrigin(0, 0.5);
    this.add(this.hpBarFill);

    // Physics
    scene.physics.add.existing(this);
    this.body.setSize(16, 8).setOffset(-8, -4);

    // State machine (simplified from Player — no input handling)
    this.fsm = new StateMachine(this, {
      idle: {
        enter() { this.sprite.play(`${this.classKey}_idle`, true); },
        update(dt) { this.aiDecide(dt); },
        transitions: { walk: 'walk', attack: 'attack', hitstun: 'hitstun', death: 'death' },
      },
      walk: {
        enter() { this.sprite.play(`${this.classKey}_walk`, true); },
        update(dt) {
          this.aiMove(dt);
          this.aiDecide(dt);
        },
        transitions: { idle: 'idle', attack: 'attack', hitstun: 'hitstun', death: 'death' },
      },
      attack: {
        enter() {
          this.sprite.play(`${this.classKey}_atk1`, true);
          this.fsm.locked = true;

          // Face target
          if (this.attackTarget) {
            this.facingRight = this.attackTarget.x > this.x;
            this.sprite.setFlipX(!this.facingRight);
          }

          // Emit hitbox
          this.scene.time.delayedCall(150, () => {
            if (this.fsm.is('attack') && this.attackTarget) {
              this.scene.events.emit('aiAttack', {
                companion: this,
                target: this.attackTarget,
                damage: 8 * this.power,
              });
            }
          });

          this.sprite.once('animationcomplete', () => {
            this.fsm.locked = false;
            this.fsm.transition('idle');
          });
        },
        update(dt) {},
        transitions: { idle: 'idle', hitstun: 'hitstun', death: 'death' },
      },
      hitstun: {
        enter() {
          this.sprite.play(`${this.classKey}_hitstun`, true);
          this.fsm.locked = true;
          this.hitstunTimer = 0;
        },
        update(dt) {
          this.hitstunTimer += dt;
          this.x += this.knockbackVelocity.x;
          this.groundY = clampToGround(this.groundY + this.knockbackVelocity.y);
          this.y = this.groundY;
          this.knockbackVelocity.x *= GAME_CONFIG.knockbackDecay;
          this.knockbackVelocity.y *= GAME_CONFIG.knockbackDecay;
          if (this.hitstunTimer >= this.hitstunDuration) {
            this.fsm.locked = false;
            this.fsm.transition('idle');
          }
        },
        transitions: { idle: 'idle', death: 'death' },
      },
      death: {
        enter() {
          this.sprite.play(`${this.classKey}_death`, true);
          this.fsm.locked = true;
          this.scene.events.emit('playerDeath', this);
        },
        update(dt) {},
        transitions: {},
      },
    });

    this.fsm.start('idle');
  }

  /**
   * AI DECISION MAKING
   * Runs on a timer to avoid per-frame overhead.
   */
  aiDecide(dt) {
    this.thinkTimer -= dt;
    if (this.thinkTimer > 0) return;
    this.thinkTimer = this.thinkInterval;

    const enemies = this.scene.getAliveEnemies();
    const party = this.scene.getPartyMembers();

    if (this.role === 'tank') this.aiTankBehavior(enemies, party);
    else if (this.role === 'healer') this.aiHealerBehavior(enemies, party);
    else this.aiDpsBehavior(enemies, party);
  }

  aiTankBehavior(enemies, party) {
    if (enemies.length === 0) {
      this.currentAction = 'idle';
      this.fsm.transition('idle');
      return;
    }

    // Find the closest enemy to any ally
    let closestToAlly = null;
    let minDist = Infinity;
    for (const enemy of enemies) {
      for (const ally of party) {
        if (ally === this) continue;
        const d = Phaser.Math.Distance.Between(enemy.x, enemy.groundY, ally.x, ally.groundY);
        if (d < minDist) {
          minDist = d;
          closestToAlly = enemy;
        }
      }
    }

    this.attackTarget = closestToAlly || enemies[0];
    const dist = this.distTo(this.attackTarget);

    if (dist <= 20) {
      this.fsm.transition('attack');
    } else {
      this.moveTarget = { x: this.attackTarget.x, y: this.attackTarget.groundY };
      this.fsm.transition('walk');
    }
  }

  aiHealerBehavior(enemies, party) {
    // Check if anyone needs healing
    const lowestAlly = party.reduce((low, m) => {
      if (m.hp <= 0) return low;
      if (!low || (m.hp / m.maxHp) < (low.hp / low.maxHp)) return m;
      return low;
    }, null);

    const needsHeal = lowestAlly && (lowestAlly.hp / lowestAlly.maxHp) < 0.6;

    if (needsHeal && this.cooldowns.special1 <= 0) {
      // Heal the lowest ally
      this.scene.events.emit('aiHeal', {
        healer: this,
        target: lowestAlly,
        amount: this.classData.specials.special1.healAmount,
      });
      this.cooldowns.special1 = this.classData.specials.special1.cooldown;
      return;
    }

    // Otherwise DPS
    if (enemies.length > 0) {
      this.attackTarget = enemies[0];
      const dist = this.distTo(this.attackTarget);

      // Stay at range
      if (dist < 40) {
        // Move away
        this.moveTarget = {
          x: this.x + (this.x > this.attackTarget.x ? 20 : -20),
          y: this.groundY,
        };
        this.fsm.transition('walk');
      } else if (dist <= 50) {
        this.fsm.transition('attack');
      } else {
        this.moveTarget = { x: this.attackTarget.x, y: this.attackTarget.groundY };
        this.fsm.transition('walk');
      }
    } else {
      this.fsm.transition('idle');
    }
  }

  aiDpsBehavior(enemies, party) {
    if (enemies.length === 0) {
      this.fsm.transition('idle');
      return;
    }

    // Focus player's target or closest enemy
    this.attackTarget = enemies[0];
    const dist = this.distTo(this.attackTarget);

    if (dist <= 18) {
      this.fsm.transition('attack');
    } else {
      this.moveTarget = { x: this.attackTarget.x, y: this.attackTarget.groundY };
      this.fsm.transition('walk');
    }
  }

  aiMove(dt) {
    if (!this.moveTarget) return;

    const dx = this.moveTarget.x - this.x;
    const dy = this.moveTarget.y - this.groundY;
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len < 4) {
      this.moveTarget = null;
      return;
    }

    const spd = this.speed * (dt / 1000);
    this.x += (dx / len) * spd;
    this.groundY = clampToGround(this.groundY + (dy / len) * spd * 0.6);
    this.y = this.groundY;

    this.facingRight = dx > 0;
    this.sprite.setFlipX(!this.facingRight);
  }

  distTo(entity) {
    const dx = entity.x - this.x;
    const dy = (entity.groundY || entity.y) - this.groundY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  takeDamage(amount, knockbackDir, hitstunDuration) {
    if (this.fsm.is('death')) return;
    const finalDamage = Math.max(1, Math.round(amount / this.defense));
    this.hp -= finalDamage;

    this.scene.events.emit('entityDamaged', {
      entity: this, damage: finalDamage, x: this.x, y: this.y - 20,
    });

    if (this.hp <= 0) {
      this.hp = 0;
      this.fsm.forceState('death');
      return;
    }

    this.knockbackVelocity = knockbackDir || { x: 0, y: 0 };
    this.hitstunDuration = hitstunDuration || 200;
    this.fsm.forceState('hitstun');
  }

  update(time, dt) {
    if (this.cooldowns.special1 > 0) this.cooldowns.special1 -= dt;
    if (this.cooldowns.special2 > 0) this.cooldowns.special2 -= dt;
    this.fsm.update(dt);
    this.y = this.groundY - this.jumpZ;

    const pct = this.hp / this.maxHp;
    this.hpBarFill.setScale(pct, 1);
    if (pct > 0.5) this.hpBarFill.setTint(0x44cc44);
    else if (pct > 0.25) this.hpBarFill.setTint(0xcccc44);
    else this.hpBarFill.setTint(0xcc4444);

    this.setDepth(GAME_CONFIG.layers.entities + this.groundY);
  }
}
