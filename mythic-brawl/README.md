# MYTHIC BRAWL

A 2.5D side-scrolling beat-em-up with WoW Mythic+ dungeon mechanics.
**Streets of Rage meets Mythic+.**

## Quick Start

```bash
npm install
npm run dev
```

Opens at `http://localhost:8080`. Game renders at 480x270 scaled up to fit your window with crisp pixel art.

## Controls

| Key | Action |
|-----|--------|
| WASD | Move (2.5D plane) |
| J | Attack (combo chain) |
| K | Special 1 |
| L | Special 2 |
| SHIFT | Block (Warrior only) |
| SPACE | Dodge |
| ESC | Pause |

---

## Architecture

### Tech Stack
- **Phaser 3** — 2D game engine (physics, sprites, cameras, input)
- **Vite** — Dev server + bundler
- **Vanilla JS** — No framework, ES modules throughout

### Project Structure

```
mythic-brawl/
├── index.html                    # Entry point
├── package.json
├── vite.config.js
├── src/
│   ├── main.js                   # Phaser game config + scene registration
│   ├── config/
│   │   └── game.js               # ALL game data: classes, attacks, enemies, dungeons, affixes, input map
│   ├── scenes/
│   │   ├── BootScene.js          # Asset loading + placeholder sprite generation
│   │   ├── MainMenuScene.js      # Title screen + class/dungeon selection
│   │   ├── DungeonScene.js       # Main gameplay — entities, rooms, camera, systems
│   │   └── UIScene.js            # HUD overlay (timer, party frames, cooldowns, affixes)
│   ├── entities/
│   │   ├── Player.js             # Player-controlled character with input + state machine
│   │   ├── Enemy.js              # AI enemy with aggro/chase/attack/retreat behavior
│   │   └── AICompanion.js        # AI party member with role-based behavior (tank/healer/dps)
│   ├── systems/
│   │   ├── CombatSystem.js       # Hitbox resolution, damage calc, hit-stop, damage numbers
│   │   ├── ComboStateMachine.js  # Input buffering, combo chain helpers
│   │   ├── AffixManager.js       # M+ affix logic (Fortified, Bursting, Bolstering, etc.)
│   │   └── DungeonTimer.js       # M+ countdown timer with death penalty
│   ├── utils/
│   │   ├── StateMachine.js       # Generic FSM for entity states
│   │   └── DepthSort.js          # 2.5D Y-sorting for render order
│   └── assets/
│       ├── sprites/              # Character sprite sheets (PNG)
│       ├── tilesets/             # Tilemap images + Tiled JSON maps
│       ├── audio/                # BGM + SFX
│       └── ui/                   # UI element sprites
```

### Key Concepts

**2.5D Coordinate System:**
- X = horizontal (left/right)
- Y = depth on ground plane (up = far, down = close). Range: `groundMinY` (160) to `groundMaxY` (240)
- Z = jump height (simulated via Y-offset; shadow stays on ground)
- Depth sorting: every frame, entities re-sort by `groundY` so closer entities render in front

**State Machines:**
Every entity (Player, Enemy, AICompanion) uses a `StateMachine` with states like idle, walk, attack, hitstun, death. States define `enter()`, `update(dt)`, `exit()`, and `transitions`. The FSM can be locked during un-cancellable animations.

**Combat Flow:**
1. Player presses attack → Player FSM enters `attack` state
2. Attack animation plays → at `activeStart` frame, hitbox is created
3. CombatSystem checks hitbox overlap against enemy hurtboxes
4. On hit: damage calculated (base × power × combo multiplier × crit), knockback applied, hit-stop freezes both entities for 3 frames, damage number floats up
5. Enemy enters `hitstun` state for the attack's hitstun duration
6. If attack has `canCancel` frame and player buffered another attack input, combo continues

**Input Buffering:**
When the player presses attack during an active attack animation, the input is stored. Once the current attack reaches its `canCancel` frame, the buffered input fires the next combo hit. This makes combos feel responsive without requiring frame-perfect timing.

**M+ System:**
- Dungeon timer counts down; deaths subtract 5 seconds
- Keystone level scales enemy HP/damage by 8% per level
- Affixes activate at level thresholds: +4 (1 affix), +7 (2), +10 (3)
- Affixes hook into game events (enemy death, enemy attack) to trigger effects
- Timer completion determines key upgrade (+1/+2/+3)

---

## Data-Driven Design

Almost everything is defined in `src/config/game.js`:

- **CLASSES** — Stats, combo chains, specials, passives for each class
- **ATTACKS** — Frame data, hitboxes, damage, knockback for every attack
- **ENEMIES** — Stats, AI parameters, attack lists for each enemy type
- **DUNGEONS** — Room sequences, enemy compositions, time limits
- **AFFIXES** — M+ modifier definitions with all tuning values
- **INPUT_MAP** — Keyboard bindings

To add a new enemy: add an entry to `ENEMIES`, add its attack(s) to `ATTACKS`, reference it in a dungeon room definition, and create its sprite sheet.

To add a new affix: add an entry to `AFFIXES`, add handler logic in `AffixManager.js`, and update `selectAffixes()` to include it in the rotation.

---

## Current State (What's Built)

