/**
 * ENEMY ENTITY
 * 
 * AI-controlled enemies with behavior states:
 *   idle    — Standing still, waiting for player in aggro range
 *   chase   — Walking toward target
 *   attack  — Executing an attack when in range
 *   retreat — Backing off after attacking (prevents stunlock feel)
 *   hitstun — Staggered after being hit
 *   death   — Death animation, triggers affix effects
 * 
 * M+ SCALING:
 *   Enemy stats are multiplied by keystone level scaling.
 *   Affix modifiers are applied on top (Fortified, Tyrannical, etc.)
 */

import Phaser from 'phaser';
import { StateMachine } from '../utils/StateMachine.js';
import { ENEMIES, GAME_CONFIG } from '../config/game.js';
import { clampToGround } from '../utils/DepthSort.js';

export class Enemy extends Phaser.GameObjects.Container {
  constructor(scene, x, y, enemyKey, keystoneLevel = 2) {
    super(scene, x, y);
    scene.add.existing(this);

    this.enemyKey = enemyKey;
    this.enemyData = ENEMIES[enemyKey];
    this.groundY = y;
    this.jumpZ = 0;
    this.facingRight = false;  // Enemies face left by default (toward player)

    // Scale stats by keystone level
    const scale = 1 + (keystoneLevel - 2) * 0.08;  // 8% per keystone level
    this.maxHp = Math.round(this.enemyData.stats.hp * scale);
    this.hp = this.maxHp;
    this.speed = this.enemyData.stats.speed;
    this.power = this.enemyData.stats.power * scale;
    this.defense = this.enemyData.stats.defense;

    // AI
    this.target = null;             // Current target entity
    this.aggroRange = this.enemyData.aggroRange;
    this.attackRange = this.enemyData.attackRange;
    this.attackCooldown = this.enemyData.attackCooldown;
    this.attackTimer = 0;
    this.retreatTimer = 0;
    this.retreatDuration = 600;     // ms to back off after attacking

    // Combat
    this.knockbackVelocity = { x: 0, y: 0 };
    this.hitstunDuration = 0;
    this.hitstunTimer = 0;

    // Bleed DOT state
    this.bleed = null;  // { damagePerTick, ticksRemaining, interval, timer }

    // M+ affix state
    this.affixBuffs = [];  // Applied bolstering stacks, etc.

    // Sprite
    this.sprite = scene.add.sprite(0, 0, enemyKey);
    this.sprite.setOrigin(0.5, 1);
    this.add(this.sprite);

    // Shadow
    this.shadow = scene.add.image(0, 0, 'shadow');
    this.shadow.setOrigin(0.5, 0.5);
    this.shadow.setAlpha(0.3);
    this.add(this.shadow);
    this.sendToBack(this.shadow);

    // HP bar
    this.hpBarBg = scene.add.image(0, -this.sprite.height - 4, 'hp_bar_bg');
    this.hpBarBg.setOrigin(0.5, 0.5);
    this.add(this.hpBarBg);
    this.hpBarFill = scene.add.image(-15, -this.sprite.height - 4, 'hp_bar_fill');
    this.hpBarFill.setOrigin(0, 0.5);
    this.add(this.hpBarFill);

    // Bleed icon (red droplet next to HP bar, hidden until bleed applied)
    this.bleedIcon = scene.add.graphics();
    this.bleedIcon.fillStyle(0xcc2222, 1);
    this.bleedIcon.fillCircle(0, 0, 2);
    this.bleedIcon.fillTriangle(0, -3, -1.5, 0, 1.5, 0);
    this.bleedIcon.setPosition(18, -this.sprite.height - 4);
    this.bleedIcon.setVisible(false);
    this.add(this.bleedIcon);

    // Elite/boss indicator
    if (this.enemyData.type === 'elite') {
      this.hpBarFill.setTint(0xccaa44);
    } else if (this.enemyData.type === 'boss') {
      this.hpBarFill.setTint(0xcc4444);
    }

    // Physics
    scene.physics.add.existing(this);
    this.body.setSize(16, 8);
    this.body.setOffset(-8, -4);

    // State machine
    this.fsm = new StateMachine(this, this.buildStates());
    this.fsm.start('idle');
  }

