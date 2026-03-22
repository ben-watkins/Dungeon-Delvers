/**
 * PLAYER ENTITY
 * 
 * The player-controlled character. Handles:
 * - Input processing
 * - State machine (idle, walk, attack, special, hitstun, etc.)
 * - Combo chain with input buffering
 * - Hitbox/hurtbox management
 * - Health, cooldowns, and status effects
 * 
 * COORDINATE NOTES:
 *   this.x / this.y  — Position on the 2.5D ground plane
 *   this.groundY      — Same as this.y; used for depth sorting
 *   this.jumpZ         — Vertical offset for jumps (0 = on ground)
 *   Visual position:   sprite renders at (this.x, this.y - this.jumpZ)
 */

import Phaser from 'phaser';
import { StateMachine } from '../utils/StateMachine.js';
import { CLASSES, ATTACKS, INPUT_MAP, GAME_CONFIG } from '../config/game.js';
import { clampToGround } from '../utils/DepthSort.js';

export class Player extends Phaser.GameObjects.Container {
  constructor(scene, x, y, classKey) {
    super(scene, x, y);
    scene.add.existing(this);

    this.classKey = classKey;
    this.classData = CLASSES[classKey];
    this.groundY = y;
    this.jumpZ = 0;
    this.facingRight = true;

    // Stats
    this.maxHp = this.classData.stats.hp;
    this.hp = this.maxHp;
    this.speed = this.classData.stats.speed;
    this.power = this.classData.stats.power;
    this.defense = this.classData.stats.defense;

    // Combat state
    this.comboIndex = 0;
    this.comboTimer = 0;
    this.comboWindow = 500;  // ms to input next combo hit
    this.inputBuffer = null;  // Buffered action to execute when current state allows
    this.cooldowns = { special1: 0, special2: 0, special3: 0, special4: 0, special5: 0 };
    this.hitStopTimer = 0;
    this.knockbackVelocity = { x: 0, y: 0 };
    this.invulnerable = false;
    this.invulnTimer = 0;

    // Status effects (for M+ affixes)
    this.statusEffects = [];  // { type, stacks, duration, timer }

    // Sprite
    this.sprite = scene.add.sprite(0, 0, classKey);
    this.sprite.setOrigin(0.5, 1);  // Origin at feet for depth sorting
    this.add(this.sprite);

    // Shadow
    this.shadow = scene.add.image(0, 0, 'shadow');
    this.shadow.setOrigin(0.5, 0.5);
    this.shadow.setAlpha(0.4);
    this.add(this.shadow);
    this.sendToBack(this.shadow);

    // HP bar (above head)
    this.hpBarBg = scene.add.image(0, -this.sprite.height - 4, 'hp_bar_bg');
    this.hpBarBg.setOrigin(0.5, 0.5);
    this.add(this.hpBarBg);

    this.hpBarFill = scene.add.image(-15, -this.sprite.height - 4, 'hp_bar_fill');
    this.hpBarFill.setOrigin(0, 0.5);
    this.add(this.hpBarFill);

    // Physics body (for collision detection)
    scene.physics.add.existing(this);
    this.body.setSize(16, 8);       // Narrow body for ground collision
    this.body.setOffset(-8, -4);

    // Active hitbox (created dynamically during attacks)
    this.activeHitbox = null;

    // State machine
    this.fsm = new StateMachine(this, this.buildStates());
    this.fsm.start('idle');

    // Input
    this.keys = {};
    const kb = scene.input.keyboard;
    this.keys.left = kb.addKey(INPUT_MAP.moveLeft);
    this.keys.right = kb.addKey(INPUT_MAP.moveRight);
    this.keys.up = kb.addKey(INPUT_MAP.moveUp);
    this.keys.down = kb.addKey(INPUT_MAP.moveDown);
    this.keys.attack = kb.addKey(INPUT_MAP.attack);
    this.keys.special1 = kb.addKey(INPUT_MAP.special1);
    this.keys.special2 = kb.addKey(INPUT_MAP.special2);
    this.keys.block = kb.addKey(INPUT_MAP.block);
    this.keys.dodge = kb.addKey(INPUT_MAP.dodge);
    this.keys.sprint = kb.addKey('SHIFT');
    this.keys.tab = kb.addKey('TAB');
    this.keys.special3 = kb.addKey('NUMPAD_SEVEN');
    this.keys.special4 = kb.addKey('NUMPAD_FOUR');
    this.keys.special5 = kb.addKey('NUMPAD_FIVE');

    // Tab target reference (set by DungeonScene)
    this.tabTarget = null;

    // Track just-pressed for buffering
    this.attackJustPressed = false;
    this.special1JustPressed = false;
    this.special2JustPressed = false;
    this.special3JustPressed = false;
    this.special4JustPressed = false;
    this.special5JustPressed = false;
    this.tabJustPressed = false;

    // Gamepad — tracks previous frame button state for just-pressed detection
    this.pad = null;
    this.padPrev = {};
  }

