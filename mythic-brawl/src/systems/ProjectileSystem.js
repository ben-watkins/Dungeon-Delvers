/**
 * PROJECTILE SYSTEM — Enemy ranged attacks with animated projectiles.
 */

import Phaser from 'phaser';
import { GAME_CONFIG, DUNGEONS, ENEMIES } from '../config/game.js';

export class ProjectileSystem {
  constructor(scene, dungeonKey) {
    this.scene = scene;
    this.dungeonKey = dungeonKey;
    this.projectiles = [];
    this.prefix = DUNGEONS[dungeonKey]?.projectilePrefix || 'deadmines';

    scene.events.on('enemyRangedAttack', this.onEnemyRangedAttack, this);
  }

  onEnemyRangedAttack(data) {
    const { enemy, target } = data;
    if (!target || target.hp <= 0) return;

    const size = enemy.enemyData?.size || 'small';
    const sizeMap = { small: 'proj_small', medium: 'proj_med', large: 'proj_large' };
    const projKey = `${this.prefix}_${sizeMap[size]}`;
    const animKey = `${projKey}_anim`;
    const speedMap = { small: 200, medium: 160, large: 120 };
    const speed = speedMap[size];

    const sx = enemy.x + (enemy.facingRight ? 12 : -12);
    const sy = enemy.groundY - 16;
    const tx = target.x;
    const ty = target.groundY - 12;

    const proj = this.scene.add.sprite(sx, sy, projKey, 0);
    proj.play(animKey);
    proj.setDepth(GAME_CONFIG.layers.foregroundDecor);

    const dx = tx - sx;
    const dy = ty - sy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const vx = (dx / dist) * speed;
    const vy = (dy / dist) * speed;

    const projectile = {
      sprite: proj,
      vx, vy,
      damage: (enemy.power || 0.1) * 10 * 0.7,
      targetX: tx,
      targetY: ty,
      enemy,
      size,
      traveled: 0,
      maxDist: dist + 50,
    };

    this.projectiles.push(projectile);
  }

  update(dt) {
    const dtSec = dt / 1000;

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.sprite.x += p.vx * dtSec;
      p.sprite.y += p.vy * dtSec;
      p.traveled += Math.sqrt((p.vx * dtSec) ** 2 + (p.vy * dtSec) ** 2);

      // Check hit against party members
      let hit = false;
      const party = this.scene.getPartyMembers();
      for (const member of party) {
        if (member.hp <= 0) continue;
        const dist = Phaser.Math.Distance.Between(p.sprite.x, p.sprite.y, member.x, member.groundY - 12);
        if (dist <= 12) {
          member.takeDamage(p.damage, { x: p.vx * 0.01, y: p.vy * 0.01 }, 0);
          this.spawnImpact(p.sprite.x, p.sprite.y, p.size);
          hit = true;
          break;
        }
      }

      // Destroy if hit or traveled too far
      if (hit || p.traveled > p.maxDist) {
        p.sprite.destroy();
        this.projectiles.splice(i, 1);
      }
    }
  }

  spawnImpact(x, y, size) {
    const impactKey = `${this.prefix}_impact`;
    const animKey = `${impactKey}_anim`;
    if (!this.scene.textures.exists(impactKey)) return;

    const impact = this.scene.add.sprite(x, y, impactKey, 0);
    impact.play(animKey);
    impact.setDepth(GAME_CONFIG.layers.foregroundDecor);
    impact.once('animationcomplete', () => impact.destroy());
  }

  destroy() {
    this.scene.events.off('enemyRangedAttack', this.onEnemyRangedAttack, this);
    for (const p of this.projectiles) {
      p.sprite.destroy();
    }
    this.projectiles = [];
  }
}
