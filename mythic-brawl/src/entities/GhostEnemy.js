/**
 * GHOST ENEMY — Render-only enemy for non-host multiplayer clients.
 * Receives position/state from server schema and interpolates.
 * No AI, no physics, no combat logic.
 */
import Phaser from 'phaser';
import { ENEMIES, GAME_CONFIG } from '../config/game.js';

export class GhostEnemy extends Phaser.GameObjects.Container {
  constructor(scene, x, y, enemyKey) {
    super(scene, x, y);
    scene.add.existing(this);

    this.enemyKey = enemyKey;
    this.enemyData = ENEMIES[enemyKey] || {};
    this.groundY = y;
    this.facingRight = false;
    this.hp = 1;
    this.maxHp = 1;
    this.networkId = null;
    this._targetX = x;
    this._targetGroundY = y;

    this.sprite = scene.add.sprite(0, 0, enemyKey);
    this.sprite.setOrigin(0.5, 1);
    this.add(this.sprite);

    this.shadow = scene.add.image(0, 0, 'shadow');
    this.shadow.setOrigin(0.5, 0.5).setAlpha(0.3);
    this.add(this.shadow);
    this.sendToBack(this.shadow);

    this.hpBarBg = scene.add.image(0, -this.sprite.height - 4, 'hp_bar_bg');
    this.hpBarBg.setOrigin(0.5, 0.5);
    this.add(this.hpBarBg);
    this.hpBarFill = scene.add.image(-15, -this.sprite.height - 4, 'hp_bar_fill');
    this.hpBarFill.setOrigin(0, 0.5);
    this.add(this.hpBarFill);

    if (this.enemyData.type === 'elite') this.hpBarFill.setTint(0xccaa44);
    else if (this.enemyData.type === 'boss') this.hpBarFill.setTint(0xcc4444);

    try { this.sprite.play(`${enemyKey}_idle`, true); } catch(e) {}
  }

  updateFromServer(serverEnemy) {
    this._targetX = serverEnemy.x;
    this._targetGroundY = serverEnemy.groundY;
    this.hp = serverEnemy.hp;
    this.maxHp = serverEnemy.maxHp;
    this.facingRight = serverEnemy.facingRight;
    this.sprite.setFlipX(!this.facingRight);

    const st = serverEnemy.state;
    const cur = this.sprite.anims.currentAnim?.key || '';
    try {
      if ((st === 'walk' || st === 'chase' || st === 'retreat') && !cur.includes('walk')) {
        this.sprite.play(`${this.enemyKey}_walk`, true);
      } else if (st === 'attack' && !cur.includes('atk')) {
        this.sprite.play(`${this.enemyKey}_atk1`, true);
      } else if ((st === 'hitstun' || st === 'stunned') && !cur.includes('hitstun')) {
        this.sprite.play(`${this.enemyKey}_hitstun`, true);
      } else if (st === 'death' && !cur.includes('death')) {
        this.sprite.play(`${this.enemyKey}_death`, true);
      } else if (st === 'idle' && !cur.includes('idle')) {
        this.sprite.play(`${this.enemyKey}_idle`, true);
      }
    } catch(e) {}
  }

  update(time, dt) {
    const lerp = 0.25;
    this.x += (this._targetX - this.x) * lerp;
    this.groundY += (this._targetGroundY - this.groundY) * lerp;
    this.y = this.groundY;
    const pct = this.maxHp > 0 ? this.hp / this.maxHp : 0;
    this.hpBarFill.setScale(pct, 1);
    this.setDepth(GAME_CONFIG.layers.entities + this.groundY);
  }
}
