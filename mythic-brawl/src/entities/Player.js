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
    this.cooldowns = { special1: 0, special2: 0 };
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

    // Track just-pressed for buffering
    this.attackJustPressed = false;
    this.special1JustPressed = false;
    this.special2JustPressed = false;
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
        },
        transitions: { walk: 'walk', attack: 'attack', special1: 'special1', special2: 'special2', hitstun: 'hitstun', death: 'death' },
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
        },
        transitions: { idle: 'idle', attack: 'attack', special1: 'special1', special2: 'special2', hitstun: 'hitstun', death: 'death' },
      },

      attack: {
        enter() {
          const combo = this.classData.combo;
          const attackKey = combo[this.comboIndex];
          const attackData = ATTACKS[attackKey];

          this.sprite.play(`${this.classKey}_atk${this.comboIndex + 1}`, true);
          this.currentAttack = attackData;
          this.attackFrame = 0;
          this.attackHit = false;  // Track if this attack has hit anything

          // Lock FSM during active attack frames
          this.fsm.locked = true;

          this.sprite.once('animationcomplete', () => {
            // Check for buffered combo continuation
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
          this.attackFrame++;

          // Create hitbox during active frames
          if (this.currentAttack) {
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
          this.sprite.play(`${this.classKey}_special1`, true);
          this.cooldowns.special1 = this.classData.specials.special1.cooldown;
          this.fsm.locked = true;

          // Emit event for combat system to handle special effects
          this.scene.events.emit('playerSpecial', {
            player: this,
            special: this.classData.specials.special1,
            key: 'special1',
          });

          this.sprite.once('animationcomplete', () => {
            this.fsm.locked = false;
            this.fsm.transition('idle');
          });
        },
        update(dt) {},
        transitions: { idle: 'idle', hitstun: 'hitstun', death: 'death' },
      },

      special2: {
        enter() {
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
    return this.keys.left.isDown || this.keys.right.isDown ||
           this.keys.up.isDown || this.keys.down.isDown;
  }

  handleMovementInput(dt) {
    const spd = this.speed * (dt / 1000);
    let dx = 0, dy = 0;

    if (this.keys.left.isDown) dx -= spd;
    if (this.keys.right.isDown) dx += spd;
    if (this.keys.up.isDown) dy -= spd * 0.6;    // Slower vertical movement for 2.5D perspective
    if (this.keys.down.isDown) dy += spd * 0.6;

    if (dx !== 0 || dy !== 0) {
      this.x += dx;
      this.groundY = clampToGround(this.groundY + dy);
      this.y = this.groundY - this.jumpZ;

      // Flip sprite based on direction
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

    // Apply knockback and hitstun
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

    // Track just-pressed inputs
    this.attackJustPressed = Phaser.Input.Keyboard.JustDown(this.keys.attack);
    this.special1JustPressed = Phaser.Input.Keyboard.JustDown(this.keys.special1);
    this.special2JustPressed = Phaser.Input.Keyboard.JustDown(this.keys.special2);

    // Update cooldowns
    if (this.cooldowns.special1 > 0) this.cooldowns.special1 -= dt;
    if (this.cooldowns.special2 > 0) this.cooldowns.special2 -= dt;

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
