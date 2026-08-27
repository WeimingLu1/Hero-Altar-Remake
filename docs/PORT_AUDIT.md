# RMXP-Hero browser port completion audit

> Updated 2026-08-23 for Sites v86. This audit covers deterministic RMXP parity; the newer
> LLM-driven ambient simulation is an additive browser-remake layer and cannot
> alter the deterministic task, inventory, combat, or save state directly.

This document tracks parity against the checked-in RMXP source. A row is only
marked complete when the browser runtime has executable behavior and a relevant
test or runtime check. Data extraction alone is not implementation evidence.

## Source inventory

- 69 maps, 400 map events, 955 event commands.
- 60 kungfu records, 40 active special-skill records, 33 items, 32 weapons,
  34 armors, and 199 enemies.
- 108 Ruby script files, including character simulation, tasks, shops,
  training, combat, minigames, forging, housing, and network-only scenes.

## Coverage matrix

| Area                     | Current evidence                                                                                                                                                                                                                          | State       |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Map loading and transfer | All 69 maps load; all used RMXP command codes have adapters and tests                                                                                                                                                                     | Implemented |
| Map event hooks          | All 215 `Scene_Event` calls parse; event types 0-16 route; all command codes used by the 69 maps have executable adapters                                                                                                                 | Implemented |
| NPC interaction          | Talk/status/lethal battle/trade/join/study, bespoke task owners, altar chain, forge master, home owner and all ten hidden exchanges are available                                                                                         | Implemented |
| Inventory/equipment      | Indexed original data, unlimited distinct bag/learned-skill entries, use/equip bonuses, books, battle/menu item occasions, drops, stone records, in-battle equipment switching, and forged-weapon entry recovery are tested                | Implemented |
| Combat                   | Normal attack, all learned skills 1-40 in the special menu, weapon requirement feedback, in-battle kungfu/equipment switching, cooldowns, magic/status effects, battle items, escalating flee, rewards and lethal/story outcomes execute; Meteor Throw preserves forged weapons | Implemented |
| Tasks                    | All `$data_tasks` families plus deterministic duel/visit/delegated-duel generated encounters are executable; original tasks retain priority, exact NPC/map/event targets and rewards are engine-controlled, and deadlines are tested       | Implemented |
| Training                 | Teacher and book study, equipped-kungfu practice, force/magic meditation, recovery, healing, power controls and Caihua choice flow run at the original 120 Hz phase rate and are formula-tested                                           | Implemented |
| Minigames                | Fishing, 120 Hz dance-pad timing/scoring and throw-ball moving aim/shot/failure loop are keyboard-playable; high scores persist in JSON                                                                                                   | Implemented |
| Forging/housing          | Four-round weapon-matching forge challenge, four custom weapon types, editable names, original reforge costs/affix formulas, custom stat bonuses, Peach Blossom ownership, three room levels and five furniture types execute and persist | Implemented |
| Time/survival            | Original 15-second digestion, hunger/thirst decay, passive recovery, aging, drinking, wine time changes and all task deadlines run from the persisted game clock                                                                          | Implemented |
| Save files               | v4 local JSON import/export, generated-quest journal, normalization and editable actor/world/task/forge/home/minigame fields; old forged-weapon entries are repaired while unavailable, corrupt and quota failures remain recoverable      | Implemented |
| Keyboard                 | Mac/Windows-compatible WASD/arrows, E/Enter, X/Escape, C/M, 1–4, R/H/T/Q/I/G and every modal have keyboard and clickable controls; Space is scoped to active-talk autoplay, while Z, F, F1–F12 and K remain unbound                        | Implemented |
| Visual redraw            | Source bitmaps are not shipped; maps, terrain, buildings, figures, portraits, objects and furniture use project-original generated atlases plus CSS/canvas composition                                                                     | Implemented |
| Ambient world layer      | Current-screen NPC roaming, 3×3 hearing, strict one-to-one alternating dialogue, a fixed player-priority queue, immutable character facts and cancellable LM Studio requests remain isolated from deterministic state                         | Implemented |
| Combat rebalance layer   | Static NPCs scale from genuine combat kungfu while civilians and dynamic wanted enemies retain intended balance; masters gain vitality, energy, innate stats, hit and affordable offensive specials; spell resources use diminishing inputs and corrected burn coefficients | Implemented |
| Movement policy          | Product design intentionally ignores RMXP tile passage flags across all 69 maps; rectangular bounds and live character occupancy remain                                                                                                   | Implemented |
| Modifier limits          | Experience caps at 10,000,000, innate player stats at 30, force/magic boosts use equipped-skill caps, MAX preserves age, and modifier-only school/teacher fields are independent                                                            | Implemented |
| Production               | TypeScript, ESLint, global coverage, production build, chunk/title/asset-manifest budgets, logic/visual/SSR tests, axe checks and Chromium/Firefox/WebKit E2E are enforced locally or in CI                                                   | Implemented |

## Completion gate

The detailed requirement-by-requirement evidence is maintained in
`docs/STRICT_PARITY_AUDIT.md`. The offline single-player port passes the completion gate. The source inventory
has coverage tests, production build succeeds, and `/original` exposes keyboard
flows for save, travel, NPC interaction, training, shopping, lethal and sparring
combat, tasks, minigames, forging, and housing. Original network-only scenes are
intentionally outside the offline browser product.
