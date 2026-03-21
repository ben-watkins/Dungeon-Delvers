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
import { DUNGEONS } from '../config/game.js';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create() {
    const { width, height } = this.cameras.main;

    // Title
    this.add.text(width / 2, height * 0.15, 'MYTHIC BRAWL', {
      fontSize: '32px',
      fontFamily: 'monospace',
      color: '#80d8ff',
    }).setOrigin(0.5).setResolution(4);

    this.add.text(width / 2, height * 0.28, 'Streets of Rage meets Mythic+', {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#606080',
    }).setOrigin(0.5).setResolution(4);

    // "Choose your class" label
    this.add.text(width / 2, height * 0.38, 'Choose your class', {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#808098',
    }).setOrigin(0.5).setResolution(4);

    // Class selection
    this.classes = [
      { key: 'warrior', name: 'WARRIOR', role: 'Tank', color: '#8898b8' },
      { key: 'priest', name: 'PRIEST', role: 'Healer', color: '#90a8d8' },
      { key: 'rogue', name: 'ROGUE', role: 'DPS', color: '#cc6666' },
    ];

    this.selectedIndex = 0;
    this.classSlots = [];

    this.classes.forEach((cls, i) => {
      const x = width * 0.25 + i * (width * 0.25);
      const spriteY = height * 0.52;
      const labelY = height * 0.64;

      // Animated sprite preview — plays idle animation
      const sprite = this.add.sprite(x, spriteY, cls.key, 0);
      sprite.play(`${cls.key}_idle`);

      // Selection highlight box (drawn behind sprite)
      const box = this.add.rectangle(x, spriteY, 64, 64, 0xffffff, 0)
        .setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(cls.color).color, 0);

      // Class name + role label
      const label = this.add.text(x, labelY, `${cls.name}\n${cls.role}`, {
        fontSize: '10px',
        fontFamily: 'monospace',
        color: cls.color,
        align: 'center',
        lineSpacing: 2,
      }).setOrigin(0.5).setResolution(4).setInteractive();

      label.on('pointerdown', () => {
        this.selectedIndex = i;
        this.updateSelection();
      });

      this.classSlots.push({ sprite, box, label, cls });
    });

    // Apply initial selection highlight
    this.updateSelection();

    // Left/right arrows hint
    this.add.text(width * 0.25 - 36, height * 0.52, '<', {
      fontSize: '14px', fontFamily: 'monospace', color: '#404060',
    }).setOrigin(0.5).setResolution(4);
    this.add.text(width * 0.75 + 36, height * 0.52, '>', {
      fontSize: '14px', fontFamily: 'monospace', color: '#404060',
    }).setOrigin(0.5).setResolution(4);

    // Dungeon selector
    this.dungeonKeys = Object.keys(DUNGEONS);
    this.dungeonIndex = 0;
    this.dungeonText = this.add.text(width / 2, height * 0.73, this.getDungeonLabel(), {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#60cc80',
    }).setOrigin(0.5).setResolution(4);

    // Keystone level
    this.keystoneLevel = 2;
    this.keystoneText = this.add.text(width / 2, height * 0.81, `Keystone Level: +${this.keystoneLevel}   [UP/DOWN]`, {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#d4b040',
    }).setOrigin(0.5).setResolution(4);

    // Start prompt
    this.add.text(width / 2, height * 0.90, 'Press ENTER to start', {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#707090',
    }).setOrigin(0.5).setResolution(4);

    // Input — class selection
    this.input.keyboard.on('keydown-LEFT', () => {
      this.selectedIndex = (this.selectedIndex - 1 + this.classes.length) % this.classes.length;
      this.updateSelection();
    });
    this.input.keyboard.on('keydown-A', () => {
      this.selectedIndex = (this.selectedIndex - 1 + this.classes.length) % this.classes.length;
      this.updateSelection();
    });

    this.input.keyboard.on('keydown-RIGHT', () => {
      this.selectedIndex = (this.selectedIndex + 1) % this.classes.length;
      this.updateSelection();
    });
    this.input.keyboard.on('keydown-D', () => {
      this.selectedIndex = (this.selectedIndex + 1) % this.classes.length;
      this.updateSelection();
    });

    // Input — dungeon selector (W/S)
    this.input.keyboard.on('keydown-W', () => {
      this.dungeonIndex = (this.dungeonIndex + 1) % this.dungeonKeys.length;
      this.dungeonText.setText(this.getDungeonLabel());
    });
    this.input.keyboard.on('keydown-S', () => {
      this.dungeonIndex = (this.dungeonIndex - 1 + this.dungeonKeys.length) % this.dungeonKeys.length;
      this.dungeonText.setText(this.getDungeonLabel());
    });

    // Input — keystone level (UP/DOWN arrows)
    this.input.keyboard.on('keydown-UP', () => {
      this.keystoneLevel = Math.min(30, this.keystoneLevel + 1);
      this.keystoneText.setText(`Keystone Level: +${this.keystoneLevel}   [UP/DOWN]`);
    });
    this.input.keyboard.on('keydown-DOWN', () => {
      this.keystoneLevel = Math.max(2, this.keystoneLevel - 1);
      this.keystoneText.setText(`Keystone Level: +${this.keystoneLevel}   [UP/DOWN]`);
    });

    // Input — start
    this.input.keyboard.on('keydown-ENTER', () => {
      this.startDungeon();
    });

    // Gamepad support — poll in update loop
    this.padPrev = {};
  }

  update() {
    const pad = this.input.gamepad && this.input.gamepad.total > 0
      ? this.input.gamepad.pad1 : null;
    if (!pad) return;

    // D-pad / left stick — class selection (left/right) and keystone (up/down)
    const stickX = Math.abs(pad.leftStick.x) > 0.5 ? Math.sign(pad.leftStick.x) : 0;
    const stickY = Math.abs(pad.leftStick.y) > 0.5 ? Math.sign(pad.leftStick.y) : 0;
    const left = pad.left || stickX < 0;
    const right = pad.right || stickX > 0;
    const up = pad.up || stickY < 0;
    const down = pad.down || stickY > 0;

    if (left && !this.padPrev.left) {
      this.selectedIndex = (this.selectedIndex - 1 + this.classes.length) % this.classes.length;
      this.updateSelection();
    }
    if (right && !this.padPrev.right) {
      this.selectedIndex = (this.selectedIndex + 1) % this.classes.length;
      this.updateSelection();
    }
    if (up && !this.padPrev.up) {
      this.keystoneLevel = Math.min(30, this.keystoneLevel + 1);
      this.keystoneText.setText(`Keystone Level: +${this.keystoneLevel}   [UP/DOWN]`);
    }
    if (down && !this.padPrev.down) {
      this.keystoneLevel = Math.max(2, this.keystoneLevel - 1);
      this.keystoneText.setText(`Keystone Level: +${this.keystoneLevel}   [UP/DOWN]`);
    }

    // A button (index 0) or Start button (index 9) — start game
    const btnA = pad.buttons[0] && pad.buttons[0].pressed;
    const btnStart = pad.buttons[9] && pad.buttons[9].pressed;
    if ((btnA && !this.padPrev.a) || (btnStart && !this.padPrev.start)) {
      this.startDungeon();
    }

    this.padPrev.left = left;
    this.padPrev.right = right;
    this.padPrev.up = up;
    this.padPrev.down = down;
    this.padPrev.a = btnA;
    this.padPrev.start = btnStart;
  }

  updateSelection() {
    this.classes.forEach((cls, i) => {
      const slot = this.classSlots[i];
      const selected = i === this.selectedIndex;

      // Highlight box — visible only on selected
      const clsColor = Phaser.Display.Color.HexStringToColor(cls.color).color;
      slot.box.setStrokeStyle(selected ? 2 : 1, clsColor, selected ? 1 : 0);
      slot.box.setFillStyle(0xffffff, selected ? 0.05 : 0);

      // Dim non-selected sprites
      slot.sprite.setAlpha(selected ? 1 : 0.4);

      // Brighten selected label
      slot.label.setColor(selected ? '#ffffff' : cls.color);
    });

    this.selectedClass = this.classes[this.selectedIndex].key;
  }

  getDungeonLabel() {
    const key = this.dungeonKeys[this.dungeonIndex];
    const name = DUNGEONS[key].name;
    return `Dungeon: ${name}   [W/S]`;
  }

  startDungeon() {
    this.scene.start('DungeonScene', {
      playerClass: this.selectedClass,
      dungeon: this.dungeonKeys[this.dungeonIndex],
      keystoneLevel: this.keystoneLevel,
    });
  }
}
