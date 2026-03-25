/**
 * COMBAT SYSTEM
 * 
 * Central hub for all combat resolution:
 * - Hitbox vs hurtbox overlap detection
 * - Damage calculation with class stats
 * - Hit-stop (freeze frames on impact)
 * - Knockback direction calculation
 * - Atonement healing (Priest passive)
 * - Critical strikes (Rogue passive)
 * - Evasion (Rogue passive)
 * - Damage number spawning
 * 
 * Listens to events from Player, Enemy, and AICompanion entities.
 */

import { GAME_CONFIG } from '../config/game.js';

export class CombatSystem {
  constructor(scene) {
    this.scene = scene;
    this.activeHitboxes = [];

    // Listen for combat events
    scene.events.on('hitboxActive', this.onHitboxActive, this);
    scene.events.on('hitboxDeactivated', this.onHitboxDeactivated, this);
    scene.events.on('enemyAttack', this.onEnemyAttack, this);
    scene.events.on('aiAttack', this.onAIAttack, this);
    scene.events.on('aiHeal', this.onAIHeal, this);
    scene.events.on('playerSpecial', this.onPlayerSpecial, this);
  }

  onHitboxActive(hitbox) {
    // Check against all enemies
    const enemies = this.scene.getAliveEnemies();
    for (const enemy of enemies) {
      if (this.checkOverlap(hitbox, enemy)) {
        this.resolvePlayerHit(hitbox, enemy);
      }
    }
  }

  onHitboxDeactivated(hitbox) {
    // Cleanup if needed
  }

  onEnemyAttack(data) {
    const { enemy, damage, hitbox } = data;
    const party = this.scene.getPartyMembers();

    for (const member of party) {
      if (member.hp <= 0) continue;
      if (this.checkOverlapRect(hitbox, member)) {
        // Check evasion
        if (member.classData?.passives?.evasion) {
          if (Math.random() < member.classData.passives.evasion.chance) {
            this.spawnDamageNumber(member.x, member.y - 24, 'DODGE', '#80d8ff');
            continue;
          }
        }

        const dir = this.knockbackDir(enemy, member, 2);
        member.takeDamage(damage, dir, 200);

        // Apply necrotic stacks if affix active
        this.scene.events.emit('necroticStack', { target: member });
      }
    }
  }

  onAIAttack(data) {
    const { companion, target, damage } = data;
    if (!target || target.hp <= 0) return;

    const dir = this.knockbackDir(companion, target, 1.5);
    target.takeDamage(damage, dir, 150);

    // Atonement healing
    if (companion.classData?.passives?.atonement) {
      const healAmt = Math.round(damage * companion.classData.passives.atonement.healPercent);
      this.atonementHeal(companion, healAmt);
    }
  }

  onAIHeal(data) {
    const { healer, target, amount } = data;
    if (!target || target.hp <= 0) return;

    // Check for necrotic debuff reducing healing
    let healAmount = amount;
    const necro = target.statusEffects?.find(e => e.type === 'necrotic');
    if (necro) {
      healAmount = Math.round(healAmount * (1 - necro.stacks * 0.03));
    }

    target.hp = Math.min(target.maxHp, target.hp + healAmount);
    this.spawnDamageNumber(target.x, target.y - 24, `+${healAmount}`, '#44cc44');
  }

  onPlayerSpecial(data) {
    const { player, special, key } = data;
    const enemies = this.scene.getAliveEnemies();

    // Handle heal specials
    if (special.healAmount) {
      const party = this.scene.getPartyMembers();
      if (key === 'special1') {
        // Single target heal — lowest HP
        const lowest = party.reduce((low, m) => {
          if (m.hp <= 0) return low;
          return (!low || m.hp < low.hp) ? m : low;
        }, null);
        if (lowest) {
          lowest.hp = Math.min(lowest.maxHp, lowest.hp + special.healAmount);
          this.spawnDamageNumber(lowest.x, lowest.y - 24, `+${special.healAmount}`, '#44cc44');
        }
      } else if (key === 'special2') {
        // AoE heal + damage
        for (const member of party) {
          if (member.hp <= 0) continue;
          member.hp = Math.min(member.maxHp, member.hp + special.healAmount);
          this.spawnDamageNumber(member.x, member.y - 24, `+${special.healAmount}`, '#44cc44');
        }
      }
    }

    // Handle damage specials
    if (special.damage) {
      for (const enemy of enemies) {
        const dist = Phaser.Math.Distance.Between(player.x, player.groundY, enemy.x, enemy.groundY);
        const range = special.range || (special.teleport ? 100 : 40);
        if (dist <= range) {
          let knockForce = special.knockback || 0;
          let stunTime = special.stun || 300;
          const enemySize = enemy.enemyData?.size || 'medium';

          if (special.knockbackBySize) {
            knockForce = special.knockbackBySize[enemySize] ?? knockForce;
          }
          if (special.hitstunBySize) {
            stunTime = special.hitstunBySize[enemySize] ?? stunTime;
          }

          const dir = this.knockbackDir(player, enemy, knockForce);

          // Stun — enemy is stunned, takes double damage, yellow HP bar
          if (special.stun === true && enemy.applyStun) {
            enemy.takeDamage(special.damage * player.power * 10, dir, 0);
            enemy.applyStun(special.stunDuration || 1500, dir);
          // Knockdown — enemy plays knockdown + getup anims
          } else if (special.knockdown && enemy.applyKnockdown) {
            enemy.takeDamage(special.damage * player.power * 10, dir, 0);
            enemy.applyKnockdown(special.knockdownDuration || 1500, dir);
          } else {
            enemy.takeDamage(special.damage * player.power * 10, dir, stunTime);
          }

          // Apply bleed DOT
          if (special.bleed && enemy.applyBleed) {
            enemy.applyBleed(special.bleed);
          }
        }
      }
    }
  }

