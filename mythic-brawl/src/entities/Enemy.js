/**
 * ENEMY ENTITY — Smart AI Overhaul
 *
 * AI-controlled enemies with advanced behavior:
 *   idle       — Waiting for player in aggro range
 *   chase      — Smart decision tree: evaluate dash/jump/dodge/attack/flank
 *   attack     — Melee with combo chaining (atk1 → atk2 → atk3)
 *   retreat    — Angled retreat after attacking
 *   dash       — Burst-speed gap closer / escape with afterimage trail
 *   jumpAttack — Aerial leap slam with ground impact
 *   dodge      — Reactive evasion when player winds up
 *   special    — Type-specific ability (cleaving spin, fire breath, etc.)
 *   fly        — Boss hovering state with swoop attacks
 *   swoop      — Diving attack from flight
 *   hitstun    — Staggered after being hit
 *   knockdown  — Hard CC, must get up
 *   getup      — Recovery from knockdown
 *   stunned    — Frozen in place, takes double damage
 *   death      — Gore explosion
 *
 * M+ SCALING:
 *   Enemy stats multiplied by keystone level scaling.
 *   Affix modifiers applied on top (Fortified, Tyrannical, etc.)
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
    this.facingRight = false;

    // Scale stats by keystone level
    const scale = 1 + (keystoneLevel - 2) * 0.08;
    this.maxHp = Math.round(this.enemyData.stats.hp * scale);
    this.hp = this.maxHp;
    this.speed = this.enemyData.stats.speed;
    this.power = this.enemyData.stats.power * scale;
    this.defense = this.enemyData.stats.defense;

    // Core AI
    this.target = null;
    this.aggroRange = this.enemyData.aggroRange;
    this.attackRange = this.enemyData.attackRange;
    this.attackCooldown = this.enemyData.attackCooldown;
    this.attackTimer = 0;
    this.retreatTimer = 0;
    this.retreatDuration = 600;

    // Advanced AI config (defaults for enemies without ai block)
    const ai = this.enemyData.ai || {};
    this.aiConfig = ai;
    this.dashCooldown = 0;
    this.dodgeCooldown = 0;
    this.jumpCooldownTimer = 0;
    this.specialTimer = 0;
    this.flyCooldown = 0;
    this.swoopCooldown = 0;
    this.isFlying = false;
    this.flankAngle = 0;
    this._playerWasAttacking = false;

    // Boss phase tracking
    this.currentPhase = 0;
    this.enraged = false;

    // Combat
    this.knockbackVelocity = { x: 0, y: 0 };
    this.hitstunDuration = 0;
    this.hitstunTimer = 0;
    this.stunned = false;

    // Bleed DOT
    this.bleed = null;

    // M+ affix state
    this.affixBuffs = [];

    // Raid boss ability cooldowns
    this.raidAbilityCooldowns = {};
    if (ai.raidBoss && ai.abilities) {
      for (const key of Object.keys(ai.abilities)) {
        this.raidAbilityCooldowns[key] = 3000 + Math.random() * 2000; // stagger initial cooldowns
      }
    }

    // Sprite
    this.sprite = scene.add.sprite(0, 0, enemyKey);
    this.sprite.setOrigin(0.5, 1);
    this.add(this.sprite);

    // Apply boss scale (e.g. 3x for pitlord raid boss)
    const bossScale = this.enemyData.bossScale || 1;
    if (bossScale > 1) {
      this.sprite.setScale(bossScale);
    }

    // Shadow
    this.shadow = scene.add.image(0, 0, 'shadow');
    this.shadow.setOrigin(0.5, 0.5);
    this.shadow.setAlpha(0.3);
    if (bossScale > 1) this.shadow.setScale(bossScale * 0.8);
    this.add(this.shadow);
    this.sendToBack(this.shadow);

    // HP bar — offset further up for large bosses
    const hpBarY = -(this.sprite.height * bossScale) - 4;
    this.hpBarBg = scene.add.image(0, hpBarY, 'hp_bar_bg');
    this.hpBarBg.setOrigin(0.5, 0.5);
    this.add(this.hpBarBg);
    this.hpBarFill = scene.add.image(-15, hpBarY, 'hp_bar_fill');
    this.hpBarFill.setOrigin(0, 0.5);
    this.add(this.hpBarFill);

    // Bleed icon
    this.bleedIcon = scene.add.graphics();
    this.bleedIcon.fillStyle(0xcc2222, 1);
    this.bleedIcon.fillCircle(0, 0, 2);
    this.bleedIcon.fillTriangle(0, -3, -1.5, 0, 1.5, 0);
    this.bleedIcon.setPosition(18, hpBarY);
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
    this.body.pushable = false;
    this.body.immovable = true;

    // State machine
    this.fsm = new StateMachine(this, this.buildStates());
    this.fsm.start('idle');
  }

  // ═══════════════════════════════════════════════════════════
  //  STATE MACHINE
  // ═══════════════════════════════════════════════════════════

  buildStates() {
    const allTransitions = {
      idle: 'idle', chase: 'chase', attack: 'attack', retreat: 'retreat',
      dash: 'dash', jumpAttack: 'jumpAttack', dodge: 'dodge',
      special: 'special', fly: 'fly', swoop: 'swoop',
      hitstun: 'hitstun', knockdown: 'knockdown', stunned: 'stunned', death: 'death',
    };

    return {
      // ─── IDLE ────────────────────────────────────────────
      idle: {
        enter() {
          this.sprite.play(`${this.enemyKey}_idle`, true);
          this.computeFlankAngle();
        },
        update(dt) {
          this.findTarget();
          // Once in combat, always re-aggro any living target (no range check)
          if (this.target && (this.hasBeenInCombat || this.distToTarget() <= this.aggroRange)) {
            this.fsm.transition('chase');
          }
        },
        transitions: allTransitions,
      },

      // ─── CHASE (Smart Decision Tree) ────────────────────
      chase: {
        enter() {
          this.hasBeenInCombat = true;
          this.sprite.play(`${this.enemyKey}_walk`, true);
          this.strafeDir = Math.random() < 0.5 ? 1 : -1;
          this.strafeTimer = 0;
          this.strafeDuration = 400 + Math.random() * 600;
          this.computeFlankAngle();
        },
        update(dt) {
          if (!this.target || this.target.hp <= 0) {
            this.findTarget();
            if (!this.target) { this.fsm.transition('idle'); return; }
          }

          const dist = this.distToTarget();
          const ai = this.aiConfig;

          // 0. RAID BOSS ABILITIES — telegraphed, dodgeable mechanics
          if (ai.raidBoss && this._tickRaidAbilities(0)) return;

          // 1. DODGE — react to player attack telegraphs
          const playerAttacking = this.isPlayerAttacking();
          if (playerAttacking && !this._playerWasAttacking) {
            if (ai.dodgeChance > 0 && this.dodgeCooldown <= 0 && dist < 70) {
              if (Math.random() < ai.dodgeChance) {
                this._playerWasAttacking = playerAttacking;
                this.fsm.transition('dodge');
                return;
              }
            }
          }
          this._playerWasAttacking = playerAttacking;

          // 2. BOSS: Take flight
          if (ai.canFly && this.flyCooldown <= 0 && !this.isFlying && Math.random() < 0.005) {
            this.fsm.transition('fly');
            return;
          }

          // 3. SPECIAL ABILITY at medium range
          if (ai.specialAbility && ai.specialCooldown > 0 && this.specialTimer <= 0 && dist < 80) {
            this.fsm.transition('special');
            return;
          }

          // 4. JUMP ATTACK from medium range
          if (ai.jumpHeight > 0 && this.jumpCooldownTimer <= 0 && dist > 40 && dist < 120) {
            if (Math.random() < 0.02) {
              this.fsm.transition('jumpAttack');
              return;
            }
          }

          // 5. DASH to close gap
          if (ai.dashDist > 0 && this.dashCooldown <= 0 && dist > this.attackRange + 15 && dist < 100) {
            if (Math.random() < 0.015) {
              this.fsm.transition('dash');
              return;
            }
          }

          // 6. MELEE ATTACK
          if (this.attackTimer <= 0) {
            if (dist > 60 && dist <= 150 && Math.random() < 0.25) {
              this.fireRangedAttack();
              this.attackTimer = this.attackCooldown;
              return;
            }
            if (dist <= this.attackRange + 8) {
              this.fsm.transition('attack');
              return;
            }
          }

          // 7. MOVEMENT — strafe or rush
          this.strafeTimer += dt;
          if (this.strafeTimer > this.strafeDuration) {
            this.strafeDir *= -1;
            this.strafeTimer = 0;
            this.strafeDuration = 400 + Math.random() * 600;
            this.computeFlankAngle();
          }

          if (dist < 60 && dist > this.attackRange && this.attackTimer > 0) {
            this.strafeAroundTarget(dt);
          } else {
            this.moveTowardTarget(dt);
          }
        },
        transitions: allTransitions,
      },

      // ─── ATTACK (Combo Chaining) ────────────────────────
      attack: {
        enter() {
          this.comboHit = 1;
          this._startComboHit();
        },
        update(dt) {
          if (this.lungeVx) {
            this.x += this.lungeVx;
            this.clampToRoom();
            this.lungeVx *= 0.85;
            if (Math.abs(this.lungeVx) < 0.1) this.lungeVx = 0;
          }
        },
        transitions: allTransitions,
      },

      // ─── RETREAT ─────────────────────────────────────────
      retreat: {
        enter() {
          this.sprite.play(`${this.enemyKey}_walk`, true);
          this.retreatAngle = (Math.random() - 0.5) * 1.5;
        },
        update(dt) {
          this.retreatTimer -= dt;
          if (this.target) {
            const dx = this.x - this.target.x;
            const dy = this.groundY - this.target.groundY;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const nx = dx / len;
            const ny = dy / len;
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
        transitions: allTransitions,
      },

      // ─── DASH ────────────────────────────────────────────
      dash: {
        enter() {
          const ai = this.aiConfig;
          this.dashCooldown = ai.dashCooldown || 3000;
          this.fsm.locked = true;

          // Dash toward target
          if (this.target) {
            this.facingRight = this.target.x > this.x;
            this.sprite.setFlipX(!this.facingRight);
          }
          const dir = this.facingRight ? 1 : -1;
          this.dashVx = dir * (ai.dashSpeed || 200) / 1000;
          this.dashRemaining = ai.dashDist || 40;
          this.dashAfterimageTimer = 0;

          this.sprite.play(`${this.enemyKey}_walk`, true);
          this.sprite.anims.msPerFrame = 30;

          this.scene.events.emit('enemyDash', {
            enemy: this, startX: this.x, startY: this.groundY,
          });
        },
        update(dt) {
          const step = Math.abs(this.dashVx * dt);
          this.dashRemaining -= step;
          this.x += this.dashVx * dt;
          this.clampToRoom();

          // Spawn afterimage every 40ms
          this.dashAfterimageTimer += dt;
          if (this.dashAfterimageTimer >= 40) {
            this.dashAfterimageTimer -= 40;
            this.scene.events.emit('enemyAfterimage', { enemy: this });
          }

          if (this.dashRemaining <= 0) {
            this.fsm.locked = false;
            // If close to target, immediately attack
            if (this.target && this.distToTarget() <= this.attackRange + 12 && this.attackTimer <= 0) {
              this.fsm.transition('attack');
            } else {
              this.fsm.transition('chase');
            }
          }
        },
        exit() {
          this.scene.events.emit('enemyDashEnd', { enemy: this });
        },
        transitions: allTransitions,
      },

      // ─── JUMP ATTACK ────────────────────────────────────
      jumpAttack: {
        enter() {
          const ai = this.aiConfig;
          this.jumpCooldownTimer = ai.jumpCooldown || 5000;
          this.fsm.locked = true;

          // Target landing position
          this.jumpTargetX = this.target ? this.target.x : this.x;
          this.jumpTargetY = this.target ? this.target.groundY : this.groundY;
          this.jumpStartX = this.x;
          this.jumpStartY = this.groundY;
          this.jumpPeakHeight = ai.jumpHeight || 25;
          this.jumpTimer = 0;
          this.jumpDuration = 500;
          this.jumpLanded = false;
          this.jumpDamage = ai.jumpDamage || 0.1;

          // Face target
          if (this.target) {
            this.facingRight = this.target.x > this.x;
            this.sprite.setFlipX(!this.facingRight);
          }

          this.sprite.play(`${this.enemyKey}_special1`, true);
          this.scene.events.emit('enemyJumpStart', {
            enemy: this, targetX: this.jumpTargetX, targetY: this.jumpTargetY,
          });
        },
        update(dt) {
          if (this.jumpLanded) return;
          this.jumpTimer += dt;
          const t = Math.min(this.jumpTimer / this.jumpDuration, 1);

          // Arc trajectory
          this.x = Phaser.Math.Linear(this.jumpStartX, this.jumpTargetX, t);
          this.groundY = clampToGround(
            Phaser.Math.Linear(this.jumpStartY, this.jumpTargetY, t)
          );
          this.jumpZ = Math.sin(t * Math.PI) * this.jumpPeakHeight;
          this.y = this.groundY - this.jumpZ;

          // Shadow shrinks as enemy rises
          if (this.shadow) {
            const shadowScale = 1 - (this.jumpZ / this.jumpPeakHeight) * 0.5;
            this.shadow.setScale(shadowScale);
            this.shadow.setAlpha(0.15 + 0.15 * shadowScale);
          }

          if (t >= 1) {
            this.jumpLanded = true;
            this.jumpZ = 0;
            this.y = this.groundY;
            if (this.shadow) { this.shadow.setScale(1); this.shadow.setAlpha(0.3); }

            // Slam damage AoE
            const slamRadius = this.enemyData.type === 'boss' ? 40 : 25;
            const party = this.scene.getPartyMembers();
            for (const member of party) {
              if (member.hp <= 0) continue;
              const d = Phaser.Math.Distance.Between(this.x, this.groundY, member.x, member.groundY);
              if (d <= slamRadius) {
                const dir = {
                  x: (member.x - this.x) / (d || 1) * 6,
                  y: ((member.groundY - this.groundY) / (d || 1)) * 2,
                };
                member.takeDamage(this.jumpDamage * 100 * this.power, dir, 300);
              }
            }

            // VFX + shake
            this.scene.events.emit('enemyJumpSlam', {
              enemy: this, x: this.x, y: this.groundY, radius: slamRadius,
            });
            const shakeIntensity = this.enemyData.type === 'boss' ? 0.012 : 0.006;
            this.scene.cameras.main.shake(180, shakeIntensity);

            this.fsm.locked = false;
            this.scene.time.delayedCall(200, () => {
              if (this.fsm.is('jumpAttack') && !this.dead) {
                this.fsm.transition('chase');
              }
            });
          }
        },
        exit() {
          this.jumpZ = 0;
          if (this.shadow) { this.shadow.setScale(1); this.shadow.setAlpha(0.3); }
        },
        transitions: allTransitions,
      },

      // ─── DODGE ───────────────────────────────────────────
      dodge: {
        enter() {
          const ai = this.aiConfig;
          this.dodgeCooldown = ai.dodgeCooldown || 2000;
          this.fsm.locked = true;
          this.dodgeTimer = 0;
          this.dodgeDuration = 220;

          // Dodge perpendicular to player
          const dx = this.target ? this.target.x - this.x : 1;
          const dy = this.target ? this.target.groundY - this.groundY : 0;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const perpDir = Math.random() < 0.5 ? 1 : -1;
          this.dodgeVx = (-dy / len * perpDir) * (ai.dodgeDist || 28) / (this.dodgeDuration / 1000);
          this.dodgeVy = (dx / len * perpDir) * (ai.dodgeDist || 28) / (this.dodgeDuration / 1000) * 0.4;

          this.sprite.setAlpha(0.5);
          this.sprite.play(`${this.enemyKey}_walk`, true);
          this.sprite.anims.msPerFrame = 25;

          this.scene.events.emit('enemyDodge', {
            enemy: this, fromX: this.x, fromY: this.groundY,
          });
        },
        update(dt) {
          this.dodgeTimer += dt;
          const sec = dt / 1000;
          this.x += this.dodgeVx * sec;
          this.groundY = clampToGround(this.groundY + this.dodgeVy * sec);
          this.y = this.groundY;
          this.clampToRoom();

          if (this.dodgeTimer >= this.dodgeDuration) {
            this.fsm.locked = false;
            this.fsm.transition('chase');
          }
        },
        exit() {
          this.sprite.setAlpha(1);
        },
        transitions: allTransitions,
      },

      // ─── SPECIAL ABILITY ─────────────────────────────────
      special: {
        enter() {
          const ai = this.aiConfig;
          this.specialTimer = ai.specialCooldown || 6000;
          this.fsm.locked = true;
          this.specialAbilityKey = ai.specialAbility;

          if (this.target) {
            this.facingRight = this.target.x > this.x;
            this.sprite.setFlipX(!this.facingRight);
          }

          this.sprite.play(`${this.enemyKey}_special1`, true);
          this.scene.events.emit('enemyWindup', { enemy: this, duration: 400 });

          this.scene.time.delayedCall(400, () => {
            if (this.dead || !this.fsm.is('special')) return;
            this._executeSpecial();
          });

          this.sprite.once('animationcomplete', () => {
            if (!this.dead) {
              this.fsm.locked = false;
              this.retreatTimer = this.retreatDuration;
              this.fsm.transition('retreat');
            }
          });
          // Safety timeout
          this.scene.time.delayedCall(1200, () => {
            if (this.fsm.is('special') && !this.dead) {
              this.fsm.locked = false;
              this.fsm.transition('chase');
            }
          });
        },
        update(dt) {
          if (this.lungeVx) {
            this.x += this.lungeVx;
            this.clampToRoom();
            this.lungeVx *= 0.85;
            if (Math.abs(this.lungeVx) < 0.1) this.lungeVx = 0;
          }
        },
        transitions: allTransitions,
      },

      // ─── FLY (Boss) ──────────────────────────────────────
      fly: {
        enter() {
          const ai = this.aiConfig;
          this.flyCooldown = 12000;
          this.isFlying = true;
          this.flyTargetZ = ai.flyHeight || 28;
          this.flyTimer = 0;
          this.flyDuration = 4000 + Math.random() * 2000;
          this.swoopCooldown = ai.swoopCooldown || 6000;
          this.flySwoopTimer = 1500; // delay before first swoop

          this.sprite.play(`${this.enemyKey}_idle`, true);
          this.scene.events.emit('enemyFlyStart', { enemy: this });
        },
        update(dt) {
          this.flyTimer += dt;
          this.flySwoopTimer -= dt;

          // Rise to fly height
          if (this.jumpZ < this.flyTargetZ) {
            this.jumpZ = Math.min(this.jumpZ + dt * 0.06, this.flyTargetZ);
          }
          // Hover oscillation
          this.jumpZ = this.flyTargetZ + Math.sin(this.flyTimer * 0.003) * 3;
          this.y = this.groundY - this.jumpZ;

          // Shadow on ground
          if (this.shadow) {
            this.shadow.setScale(0.6);
            this.shadow.setAlpha(0.15);
          }

          // Slowly drift toward target
          if (this.target) {
            const dx = this.target.x - this.x;
            const dy = this.target.groundY - this.groundY;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const spd = this.speed * 0.4 * (dt / 1000);
            this.x += (dx / len) * spd;
            this.groundY = clampToGround(this.groundY + (dy / len) * spd * 0.4);
            this.facingRight = dx > 0;
            this.sprite.setFlipX(!this.facingRight);
          }

          // Swoop when ready and in range
          if (this.flySwoopTimer <= 0 && this.target && this.distToTarget() < 120) {
            this.fsm.transition('swoop');
            return;
          }

          // Land after duration
          if (this.flyTimer >= this.flyDuration) {
            this.isFlying = false;
            this.fsm.transition('chase');
          }
        },
        exit() {
          this.isFlying = false;
          this.jumpZ = 0;
          this.y = this.groundY;
          if (this.shadow) { this.shadow.setScale(1); this.shadow.setAlpha(0.3); }
          this.scene.events.emit('enemyFlyEnd', { enemy: this });
        },
        transitions: allTransitions,
      },

      // ─── SWOOP (Boss dive attack) ───────────────────────
      swoop: {
        enter() {
          this.fsm.locked = true;
          this.swoopTargetX = this.target ? this.target.x : this.x;
          this.swoopTargetY = this.target ? this.target.groundY : this.groundY;
          this.swoopStartX = this.x;
          this.swoopStartY = this.groundY;
          this.swoopStartZ = this.jumpZ;
          this.swoopTimer = 0;
          this.swoopDuration = 350;
          this.swoopLanded = false;

          if (this.target) {
            this.facingRight = this.target.x > this.x;
            this.sprite.setFlipX(!this.facingRight);
          }

          this.sprite.play(`${this.enemyKey}_atk3`, true);
          this.scene.events.emit('enemySwoop', {
            enemy: this, targetX: this.swoopTargetX, targetY: this.swoopTargetY,
          });
        },
        update(dt) {
          if (this.swoopLanded) return;
          this.swoopTimer += dt;
          const t = Math.min(this.swoopTimer / this.swoopDuration, 1);

          this.x = Phaser.Math.Linear(this.swoopStartX, this.swoopTargetX, t);
          this.groundY = clampToGround(
            Phaser.Math.Linear(this.swoopStartY, this.swoopTargetY, t)
          );
          this.jumpZ = Phaser.Math.Linear(this.swoopStartZ, 0, t * t); // accelerate down
          this.y = this.groundY - this.jumpZ;

          // Afterimage during swoop
          if (Math.random() < 0.4) {
            this.scene.events.emit('enemyAfterimage', { enemy: this });
          }

          if (t >= 1) {
            this.swoopLanded = true;
            this.jumpZ = 0;
            this.y = this.groundY;
            if (this.shadow) { this.shadow.setScale(1); this.shadow.setAlpha(0.3); }

            // Impact damage
            const swoopRadius = 35;
            const swoopDmg = (this.aiConfig.swoopDamage || 0.2) * 100 * this.power;
            const party = this.scene.getPartyMembers();
            for (const member of party) {
              if (member.hp <= 0) continue;
              const d = Phaser.Math.Distance.Between(this.x, this.groundY, member.x, member.groundY);
              if (d <= swoopRadius) {
                const dir = {
                  x: (member.x - this.x) / (d || 1) * 8,
                  y: ((member.groundY - this.groundY) / (d || 1)) * 3,
                };
                member.takeDamage(swoopDmg, dir, 350);
              }
            }

            this.scene.events.emit('enemyJumpSlam', {
              enemy: this, x: this.x, y: this.groundY, radius: swoopRadius,
            });
            this.scene.cameras.main.shake(200, 0.01);

            this.fsm.locked = false;
            // Go back to flying or land
            this.scene.time.delayedCall(300, () => {
              if (this.dead || !this.fsm.is('swoop')) return;
              if (this.flyTimer < this.flyDuration * 0.7) {
                this.isFlying = true;
                this.fsm.transition('fly');
              } else {
                this.isFlying = false;
                this.fsm.transition('chase');
              }
            });
          }
        },
        exit() {
          this.jumpZ = 0;
          if (this.shadow) { this.shadow.setScale(1); this.shadow.setAlpha(0.3); }
        },
        transitions: allTransitions,
      },

      // ─── HITSTUN ─────────────────────────────────────────
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
        transitions: allTransitions,
      },

      // ─── KNOCKDOWN ───────────────────────────────────────
      knockdown: {
        enter() {
          this.sprite.play(`${this.enemyKey}_knockdown`, true);
          this.fsm.locked = true;
          this.knockdownTimer = 0;
        },
        update(dt) {
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

      // ─── GETUP ───────────────────────────────────────────
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

      // ─── STUNNED ─────────────────────────────────────────
      stunned: {
        enter() {
          this.sprite.play(`${this.enemyKey}_hitstun`, true);
          this.fsm.locked = true;
          this.stunned = true;
          this.stunTimer = 0;
        },
        update(dt) {
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
        exit() { this.stunned = false; },
        transitions: { chase: 'chase', death: 'death' },
      },

      // ─── DEATH ───────────────────────────────────────────
      death: {
        enter() {
          this.fsm.locked = true;
          this.dead = true;
          if (this.body) this.body.enable = false;

          const scene = this.scene;
          scene.events.emit('enemyDeath', this);

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

          for (let i = 0; i < 24; i++) {
            const size = Phaser.Math.Between(1, 3);
            const blood = scene.add.graphics();
            blood.fillStyle(pickColor(gibColors), 1);
            blood.fillCircle(0, 0, size);
            blood.setPosition(cx, cy);
            blood.setDepth(depthVal + 1);
            const angle = Math.random() * Math.PI * 2;
            const speed = Phaser.Math.Between(60, 200);
            scene.tweens.add({
              targets: blood,
              x: cx + Math.cos(angle) * speed,
              y: cy + Math.sin(angle) * speed * 0.6,
              alpha: 0,
              duration: Phaser.Math.Between(400, 900),
              ease: 'Power2',
              onComplete: () => blood.destroy(),
            });
          }

          const partShapes = ['circle', 'rect', 'triangle'];
          for (let i = 0; i < 8; i++) {
            const chunk = scene.add.graphics();
            const color = i < 5 ? pickColor(gibColors) : pickColor(boneColors);
            const shape = partShapes[Phaser.Math.Between(0, partShapes.length - 1)];
            const chunkSize = Phaser.Math.Between(2, 5);
            chunk.fillStyle(color, 1);
            if (shape === 'circle') chunk.fillCircle(0, 0, chunkSize);
            else if (shape === 'rect') chunk.fillRect(-chunkSize, -chunkSize / 2, chunkSize * 2, chunkSize);
            else chunk.fillTriangle(0, -chunkSize, -chunkSize, chunkSize, chunkSize, chunkSize);
            chunk.setPosition(cx, cy);
            chunk.setDepth(depthVal + 2);

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

            scene.tweens.add({ targets: chunk, x: finalX, angle: Phaser.Math.Between(-720, 720), duration, ease: 'Linear' });
            scene.tweens.add({
              targets: chunk, y: peakY, duration: duration * 0.35, ease: 'Quad.easeOut',
              onComplete: () => { scene.tweens.add({ targets: chunk, y: finalY, duration: duration * 0.65, ease: 'Quad.easeIn' }); },
            });
            scene.tweens.add({ targets: chunk, alpha: 0, delay: duration * 0.6, duration: duration * 0.4, onComplete: () => chunk.destroy() });
          }

          const pool = scene.add.graphics();
          pool.fillStyle(0x660000, 0.7);
          pool.fillCircle(0, 0, 6);
          pool.setPosition(cx, cy + 2);
          pool.setDepth(depthVal - 1);
          pool.setScale(0.5, 0.3);
          pool.setAlpha(0);
          scene.tweens.add({ targets: pool, alpha: 0.5, scaleX: Phaser.Math.FloatBetween(3, 5), scaleY: Phaser.Math.FloatBetween(1.5, 2.5), duration: 400, ease: 'Power2' });
          scene.tweens.add({ targets: pool, alpha: 0, delay: 2500, duration: 1500, onComplete: () => pool.destroy() });

          scene.cameras.main.shake(120, 0.006);
          scene.time.delayedCall(200, () => { this.destroy(); });
        },
        update(dt) {},
        transitions: {},
      },
    };
  }

  // ═══════════════════════════════════════════════════════════
  //  COMBO ATTACK SYSTEM
  // ═══════════════════════════════════════════════════════════

  _startComboHit() {
    const ai = this.aiConfig;
    const hit = this.comboHit;
    const animKey = `${this.enemyKey}_atk${hit}`;

    this.sprite.play(animKey, true);
    this.attackTimer = this.attackCooldown;
    this.fsm.locked = true;
    this.attackWindup = true;

    if (this.target) {
      this.facingRight = this.target.x > this.x;
      this.sprite.setFlipX(!this.facingRight);
    }

    // Escalating windup / damage / hitbox per combo hit
    const windupTime = hit === 1 ? 350 : hit === 2 ? 250 : 200;
    const damageMult = hit === 1 ? 1.0 : hit === 2 ? 1.3 : 2.0;
    const hitboxScale = hit === 1 ? 1.0 : hit === 2 ? 1.1 : 1.4;
    const lungeDir = this.facingRight ? 1 : -1;
    this.lungeVx = lungeDir * (hit === 3 ? 2.5 : 1.5);

    this.scene.events.emit('enemyWindup', { enemy: this, duration: windupTime, comboHit: hit });

    this.scene.time.delayedCall(windupTime, () => {
      if (!this.fsm.is('attack') || this.dead) return;
      this.attackWindup = false;
      this.lungeVx = lungeDir * (hit === 3 ? 5 : 3);
      this.scene.events.emit('enemyAttack', {
        enemy: this,
        damage: 10 * this.power * damageMult,
        comboHit: hit,
        hitbox: {
          x: this.x + (this.facingRight ? 16 : -34 * hitboxScale),
          y: this.groundY - 12,
          width: Math.round(28 * hitboxScale),
          height: Math.round(20 * hitboxScale),
        },
      });
    });

    this.sprite.once('animationcomplete', () => {
      if (this.dead) return;
      const maxHits = ai.comboHits || 1;
      const canChain = hit < maxHits && Math.random() < (ai.comboChance || 0);
      const inRange = this.target && this.distToTarget() < this.attackRange + 20;

      if (canChain && inRange) {
        this.comboHit = hit + 1;
        this._startComboHit();
      } else {
        this.fsm.locked = false;
        this.retreatTimer = this.retreatDuration;
        this.fsm.transition('retreat');
      }
    });

    // Safety timeout per hit
    this.scene.time.delayedCall(900, () => {
      if (this.fsm.is('attack') && !this.dead && this.comboHit === hit) {
        this.fsm.locked = false;
        this.retreatTimer = this.retreatDuration;
        this.fsm.transition('retreat');
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  SPECIAL ABILITIES
  // ═══════════════════════════════════════════════════════════

  _executeSpecial() {
    const ability = this.specialAbilityKey;
    const dir = this.facingRight ? 1 : -1;
    this.lungeVx = dir * 2;

    if (ability === 'cleaving_spin') {
      // AoE around self
      const party = this.scene.getPartyMembers();
      for (const m of party) {
        if (m.hp <= 0) continue;
        const d = Phaser.Math.Distance.Between(this.x, this.groundY, m.x, m.groundY);
        if (d <= 35) {
          const kd = { x: (m.x - this.x) / (d || 1) * 6, y: 0 };
          m.takeDamage(15 * this.power, kd, 250);
        }
      }
      this.scene.events.emit('enemySpecial', { enemy: this, ability, x: this.x, y: this.groundY });
      this.scene.cameras.main.shake(80, 0.004);

    } else if (ability === 'fire_breath' || ability === 'magma_slam') {
      // Cone damage in front
      const party = this.scene.getPartyMembers();
      for (const m of party) {
        if (m.hp <= 0) continue;
        const dx = m.x - this.x;
        const dy = m.groundY - this.groundY;
        const d = Math.sqrt(dx * dx + dy * dy);
        const inFront = (dx * dir) > 0;
        if (d <= 60 && inFront && Math.abs(dy) < 30) {
          const kd = { x: dir * 5, y: 0 };
          m.takeDamage(20 * this.power, kd, 300);
        }
      }
      this.scene.events.emit('enemySpecial', { enemy: this, ability, x: this.x, y: this.groundY, dir });
      this.scene.cameras.main.shake(100, 0.005);

    } else if (ability === 'ground_pound' || ability === 'ice_shatter') {
      // AoE stun
      const party = this.scene.getPartyMembers();
      for (const m of party) {
        if (m.hp <= 0) continue;
        const d = Phaser.Math.Distance.Between(this.x, this.groundY, m.x, m.groundY);
        if (d <= 45) {
          const kd = { x: (m.x - this.x) / (d || 1) * 4, y: 0 };
          m.takeDamage(12 * this.power, kd, 400);
        }
      }
      this.scene.events.emit('enemySpecial', { enemy: this, ability, x: this.x, y: this.groundY });
      this.scene.cameras.main.shake(120, 0.008);

    } else if (ability === 'water_surge') {
      // Line AoE in front
      const party = this.scene.getPartyMembers();
      for (const m of party) {
        if (m.hp <= 0) continue;
        const dx = m.x - this.x;
        const inFront = (dx * dir) > 0;
        const dist = Math.abs(dx);
        if (inFront && dist <= 80 && Math.abs(m.groundY - this.groundY) < 20) {
          const kd = { x: dir * 8, y: 0 };
          m.takeDamage(14 * this.power, kd, 250);
        }
      }
      this.scene.events.emit('enemySpecial', { enemy: this, ability, x: this.x, y: this.groundY, dir });
      this.scene.cameras.main.shake(60, 0.003);

    } else if (ability === 'void_zone') {
      // Persistent AoE pool
      const zx = this.target ? this.target.x : this.x;
      const zy = this.target ? this.target.groundY : this.groundY;
      this.scene.events.emit('enemySpecial', { enemy: this, ability, x: zx, y: zy });
      // Damage ticks handled by VFX event / scene
      const tickCount = 5;
      for (let i = 0; i < tickCount; i++) {
        this.scene.time.delayedCall(i * 600, () => {
          if (!this.scene) return;
          const party = this.scene.getPartyMembers();
          for (const m of party) {
            if (m.hp <= 0) continue;
            const d = Phaser.Math.Distance.Between(zx, zy, m.x, m.groundY);
            if (d <= 30) {
              m.takeDamage(6 * this.power, { x: 0, y: 0 }, 80);
            }
          }
        });
      }
    } else {
      // Generic damage fallback
      this.scene.events.emit('enemySpecial', { enemy: this, ability: 'generic', x: this.x, y: this.groundY });
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  RAID BOSS ABILITIES (telegraphed + dodgeable)
  // ═══════════════════════════════════════════════════════════

  _tickRaidAbilities(dt) {
    const ai = this.aiConfig;
    if (!ai.raidBoss || !ai.abilities) return false;
    if (this.fsm.is('death') || this.isFlying) return false;
    // Don't fire abilities during other locked states
    if (this.fsm.locked) return false;

    for (const [key, cfg] of Object.entries(ai.abilities)) {
      if (this.raidAbilityCooldowns[key] > 0) {
        this.raidAbilityCooldowns[key] -= dt;
        continue;
      }

      // Fire this ability
      this.raidAbilityCooldowns[key] = cfg.cooldown;
      this._castRaidAbility(key, cfg);
      return true; // Only one ability per frame
    }
    return false;
  }

  _castRaidAbility(key, cfg) {
    this.fsm.locked = true;
    this.sprite.play(`${this.enemyKey}_special1`, true);

    // Face target
    if (this.target) {
      this.facingRight = this.target.x > this.x;
      this.sprite.setFlipX(!this.facingRight);
    }

    // Telegraph phase
    this.scene.events.emit('raidBossTelegraph', {
      enemy: this, ability: key, config: cfg,
      x: this.x, y: this.groundY,
      targetX: this.target?.x || this.x,
      targetY: this.target?.groundY || this.groundY,
      dir: this.facingRight ? 1 : -1,
    });

    // Execute after telegraph
    this.scene.time.delayedCall(cfg.telegraphTime || 800, () => {
      if (this.dead || !this.scene) return;

      if (key === 'hellfire_rain') this._abilityHellfireRain(cfg);
      else if (key === 'shadow_cleave') this._abilityShadowCleave(cfg);
      else if (key === 'fel_stomp') this._abilityFelStomp(cfg);
      else if (key === 'inferno_charge') this._abilityInfernoCharge(cfg);

      // Unlock after a short recovery
      this.scene.time.delayedCall(600, () => {
        if (!this.dead && this.fsm.locked) {
          this.fsm.locked = false;
          this.fsm.transition('chase');
        }
      });
    });
  }

  /** Hellfire Rain — fire circles rain down on random positions. Dodge the circles! */
  _abilityHellfireRain(cfg) {
    const count = cfg.count || 12;
    const delay = cfg.delay || 200;
    const radius = cfg.radius || 22;
    const dmg = (cfg.damage || 0.15) * 100 * this.power;

    for (let i = 0; i < count; i++) {
      // Target random positions near party members
      const party = this.scene.getPartyMembers();
      if (party.length === 0) return;
      const t = party[Phaser.Math.Between(0, party.length - 1)];
      const tx = t.x + Phaser.Math.Between(-40, 40);
      const ty = t.groundY + Phaser.Math.Between(-12, 12);

      this.scene.time.delayedCall(i * delay, () => {
        if (!this.scene) return;
        // Emit telegraph circle BEFORE impact
        this.scene.events.emit('raidBossHellfireDrop', { x: tx, y: ty, radius, delay: 500 });

        // Damage after telegraph delay
        this.scene.time.delayedCall(500, () => {
          if (!this.scene) return;
          const members = this.scene.getPartyMembers();
          for (const m of members) {
            if (m.hp <= 0) continue;
            const d = Phaser.Math.Distance.Between(tx, ty, m.x, m.groundY);
            if (d <= radius) {
              m.takeDamage(dmg, { x: (m.x - tx) / (d || 1) * 4, y: 0 }, 150);
            }
          }
          this.scene.events.emit('raidBossHellfireImpact', { x: tx, y: ty, radius });
        });
      });
    }
  }

  /** Shadow Cleave — wide frontal cone. Giant telegraph line, then massive damage. */
  _abilityShadowCleave(cfg) {
    const dir = this.facingRight ? 1 : -1;
    const width = cfg.width || 120;
    const dmg = (cfg.damage || 0.3) * 100 * this.power;

    const party = this.scene.getPartyMembers();
    for (const m of party) {
      if (m.hp <= 0) continue;
      const dx = m.x - this.x;
      const inFront = (dx * dir) > 0;
      if (inFront && Math.abs(dx) <= width && Math.abs(m.groundY - this.groundY) < 35) {
        m.takeDamage(dmg, { x: dir * 10, y: 0 }, 400);
      }
    }

    this.scene.events.emit('raidBossShadowCleave', {
      enemy: this, dir, width, x: this.x, y: this.groundY,
    });
    this.scene.cameras.main.shake(200, 0.01);
  }

  /** Fel Stomp — massive AoE around boss. Jump up, slam down. */
  _abilityFelStomp(cfg) {
    const radius = cfg.radius || 60;
    const dmg = (cfg.damage || 0.2) * 100 * this.power;

    const party = this.scene.getPartyMembers();
    for (const m of party) {
      if (m.hp <= 0) continue;
      const d = Phaser.Math.Distance.Between(this.x, this.groundY, m.x, m.groundY);
      if (d <= radius) {
        const kd = { x: (m.x - this.x) / (d || 1) * 8, y: 0 };
        m.takeDamage(dmg, kd, 200);
        // Stun if close enough
        if (d <= radius * 0.6 && m.fsm) {
          m.knockbackVelocity = kd;
          m.hitstunDuration = cfg.stunDuration || 1500;
          m.fsm.forceState('hitstun');
        }
      }
    }

    this.scene.events.emit('raidBossFelStomp', {
      enemy: this, x: this.x, y: this.groundY, radius,
    });
    this.scene.cameras.main.shake(300, 0.015);
  }

  /** Inferno Charge — boss charges across the arena leaving fire trail. */
  _abilityInfernoCharge(cfg) {
    const dir = this.facingRight ? 1 : -1;
    const chargeSpeed = (cfg.speed || 300) / 1000;
    const chargeDist = 200;
    const dmg = (cfg.damage || 0.35) * 100 * this.power;
    const trailDmg = (cfg.trailDamage || 0.08) * 100 * this.power;

    this.sprite.play(`${this.enemyKey}_walk`, true);
    this.sprite.anims.msPerFrame = 25;

    let remaining = chargeDist;
    const trailPositions = [];

    const chargeUpdate = this.scene.time.addEvent({
      delay: 16, repeat: -1,
      callback: () => {
        if (this.dead || !this.scene) { chargeUpdate.destroy(); return; }
        const step = chargeSpeed * 16;
        this.x += dir * step;
        remaining -= step;
        this.clampToRoom();

        // Drop fire trail
        trailPositions.push({ x: this.x, y: this.groundY });
        this.scene.events.emit('raidBossChargeTrail', { x: this.x, y: this.groundY });

        // Hit players in path
        const party = this.scene.getPartyMembers();
        for (const m of party) {
          if (m.hp <= 0) continue;
          const d = Phaser.Math.Distance.Between(this.x, this.groundY, m.x, m.groundY);
          if (d <= 20) {
            m.takeDamage(dmg, { x: dir * 12, y: 0 }, 350);
          }
        }

        if (remaining <= 0) {
          chargeUpdate.destroy();
          this.scene.events.emit('raidBossChargeEnd', { enemy: this });

          // Fire trail persists and damages for 3 seconds
          const trailTick = this.scene.time.addEvent({
            delay: 500, repeat: 5,
            callback: () => {
              if (!this.scene) { trailTick.destroy(); return; }
              const members = this.scene.getPartyMembers();
              for (const pos of trailPositions) {
                for (const m of members) {
                  if (m.hp <= 0) continue;
                  const d = Phaser.Math.Distance.Between(pos.x, pos.y, m.x, m.groundY);
                  if (d <= 12) {
                    m.takeDamage(trailDmg, { x: 0, y: 0 }, 50);
                  }
                }
              }
            },
          });
          this.scene.time.delayedCall(3500, () => {
            trailTick.destroy();
            this.scene.events.emit('raidBossTrailFade', { positions: trailPositions });
          });
        }
      },
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  AI HELPERS
  // ═══════════════════════════════════════════════════════════

  isPlayerAttacking() {
    if (!this.target || !this.target.fsm) return false;
    const state = this.target.fsm.currentState;
    return state === 'attack' || (typeof state === 'string' && state.startsWith('special'));
  }

  computeFlankAngle() {
    const ai = this.aiConfig;
    if (!ai.flankWeight || !this.scene) { this.flankAngle = 0; return; }

    const siblings = this.scene.getAliveEnemies().filter(
      e => e !== this && e.target === this.target && !e.dead
    );
    if (siblings.length === 0) { this.flankAngle = 0; return; }

    const total = siblings.length + 1;
    const myIndex = siblings.filter(e => (e.networkId || '') < (this.networkId || '')).length;
    const spread = Math.PI * 0.8;
    this.flankAngle = ((myIndex / Math.max(total - 1, 1)) - 0.5) * spread * ai.flankWeight;
  }

  fireRangedAttack() {
    this.sprite.play(`${this.enemyKey}_atk1`, true);
    const party = this.scene.getPartyMembers();
    const alive = party.filter(m => m.hp > 0);
    const rangedTarget = alive.length > 0 ? alive[Phaser.Math.Between(0, alive.length - 1)] : this.target;
    if (rangedTarget) {
      this.facingRight = rangedTarget.x > this.x;
      this.sprite.setFlipX(!this.facingRight);
    }
    this.scene.events.emit('enemyRangedAttack', { enemy: this, target: rangedTarget });
  }

  findTarget() {
    const party = this.scene.getPartyMembers();
    if (party.length === 0) { this.target = null; return; }
    const tank = party.find(m => m.hp > 0 && m.classData && m.classData.role === 'tank');
    if (tank) { this.target = tank; return; }
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

    // Apply flank offset for pack coordination
    let moveX = dx / len;
    let moveY = dy / len;
    if (this.flankAngle !== 0) {
      const cos = Math.cos(this.flankAngle);
      const sin = Math.sin(this.flankAngle);
      const rx = moveX * cos - moveY * sin;
      const ry = moveX * sin + moveY * cos;
      moveX = moveX * 0.6 + rx * 0.4;
      moveY = moveY * 0.6 + ry * 0.4;
    }

    this.x += moveX * spd;
    this.groundY = clampToGround(this.groundY + moveY * spd * 0.6);
    this.y = this.groundY;
    this.facingRight = dx > 0;
    this.sprite.setFlipX(!this.facingRight);
  }

  strafeAroundTarget(dt) {
    if (!this.target) return;
    const dx = this.target.x - this.x;
    const dy = this.target.groundY - this.groundY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const spd = this.speed * 0.8 * (dt / 1000);
    const perpX = -dy / len * this.strafeDir;
    const perpY = dx / len * this.strafeDir;
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

  // ═══════════════════════════════════════════════════════════
  //  COMBAT
  // ═══════════════════════════════════════════════════════════

  takeDamage(amount, knockbackDir, hitstunDuration) {
    if (this.fsm.is('death')) return;
    const stunnedMultiplier = this.stunned ? 2 : 1;
    const finalDamage = Math.max(1, Math.round((amount * stunnedMultiplier) / this.defense));
    this.hp -= finalDamage;

    this.scene.events.emit('entityDamaged', {
      entity: this, damage: finalDamage, x: this.x, y: this.y - 20,
    });

    // Boss phase check
    if (this.enemyData.phases) this._checkPhase();

    if (this.hp <= 0) {
      this.hp = 0;
      this.fsm.forceState('death');
      return;
    }

    this.knockbackVelocity = knockbackDir || { x: 0, y: 0 };
    this.hitstunDuration = hitstunDuration || 200;
    // Flying enemies don't get hitstunned (they're airborne)
    if (this.isFlying) return;
    this.fsm.forceState('hitstun');
  }

  _checkPhase() {
    const phases = this.enemyData.phases;
    if (!phases) return;
    const pct = this.hp / this.maxHp;
    for (let i = this.currentPhase; i < phases.length; i++) {
      if (pct <= phases[i].hpThreshold) {
        this.currentPhase = i + 1;
        const buff = phases[i].buff;
        if (buff === 'enrage') {
          this.enraged = true;
          this.power *= 1.5;
          this.speed *= 1.3;
          this.sprite.setTint(0xff4444);
          this.scene.cameras.main.shake(200, 0.008);
          this.scene.events.emit('enemyEnrage', { enemy: this });
        } else if (buff === 'meteor_phase') {
          // Reduce hellfire rain cooldown for more intense phase
          if (this.raidAbilityCooldowns.hellfire_rain !== undefined) {
            this.raidAbilityCooldowns.hellfire_rain = 0; // Trigger immediately
            if (this.aiConfig.abilities?.hellfire_rain) {
              this.aiConfig.abilities.hellfire_rain.cooldown = 7000; // Faster
              this.aiConfig.abilities.hellfire_rain.count = 16; // More meteors
            }
          }
          this.sprite.setTint(0xff6622);
          this.scene.cameras.main.shake(250, 0.01);
          this.scene.events.emit('enemyPhaseChange', { enemy: this, buff });
        } else {
          this.scene.events.emit('enemyPhaseChange', { enemy: this, buff });
        }
      }
    }
  }

  applyStun(duration, knockbackDir) {
    if (this.fsm.is('death')) return;
    this.stunDuration = duration;
    this.knockbackVelocity = knockbackDir || { x: 0, y: 0 };
    this.isFlying = false;
    this.jumpZ = 0;
    this.fsm.locked = false;
    this.fsm.forceState('stunned');
  }

  applyKnockdown(duration, knockbackDir) {
    if (this.fsm.is('death')) return;
    this.knockdownDuration = duration;
    this.knockbackVelocity = knockbackDir || { x: 0, y: 0 };
    this.isFlying = false;
    this.jumpZ = 0;
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
        entity: this, damage: this.bleed.damagePerTick,
        x: this.x + Phaser.Math.Between(-4, 4), y: this.y - 16,
      });
      if (this.hp <= 0) {
        this.hp = 0;
        this.fsm.forceState('death');
        this.bleed = null;
        return;
      }
      if (this.bleed.ticksRemaining <= 0) this.bleed = null;
    }
  }

  updateHpBar() {
    const pct = this.hp / this.maxHp;
    this.hpBarFill.setScale(pct, 1);
    if (this.stunned) {
      this.hpBarFill.setTint(0xeecc44);
    } else if (this.enraged) {
      this.hpBarFill.setTint(0xff2222);
    } else if (this.enemyData.type === 'elite') {
      this.hpBarFill.setTint(0xccaa44);
    } else if (this.enemyData.type === 'boss') {
      this.hpBarFill.setTint(0xcc4444);
    } else {
      this.hpBarFill.clearTint();
    }
    if (this.bleedIcon) this.bleedIcon.setVisible(this.bleed !== null);
  }

  applyAffixBuff(type, value) {
    this.affixBuffs.push({ type, value });
    if (type === 'bolster_damage') this.power += value;
    if (type === 'bolster_scale') this.sprite.setScale(this.sprite.scaleX + value);
  }

  // ═══════════════════════════════════════════════════════════
  //  MAIN UPDATE
  // ═══════════════════════════════════════════════════════════

  update(time, dt) {
    if (this.dead) return;

    // Cooldown ticks
    if (this.attackTimer > 0) this.attackTimer -= dt;
    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    if (this.dodgeCooldown > 0) this.dodgeCooldown -= dt;
    if (this.jumpCooldownTimer > 0) this.jumpCooldownTimer -= dt;
    if (this.specialTimer > 0) this.specialTimer -= dt;
    if (this.flyCooldown > 0) this.flyCooldown -= dt;
    if (this.swoopCooldown > 0) this.swoopCooldown -= dt;

    this.updateBleed(dt);
    this.fsm.update(dt);
    this.y = this.groundY - this.jumpZ;
    this.updateHpBar();
    this.setDepth(GAME_CONFIG.layers.entities + this.groundY);
  }
}
