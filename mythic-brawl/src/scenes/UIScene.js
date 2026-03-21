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

    // --- ABILITY BAR (bottom-center) ---
    this.createAbilityBar(width, height);

    // --- CONTROLS HINT (first 10 seconds) ---
    this.controlsHint = this.add.text(width / 2, height - 4, 'WASD move · NUM1 attack · NUM2/3 specials · NUM7 leap · TAB target', {
      fontSize: '7px', fontFamily: 'monospace', color: '#404060',
    }).setOrigin(0.5, 1).setResolution(2).setDepth(1);

    this.time.delayedCall(10000, () => {
      this.controlsHint?.destroy();
    });
  }

  createAbilityBar(width, height) {
    const specials = this.player.classData.specials;
    const slotSize = 22;
    const slotGap = 3;
    const keys = Object.keys(specials);  // ['special1', 'special2', 'special3', ...]
    const slotCount = keys.length + 1;   // +1 for basic attack
    const barWidth = slotCount * (slotSize + slotGap) - slotGap;
    const barX = (width - barWidth) / 2;
    const barY = height - slotSize - 6;

    // Background bar
    this.add.rectangle(width / 2, barY + slotSize / 2, barWidth + 8, slotSize + 6, 0x0d0d18, 0.85)
      .setDepth(0);

    this.abilitySlots = [];
    const keyLabels = ['1', '2', '3', '7', '8', '9'];
    const slotNames = ['Attack', ...keys.map(k => specials[k].name)];
    const slotKeys = ['attack', ...keys];

    for (let i = 0; i < slotCount; i++) {
      const sx = barX + i * (slotSize + slotGap);
      const sy = barY;

      // Slot background
      const bg = this.add.rectangle(sx + slotSize / 2, sy + slotSize / 2, slotSize, slotSize, 0x1a1a2e)
        .setStrokeStyle(1, 0x404060).setDepth(1);

      // Cooldown overlay (darkens slot when on cooldown)
      const cdOverlay = this.add.rectangle(sx + slotSize / 2, sy + slotSize / 2, slotSize, slotSize, 0x000000, 0.6)
        .setDepth(2).setVisible(false);

      // Cooldown timer text
      const cdText = this.add.text(sx + slotSize / 2, sy + slotSize / 2, '', {
        fontSize: '9px', fontFamily: 'monospace', color: '#ffffff',
      }).setOrigin(0.5).setResolution(2).setDepth(3);

      // Key label (bottom of slot)
      this.add.text(sx + slotSize / 2, sy + slotSize + 1, keyLabels[i] || '', {
        fontSize: '6px', fontFamily: 'monospace', color: '#606080',
      }).setOrigin(0.5, 0).setResolution(2).setDepth(1);

      // Ability name abbreviation (inside slot)
      const abbr = slotNames[i].substring(0, 3);
      this.add.text(sx + slotSize / 2, sy + 3, abbr, {
        fontSize: '6px', fontFamily: 'monospace', color: '#8090a8',
      }).setOrigin(0.5, 0).setResolution(2).setDepth(1);

      this.abilitySlots.push({
        key: slotKeys[i],
        bg,
        cdOverlay,
        cdText,
      });
    }
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

    // Ability bar cooldowns
    if (this.player && this.abilitySlots) {
      for (const slot of this.abilitySlots) {
        if (slot.key === 'attack') {
          // Attack has no cooldown
          slot.cdOverlay.setVisible(false);
          slot.cdText.setText('');
          slot.bg.setStrokeStyle(1, 0x44cc44);
          continue;
        }

        const cd = this.player.cooldowns[slot.key] || 0;
        if (cd > 0) {
          const secs = Math.ceil(cd / 1000);
          slot.cdOverlay.setVisible(true);
          slot.cdText.setText(`${secs}`);
          slot.bg.setStrokeStyle(1, 0x404060);
        } else {
          slot.cdOverlay.setVisible(false);
          slot.cdText.setText('');
          slot.bg.setStrokeStyle(1, 0x44cc44);
        }
      }
    }
  }
}
