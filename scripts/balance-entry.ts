// 平衡模拟入口：只导出 sim/content 纯逻辑，esbuild 打包后由 node 执行
export { newGame } from "../src/game/sim/state";
export { attackPower, defensePower, maxHp, maxMp, learnCost } from "../src/game/sim/formulas";
export {
  startBattle,
  playerAttack,
  playerUlt,
  playerDefend,
  playerItem,
  availableUts
} from "../src/game/sim/battle";
export { ENEMIES } from "../src/game/content/enemies";
export { NPCS } from "../src/game/content/npcs";
export { SKILLS } from "../src/game/content/skills";