✅ Full project scaffold with Phaser 3 + Vite
✅ State machine system for all entities
✅ Player with full combo chain, input buffering, specials, hitstun
✅ Enemy AI with aggro/chase/attack/retreat states
✅ AI companions with role-based behavior (tank/healer/dps)
✅ Combat system with hitbox resolution, hit-stop, damage numbers, crits
✅ M+ timer with death penalty and key upgrade calculation
✅ Affix system (Fortified, Tyrannical, Bursting, Bolstering, Sanguine, Explosive, Necrotic)
✅ Dungeon room system with arena lock/unlock flow
✅ HUD overlay (timer, party frames, cooldowns, affix indicators)
✅ Placeholder sprite generation for all characters
✅ Depth sorting for 2.5D
✅ 3 classes fully defined (Warrior/Tank, Priest/Healer, Rogue/DPS)
✅ Data-driven config for classes, attacks, enemies, dungeons, affixes

---

## Build Roadmap (What Needs Building Next)

### Phase 1: Get It Playable (Priority)

1. **Fix placeholder sprites → real sprite sheets**
   - Each character needs a PNG sprite sheet: 48x48 frames, rows = animation states
   - Sprite sheets will be provided as assets — load them in BootScene.js
   - Update animation frame ranges in `createAnimations()` to match actual sheet layout

2. **Polish combat feel**
   - Screen shake on heavy hits ✅ (basic)
   - Hit flash (white overlay on damaged entity for 2 frames)
   - Knockback sliding with ground friction
   - Jump mechanic (fake Z-axis with shadow)
   - Grab/throw system (iconic beat-em-up mechanic)

3. **Room progression**
   - Camera scroll-lock zones (invisible trigger rects)
   - "GO →" arrow when room is cleared
   - Room transition animations (brief fade or scroll)
   - Enemy spawn animations (jump in from off-screen, or emerge from background)

4. **Sound effects**
   - Hit impacts (vary by weapon type)
   - Footsteps
   - Special ability sounds
   - M+ timer warning at 2 minutes
   - Boss intro sound

### Phase 2: Content

5. **Tilemap-based levels**
   - Use Tiled editor (free) to create tilemap JSON files
   - Load in BootScene, render in DungeonScene
   - Parallax scrolling backgrounds (3 layers: far, mid, near)
   - Destructible objects (crates, barrels — drop health/items)

6. **Boss encounters**
   - Phase transitions (different attack patterns at HP thresholds)
   - Telegraph system (warning indicators before AoE attacks)
   - Boss-specific mechanics (dodge zones, interrupt casts, adds spawn)

7. **More enemies**
   - Ranged enemies (archers, casters)
   - Shielded enemies (must break shield or attack from behind)
   - Summoners (spawn smaller adds)
   - Each needs: sprite sheet, entry in ENEMIES config, attack definitions

8. **More dungeons**
   - Each dungeon = new tileset + room sequence + enemy composition + bosses
   - Different themes (mine, castle, forest, sewers)

### Phase 3: Progression

9. **Loot system**
   - Equipment drops from bosses/chests
   - Gear slots: weapon, armor, accessory
   - Stats modify class base stats
   - Rarity tiers (common, rare, epic, legendary)

10. **Talent/skill trees**
    - Each class gets branching ability upgrades
    - Modify existing abilities or unlock new ones
    - Respec option

11. **Save system**
    - localStorage for web builds
    - Save: unlocked dungeons, highest keystone cleared, gear, talents
    - Per-class progression

### Phase 4: Polish

12. **Particle effects** — hit sparks, heal particles, affix visuals, death effects
13. **Screen transitions** — menu→game, room→room, game→results
14. **Results screen** — detailed run summary like a Details/Recount meter
15. **Difficulty tuning** — balance timer, enemy HP/damage scaling, affix interactions
16. **Electron wrapper** — package for desktop distribution

---

## Sprite Sheet Format

When real sprites are ready, they should be PNG files at this spec:

- **Frame size:** 48×48 pixels (boss sprites: 64×64)
- **Columns:** max frames in any animation (12 is safe)
- **Rows (animation states):**

| Row | Animation | Frames | Frame Rate |
|-----|-----------|--------|------------|
| 0 | Idle | 4 | 6 fps |
| 1 | Walk | 6 | 8 fps |
| 2 | Attack 1 | 6 | 12 fps |
| 3 | Attack 2 | 7 | 12 fps |
| 4 | Attack 3 (finisher) | 10 | 12 fps |
| 5 | Special 1 | 8 | 10 fps |
| 6 | Special 2 | 8 | 10 fps |
| 7 | Hitstun | 3 | 8 fps |
| 8 | Knockdown | 4 | 8 fps |
| 9 | Getup | 4 | 8 fps |
| 10 | Death | 6 | 6 fps |
| 11 | Block/Dodge | 2-4 | 8 fps |

Total sheet size per character: 576×576 (12 cols × 12 rows × 48px)

Place in `src/assets/sprites/warrior.png`, `priest.png`, `rogue.png`, etc.

---

## Tips for Claude Code

- All game data lives in `src/config/game.js` — edit there to tune balance
- Entity behavior is driven by state machines — add new states by adding to the states object in `buildStates()`
- Combat events flow through Phaser's event system: `scene.events.emit()` / `scene.events.on()`
- When adding new features, follow the existing pattern: define data in config, create system class in `systems/`, wire it up in DungeonScene
- The Phaser docs are at https://newdocs.phaser.io/docs/3.80.0 — refer there for API questions
- `pixelArt: true` in the game config prevents Phaser from anti-aliasing sprites — never change this
- Test at 480×270 native resolution; `Phaser.Scale.FIT` handles display scaling