  buildStates() {
    return {
      idle: {
        enter() {
          this.sprite.play(`${this.enemyKey}_idle`, true);
        },
        update(dt) {
          this.findTarget();
          if (this.target && this.distToTarget() <= this.aggroRange) {
            this.fsm.transition('chase');
          }
        },
        transitions: { chase: 'chase', hitstun: 'hitstun', death: 'death' },
      },

      chase: {
        enter() {
          this.sprite.play(`${this.enemyKey}_walk`, true);
        },
        update(dt) {
          if (!this.target || this.target.hp <= 0) {
            this.findTarget();
            if (!this.target) {
              this.fsm.transition('idle');
              return;
            }
          }

          const dist = this.distToTarget();

          if (dist <= this.attackRange && this.attackTimer <= 0) {
            this.fsm.transition('attack');
            return;
          }

          // Move toward target
          this.moveTowardTarget(dt);
        },
        transitions: { idle: 'idle', attack: 'attack', hitstun: 'hitstun', death: 'death' },
      },

      attack: {
        enter() {
          this.sprite.play(`${this.enemyKey}_atk1`, true);
          this.attackTimer = this.attackCooldown;
          this.fsm.locked = true;

          // Face target
          if (this.target) {
            this.facingRight = this.target.x > this.x;
            this.sprite.setFlipX(!this.facingRight);
          }

          // Emit attack hitbox after brief windup
          this.scene.time.delayedCall(200, () => {
            if (this.fsm.is('attack')) {
              this.scene.events.emit('enemyAttack', {
                enemy: this,
                damage: 10 * this.power,
                hitbox: {
                  x: this.x + (this.facingRight ? 14 : -14),
                  y: this.groundY - 8,
                  width: 18,
                  height: 14,
                },
              });
            }
          });

          this.sprite.once('animationcomplete', () => {
            this.fsm.locked = false;
            this.retreatTimer = this.retreatDuration;
            this.fsm.transition('retreat');
          });
        },
        update(dt) {},
        transitions: { retreat: 'retreat', hitstun: 'hitstun', death: 'death' },
      },

      retreat: {
        enter() {
          this.sprite.play(`${this.enemyKey}_walk`, true);
        },
        update(dt) {
          this.retreatTimer -= dt;

          // Move away from target
          if (this.target) {
            const dx = this.x - this.target.x;
            const dy = this.groundY - this.target.groundY;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const spd = this.speed * 0.5 * (dt / 1000);
            this.x += (dx / len) * spd;
            this.groundY = clampToGround(this.groundY + (dy / len) * spd * 0.6);
            this.y = this.groundY;
          }

          if (this.retreatTimer <= 0) {
            this.fsm.transition('chase');
          }
        },
        transitions: { chase: 'chase', hitstun: 'hitstun', death: 'death' },
      },

      hitstun: {
        enter() {
          this.sprite.play(`${this.enemyKey}_hitstun`, true);
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
            this.fsm.transition('chase');
          }
        },
        transitions: { chase: 'chase', knockdown: 'knockdown', death: 'death' },
      },

      knockdown: {
        enter() {
          this.sprite.play(`${this.enemyKey}_knockdown`, true);
          this.fsm.locked = true;
          this.knockdownTimer = 0;
        },
        update(dt) {
          // Slide during knockdown
          this.x += this.knockbackVelocity.x;
          this.groundY = clampToGround(this.groundY + this.knockbackVelocity.y);
          this.y = this.groundY;
          this.knockbackVelocity.x *= GAME_CONFIG.knockbackDecay;
          this.knockbackVelocity.y *= GAME_CONFIG.knockbackDecay;

          this.knockdownTimer += dt;
          if (this.knockdownTimer >= this.knockdownDuration) {
            this.fsm.transition('getup');
          }
        },
        transitions: { getup: 'getup', death: 'death' },
      },

      getup: {
        enter() {
          this.sprite.play(`${this.enemyKey}_getup`, true);
          this.sprite.once('animationcomplete', () => {
            this.fsm.locked = false;
            this.fsm.transition('chase');
          });
        },
        update(dt) {},
        transitions: { chase: 'chase', death: 'death' },
      },

      death: {
        enter() {
          this.sprite.play(`${this.enemyKey}_death`, true);
          this.fsm.locked = true;
          this.scene.events.emit('enemyDeath', this);

          this.sprite.once('animationcomplete', () => {
            this.scene.time.delayedCall(500, () => {
              this.destroy();
            });
          });
        },
        update(dt) {},
        transitions: {},
      },
    };
  }

  findTarget() {
    const party = this.scene.getPartyMembers();
    if (party.length === 0) { this.target = null; return; }

    // Find the tank (if alive)
    const tank = party.find(m => m.hp > 0 && m.classData && m.classData.role === 'tank');

    if (tank) {
      // 75% chance to target the tank, 25% chance to pick a random party member
      if (Math.random() < 0.75) {
        this.target = tank;
        return;
      }
    }

    // Random target from alive party members
    const alive = party.filter(m => m.hp > 0);
    if (alive.length > 0) {
      this.target = alive[Phaser.Math.Between(0, alive.length - 1)];
    } else {
      this.target = null;
    }
  }

  moveTowardTarget(dt) {
    if (!this.target) return;

    const dx = this.target.x - this.x;
    const dy = this.target.groundY - this.groundY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const spd = this.speed * (dt / 1000);

    this.x += (dx / len) * spd;
    this.groundY = clampToGround(this.groundY + (dy / len) * spd * 0.6);
    this.y = this.groundY;

    // Face target
    this.facingRight = dx > 0;
    this.sprite.setFlipX(!this.facingRight);
  }

  distToTarget() {
    if (!this.target) return Infinity;
    return this.distTo(this.target);
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
      entity: this,
      damage: finalDamage,
      x: this.x,
      y: this.y - 20,
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

  applyKnockdown(duration, knockbackDir) {
    if (this.fsm.is('death')) return;
    this.knockdownDuration = duration;
    this.knockbackVelocity = knockbackDir || { x: 0, y: 0 };
    this.fsm.forceState('knockdown');
  }

  applyBleed(bleedConfig) {
    this.bleed = {
      damagePerTick: bleedConfig.damagePerTick,
      ticksRemaining: bleedConfig.ticks,
      interval: bleedConfig.interval,
      timer: 0,
    };
  }

  updateBleed(dt) {
    if (!this.bleed || this.fsm.is('death')) return;

    this.bleed.timer += dt;
    if (this.bleed.timer >= this.bleed.interval) {
      this.bleed.timer -= this.bleed.interval;
      this.bleed.ticksRemaining--;

      this.hp -= this.bleed.damagePerTick;
      this.scene.events.emit('entityDamaged', {
        entity: this,
        damage: this.bleed.damagePerTick,
        x: this.x + Phaser.Math.Between(-4, 4),
        y: this.y - 16,
      });

      if (this.hp <= 0) {
        this.hp = 0;
        this.fsm.forceState('death');
        this.bleed = null;
        return;
      }

      if (this.bleed.ticksRemaining <= 0) {
        this.bleed = null;
      }
    }
  }

  updateHpBar() {
    const pct = this.hp / this.maxHp;
    this.hpBarFill.setScale(pct, 1);

    // Show/hide bleed icon
    if (this.bleedIcon) {
      this.bleedIcon.setVisible(this.bleed !== null);
    }
  }

  applyAffixBuff(type, value) {
    this.affixBuffs.push({ type, value });
    if (type === 'bolster_damage') {
      this.power += value;
    }
    if (type === 'bolster_scale') {
      this.sprite.setScale(this.sprite.scaleX + value);
    }
  }

  update(time, dt) {
    if (this.attackTimer > 0) this.attackTimer -= dt;
    this.updateBleed(dt);
    this.fsm.update(dt);
    this.y = this.groundY - this.jumpZ;
    this.updateHpBar();
    this.setDepth(GAME_CONFIG.layers.entities + this.groundY);
  }
}
