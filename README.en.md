# Hero Altar: Golden Remake

> A browser remake of the classic Wuxia RPG "Hero Altar" from the WenQu Xing electronic dictionary. Side-scrolling exploration, turn-based combat, sect training, quests, life simulation, and a three-way finale.

## About

This remake is built with Phaser 3 Canvas 2D, TypeScript, and Vite. All art is generated procedurally at runtime with zero external assets, while the DOM overlay renders every text interface in an ink-and-paper Wuxia style.

Content highlights:

- Seven sects: Taiji, Bagua, Xueshan, Huajian, Yinhe, Honglian, and Gaibang
- 14 outdoor areas and 19 indoor rooms
- 50 NPCs with 12 social relationship pairs
- 30+ enemies, including the Heifeng stronghold, six sect masters, and three final bosses
- 1 main quest, 12 side quests, and 3 endings
- Day/night cycle, weather, random events, rumors, romance, marriage, housing, forging, and storage

## Quick Start

```bash
npm install
npm run dev          # dev server at http://127.0.0.1:5173/
npm run build        # production build to dist/
npm run build:single # single-file build to dist-single/index.html
npm run preview      # preview production build
npm run balance      # battle balance simulation
```

Note: `index.html` at the project root is the Vite entry and should not be opened directly via `file://`. Use `dist-single/index.html` for a double-click playable build.

## Controls

- Move: Arrow keys or A / D
- Interact: E or Enter
- Menus: 1 Status, 2 Bag, 3 Skills, 4 Quests, 5 Meditate, 6 Save
- World map: M
- Cheat panel: F8

## Walkthrough

### One-line path

Collect herbs, train literacy to level 10, defeat Iron Fist Zhou San, join a sect and reach 5,000 experience, get the Qinglong Altar map, clear Heifeng stronghold and kill Leng Tieyi, challenge the six masters for six stone plates, open the End of Time, and defeat the final boss of your choice.

### Phase 1: Ping'an Town and the Back Mountain

- During character creation, make the four attributes total as close to 80 as possible. Keep Intelligence reasonably high and keep Strength, Constitution, and Agility at 15 or above.
- Accept the main quest from the village chief, then collect 3 herbs on the Back Mountain.
- Grind on the Back Mountain: wild boars, wolves, and vipers. Gather herbs and mine ore to sell.
- Learn literacy from Gu Yanwu until level 10.
- Get the hand-copied manual from the mysterious man and train basic internal energy.
- Do convenient side quests: the old woman's chores and Ma Daha's lost hairpin (found on the Back Mountain).

### Phase 2: Defeat Zhou San

- Train basic fist to level 25+, buy a wooden blade or iron sword, leather armor, and wound-healing pills.
- Zhou San patrols Ping'an Town. Walk into him to fight. Winning advances the main quest.

### Phase 3: Join a Sect and Grow

- Recommended first sects: Taiji (Wudang) or Bagua (Shangjia), both have low entry requirements.
- Train sect martial arts to around level 60 to unlock ultimate moves, learn sect internal energy and lightness skills, and meditate to raise internal strength.
- Hermit route: to obtain the Xiaoyao Heart Method, do not join a sect first. Collect the Fist Classic, the Sky-Splitting Blade Manual, and the Scorched Page, then talk to the old man at the town gate.
- Do side quests as they come: bounty hunting, Ping Yizhi, Xuantie, visits, official letters, and the daily quests.
- Before reaching 5,000 experience, upgrade to a Qingfeng sword or Golden Ring blade and armor better than refined cloth.

### Phase 4: Heifeng Stronghold

- After 5,000 experience, get the Qinglong Altar map from the village chief.
- Route: bandits, bandit leader, Qinglong guards, then Leng Tieyi.
- Leng Tieyi is the first real boss. Save before fighting, stock up on healing items, and use ultimates plus defensive stance.
- Take the secret letter after victory and report back to the village chief.

### Phase 5: Collect the Six Stone Plates

- The six masters: Qing Xu (Wudang), Wang Weiyang (Shangjia), Bai Ruide (Xueshan), Li Qingzhao (Baihua), He Zhongyang (Binghuo), and Yu Hongru (Wuzhi).
- Losing a master challenge has no penalty, so retry freely.
- Recommended state: main combat skill at level 100+, internal strength 400+, top-tier weapon, strong armor, and plenty of potions.
- Yun Zhonghe offers 800 taels as a bounty at night on the Back Mountain. Qiao Sihai of Gaibang has no plate and is optional.

### Phase 6: Endgame

- After collecting all six plates, return to the village chief to open the End of Time.
- Choose one of three final bosses at the bronze mirror: Who Am I, the Moral Monk, or Dongfang Qiubai.
- The Moral Monk is the most stable fight; Dongfang Qiubai is the hardest. Each boss has its own ending.
- Save before the fight, bring 5-10 Great Rejuvenation Pills, and alternate ultimates, defense, and healing.

### Tips

- Slot 0 is autosave; slots 1-3 are manual. Always save manually before bosses.
- Press M to open the world map and teleport to explored areas.
- Dying in normal battles halves your silver and loses 30% of potential. Sparring and master challenges have no death penalty.
- If stuck, use the F8 cheat panel. Naming your character `YOBDC` unlocks classic black-and-white mode with bonus resources.

## Saves

- localStorage key: `yxts-golden-save`
- Save version v2; old saves are migrated automatically and corrupted saves are quarantined

## Project Layout

```text
src/game/content  Pure data and story text
src/game/sim      Simulation rules and state
src/game/scenes   Phaser scenes
src/game/view     Procedural art and day/night logic
src/ui            DOM interface
scripts           Balance simulation and QA scripts
```
