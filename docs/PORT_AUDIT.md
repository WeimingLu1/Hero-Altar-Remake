# RMXP-Hero browser port completion audit

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

| Area                     | Current evidence                                                                  | State                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Map loading and transfer | All 69 maps load; all used RMXP command codes have adapters and tests             | Implemented                                                                              |
| Map event hooks          | All 215 `Scene_Event` calls parse; event types 0-16 route                         | Partial: complex types still being restored                                              |
| NPC interaction          | Talk/status/spar/trade/join/study available                                       | Partial: quests and special NPC flows missing                                            |
| Inventory/equipment      | Indexed original data, use/equip bonuses and consumable effects tested            | Partial: selling, books, drops, and capacity rules missing                               |
| Combat                   | Normal attack, skills 1-40, cooldowns, magic reflection and status effects tested | Partial: items, flee rules, rewards/drops, lethal/story battle outcomes missing          |
| Tasks                    | Extracted task database                                                           | Missing: wanted, work, hidden, sect and altar progression runtimes                       |
| Training                 | Teacher study implemented                                                         | Missing: practice, force/magic meditation and self-study scenes                          |
| Minigames                | Fishing restored                                                                  | Missing: dance and basketball                                                            |
| Forging/housing          | Entry hooks present                                                               | Missing: forging progression and complete Peach Blossom home loop                        |
| Time/survival            | Food/water/item formulas; drinking and wine time change                           | Partial: walking time, hunger/thirst decay, aging and task timers missing                |
| Save files               | Versioned local JSON import/export and editable actor/world fields                | Implemented; migration validation still needs hardening                                  |
| Keyboard                 | WASD/arrows, Z/Enter, X/Escape, menus and specials                                | Implemented; full modal coverage remains tied to missing scenes                          |
| Visual redraw            | Programmatic map/tile/character renderer and CSS UI                               | Partial: semantic unique redraw coverage for all source visual classes is not yet proven |
| Production               | Sites deployment available                                                        | Implemented per version; final deployment awaits parity completion                       |

## Completion gate

The port is complete only after every partial/missing row above is implemented,
the complete source inventory has a coverage test, production build succeeds,
and the deployed `/original` route passes a keyboard playthrough covering save,
travel, NPC interaction, training, shopping, combat, a task, a minigame, forging,
and housing.