  resolvePlayerHit(hitbox, enemy) {
    // Prevent multi-hitting on same attack
    if (hitbox._hitEntities?.has(enemy)) return;
    if (!hitbox._hitEntities) hitbox._hitEntities = new Set();
    hitbox._hitEntities.add(enemy);

    let damage = hitbox.damage;

    // Critical strike check
    const owner = hitbox.owner;
    let isCrit = false;
    if (owner.classData?.passives?.criticalStrikes) {
      if (Math.random() < owner.classData.passives.criticalStrikes.chance) {
        damage *= owner.classData.passives.criticalStrikes.multiplier;
        isCrit = true;
      }
    }

    // Apply damage
    const dir = this.knockbackDir(owner, enemy, hitbox.knockback);
    enemy.takeDamage(damage, dir, hitbox.hitstun);

    // Hit-stop
    if (owner.hitStopTimer !== undefined) {
      owner.hitStopTimer = GAME_CONFIG.hitStopFrames * 16;  // Convert frames to ms
    }

    // Damage number
    const color = isCrit ? '#ffcc44' : '#ffffff';
    const text = isCrit ? `${Math.round(damage)}!` : `${Math.round(damage)}`;
    this.spawnDamageNumber(enemy.x, enemy.y - 20, text, color);

    // Atonement healing
    if (owner.classData?.passives?.atonement) {
      const healAmt = Math.round(damage * owner.classData.passives.atonement.healPercent);
      this.atonementHeal(owner, healAmt);
    }

    // Screen shake on heavy hits
    if (damage > 15) {
      this.scene.cameras.main.shake(80, 0.003 * Math.min(damage / 10, 3));
    }
  }

  atonementHeal(source, amount) {
    const party = this.scene.getPartyMembers();
    const lowest = party.reduce((low, m) => {
      if (m.hp <= 0 || m.hp >= m.maxHp) return low;
      return (!low || m.hp < low.hp) ? m : low;
    }, null);

    if (lowest && amount > 0) {
      lowest.hp = Math.min(lowest.maxHp, lowest.hp + amount);
      this.spawnDamageNumber(lowest.x, lowest.y - 24, `+${amount}`, '#80d8ff');
    }
  }

  checkOverlap(hitbox, entity) {
    const ex = entity.x - 8;
    const ey = entity.groundY - 16;
    const ew = 16;
    const eh = 16;
    return hitbox.x < ex + ew && hitbox.x + hitbox.width > ex &&
           hitbox.y < ey + eh && hitbox.y + hitbox.height > ey;
  }

  checkOverlapRect(rect, entity) {
    const ex = entity.x - 8;
    const ey = (entity.groundY || entity.y) - 16;
    return rect.x < ex + 16 && rect.x + rect.width > ex &&
           rect.y < ey + 16 && rect.y + rect.height > ey;
  }

  knockbackDir(attacker, target, force) {
    const dx = target.x - attacker.x;
    const dy = (target.groundY || target.y) - (attacker.groundY || attacker.y);
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return {
      x: (dx / len) * force,
      y: (dy / len) * force * 0.15,  // Less vertical drift so they fly horizontally
    };
  }

  spawnDamageNumber(x, y, text, color) {
    const dmgText = this.scene.add.text(x, y, text, {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: color,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setResolution(4).setDepth(GAME_CONFIG.layers.ui);

    this.scene.tweens.add({
      targets: dmgText,
      y: y - 16,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => dmgText.destroy(),
    });
  }

  destroy() {
    this.scene.events.off('hitboxActive', this.onHitboxActive, this);
    this.scene.events.off('hitboxDeactivated', this.onHitboxDeactivated, this);
    this.scene.events.off('enemyAttack', this.onEnemyAttack, this);
    this.scene.events.off('aiAttack', this.onAIAttack, this);
    this.scene.events.off('aiHeal', this.onAIHeal, this);
    this.scene.events.off('playerSpecial', this.onPlayerSpecial, this);
  }
}