  buildStates() {
    const self = this;
    return {
      idle: {
        enter() {
          this.sprite.play(`${this.classKey}_idle`, true);
          this.comboIndex = 0;
        },
        update(dt) {
          this.handleMovementInput(dt);
          if (this.isMoving()) {
            this.fsm.transition('walk');
          }
          if (this.attackJustPressed) {
            this.fsm.transition('attack');
          }
          if (this.special1JustPressed && this.cooldowns.special1 <= 0) {
            this.fsm.transition('special1');
          }
          if (this.special2JustPressed && this.cooldowns.special2 <= 0) {
            this.fsm.transition('special2');
          }
          if (this.special3JustPressed && this.cooldowns.special3 <= 0 && this.classData.specials.special3) {
            this.fsm.transition('special3');
          }
          if (this.special4JustPressed && this.cooldowns.special4 <= 0 && this.classData.specials.special4) {
            this.fsm.transition('special4');
          }
          if (this.special5JustPressed && this.cooldowns.special5 <= 0 && this.classData.specials.special5) {
            this.fsm.transition('special5');
          }
        },
        transitions: { walk: 'walk', attack: 'attack', special1: 'special1', special2: 'special2', special3: 'special3', special4: 'special4', special5: 'special5', hitstun: 'hitstun', death: 'death' },
      },

      walk: {
        enter() {
          this.sprite.play(`${this.classKey}_walk`, true);
        },
        update(dt) {
          this.handleMovementInput(dt);
          if (!this.isMoving()) {
            this.fsm.transition('idle');
          }
          if (this.attackJustPressed) {
            this.fsm.transition('attack');
          }
          if (this.special1JustPressed && this.cooldowns.special1 <= 0) {
            this.fsm.transition('special1');
          }
          if (this.special2JustPressed && this.cooldowns.special2 <= 0) {
            this.fsm.transition('special2');
          }
          if (this.special3JustPressed && this.cooldowns.special3 <= 0 && this.classData.specials.special3) {
            this.fsm.transition('special3');
          }
        },
        transitions: { idle: 'idle', attack: 'attack', special1: 'special1', special2: 'special2', special3: 'special3', hitstun: 'hitstun', death: 'death' },
      },

      attack: {
        enter() {
          const combo = this.classData.combo;
          const attackKey = combo[this.comboIndex];
          const attackData = ATTACKS[attackKey];

          this.sprite.play(`${this.classKey}_atk${this.comboIndex + 1}`, true);
          this.currentAttack = attackData;
          this.attackFrame = 0;
          this.attackHit = false;
          this.beamFired = false;

          // Auto-face tab target
          if (this.tabTarget && this.tabTarget.hp > 0) {
            this.facingRight = this.tabTarget.x > this.x;
            this.sprite.setFlipX(!this.facingRight);
          }

          // Signal AI companions that combat has begun
          this.scene.events.emit('playerAttack');

          // Lock FSM during active attack frames
          this.fsm.locked = true;

          this.sprite.once('animationcomplete', () => {
            if (this.inputBuffer === 'attack' && attackData.canCancel >= 0) {
              this.comboIndex = (this.comboIndex + 1) % combo.length;
              this.comboTimer = this.comboWindow;
              this.inputBuffer = null;
              this.fsm.locked = false;
              this.fsm.forceState('attack');
            } else {
              this.comboTimer = this.comboWindow;
              this.fsm.locked = false;
              this.fsm.transition('idle');
            }
          });
        },
        update(dt) {
          this.handleMovementInput(dt);
          this.attackFrame++;

          // Priest ranged beam attack — fires at mid-animation instead of melee hitbox
          if (this.classData.rangedAttack && !this.beamFired) {
            if (this.attackFrame >= 3) {
              this.beamFired = true;
              const ranged = this.classData.rangedAttack;
              const enemies = this.scene.getAliveEnemies();
              let totalDamage = 0;

              for (const enemy of enemies) {
                const dmg = ranged.damage * this.power * 10;
                enemy.takeDamage(dmg, { x: 0, y: 0 }, 80);
                totalDamage += dmg;

                this.scene.events.emit('priestBeam', {
                  source: this,
                  target: enemy,
                  color: ranged.beamColor,
                  beamCount: ranged.beamCount,
                });
              }

              // Heal all allies with total damage dealt
              if (totalDamage > 0 && ranged.healPercent) {
                const healAmount = Math.round(totalDamage * ranged.healPercent);
                const party = this.scene.getPartyMembers();
                for (const member of party) {
                  if (member.hp <= 0 || member.hp >= member.maxHp) continue;
                  member.hp = Math.min(member.maxHp, member.hp + healAmount);
                  this.scene.events.emit('aiHeal', {
                    healer: this, target: member, amount: healAmount,
                  });
                }
              }
            }
          } else if (this.currentAttack) {
            // Melee hitbox for non-ranged classes
            const { activeStart, activeEnd, hitbox } = this.currentAttack;
            if (this.attackFrame >= activeStart && this.attackFrame <= activeEnd) {
              this.activateHitbox(hitbox);
            } else {
              this.deactivateHitbox();
            }
          }

          // Buffer combo input
          if (this.attackJustPressed) {
            this.inputBuffer = 'attack';
          }
        },
        exit() {
          this.deactivateHitbox();
          this.currentAttack = null;
        },
        transitions: { idle: 'idle', hitstun: 'hitstun', death: 'death' },
      },

      special1: {
        enter() {
          // Auto-face tab target
          if (this.tabTarget && this.tabTarget.hp > 0) {
            this.facingRight = this.tabTarget.x > this.x;
            this.sprite.setFlipX(!this.facingRight);
          }

          this.sprite.play(`${this.classKey}_special1`, true);
          this.cooldowns.special1 = this.classData.specials.special1.cooldown;
          this.fsm.locked = true;

          // Signal combat started
          this.scene.events.emit('playerAttack');

          // Delay damage + VFX to mid-swing (200ms into animation)
          this.scene.time.delayedCall(200, () => {
            if (!this.fsm.is('special1')) return;
            this.scene.events.emit('playerSpecial', {
              player: this,
              special: this.classData.specials.special1,
              key: 'special1',
            });
          });

          this.sprite.once('animationcomplete', () => {
            this.fsm.locked = false;
            this.fsm.transition('idle');
          });
        },
        update(dt) { this.handleMovementInput(dt); },
        transitions: { idle: 'idle', hitstun: 'hitstun', death: 'death' },
      },

      special2: {
        enter() {
          // Auto-face tab target
          if (this.tabTarget && this.tabTarget.hp > 0) {
            this.facingRight = this.tabTarget.x > this.x;
            this.sprite.setFlipX(!this.facingRight);
          }

          this.sprite.play(`${this.classKey}_special2`, true);
          this.cooldowns.special2 = this.classData.specials.special2.cooldown;
          this.fsm.locked = true;

          this.scene.events.emit('playerSpecial', {
            player: this,
            special: this.classData.specials.special2,
            key: 'special2',
          });

          this.sprite.once('animationcomplete', () => {
            this.fsm.locked = false;
            this.fsm.transition('idle');
          });
        },
        update(dt) { this.handleMovementInput(dt); },
        transitions: { idle: 'idle', hitstun: 'hitstun', death: 'death' },
      },

      special3: {
        enter() {
          const special = this.classData.specials.special3;
          this.cooldowns.special3 = special.cooldown;
          this.fsm.locked = true;
          this.special3Class = this.classKey;

          if (this.classKey === 'priest') {
            // --- PRIEST: Divine Ascension — levitate with wings, lightning heals ---
            this.sprite.play(`${this.classKey}_special1`, true);
            this.ascensionTimer = 0;
            this.ascensionDuration = special.duration;
            this.ascensionBlobTimer = 0;
            this.ascensionBlobInterval = special.duration / special.blobCount;
            this.ascensionBlobsLobbed = 0;
            this.ascensionSpecial = special;

            // Bright body glow
            this.ascensionGlow = this.scene.add.circle(this.x, this.groundY - 20, 18, 0xffffcc, 0.35);
            this.ascensionGlow.setDepth(GAME_CONFIG.layers.foregroundDecor);

            // Outer radiance
            this.ascensionRadiance = this.scene.add.circle(this.x, this.groundY - 20, 30, 0xffffaa, 0.12);
            this.ascensionRadiance.setDepth(GAME_CONFIG.layers.foregroundDecor - 1);

            // Wings — drawn as graphics, updated each frame
            this.ascensionWings = this.scene.add.graphics();
            this.ascensionWings.setDepth(GAME_CONFIG.layers.foregroundDecor - 1);

            // Sprite glow tint
            this.sprite.setTint(0xffffdd);

            // Sparkle aura particles
            this.ascensionAura = this.scene.add.particles(this.x, this.groundY - 20, 'vfx_circle', {
              speed: { min: 8, max: 20 },
              angle: { min: 0, max: 360 },
              lifespan: 400,
              tint: 0xffffaa,
              alpha: { start: 0.6, end: 0 },
              scale: { start: 0.5, end: 0.1 },
              frequency: 60,
              emitting: true,
            });
            this.ascensionAura.setDepth(GAME_CONFIG.layers.foregroundDecor);
          } else {
            // --- WARRIOR: Heroic Leap ---
            let targetX = this.x + (this.facingRight ? 60 : -60);
            let targetY = this.groundY;
            if (this.tabTarget && this.tabTarget.hp > 0) {
              targetX = this.tabTarget.x;
              targetY = this.tabTarget.groundY;
              this.facingRight = targetX > this.x;
              this.sprite.setFlipX(!this.facingRight);
            }

            this.sprite.play(`${this.classKey}_special1`, true);
            this.leapStartX = this.x;
            this.leapStartY = this.groundY;
            this.leapTargetX = targetX;
            this.leapTargetY = targetY;
            this.leapTimer = 0;
            this.leapDuration = 400;
            this.leapSpecial = special;

            this.scene.events.emit('playerAttack');
          }
        },
        update(dt) {
          if (this.special3Class === 'priest') {
            // --- PRIEST: Divine Ascension update ---
            this.ascensionTimer += dt;

            // Levitate — rise then hover with gentle bob
            const riseT = Math.min(this.ascensionTimer / 400, 1);
            const bob = Math.sin(this.ascensionTimer * 0.005) * 3;
            this.jumpZ = riseT * 35 + bob;
            this.y = this.groundY - this.jumpZ;

            const cx = this.x;
            const cy = this.groundY - this.jumpZ - 6;

            // Update glow + radiance position
            if (this.ascensionGlow) {
              this.ascensionGlow.setPosition(cx, cy);
              this.ascensionGlow.setAlpha(0.25 + Math.sin(this.ascensionTimer * 0.01) * 0.15);
              this.ascensionGlow.setScale(1 + Math.sin(this.ascensionTimer * 0.008) * 0.15);
            }
            if (this.ascensionRadiance) {
              this.ascensionRadiance.setPosition(cx, cy);
              this.ascensionRadiance.setAlpha(0.08 + Math.sin(this.ascensionTimer * 0.006) * 0.06);
            }
            if (this.ascensionAura) {
              this.ascensionAura.setPosition(cx, cy);
            }

            // Draw animated wings at shoulder height (behind the character)
            if (this.ascensionWings) {
              this.ascensionWings.clear();
              const wingFlap = Math.sin(this.ascensionTimer * 0.012) * 6;
              // Shoulders: sprite is 48px tall, origin at bottom, so shoulders ~32px up from feet
              const wy = this.groundY - this.jumpZ - 32;

              // Left wing — main feather, mid feather, lower feather
              this.ascensionWings.lineStyle(2, 0xffffcc, 0.8);
              this.ascensionWings.beginPath();
              this.ascensionWings.moveTo(cx - 4, wy);
              this.ascensionWings.lineTo(cx - 18, wy - 12 - wingFlap);
              this.ascensionWings.lineTo(cx - 28, wy - 8 - wingFlap);
              this.ascensionWings.lineTo(cx - 32, wy - 2 - wingFlap * 0.5);
              this.ascensionWings.strokePath();
              // Mid feather
              this.ascensionWings.lineStyle(2, 0xffffdd, 0.6);
              this.ascensionWings.beginPath();
              this.ascensionWings.moveTo(cx - 4, wy + 3);
              this.ascensionWings.lineTo(cx - 16, wy - 5 - wingFlap * 0.8);
              this.ascensionWings.lineTo(cx - 26, wy - 1 - wingFlap * 0.6);
              this.ascensionWings.strokePath();
              // Lower feather
              this.ascensionWings.lineStyle(1, 0xffffee, 0.4);
              this.ascensionWings.beginPath();
              this.ascensionWings.moveTo(cx - 4, wy + 6);
              this.ascensionWings.lineTo(cx - 14, wy + 2 - wingFlap * 0.4);
              this.ascensionWings.lineTo(cx - 22, wy + 5 - wingFlap * 0.3);
              this.ascensionWings.strokePath();

              // Right wing — mirror
              this.ascensionWings.lineStyle(2, 0xffffcc, 0.8);
              this.ascensionWings.beginPath();
              this.ascensionWings.moveTo(cx + 4, wy);
              this.ascensionWings.lineTo(cx + 18, wy - 12 - wingFlap);
              this.ascensionWings.lineTo(cx + 28, wy - 8 - wingFlap);
              this.ascensionWings.lineTo(cx + 32, wy - 2 - wingFlap * 0.5);
              this.ascensionWings.strokePath();
              this.ascensionWings.lineStyle(2, 0xffffdd, 0.6);
              this.ascensionWings.beginPath();
              this.ascensionWings.moveTo(cx + 4, wy + 3);
              this.ascensionWings.lineTo(cx + 16, wy - 5 - wingFlap * 0.8);
              this.ascensionWings.lineTo(cx + 26, wy - 1 - wingFlap * 0.6);
              this.ascensionWings.strokePath();
              this.ascensionWings.lineStyle(1, 0xffffee, 0.4);
              this.ascensionWings.beginPath();
              this.ascensionWings.moveTo(cx + 4, wy + 6);
              this.ascensionWings.lineTo(cx + 14, wy + 2 - wingFlap * 0.4);
              this.ascensionWings.lineTo(cx + 22, wy + 5 - wingFlap * 0.3);
              this.ascensionWings.strokePath();
            }

            // Healing lightning bolts at intervals
            this.ascensionBlobTimer += dt;
            if (this.ascensionBlobTimer >= this.ascensionBlobInterval &&
                this.ascensionBlobsLobbed < this.ascensionSpecial.blobCount) {
              this.ascensionBlobTimer -= this.ascensionBlobInterval;
              this.ascensionBlobsLobbed++;

              const party = this.scene.getPartyMembers();
              const alive = party.filter(m => m.hp > 0);
              if (alive.length > 0) {
                const target = alive[Phaser.Math.Between(0, alive.length - 1)];
                const healAmt = this.ascensionSpecial.healPerBlob;
                target.hp = Math.min(target.maxHp, target.hp + healAmt);

                // Emit healing lightning VFX
                this.scene.events.emit('priestHealLightning', {
                  source: this,
                  target: target,
                  healAmount: healAmt,
                });
              }
            }

            // Loop animation
            if (!this.sprite.anims.isPlaying) {
              this.sprite.play(`${this.classKey}_special1`, true);
            }

            // End after duration
            if (this.ascensionTimer >= this.ascensionDuration) {
              this.jumpZ = 0;
              this.y = this.groundY;
              this.sprite.clearTint();
              this.fsm.locked = false;
              this.fsm.transition('idle');
            }
          } else {
            // --- WARRIOR: Heroic Leap update ---
            this.leapTimer += dt;
            const t = Math.min(this.leapTimer / this.leapDuration, 1);

            this.x = Phaser.Math.Linear(this.leapStartX, this.leapTargetX, t);
            this.groundY = clampToGround(
              Phaser.Math.Linear(this.leapStartY, this.leapTargetY, t)
            );
            this.jumpZ = Math.sin(t * Math.PI) * 40;
            this.y = this.groundY - this.jumpZ;

            if (t >= 1) {
              this.jumpZ = 0;
              this.y = this.groundY;

              const enemies = this.scene.getAliveEnemies();
              const special = this.leapSpecial;
              for (const enemy of enemies) {
                const dist = Phaser.Math.Distance.Between(
                  this.x, this.groundY, enemy.x, enemy.groundY
                );
                if (dist <= special.radius) {
                  enemy.takeDamage(special.damage * this.power * 10, { x: 0, y: 0 }, 0);
                  if (special.stun && enemy.applyStun) {
                    enemy.applyStun(special.stunDuration, { x: 0, y: 0 });
                  }
                }
              }

              this.scene.events.emit('playerSpecial', {
                player: this, special: special, key: 'special3',
              });
              this.scene.cameras.main.shake(150, 0.006);

              this.fsm.locked = false;
              this.fsm.transition('idle');
            }
          }
        },
        exit() {
          if (this.ascensionGlow) { this.ascensionGlow.destroy(); this.ascensionGlow = null; }
          if (this.ascensionRadiance) { this.ascensionRadiance.destroy(); this.ascensionRadiance = null; }
          if (this.ascensionWings) { this.ascensionWings.destroy(); this.ascensionWings = null; }
          if (this.ascensionAura) { this.ascensionAura.destroy(); this.ascensionAura = null; }
          this.sprite.clearTint();
          this.jumpZ = 0;
        },
        transitions: { idle: 'idle', death: 'death' },
      },

      special4: {
        enter() {
          const special = this.classData.specials.special4;
          this.cooldowns.special4 = special.cooldown;
          this.fsm.locked = true;

          // Determine charge target
          let targetX = this.x + (this.facingRight ? 120 : -120);
          let targetY = this.groundY;

          if (this.tabTarget && this.tabTarget.hp > 0) {
            targetX = this.tabTarget.x;
            targetY = this.tabTarget.groundY;
            this.facingRight = targetX > this.x;
            this.sprite.setFlipX(!this.facingRight);
          }

          this.chargeTargetX = targetX;
          this.chargeTargetY = targetY;
          this.chargeSpecial = special;
          // Charge speed: 120% of normal speed, scaled to pixels/sec (not per-frame)
          this.chargeSpeed = this.speed * special.speedMultiplier * 6;
          this.chargeHit = false;

          // Play walk anim at double speed for charging look
          this.sprite.play(`${this.classKey}_walk`, true);
          this.sprite.anims.msPerFrame = 30;

          // Smoke trail emitter — follows the player during charge
          this.chargeSmoke = this.scene.add.particles(this.x, this.groundY, 'vfx_pixel_4', {
            speed: { min: 5, max: 15 },
            lifespan: 300,
            tint: 0x666688,
            alpha: { start: 0.6, end: 0 },
            scale: { start: 1, end: 0.3 },
            frequency: 30,
            emitting: true,
          });
          this.chargeSmoke.setDepth(GAME_CONFIG.layers.entities + this.groundY - 1);

          this.scene.events.emit('playerAttack');
        },
        update(dt) {
          const dx = this.chargeTargetX - this.x;
          const dy = this.chargeTargetY - this.groundY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const step = this.chargeSpeed * (dt / 1000);

          // Update smoke trail position
          if (this.chargeSmoke) {
            this.chargeSmoke.setPosition(this.x, this.groundY);
          }

          if (dist <= step + 6 && !this.chargeHit) {
            this.chargeHit = true;

            // Stop smoke
            if (this.chargeSmoke) {
              this.chargeSmoke.stop();
              this.scene.time.delayedCall(400, () => {
                if (this.chargeSmoke) { this.chargeSmoke.destroy(); this.chargeSmoke = null; }
              });
            }

            // Snap to target
            this.x = this.chargeTargetX;
            this.groundY = clampToGround(this.chargeTargetY);
            this.y = this.groundY;

            // Play bash animation
            this.sprite.play(`${this.classKey}_special2`, true);

            // Hit all enemies in range with size-based knockback
            const special = this.chargeSpecial;
            const enemies = this.scene.getAliveEnemies();
            for (const enemy of enemies) {
              const eDist = Phaser.Math.Distance.Between(
                this.x, this.groundY, enemy.x, enemy.groundY
              );
              if (eDist <= 30) {
                const enemySize = enemy.enemyData?.size || 'medium';
                const knockForce = special.knockbackBySize[enemySize] ?? 0;
                const dir = {
                  x: (enemy.x - this.x) / (eDist || 1) * knockForce,
                  y: ((enemy.groundY - this.groundY) / (eDist || 1)) * knockForce * 0.3,
                };

                enemy.takeDamage(special.damage * this.power * 10, dir, 0);
                if (knockForce > 0 && enemy.applyKnockdown) {
                  enemy.applyKnockdown(special.knockdownDuration || 1500, dir);
                }
              }
            }

            // VFX + shake
            this.scene.events.emit('playerSpecial', {
              player: this, special: special, key: 'special4',
            });
            this.scene.cameras.main.shake(100, 0.004);

            this.sprite.once('animationcomplete', () => {
              this.fsm.locked = false;
              this.fsm.transition('idle');
            });
          } else if (!this.chargeHit) {
            // Charge at high speed toward target
            const nx = dx / dist;
            const ny = dy / dist;
            this.x += nx * step;
            this.groundY = clampToGround(this.groundY + ny * step * 0.6);
            this.y = this.groundY;
          }
        },
        exit() {
          // Clean up smoke if state exits early (e.g. death)
          if (this.chargeSmoke) {
            this.chargeSmoke.destroy();
            this.chargeSmoke = null;
          }
        },
        transitions: { idle: 'idle', death: 'death' },
      },

      special5: {
        enter() {
          const special = this.classData.specials.special5;
          this.fsm.locked = false; // Allow movement during whirlwind

          // Auto-face tab target
          if (this.tabTarget && this.tabTarget.hp > 0) {
            this.facingRight = this.tabTarget.x > this.x;
            this.sprite.setFlipX(!this.facingRight);
          }
          this.whirlwindSpecial = special;
          this.whirlwindTickTimer = 0;
          this.whirlwindAngle = 0;
          this.whirlwindDuration = 0;
          this.whirlwindMaxDuration = 5000; // 5 second max

          // Play attack anim looping fast for spinning look
          this.sprite.play(`${this.classKey}_atk1`, true);
          this.sprite.anims.msPerFrame = 50;

          this.scene.events.emit('playerAttack');

          // Spinning VFX — horizontal ellipse slash ring
          this.whirlwindGfx = this.scene.add.graphics();
          this.whirlwindGfx.setDepth(GAME_CONFIG.layers.foregroundDecor);

          // Spark particles spraying outward
          this.whirlwindParticles = this.scene.add.particles(this.x, this.groundY, 'vfx_pixel', {
            speed: { min: 25, max: 55 },
            angle: { min: 0, max: 360 },
            lifespan: 180,
            tint: 0xccddff,
            alpha: { start: 0.7, end: 0 },
            frequency: 35,
            emitting: true,
          });
          this.whirlwindParticles.setDepth(GAME_CONFIG.layers.foregroundDecor);
        },
        update(dt) {
          const special = this.whirlwindSpecial;
          this.whirlwindDuration += dt;

          // Stop: key released or max duration reached
          if (!this.keys.special5.isDown || this.whirlwindDuration >= this.whirlwindMaxDuration) {
            this.cooldowns.special5 = special.cooldown;
            this.fsm.transition('idle');
            return;
          }

          // Allow movement while spinning
          this.handleMovementInput(dt);

          // Advance spin angle
          this.whirlwindAngle += dt * 0.025;

          // Draw horizontal ellipse slash ring at waist height
          const cx = this.x;
          const cy = this.groundY - 18;
          this.whirlwindGfx.clear();

          // Outer slash arc — drawn as horizontal ellipse segments
          const r = 28;
          const ry = 10; // Squashed vertically for horizontal/top-down look
          this.whirlwindGfx.lineStyle(3, 0xeeeeff, 0.85);
          this.whirlwindGfx.beginPath();
          for (let i = 0; i < 20; i++) {
            const a = this.whirlwindAngle + (i / 20) * Math.PI * 1.4;
            const px = cx + Math.cos(a) * r;
            const py = cy + Math.sin(a) * ry;
            if (i === 0) this.whirlwindGfx.moveTo(px, py);
            else this.whirlwindGfx.lineTo(px, py);
          }
          this.whirlwindGfx.strokePath();

          // Second arc offset for double-blade look
          this.whirlwindGfx.lineStyle(2, 0x88bbff, 0.6);
          this.whirlwindGfx.beginPath();
          for (let i = 0; i < 20; i++) {
            const a = this.whirlwindAngle + Math.PI + (i / 20) * Math.PI * 1.4;
            const px = cx + Math.cos(a) * (r + 4);
            const py = cy + Math.sin(a) * (ry + 2);
            if (i === 0) this.whirlwindGfx.moveTo(px, py);
            else this.whirlwindGfx.lineTo(px, py);
          }
          this.whirlwindGfx.strokePath();

          // Update particle position to follow player
          if (this.whirlwindParticles) {
            this.whirlwindParticles.setPosition(cx, cy);
          }

          // Damage tick
          this.whirlwindTickTimer += dt;
          if (this.whirlwindTickTimer >= special.tickInterval) {
            this.whirlwindTickTimer -= special.tickInterval;

            const enemies = this.scene.getAliveEnemies();
            for (const enemy of enemies) {
              const dist = Phaser.Math.Distance.Between(
                this.x, this.groundY, enemy.x, enemy.groundY
              );
              if (dist <= special.radius) {
                const dir = {
                  x: (enemy.x - this.x) / (dist || 1) * special.knockback,
                  y: ((enemy.groundY - this.groundY) / (dist || 1)) * special.knockback * 0.3,
                };
                enemy.takeDamage(special.damagePerTick * this.power * 10, dir, 100);
              }
            }
          }

          // Loop the attack animation
          if (!this.sprite.anims.isPlaying) {
            this.sprite.play(`${this.classKey}_atk1`, true);
            this.sprite.anims.msPerFrame = 50;
          }
        },
        exit() {
          if (this.whirlwindGfx) {
            this.whirlwindGfx.destroy();
            this.whirlwindGfx = null;
          }
          if (this.whirlwindParticles) {
            this.whirlwindParticles.destroy();
            this.whirlwindParticles = null;
          }
        },
        transitions: { idle: 'idle', death: 'death' },
      },

      hitstun: {
        enter() {
          this.sprite.play(`${this.classKey}_hitstun`, true);
          this.fsm.locked = true;
          this.hitstunTimer = 0;
        },
        update(dt) {
          this.hitstunTimer += dt;
          // Apply knockback
          this.x += this.knockbackVelocity.x;
          this.groundY += this.knockbackVelocity.y;
          this.groundY = clampToGround(this.groundY);
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
    };
  }

  isMoving() {
    if (this.keys.left.isDown || this.keys.right.isDown ||
        this.keys.up.isDown || this.keys.down.isDown) return true;

    // Check gamepad left stick / d-pad
    if (this.pad) {
      const deadzone = 0.2;
      if (Math.abs(this.pad.leftStick.x) > deadzone || Math.abs(this.pad.leftStick.y) > deadzone) return true;
      if (this.pad.left || this.pad.right || this.pad.up || this.pad.down) return true;
    }
    return false;
  }

  handleMovementInput(dt) {
    // Sprint: hold left shift for 50% speed boost, or LB on gamepad
    const sprinting = this.keys.sprint.isDown ||
      (this.pad && this.pad.buttons[4] && this.pad.buttons[4].pressed);
    const spd = this.speed * (dt / 1000) * (sprinting ? 1.5 : 1);
    let dx = 0, dy = 0;

    // Keyboard
    if (this.keys.left.isDown) dx -= spd;
    if (this.keys.right.isDown) dx += spd;
    if (this.keys.up.isDown) dy -= spd * 0.6;
    if (this.keys.down.isDown) dy += spd * 0.6;

    // Gamepad left stick + d-pad
    if (this.pad) {
      const deadzone = 0.2;
      const stickX = Math.abs(this.pad.leftStick.x) > deadzone ? this.pad.leftStick.x : 0;
      const stickY = Math.abs(this.pad.leftStick.y) > deadzone ? this.pad.leftStick.y : 0;
      dx += stickX * spd;
      dy += stickY * spd * 0.6;

      if (this.pad.left) dx -= spd;
      if (this.pad.right) dx += spd;
      if (this.pad.up) dy -= spd * 0.6;
      if (this.pad.down) dy += spd * 0.6;
    }

    if (dx !== 0 || dy !== 0) {
      this.x += dx;
      this.groundY = clampToGround(this.groundY + dy);
      this.y = this.groundY - this.jumpZ;

      if (dx < 0) {
        this.facingRight = false;
        this.sprite.setFlipX(true);
      } else if (dx > 0) {
        this.facingRight = true;
        this.sprite.setFlipX(false);
      }
    }
  }

  activateHitbox(hitboxDef) {
    if (this.activeHitbox) return; // Already active

    const dir = this.facingRight ? 1 : -1;
    const hx = this.x + hitboxDef.offsetX * dir;
    const hy = this.groundY + hitboxDef.offsetY;

    this.activeHitbox = {
      x: hx - hitboxDef.width / 2,
      y: hy - hitboxDef.height / 2,
      width: hitboxDef.width,
      height: hitboxDef.height,
      damage: this.currentAttack.damage * this.power,
      knockback: this.currentAttack.knockback,
      hitstun: this.currentAttack.hitstun,
      owner: this,
    };

    this.scene.events.emit('hitboxActive', this.activeHitbox);
  }

  deactivateHitbox() {
    if (this.activeHitbox) {
      this.scene.events.emit('hitboxDeactivated', this.activeHitbox);
      this.activeHitbox = null;
    }
  }

  takeDamage(amount, knockbackDir, hitstunDuration) {
    if (this.invulnerable) return;
    if (this.fsm.is('death')) return;

    // Apply defense
    const finalDamage = Math.max(1, Math.round(amount / this.defense));
    this.hp -= finalDamage;

    // Emit damage event for UI
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

    // Never interrupt abilities or attacks — take damage but don't stagger
    const currentState = this.fsm.currentState;
    if (currentState !== 'idle' && currentState !== 'walk') return;

    // Apply knockback and hitstun only when idle/walking
    this.knockbackVelocity = knockbackDir || { x: 0, y: 0 };
    this.hitstunDuration = hitstunDuration || 200;
    this.fsm.forceState('hitstun');

    // Brief invulnerability after hitstun
    this.invulnerable = true;
    this.invulnTimer = 300;
  }

  updateHpBar() {
    const pct = this.hp / this.maxHp;
    this.hpBarFill.setScale(pct, 1);

    // Color based on HP percentage
    if (pct > 0.5) this.hpBarFill.setTint(0x44cc44);
    else if (pct > 0.25) this.hpBarFill.setTint(0xcccc44);
    else this.hpBarFill.setTint(0xcc4444);
  }

  update(time, dt) {
    // Hit stop — freeze everything
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      return;
    }

    // Grab gamepad (first connected pad)
    if (!this.pad && this.scene.input.gamepad && this.scene.input.gamepad.total > 0) {
      this.pad = this.scene.input.gamepad.pad1;
    }

    // Track just-pressed inputs (keyboard)
    this.attackJustPressed = Phaser.Input.Keyboard.JustDown(this.keys.attack);
    this.special1JustPressed = Phaser.Input.Keyboard.JustDown(this.keys.special1);
    this.special2JustPressed = Phaser.Input.Keyboard.JustDown(this.keys.special2);
    this.special3JustPressed = Phaser.Input.Keyboard.JustDown(this.keys.special3);
    this.special4JustPressed = Phaser.Input.Keyboard.JustDown(this.keys.special4);
    this.special5JustPressed = Phaser.Input.Keyboard.JustDown(this.keys.special5);
    this.tabJustPressed = Phaser.Input.Keyboard.JustDown(this.keys.tab);

    // Gamepad button just-pressed detection
    // Xbox: A=0 (attack), X=2 (special1), Y=3 (special2), B=1 (block), RB=5 (dodge)
    if (this.pad) {
      const btnA = this.pad.buttons[0] && this.pad.buttons[0].pressed;
      const btnX = this.pad.buttons[2] && this.pad.buttons[2].pressed;
      const btnY = this.pad.buttons[3] && this.pad.buttons[3].pressed;
      const btnRB = this.pad.buttons[5] && this.pad.buttons[5].pressed;

      if (btnA && !this.padPrev.a) this.attackJustPressed = true;
      if (btnX && !this.padPrev.x) this.special1JustPressed = true;
      if (btnY && !this.padPrev.y) this.special2JustPressed = true;
      if (btnRB && !this.padPrev.rb) this.tabJustPressed = true;

      this.padPrev.a = btnA;
      this.padPrev.x = btnX;
      this.padPrev.y = btnY;
      this.padPrev.rb = btnRB;
    }

    // Tab targeting — cycle enemies
    if (this.tabJustPressed && this.scene.cycleTabTarget) {
      this.scene.cycleTabTarget();
    }

    // Update cooldowns
    if (this.cooldowns.special1 > 0) this.cooldowns.special1 -= dt;
    if (this.cooldowns.special2 > 0) this.cooldowns.special2 -= dt;
    if (this.cooldowns.special3 > 0) this.cooldowns.special3 -= dt;
    if (this.cooldowns.special4 > 0) this.cooldowns.special4 -= dt;
    if (this.cooldowns.special5 > 0) this.cooldowns.special5 -= dt;

    // Combo window decay
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboIndex = 0;  // Reset combo
      }
    }

    // Invulnerability timer
    if (this.invulnerable) {
      this.invulnTimer -= dt;
      if (this.invulnTimer <= 0) {
        this.invulnerable = false;
        this.sprite.setAlpha(1);
      } else {
        // Flash during invuln
        this.sprite.setAlpha(Math.sin(time * 0.02) > 0 ? 1 : 0.3);
      }
    }

    // Status effect ticking
    this.updateStatusEffects(dt);

    // State machine update
    this.fsm.update(dt);

    // Update visual position (for jumps)
    this.y = this.groundY - this.jumpZ;

    // HP bar
    this.updateHpBar();

    // Update depth for sorting
    this.setDepth(GAME_CONFIG.layers.entities + this.groundY);
  }

  updateStatusEffects(dt) {
    for (let i = this.statusEffects.length - 1; i >= 0; i--) {
      const effect = this.statusEffects[i];
      effect.timer -= dt;
      if (effect.timer <= 0) {
        this.statusEffects.splice(i, 1);
      }
    }
  }
}
