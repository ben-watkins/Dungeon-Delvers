# CLAUDE.md — Context for Claude Code

## Project Identity
**Mythic Brawl** — 2.5D pixel art beat-em-up (Streets of Rage style) with WoW Mythic+ dungeon mechanics (timer, affixes, class roles, key upgrades). Built in Phaser 3 + Vite, pure JavaScript, all in VS Code.

## Owner
Ben Watkins — Altus, Oklahoma. Plant-level developer at Bar-S Foods. Plays WoW (Disc Priest main). Experienced with JavaScript, Power Platform, and industrial automation. Building this as a personal game project.

## Commands
- `npm run dev` — Start dev server (port 8080, auto-opens browser)
- `npm run build` — Production build to `dist/`
- `npm run preview` — Preview production build

## Architecture Rules
- **Data-driven**: All game tuning lives in `src/config/game.js`. Classes, attacks, enemies, dungeons, affixes are all defined as config objects. Don't hardcode game values in entity code.
- **Event-driven combat**: Entities emit events (`hitboxActive`, `enemyDeath`, `playerSpecial`, etc.) and systems listen. Don't put combat resolution logic inside entities — route through `CombatSystem.js`.
- **State machines everywhere**: Every entity uses `StateMachine` from `src/utils/StateMachine.js`. States have `enter()`, `update(dt)`, `exit()`, and `transitions`. Add new behavior by adding new states.
- **2.5D depth sorting**: Entities have a `groundY` property. `DepthSort.sortGroup()` runs every frame to set render depth. Always use `groundY` for position logic, not `this.y` (which includes jump offset).
- **Pixel art integrity**: Game config has `pixelArt: true` and `roundPixels: true`. Never add anti-aliasing, sub-pixel rendering, or non-integer positioning. All sprites use nearest-neighbor scaling.

## Code Style
- ES modules (`import`/`export`)
- No TypeScript (plain JS)
- No frameworks beyond Phaser 3
- JSDoc comments on classes and public methods
- Entity classes extend `Phaser.GameObjects.Container`
- Config constants are ALL_CAPS objects

## Key Files to Know
| File | Purpose |
|------|---------|
| `src/config/game.js` | ALL game data — edit here for balance changes |
| `src/entities/Player.js` | Player entity — input handling, combo system, state machine |
| `src/entities/Enemy.js` | Enemy AI — aggro, chase, attack, retreat states |
| `src/entities/AICompanion.js` | AI party members — role-based behavior |
| `src/systems/CombatSystem.js` | Hitbox resolution, damage, hit-stop, crits, atonement |
| `src/systems/AffixManager.js` | M+ affix effects (Bursting, Bolstering, Sanguine, etc.) |
| `src/systems/DungeonTimer.js` | M+ countdown with death penalty |
| `src/scenes/DungeonScene.js` | Main gameplay loop — entity management, room flow, camera |
| `src/scenes/BootScene.js` | Asset loading, placeholder sprites, animation definitions |

## Common Tasks

### Add a new enemy type
1. Add entry to `ENEMIES` in `config/game.js` (stats, AI params, attacks)
2. Add its attack(s) to `ATTACKS` in same file
3. Add placeholder generation in `BootScene.generatePlaceholders()`
4. Add animation definitions in `BootScene.createAnimations()`
5. Reference in a dungeon room: `{ type: 'arena', enemies: ['new_enemy'] }`

### Add a new class ability
1. Add to the class's `specials` in `CLASSES` config
2. Add attack data to `ATTACKS` if it has a hitbox
3. Handle the special event in `CombatSystem.onPlayerSpecial()`
4. Add cooldown tracking in Player and UI display in UIScene

### Add a new affix
1. Add entry to `AFFIXES` in config
2. Add handler method in `AffixManager.js`
3. Wire event listener in AffixManager constructor
4. Add to `selectAffixes()` rotation logic
5. Add UI indicator color in `UIScene.js`

### Swap placeholder sprites for real ones
1. Place PNG sprite sheet in `src/assets/sprites/`
2. In `BootScene.preload()`, uncomment/add: `this.load.spritesheet('warrior', 'assets/sprites/warrior.png', { frameWidth: 48, frameHeight: 48 })`
3. Remove the corresponding placeholder generation from `generatePlaceholders()`
4. Verify animation frame ranges in `createAnimations()` match the sheet layout

## Gotchas
- Phaser's `arcade` physics uses AABB only — no rotation on hitboxes
- `Container` children don't inherit physics bodies — the container itself needs the body
- `Phaser.Input.Keyboard.JustDown()` must be called every frame to work (it consumes the event)
- Animation `frameRate` is independent of game update rate — Phaser handles interpolation
- `scene.events.emit()` is synchronous — listeners execute immediately in order
- `setFlipX(true)` flips the sprite but NOT the physics body or hitbox offsets — handle directional hitboxes manually
- Smart quotes in code will cause silent failures — always use straight quotes

## Sprite Sheet Spec
48×48 per frame, 12 columns, 12 rows. See README.md for full row-by-row animation layout.
