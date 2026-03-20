/**
 * AFFIX MANAGER
 * 
 * Applies M+ affix modifiers to the dungeon.
 * Affixes are selected based on keystone level:
 *   +2-3: No affixes
 *   +4-6: 1 affix (Fortified or Tyrannical)
 *   +7-9: 2 affixes
 *   +10+: 3 affixes
 * 
 * Each affix hooks into game events:
 *   Fortified/Tyrannical — applied on enemy spawn (stat scaling)
 *   Bursting — triggers on enemy death (delayed AoE)
 *   Bolstering — triggers on enemy death (buffs nearby enemies)
 *   Sanguine — triggers on enemy death (spawns healing pool)
 *   Explosive — periodic orb spawning during combat
 *   Necrotic — applied on enemy melee hit (healing reduction stack)
 */

import { AFFIXES, GAME_CONFIG } from '../config/game.js';

export class AffixManager {
  constructor(scene, keystoneLevel) {
    this.scene = scene;
    this.keystoneLevel = keystoneLevel;
    this.activeAffixes = this.selectAffixes(keystoneLevel);
    this.groundEffects = [];  // Sanguine pools, burst zones, etc.

    // Hook into events
    scene.events.on('enemyDeath', this.onEnemyDeath, this);
    scene.events.on('enemyAttack', this.onEnemyAttack, this);
    scene.events.on('necroticStack', this.onNecroticStack, this);
  }

  selectAffixes(level) {
    const affixes = [];

    if (level >= 4) {
      // Alternate Fortified/Tyrannical by level (even/odd)
      affixes.push(level % 2 === 0 ? 'fortified' : 'tyrannical');
    }
    if (level >= 7) {
      // Add a second affix
      const pool = ['bursting', 'bolstering', 'sanguine', 'explosive', 'necrotic'];
      affixes.push(pool[(level - 7) % pool.length]);
    }
    if (level >= 10) {
      // Add a third affix from remaining pool
      const pool = ['bursting', 'bolstering', 'sanguine', 'explosive', 'necrotic'];
      const used = affixes.filter(a => pool.includes(a));
      const remaining = pool.filter(a => !used.includes(a));
      if (remaining.length > 0) {
        affixes.push(remaining[(level - 10) % remaining.length]);
      }
    }

    return affixes;
  }

  /**
   * Apply stat modifiers to an enemy on spawn.
   * Called by DungeonScene when creating enemies.
   */
  applySpawnModifiers(enemy) {
    for (const affixKey of this.activeAffixes) {
      const affix = AFFIXES[affixKey];
      if (!affix) continue;

      if (affix.appliesTo && affix.appliesTo.includes(enemy.enemyData.type)) {
        if (affix.hpMultiplier) {
          enemy.maxHp = Math.round(enemy.maxHp * affix.hpMultiplier);
          enemy.hp = enemy.maxHp;
        }
        if (affix.damageMultiplier) {
          enemy.power *= affix.damageMultiplier;
        }
      }
    }
  }

  onEnemyDeath(enemy) {
    for (const affixKey of this.activeAffixes) {
      if (affixKey === 'bursting') this.triggerBursting(enemy);
      if (affixKey === 'bolstering') this.triggerBolstering(enemy);
      if (affixKey === 'sanguine') this.triggerSanguine(enemy);
    }
  }

  onEnemyAttack(data) {
    // Necrotic stacks are applied via the necroticStack event in CombatSystem
  }

  onNecroticStack(data) {
    if (!this.activeAffixes.includes('necrotic')) return;
    const { target } = data;
    if (!target.statusEffects) return;

    let necro = target.statusEffects.find(e => e.type === 'necrotic');
    if (necro) {
      necro.stacks = Math.min(30, necro.stacks + 1);
      necro.timer = AFFIXES.necrotic.duration;
    } else {
      target.statusEffects.push({
        type: 'necrotic',
        stacks: 1,
        timer: AFFIXES.necrotic.duration,
      });
    }
  }

  triggerBursting(deadEnemy) {
    const affix = AFFIXES.bursting;
    // After delay, deal AoE damage to all party members
    this.scene.time.delayedCall(affix.delay, () => {
      const party = this.scene.getPartyMembers();
      for (const member of party) {
        if (member.hp <= 0) continue;
        const dist = Phaser.Math.Distance.Between(
          deadEnemy.x, deadEnemy.groundY || deadEnemy.y,
          member.x, member.groundY || member.y
        );
        if (dist <= affix.radius) {
          member.takeDamage(affix.damage, null, 0);
        }
      }
      // Visual: red expanding ring at death location
      this.spawnGroundRing(deadEnemy.x, deadEnemy.groundY || deadEnemy.y, affix.radius, 0xcc4444, 500);
    });
  }

  triggerBolstering(deadEnemy) {
    const affix = AFFIXES.bolstering;
    const enemies = this.scene.getAliveEnemies();
    for (const enemy of enemies) {
      const dist = Phaser.Math.Distance.Between(
        deadEnemy.x, deadEnemy.groundY,
        enemy.x, enemy.groundY
      );
      if (dist <= affix.radius) {
        enemy.applyAffixBuff('bolster_damage', enemy.power * affix.damageBoost);
        enemy.applyAffixBuff('bolster_scale', affix.scaleBoost);
      }
    }
  }

  triggerSanguine(deadEnemy) {
    const affix = AFFIXES.sanguine;
    const pool = {
      x: deadEnemy.x,
      y: deadEnemy.groundY || deadEnemy.y,
      radius: affix.radius,
      healPerSecond: affix.healPerSecond,
      timer: affix.duration,
    };
    this.groundEffects.push(pool);

    // Visual placeholder
    const circle = this.scene.add.circle(pool.x, pool.y, pool.radius, 0xcc2020, 0.3);
    circle.setDepth(GAME_CONFIG.layers.groundDecor);
    pool._visual = circle;
  }

  /**
   * Called every frame to update ground effects (sanguine pools, etc.)
   */
  update(dt) {
    for (let i = this.groundEffects.length - 1; i >= 0; i--) {
      const effect = this.groundEffects[i];
      effect.timer -= dt;

      // Sanguine: heal enemies standing in pool
      const enemies = this.scene.getAliveEnemies();
      for (const enemy of enemies) {
        const dist = Phaser.Math.Distance.Between(effect.x, effect.y, enemy.x, enemy.groundY);
        if (dist <= effect.radius) {
          const healAmt = Math.round(effect.healPerSecond * (dt / 1000));
          enemy.hp = Math.min(enemy.maxHp, enemy.hp + healAmt);
        }
      }

      if (effect.timer <= 0) {
        if (effect._visual) effect._visual.destroy();
        this.groundEffects.splice(i, 1);
      }
    }

    // Explosive orb spawning (TODO: implement explosive orb entity)
  }

  spawnGroundRing(x, y, radius, color, duration) {
    const ring = this.scene.add.circle(x, y, 2, color, 0.5);
    ring.setDepth(GAME_CONFIG.layers.groundDecor);
    this.scene.tweens.add({
      targets: ring,
      radius: radius,
      alpha: 0,
      duration: duration,
      onComplete: () => ring.destroy(),
    });
  }

  getActiveAffixNames() {
    return this.activeAffixes.map(key => AFFIXES[key]?.name || key);
  }

  destroy() {
    this.scene.events.off('enemyDeath', this.onEnemyDeath, this);
    this.scene.events.off('enemyAttack', this.onEnemyAttack, this);
    this.scene.events.off('necroticStack', this.onNecroticStack, this);
    for (const effect of this.groundEffects) {
      if (effect._visual) effect._visual.destroy();
    }
  }
}
