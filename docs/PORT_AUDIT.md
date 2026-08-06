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

| Area                     | Current evidence                                                                                                                                                                                | State                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Map loading and transfer | All 69 maps load; all used RMXP command codes have adapters and tests                                                                                                                           | Implemented                                                                              |
| Map event hooks          | All 215 `Scene_Event` calls parse; event types 0-16 route                                                                                                                                       | Partial: complex types still being restored                                              |
| NPC interaction          | Talk/status/spar/trade/join/study and all ten data-defined hidden exchange quests available                                                                                                     | Partial: remaining bespoke NPC flows missing                                             |
| Inventory/equipment      | Indexed original data, use/equip bonuses and consumable effects tested                                                                                                                          | Partial: selling, books, drops, and capacity rules missing                               |
| Combat                   | Normal attack, skills 1-40, cooldowns, magic reflection and status effects tested                                                                                                               | Partial: items, flee rules, rewards/drops, lethal/story battle outcomes missing          |
| Tasks                    | All `$data_tasks` families are executable: visit/find/kill, wanted criminals, volunteer/stone work, ten hidden exchanges, teacher requirements and nine-altar progression; deadlines and rewards are tested | Implemented                                                                              |
| Training                 | Teacher and book study, equipped-kungfu practice, force/magic meditation, recovery, healing, power controls and Caihua choice flow run at the original 120 Hz phase rate and are formula-tested | Implemented                                                                              |
| Minigames                | Fishing, 120 Hz dance-pad timing/scoring and throw-ball moving aim/shot/failure loop are keyboard-playable; high scores persist in JSON                                                         | Implemented                                                                              |
| Forging/housing          | Four-round weapon-matching forge challenge, four custom weapon types, editable names, original reforge costs/affix formulas, custom stat bonuses, Peach Blossom ownership, three room levels and five furniture types execute and persist | Implemented                                                                              |
| Time/survival            | Original 15-second digestion, hunger/thirst decay, passive recovery, aging, drinking and wine time change tested                                                                                | Partial: task timers still depend on the missing task runtime                            |
| Save files               | Versioned local JSON import/export and editable actor/world fields                                                                                                                              | Implemented; migration validation still needs hardening                                  |
| Keyboard                 | WASD/arrows, Z/Enter, X/Escape, menus and specials                                                                                                                                              | Implemented; full modal coverage remains tied to missing scenes                          |
| Visual redraw            | Programmatic map/tile/character renderer and CSS UI                                                                                                                                             | Partial: semantic unique redraw coverage for all source visual classes is not yet proven |
| Production               | Sites deployment available                                                                                                                                                                      | Implemented per version; final deployment awaits parity completion                       |

## Completion gate

The port is complete only after every partial/missing row above is implemented,
the complete source inventory has a coverage test, production build succeeds,
and the deployed `/original` route passes a keyboard playthrough covering save,
travel, NPC interaction, training, shopping, combat, a task, a minigame, forging,
and housing.
