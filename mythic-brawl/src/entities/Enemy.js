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
    this.networkId = null;
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
    this.stunned = false; // Stunned enemies take double damage

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

    // Physics (body used for hitbox overlap detection only — no auto-collisions)
    scene.physics.add.existing(this);
    this.body.setSize(16, 8);
    this.body.setOffset(-8, -4);
    this.body.pushable = false;
    this.body.immovable = true;

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
          // Pick a strafe direction for circling behavior
          this.strafeDir = Math.random() < 0.5 ? 1 : -1;
          this.strafeTimer = 0;
          this.strafeDuration = 400 + Math.random() * 600;
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

          if (this.attackTimer <= 0) {
            // Ranged attack at medium distance
            if (dist > 60 && dist <= 150 && Math.random() < 0.35) {
              this.fireRangedAttack();
              this.attackTimer = this.attackCooldown;
              return;
            }
            if (dist <= this.attackRange + 8) {
              this.fsm.transition('attack');
              return;
            }
          }

          // Circling/strafing when close but not in attack range
          if (dist < 60 && dist > this.attackRange && this.attackTimer > 0) {
            this.strafeTimer += dt;
            if (this.strafeTimer > this.strafeDuration) {
              this.strafeDir *= -1;
              this.strafeTimer = 0;
              this.strafeDuration = 400 + Math.random() * 600;
            }
            this.strafeAroundTarget(dt);
          } else {
            // Rush toward target
            this.moveTowardTarget(dt);
          }
        },
        transitions: { idle: 'idle', attack: 'attack', hitstun: 'hitstun', death: 'death' },
      },

      attack: {
        enter() {
          this.sprite.play(`${this.enemyKey}_atk1`, true);
          this.attackTimer = this.attackCooldown;
          this.fsm.locked = true;
          this.attackWindup = true;

          // Face target
          if (this.target) {
            this.facingRight = this.target.x > this.x;
            this.sprite.setFlipX(!this.facingRight);
          }

          // Telegraph — emit event so VFX can show windup indicator
          this.scene.events.emit('enemyWindup', {
            enemy: this,
            duration: 350,
          });

          // Lunge forward slightly during windup
          const lungeDir = this.facingRight ? 1 : -1;
          this.lungeVx = lungeDir * 1.5;

          // Emit attack hitbox after windup
          this.scene.time.delayedCall(350, () => {
            if (this.fsm.is('attack') && !this.dead) {
              this.attackWindup = false;
              this.lungeVx = lungeDir * 3; // Lunge burst on swing
              this.scene.events.emit('enemyAttack', {
                enemy: this,
                damage: 10 * this.power,
                hitbox: {
                  x: this.x + (this.facingRight ? 16 : -34),
                  y: this.groundY - 12,
                  width: 28,
                  height: 20,
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
        update(dt) {
          // Lunge movement during attack
          if (this.lungeVx) {
            this.x += this.lungeVx;
            this.clampToRoom();
            this.lungeVx *= 0.85;
            if (Math.abs(this.lungeVx) < 0.1) this.lungeVx = 0;
          }
        },
        transitions: { retreat: 'retreat', hitstun: 'hitstun', death: 'death' },
      },

      retreat: {
        enter() {
          this.sprite.play(`${this.enemyKey}_walk`, true);
          // Randomize retreat direction — not always straight back
          this.retreatAngle = (Math.random() - 0.5) * 1.5;
        },
        update(dt) {
          this.retreatTimer -= dt;

          // Dodge-roll style retreat — move away at an angle
          if (this.target) {
            const dx = this.x - this.target.x;
            const dy = this.groundY - this.target.groundY;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const nx = dx / len;
            const ny = dy / len;
            // Rotate retreat direction by retreatAngle
            const cos = Math.cos(this.retreatAngle);
            const sin = Math.sin(this.retreatAngle);
            const rx = nx * cos - ny * sin;
            const ry = nx * sin + ny * cos;

            const spd = this.speed * 0.7 * (dt / 1000);
            this.x += rx * spd;
            this.groundY = clampToGround(this.groundY + ry * spd * 0.6);
            this.y = this.groundY;
            this.clampToRoom();
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
          this.clampToRoom();
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
          this.clampToRoom();
          this.knockbackVelocity.x *= GAME_CONFIG.knockbackDecay;
          this.knockbackVelocity.y *= GAME_CONFIG.knockbackDecay;

          this.knockdownTimer += dt;
          if (this.knockdownTimer >= this.knockdownDuration) {
            this.fsm.locked = false;
            this.fsm.transition('getup');
          }
        },
        transitions: { getup: 'getup', death: 'death' },
      },

      getup: {
        enter() {
          this.fsm.locked = true;
          this.sprite.play(`${this.enemyKey}_getup`, true);
          this.getupDone = false;

          this.sprite.once('animationcomplete', () => {
            this.getupDone = true;
            this.fsm.locked = false;
            this.fsm.transition('chase');
          });

          // Safety fallback — if animationcomplete never fires, force recovery
          this.getupFallback = 2000;
        },
        update(dt) {
          if (!this.getupDone) {
            this.getupFallback -= dt;
            if (this.getupFallback <= 0) {
              this.fsm.locked = false;
              this.fsm.transition('chase');
            }
          }
        },
        transitions: { chase: 'chase', death: 'death' },
      },

      stunned: {
        enter() {
          this.sprite.play(`${this.enemyKey}_hitstun`, true);
          this.fsm.locked = true;
          this.stunned = true;
          this.stunTimer = 0;
        },
        update(dt) {
          // Slide from knockback
          this.x += this.knockbackVelocity.x;
          this.groundY = clampToGround(this.groundY + this.knockbackVelocity.y);
          this.y = this.groundY;
          this.clampToRoom();
          this.knockbackVelocity.x *= GAME_CONFIG.knockbackDecay;
          this.knockbackVelocity.y *= GAME_CONFIG.knockbackDecay;

          this.stunTimer += dt;
          if (this.stunTimer >= this.stunDuration) {
            this.stunned = false;
            this.fsm.locked = false;
            this.fsm.transition('chase');
          }
        },
        exit() {
          this.stunned = false;
        },
        transitions: { chase: 'chase', death: 'death' },
      },

      death: {
        enter() {
          this.fsm.locked = true;
          this.dead = true;

          // Disable physics body immediately so it doesn't block movement
          if (this.body) {
            this.body.enable = false;
          }

          // Cache scene ref — this.scene becomes null after destroy()
          const scene = this.scene;
          scene.events.emit('enemyDeath', this);

          // Hide the original sprite immediately
          this.sprite.setVisible(false);
          if (this.hpBarBg) this.hpBarBg.setVisible(false);
          if (this.hpBarFill) this.hpBarFill.setVisible(false);
          if (this.bleedIcon) this.bleedIcon.setVisible(false);
          if (this.shadow) this.shadow.setVisible(false);

          // --- GORE EXPLOSION ---
          const cx = this.x;
          const cy = this.y;
          const depthVal = this.depth;
          const gibColors = [0xcc1111, 0x991111, 0x660000, 0xdd3333, 0x880000];
          const boneColors = [0xddccbb, 0xccbbaa, 0xeeddcc];

          const pickColor = (arr) => arr[Phaser.Math.Between(0, arr.length - 1)];

          // Blood splatter particles (lots of small dots)
          for (let i = 0; i < 24; i++) {
            const size = Phaser.Math.Between(1, 3);
            const blood = scene.add.graphics();
            blood.fillStyle(pickColor(gibColors), 1);
            blood.fillCircle(0, 0, size);
            blood.setPosition(cx, cy);
            blood.setDepth(depthVal + 1);

            const angle = Math.random() * Math.PI * 2;
            const speed = Phaser.Math.Between(60, 200);
            const targetX = cx + Math.cos(angle) * speed;
            const targetY = cy + Math.sin(angle) * speed * 0.6;

            scene.tweens.add({
              targets: blood,
              x: targetX,
              y: targetY,
              alpha: 0,
              duration: Phaser.Math.Between(400, 900),
              ease: 'Power2',
              onComplete: () => blood.destroy(),
            });
          }

          // Body part chunks (larger pieces that arc with gravity)
          const partShapes = ['circle', 'rect', 'triangle'];
          for (let i = 0; i < 8; i++) {
            const chunk = scene.add.graphics();
            const color = i < 5 ? pickColor(gibColors) : pickColor(boneColors);
            const shape = partShapes[Phaser.Math.Between(0, partShapes.length - 1)];
            const chunkSize = Phaser.Math.Between(2, 5);

            chunk.fillStyle(color, 1);
            if (shape === 'circle') {
              chunk.fillCircle(0, 0, chunkSize);
            } else if (shape === 'rect') {
              chunk.fillRect(-chunkSize, -chunkSize / 2, chunkSize * 2, chunkSize);
            } else {
              chunk.fillTriangle(0, -chunkSize, -chunkSize, chunkSize, chunkSize, chunkSize);
            }

            chunk.setPosition(cx, cy);
            chunk.setDepth(depthVal + 2);

            // Arc trajectory: launch upward and outward, then fall with gravity
            const launchAngle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
            const launchSpeed = Phaser.Math.Between(80, 180);
            const vx = Math.cos(launchAngle) * launchSpeed;
            const vy = Math.sin(launchAngle) * launchSpeed;
            const gravity = 300;
            const duration = Phaser.Math.Between(600, 1200);
            const t = duration / 1000;

            const finalX = cx + vx * t;
            const finalY = cy + vy * t + 0.5 * gravity * t * t;
            const peakY = cy + vy * t * 0.35;

            // Single combined tween for X + fade
            scene.tweens.add({
              targets: chunk,
              x: finalX,
              angle: Phaser.Math.Between(-720, 720),
              duration: duration,
              ease: 'Linear',
            });
            // Y: rise then fall (two chained tweens)
            scene.tweens.add({
              targets: chunk,
              y: peakY,
              duration: duration * 0.35,
              ease: 'Quad.easeOut',
              onComplete: () => {
                scene.tweens.add({
                  targets: chunk,
                  y: finalY,
                  duration: duration * 0.65,
                  ease: 'Quad.easeIn',
                });
              },
            });
            // Fade out at end
            scene.tweens.add({
              targets: chunk,
              alpha: 0,
              delay: duration * 0.6,
              duration: duration * 0.4,
              onComplete: () => chunk.destroy(),
            });
          }

          // Blood pool left on ground
          const pool = scene.add.graphics();
          pool.fillStyle(0x660000, 0.7);
          pool.fillCircle(0, 0, 6);
          pool.setPosition(cx, cy + 2);
          pool.setDepth(depthVal - 1);
          pool.setScale(0.5, 0.3);
          pool.setAlpha(0);

          scene.tweens.add({
            targets: pool,
            alpha: 0.5,
            scaleX: Phaser.Math.FloatBetween(3, 5),
            scaleY: Phaser.Math.FloatBetween(1.5, 2.5),
            duration: 400,
            ease: 'Power2',
          });
          scene.tweens.add({
            targets: pool,
            alpha: 0,
            delay: 2500,
            duration: 1500,
            onComplete: () => pool.destroy(),
          });

          // Screen shake on death
          scene.cameras.main.shake(120, 0.006);

          // Destroy the enemy container after effects launch
          scene.time.delayedCall(200, () => {
            this.destroy();
          });
        },
        update(dt) {},
        transitions: {},
      },
    };
  }

  fireRangedAttack() {
    this.sprite.play(`${this.enemyKey}_atk1`, true);

    // Ranged attacks target a random party member (not locked to tank)
    const party = this.scene.getPartyMembers();
    const alive = party.filter(m => m.hp > 0);
    const rangedTarget = alive.length > 0 ? alive[Phaser.Math.Between(0, alive.length - 1)] : this.target;

    if (rangedTarget) {
      this.facingRight = rangedTarget.x > this.x;
      this.sprite.setFlipX(!this.facingRight);
    }

    this.scene.events.emit('enemyRangedAttack', {
      enemy: this,
      target: rangedTarget,
    });
  }

  findTarget() {
    const party = this.scene.getPartyMembers();
    if (party.length === 0) { this.target = null; return; }

    // Melee aggro: always target the tank if alive
    const tank = party.find(m => m.hp > 0 && m.classData && m.classData.role === 'tank');
    if (tank) {
      this.target = tank;
      return;
    }

    // No tank alive — fallback to random
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

  strafeAroundTarget(dt) {
    if (!this.target) return;

    const dx = this.target.x - this.x;
    const dy = this.target.groundY - this.groundY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const spd = this.speed * 0.8 * (dt / 1000);

    // Perpendicular direction for circling
    const perpX = -dy / len * this.strafeDir;
    const perpY = dx / len * this.strafeDir;

    // Mix some approach with strafe
    this.x += (perpX * 0.7 + dx / len * 0.3) * spd;
    this.groundY = clampToGround(this.groundY + (perpY * 0.7 + dy / len * 0.3) * spd * 0.6);
    this.y = this.groundY;

    this.facingRight = dx > 0;
    this.sprite.setFlipX(!this.facingRight);
  }

  clampToRoom() {
    const scene = this.scene;
    if (scene && scene.roomLeftBound !== undefined) {
      this.x = Phaser.Math.Clamp(this.x, scene.roomLeftBound + 8, scene.roomRightBound - 8);
    }
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

    // Stunned enemies take double damage
    const stunnedMultiplier = this.stunned ? 2 : 1;
    const finalDamage = Math.max(1, Math.round((amount * stunnedMultiplier) / this.defense));
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

  applyStun(duration, knockbackDir) {
    if (this.fsm.is('death')) return;
    this.stunDuration = duration;
    this.knockbackVelocity = knockbackDir || { x: 0, y: 0 };
    this.fsm.locked = false;
    this.fsm.forceState('stunned');
  }

  applyKnockdown(duration, knockbackDir) {
    if (this.fsm.is('death')) return;
    this.knockdownDuration = duration;
    this.knockbackVelocity = knockbackDir || { x: 0, y: 0 };
    this.fsm.locked = false;
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

    // Yellow bar when stunned, otherwise restore type-based color
    if (this.stunned) {
      this.hpBarFill.setTint(0xeecc44);
    } else if (this.enemyData.type === 'elite') {
      this.hpBarFill.setTint(0xccaa44);
    } else if (this.enemyData.type === 'boss') {
      this.hpBarFill.setTint(0xcc4444);
    } else {
      this.hpBarFill.clearTint();
    }

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
    if (this.dead) return;
    if (this.attackTimer > 0) this.attackTimer -= dt;
    this.updateBleed(dt);
    this.fsm.update(dt);
    this.y = this.groundY - this.jumpZ;
    this.updateHpBar();
    this.setDepth(GAME_CONFIG.layers.entities + this.groundY);
  }
}
