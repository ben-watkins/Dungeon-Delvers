/**
 * UI SCENE — HUD overlay
 * 
 * Runs as a parallel scene on top of DungeonScene.
 * Displays:
 * - M+ timer with dungeon name and keystone level
 * - Party health bars (player + companions)
 * - Active affix indicators
 * - Death counter and time penalty
 * - Cooldown indicators for specials
 * - Boss health bar (when fighting a boss)
 * - Damage/healing meter (TODO)
 * 
 * This scene has its own camera that doesn't move,
 * so UI stays fixed on screen.
 */

import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/game.js';

export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
  }

  init(data) {
    this.dungeonTimer = data.dungeonTimer;
    this.affixManager = data.affixManager;
    this.player = data.player;
    this.partyMembers = data.partyMembers;
    this.keystoneLevel = data.keystoneLevel;
    this.dungeonName = data.dungeonName;
  }

  create() {
    const { width, height } = this.cameras.main;

    // --- TOP BAR: Dungeon name + Keystone + Timer ---
    this.add.rectangle(width / 2, 0, width, 20, 0x0d0d18, 0.85)
      .setOrigin(0.5, 0).setDepth(0);

    this.dungeonLabel = this.add.text(6, 3, `M+${this.keystoneLevel}  ${this.dungeonName}`, {
      fontSize: '10px', fontFamily: 'monospace', color: '#b0b0c8',
    }).setResolution(2).setDepth(1);

    this.timerText = this.add.text(width - 6, 3, '00:00', {
      fontSize: '12px', fontFamily: 'monospace', color: '#80d8ff',
    }).setOrigin(1, 0).setResolution(2).setDepth(1);

    this.deathText = this.add.text(width - 6, 15, '', {
      fontSize: '8px', fontFamily: 'monospace', color: '#cc4444',
    }).setOrigin(1, 0).setResolution(2).setDepth(1);

    // --- AFFIX INDICATORS ---
    const affixNames = this.affixManager.getActiveAffixNames();
    const affixColors = {
      'Fortified': 0xcc4444, 'Tyrannical': 0xcc8844,
      'Bursting': 0x9040cc, 'Bolstering': 0x40a0cc,
      'Sanguine': 0xcc2020, 'Explosive': 0xccaa20,
      'Necrotic': 0x40cc40,
    };

    affixNames.forEach((name, i) => {
      const ax = width / 2 - (affixNames.length * 40) / 2 + i * 40;
      const color = affixColors[name] || 0x888888;
      this.add.rectangle(ax + 4, 14, 6, 6, color).setDepth(1);
      this.add.text(ax + 12, 11, name.substring(0, 4), {
        fontSize: '8px', fontFamily: 'monospace', color: '#9090a8',
      }).setResolution(2).setDepth(1);
    });

    // --- PARTY FRAMES (bottom-left) ---
    this.partyFrames = [];
    this.partyMembers.forEach((member, i) => {
      const fx = 6;
      const fy = height - 52 + i * 16;
      const isPlayer = member === this.player;

      const frame = {
        member,
        nameText: this.add.text(fx, fy, `${isPlayer ? '>' : ' '}${member.classData.name}`, {
          fontSize: '9px', fontFamily: 'monospace',
          color: isPlayer ? '#ffffff' : '#9090a8',
        }).setResolution(2).setDepth(1),
        hpBg: this.add.rectangle(fx + 56, fy + 5, 50, 6, 0x1a1a2e).setOrigin(0, 0.5).setDepth(1),
        hpFill: this.add.rectangle(fx + 56, fy + 5, 50, 6, 0x44cc44).setOrigin(0, 0.5).setDepth(1),
        hpText: this.add.text(fx + 110, fy, '', {
          fontSize: '8px', fontFamily: 'monospace', color: '#808098',
        }).setResolution(2).setDepth(1),
      };
      this.partyFrames.push(frame);
    });

    // --- COOLDOWN INDICATORS (bottom-right) ---
    this.cd1Text = this.add.text(width - 6, height - 24, '[2] Special 1', {
      fontSize: '8px', fontFamily: 'monospace', color: '#505068',
    }).setOrigin(1, 0).setResolution(2).setDepth(1);

    this.cd2Text = this.add.text(width - 6, height - 12, '[3] Special 2', {
      fontSize: '8px', fontFamily: 'monospace', color: '#505068',
    }).setOrigin(1, 0).setResolution(2).setDepth(1);

    // --- CONTROLS HINT (first 10 seconds) ---
    this.controlsHint = this.add.text(width / 2, height - 4, 'WASD move · NUM1 attack · NUM2/NUM3 specials', {
      fontSize: '8px', fontFamily: 'monospace', color: '#404060',
    }).setOrigin(0.5, 1).setResolution(2).setDepth(1);

    this.time.delayedCall(10000, () => {
      this.controlsHint?.destroy();
    });
  }

  update(time, delta) {
    if (!this.dungeonTimer) return;

    // Timer
    this.timerText.setText(this.dungeonTimer.getTimeString());
    if (this.dungeonTimer.isOverTime()) {
      this.timerText.setColor('#cc4444');
    }

    // Deaths
    if (this.dungeonTimer.deaths > 0) {
      this.deathText.setText(`Deaths: ${this.dungeonTimer.deaths}  (-${this.dungeonTimer.deaths * 5}s)`);
    }

    // Party frames
    for (const frame of this.partyFrames) {
      const m = frame.member;
      const pct = Math.max(0, m.hp / m.maxHp);
      frame.hpFill.setScale(pct, 1);

      if (pct > 0.5) frame.hpFill.setFillStyle(0x44cc44);
      else if (pct > 0.25) frame.hpFill.setFillStyle(0xcccc44);
      else frame.hpFill.setFillStyle(0xcc4444);

      frame.hpText.setText(`${Math.max(0, m.hp)}/${m.maxHp}`);
    }

    // Cooldowns
    if (this.player) {
      const cd1 = Math.max(0, Math.ceil(this.player.cooldowns.special1 / 1000));
      const cd2 = Math.max(0, Math.ceil(this.player.cooldowns.special2 / 1000));

      this.cd1Text.setText(cd1 > 0 ? `[2] ${this.player.classData.specials.special1.name} (${cd1}s)` : `[2] ${this.player.classData.specials.special1.name}`);
      this.cd1Text.setColor(cd1 > 0 ? '#cc4444' : '#44cc44');

      this.cd2Text.setText(cd2 > 0 ? `[3] ${this.player.classData.specials.special2.name} (${cd2}s)` : `[3] ${this.player.classData.specials.special2.name}`);
      this.cd2Text.setColor(cd2 > 0 ? '#cc4444' : '#44cc44');
    }
  }
}
