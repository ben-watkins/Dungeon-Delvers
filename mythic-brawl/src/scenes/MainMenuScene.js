/**
 * MAIN MENU SCENE
 * 
 * Title screen with class selection and dungeon/keystone selection.
 * For now: simple text menu that starts the dungeon.
 * 
 * TODO:
 * - Animated title screen with character sprites
 * - Class selection carousel with stat preview
 * - Dungeon selection with M+ keystone level picker
 * - Affix display for selected keystone level
 * - Party composition display (player + 2 AI)
 * - Settings / keybinding screen
 */

import Phaser from 'phaser';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create() {
    const { width, height } = this.cameras.main;

    // Title
    this.add.text(width / 2, height * 0.25, 'MYTHIC BRAWL', {
      fontSize: '24px',
      fontFamily: 'monospace',
      color: '#80d8ff',
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.35, 'Streets of Rage meets Mythic+', {
      fontSize: '8px',
      fontFamily: 'monospace',
      color: '#606080',
    }).setOrigin(0.5);

    // Class selection
    const classes = [
      { key: 'warrior', name: 'WARRIOR', role: 'Tank', color: '#8898b8' },
      { key: 'priest', name: 'PRIEST', role: 'Healer', color: '#90a8d8' },
      { key: 'rogue', name: 'ROGUE', role: 'DPS', color: '#cc6666' },
    ];

    this.selectedClass = 'warrior';

    classes.forEach((cls, i) => {
      const x = width * 0.25 + i * (width * 0.25);
      const y = height * 0.55;

      const label = this.add.text(x, y, `${cls.name}\n${cls.role}`, {
        fontSize: '8px',
        fontFamily: 'monospace',
        color: cls.color,
        align: 'center',
      }).setOrigin(0.5).setInteractive();

      label.on('pointerdown', () => {
        this.selectedClass = cls.key;
        this.updateSelection(classes, cls.key);
      });
    });

    // Start prompt
    this.add.text(width / 2, height * 0.8, 'Press ENTER to start', {
      fontSize: '8px',
      fontFamily: 'monospace',
      color: '#505068',
    }).setOrigin(0.5);

    // Keystone level
    this.keystoneLevel = 2;
    this.keystoneText = this.add.text(width / 2, height * 0.7, `Keystone Level: +${this.keystoneLevel}`, {
      fontSize: '8px',
      fontFamily: 'monospace',
      color: '#d4b040',
    }).setOrigin(0.5);

    // Input
    this.input.keyboard.on('keydown-ENTER', () => {
      this.startDungeon();
    });

    this.input.keyboard.on('keydown-UP', () => {
      this.keystoneLevel = Math.min(30, this.keystoneLevel + 1);
      this.keystoneText.setText(`Keystone Level: +${this.keystoneLevel}`);
    });

    this.input.keyboard.on('keydown-DOWN', () => {
      this.keystoneLevel = Math.max(2, this.keystoneLevel - 1);
      this.keystoneText.setText(`Keystone Level: +${this.keystoneLevel}`);
    });
  }

  updateSelection(classes, selectedKey) {
    // Visual feedback for selection — to be expanded with sprite previews
  }

  startDungeon() {
    this.scene.start('DungeonScene', {
      playerClass: this.selectedClass,
      dungeon: 'deadmines',
      keystoneLevel: this.keystoneLevel,
    });
  }
}
