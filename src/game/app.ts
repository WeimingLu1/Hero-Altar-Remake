import Phaser from "phaser";
import {
  ENDINGS,
  HANG_TEXT,
  getNpcDialog,
  isQuestNpc,
  randomNpcChatDialog,
  randomNpcTalkDialog,
  randomBreakupText,
  randomRelationTalkText,
  randomRumor,
  randomTalkText,
  sparReaction
} from "./content/story";
import { AREAS } from "./content/areas";
import { ENEMIES, sparEnemyId } from "./content/enemies";
import { ITEMS, WEAPONS, ARMORS } from "./content/items";
import { NPCS } from "./content/npcs";
import { QUESTS } from "./content/quests";
import { ROMANCE } from "./content/romance";
import { SKILLS } from "./content/skills";
import type { GameState } from "./sim/state";
import { newGame, rollAttrs } from "./sim/state";
import { releaseLock, resolveSocialIntent } from "./sim/socialEngine";
import { randomObjectAction } from "./sim/objectLife";
import { masterSkill } from "./sim/traveler";
import { mutateRelation } from "./sim/relations";
import { useItemOnNpc, useItemOnObject } from "./sim/itemUse";
import type { BattleState } from "./sim/battle";
import {
  availableUts,
  playerAttack,
  playerDefend,
  playerFlee,
  playerItem,
  playerUlt,
  setJiali,
  startBattle,
  startIntimacyBattle
} from "./sim/battle";
import {
  acceptQuest,
  addItem,
  advanceTime,
  advanceQuest,
  buyArmor,
  buyItem,
  buyWeapon,
  completeQuest,
  countBeggarFood,
  giveBaiyuXiao,
  giveBaozi,
  giveJinfeng,
  giveMaobi,
  hangEnding,
  handleDeath,
  hasItem,
  joinSect,
  knownAreas,
  learnSkill,
  removeBeggarFood,
  removeItem,
  restAtInn,
  retreatSevenDays,
  rollChoiceEvent,
  rollRandomEvent,
  sellItem,
  travelTo,
  useItem,
  interactAction
} from "./sim/actions";
import type { EventScene } from "./sim/actions";
import { buyHouse, marry } from "./sim/actions";
import { clamp, maxHp, maxMp } from "./sim/formulas";
import * as cheat from "./sim/cheat";
import { autosave, clearSlot, hadCorruptSave, loadGame, saveGame, saveSlots } from "./sim/save";
import { setApp } from "./bus";
import { UIManager } from "../ui/UIManager";
import { BootScene } from "./scenes/BootScene";
import { WorldScene } from "./scenes/WorldScene";
import { BattleScene } from "./scenes/BattleScene";

export class App {
  state: GameState | null = null;
  ui: UIManager;
  game!: Phaser.Game;
  battle: BattleState | null = null;
  dialogNpc: string | null = null;
  world!: WorldScene;
  private battleExitTimer: number | null = null;
  private finishingBattle = false;
  private qteTimer: number | null = null;
  private pendingQteKind: "attack" | "ult" | null = null;
  private pendingQteUlt: string | null = null;

  constructor(root: HTMLElement) {
    this.ui = new UIManager(root);
    this.ui.setActionHandler((a) => this.handleAction(a));
    setApp(this);
    const gameRoot = root.querySelector("#game-root") as HTMLElement;
    this.game = new Phaser.Game({
      type: Phaser.CANVAS,
      parent: gameRoot,
      width: 960,
      height: 540,
      backgroundColor: "#0b0e14",
      pixelArt: true,
      preserveDrawingBuffer: true,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 960,
        height: 540
      },
      scene: [BootScene, WorldScene, BattleScene]
    });
    this.ui.showTitle();
    // 读一次存档索引：若数据损坏，readAll 会隔离备份并置 hadCorruptSave
    saveSlots();
    if (hadCorruptSave) this.toast("检测到损坏的存档，已隔离备份。");
  }

  handleAction(action: string): void {
    const s = this.state;
    switch (true) {
      case action === "title-new":
        this.ui.showCreate(rollAttrs());
        return;
      case action === "title-load":
        this.ui.showLoadScreen();
        return;
      case action === "title-about":
        this.ui.showAbout();
        return;
      case action === "title-back":
        this.ui.showTitle();
        return;
      case action === "roll-attrs":
        this.ui.showCreate(rollAttrs());
        return;
      case action === "create-ok": {
        this.createCharacter();
        return;
      }
      case action === "autosave":
        if (s) {
          autosave(s);
          this.toast("已自动存档。");
        }
        return;
      case action.startsWith("save:"):
        if (s) {
          saveGame(s, Number(action.split(":")[1]));
          this.toast(`已存入存档 ${action.split(":")[1]}。`);
          this.ui.showSaveLoad(s);
        }
        return;
      case action.startsWith("load:"):
        this.loadSlot(Number(action.split(":")[1]));
        return;
      case action.startsWith("clear:"):
        clearSlot(Number(action.split(":")[1]));
        this.ui.showSaveLoad(s);
        return;
      case action === "return-title":
        this.state = null;
        this.battle = null;
        this.game.scene.stop("World");
        this.game.scene.stop("Battle");
        this.ui.showTitle();
        return;
    }
    if (!s) return;
    const p = s.player;
    switch (true) {
      case action === "status":
        this.lastPanelAction = "status";
        this.ui.showStatus(s);
        return;
      case action === "bag":
        this.lastPanelAction = "bag";
        this.ui.showBag(s);
        return;
      case action === "skill":
        this.lastPanelAction = "skill";
        this.ui.showSkills(s);
        return;
      case action === "meditate":
        if (this.battle) {
          this.toast("战斗中不可打坐。");
        } else {
          this.world.toggleMeditate();
        }
        return;
      case action === "cheat":
        this.ui.showCheat(s);
        return;
      case action === "save":
        this.ui.showSaveLoad(s);
        return;
      case action === "ui-close":
        this.closeUi();
        return;
      case action === "shop":
        if (this.dialogNpc) this.ui.showShop(s, this.dialogNpc);
        return;
      case action === "learn":
        if (this.dialogNpc) this.ui.showLearn(s, this.dialogNpc);
        return;
      case action === "learnBasic":
        if (this.dialogNpc) this.ui.showLearn(s, this.dialogNpc);
        return;
      case action === "learnLiteracy":
        if (this.dialogNpc) this.ui.showLearn(s, this.dialogNpc);
        return;
      case action.startsWith("learn:"): {
        const [, id, lv] = action.split(":");
        const msg = learnSkill(s, id, Number(lv) || 1);
        this.toast(msg);
        this.refreshUi();
        return;
      }
      case action.startsWith("shop-buy"): {
        const parts = action.split(":");
        const qty = action.startsWith("shop-buy5") ? 5 : 1;
        const msg = buyItem(s, parts[1], qty);
        this.toast(msg);
        this.refreshUi();
        return;
      }
      case action.startsWith("shop-weapon:"): {
        const msg = buyWeapon(s, action.split(":")[1]);
        this.toast(msg);
        this.refreshUi();
        return;
      }
      case action.startsWith("shop-armor:"): {
        const msg = buyArmor(s, action.split(":")[1]);
        this.toast(msg);
        this.refreshUi();
        return;
      }
      case action.startsWith("shop-sell:"): {
        const msg = sellItem(s, action.split(":")[1]);
        this.toast(msg);
        this.refreshUi();
        return;
      }
      case action === "forge":
        this.ui.showForge(s);
        return;
      case action === "forge-tie" || action === "forge-xuan": {
        this.doForge(action === "forge-xuan");
        return;
      }
      case action === "rest": {
        const msg = restAtInn(s);
        this.toast(msg);
        this.refreshUi();
        this.maybeEvent("inn");
        return;
      }
      case action === "rest-panel":
        this.ui.showRest(s);
        return;
      case action === "retreat": {
        const msg = retreatSevenDays(s);
        this.toast(msg);
        this.refreshUi();
        this.maybeEvent("closed");
        return;
      }
      case action === "eat": {
        this.eatAtInn();
        return;
      }
      case action === "rumor": {
        this.toast("店小二压低声音：");
        this.ui.showDialog([
          { id: "r", speaker: "店小二", text: "店小二压低声音，凑过来说：" + randomRumor(s), opts: [] }
        ]);
        return;
      }
      case action === "map": {
        // M 只负责打开（关闭走 Esc/面板按钮）；引擎偶发双分发 keydown 时重复打开幂等
        this.lastPanelAction = "map";
        this.ui.showTravel(s);
        return;
      }
      case action.startsWith("travel:"): {
        const area = action.split(":")[1];
        if (area === "end" && !p.flags["endOpen"]) {
          this.toast("时空尽头尚未开启。");
          return;
        }
        if (!knownAreas(s).includes(area) && !(area === "end" && p.flags["endOpen"])) {
          this.toast("那里你尚未涉足，舆图上还没有这条路。");
          return;
        }
        const blocked = travelTo(s, area);
        if (blocked) {
          this.toast(blocked);
          return;
        }
        this.closeUi();
        this.world.refreshWithFade();
        this.toast(`你来到${AREAS[area]?.name || area}。`);
        this.maybeEvent("travel");
        return;
      }
      case action.startsWith("quest-accept:"): {
        const qid = action.split(":")[1];
        acceptQuest(s, qid);
        if (qid === "qSha") delete p.flags["zhaiTouDead"];
        if (qid === "qChuE") delete p.flags["eGuiDead"];
        if (qid === "qChuanShu") {
          // 县令交付三枚传书令，须分送三位掌门
          addItem(s, "chuanShiLing", 3);
          delete p.flags["shu-qingXu"];
          delete p.flags["shu-wangWeiYang"];
          delete p.flags["shu-baiRuiDe"];
          this.toast("县令双手奉上三枚火漆传书令：太极、八卦、雪山，一位掌门一枚，千万送到。");
        }
        this.toast("任务已接下，记入「任务与恩怨」。");
        this.refreshDialog();
        return;
      }
      case action.startsWith("quest-advance:"): {
        const [, id, stage] = action.split(":");
        if (id === "qMain" && stage === "1") {
          removeItem(s, "yaocai", 3);
          advanceQuest(s, id, 2);
        } else if (id === "qMain" && stage === "4") {
          addItem(s, "qingLongTu");
          advanceQuest(s, id, 5);
        } else if (id === "qMain" && stage === "6") {
          removeItem(s, "mixin");
          advanceQuest(s, id, 7);
        } else if (id === "qTieJiang" && stage === "0") {
          removeItem(s, "xuantie", 3);
          advanceQuest(s, id, 1);
        } else if (id === "qWudangDaily" && stage === "0") {
          if (!hasItem(s, "yaocai", 3)) {
            this.toast("药草不够三株。");
            return;
          }
          removeItem(s, "yaocai", 3);
          advanceQuest(s, id, 1);
        } else if (id === "qGaibangDaily" && stage === "0") {
          if (!removeBeggarFood(s, 2)) {
            this.toast("馒头、肉包子或烧鸡，任意凑够两份才行。");
            return;
          }
          advanceQuest(s, id, 1);
        } else {
          advanceQuest(s, id, stage === undefined ? undefined : Number(stage) + 1);
        }
        this.toast("任务有进展。");
        this.refreshDialog();
        return;
      }
      case action.startsWith("quest-complete:"): {
        const id = action.split(":")[1];
        if (id === "qXunWu") giveJinfeng(s);
        if (id === "qMain") {
          if (!p.items.mixin) {
            this.toast("你没有冷铁衣的密信。");
            return;
          }
          removeItem(s, "mixin");
        }
        if (id === "qShiKu") {
          if (!hasItem(s, "shiliao", 3)) {
            this.toast("石料不够三块。");
            return;
          }
          removeItem(s, "shiliao", 3);
          completeQuest(s, id);
          if (!p.accessoriesOwned.includes("baiYuFo")) p.accessoriesOwned.push("baiYuFo");
          this.toast("守墓老人把一尊白玉佛放进你手心：「戴上吧，佛祖看着你呢。」（获得饰品「白玉佛」）");
          this.ui.showDialog([
            {
              id: "r",
              speaker: "守墓老人",
              text: "墓碑补好了。老人抚着新砌的青石，缓缓道来：\n\n「这几座坟里的人，当年都和一个叫『青龙坛』的去处打过交道。青龙坛供的不是什么神仙，是一扇门——他们管那叫『时空尽头』。当年六派高人联手，才把那扇门的钥匙拆成六块石板，分镇六派。\n\n老朽守着他们，也是守着这个秘密。你今天修的是碑，说不定哪天，就要去补那扇门了。去吧，后生，路还长。」",
              opts: []
            }
          ]);
          this.refreshUi();
          return;
        }
        completeQuest(s, id);
        if (id === "qYunZhongHe" && !p.titles.includes("捕风者")) {
          p.titles.push("捕风者");
          this.toast("八百两赏银到手！江湖上从此称你——「捕风者」！");
        }
        this.toast("任务完成，奖励已到手。");
        this.refreshDialog();
        this.refreshUi();
        return;
      }
      case action.startsWith("quest-restart:"): {
        const id = action.split(":")[1];
        p.quests[id] = { stage: 0, done: false, repeat: (p.quests[id]?.repeat || 0) + 1 };
        p.task.popoWater = p.task.popoChop = p.task.popoSweep = 0;
        this.refreshDialog();
        return;
      }
      case action.startsWith("join-sect:"): {
        const msg = joinSect(s, action.split(":")[1]);
        this.toast(msg);
        this.refreshDialog();
        this.refreshUi();
        return;
      }
      case action.startsWith("challenge:"): {
        const npcId = action.split(":")[1];
        const enemyId = ENEMIES[npcId] ? npcId : null;
        if (enemyId) {
          this.closeUi();
          this.startBattle(enemyId, npcId);
        }
        return;
      }
      case action.startsWith("spar:"): {
        const npcId = action.split(":")[1];
        const enemyId = sparEnemyId(npcId);
        if (ENEMIES[enemyId]) {
          this.closeUi();
          this.startBattle(enemyId);
        }
        return;
      }
      case action === "get-shouChaoben":
        if (!p.items.shouChaoBen) {
          p.items.shouChaoBen = 1;
          p.flags["gotShouChaoBen"] = true;
          this.toast("你收下了神秘人赠予的手抄本。");
        }
        this.refreshDialog();
        return;
      case action === "get-shancha":
        p.flags["gotShancha"] = true;
        p.items.shanChaHua = (p.items.shanChaHua || 0) + 1;
        this.toast("阿绣把山茶花放进你手心，脸红了。");
        this.refreshDialog();
        return;
      case action === "like-axiu":
        p.affections.axiu = Math.min(100, (p.affections.axiu || 0) + 5);
        this.toast(`阿绣对你的好感提升了（${p.affections.axiu}）。`);
        this.refreshDialog();
        return;
      case action.startsWith("npc-chat:"): {
        const npcId = action.split(":")[1];
        if (NPCS[npcId]) this.ui.showDialog(randomNpcChatDialog(npcId, s));
        return;
      }
      case action.startsWith("npc-talk:"): {
        const npcId = action.split(":")[1];
        if (!NPCS[npcId]) return;
        if (isQuestNpc(npcId, s)) {
          const nodes = getNpcDialog(npcId, s);
          if (nodes) {
            this.ui.showDialog(nodes);
          } else {
            this.ui.showDialog(randomNpcTalkDialog(npcId, s));
          }
        } else {
          this.ui.showDialog(randomNpcTalkDialog(npcId, s));
        }
        return;
      }
      case action.startsWith("npc-status:"): {
        this.ui.showNpcStatus(action.split(":")[1], s);
        return;
      }
      case action.startsWith("social-menu:"): {
        const npcId = action.split(":")[1];
        if (NPCS[npcId]) this.ui.showSocialMenu(npcId, s);
        return;
      }
      case action.startsWith("npc-item:"): {
        const npcId = action.split(":")[1];
        if (NPCS[npcId]) this.ui.showNpcItemUse(npcId, s);
        return;
      }
      case action.startsWith("use-item-npc:"): {
        const parts = action.split(":");
        const npcId = parts[1];
        const itemId = parts.slice(2).join(":");
        if (!NPCS[npcId] || !ITEMS[itemId]) return;
        const text = useItemOnNpc(s, npcId, itemId);
        this.ui.showNarrative(text);
        this.world.showPlayerFloating(text);
        this.world.showNpcApproach(npcId, text);
        this.refreshUi();
        this.ui.showNpcItemUse(npcId, s);
        return;
      }
      case action.startsWith("social-intent:"): {
        const [, npcId, intent] = action.split(":");
        if (!NPCS[npcId] || !["talk", "kind", "hostile"].includes(intent)) return;
        const res = resolveSocialIntent(s, npcId, intent as "talk" | "kind" | "hostile");
        mutateRelation(s, "player", npcId, res.deltas, res.text.slice(0, 42));
        releaseLock(s.world, "player", npcId);
        this.ui.closePanels();
        this.ui.showNarrative(res.text);
        this.world.showPlayerFloating(res.text.split("\n")[0]);
        if (res.battle) {
          this.startBattle(res.battle, npcId);
          return;
        }
        this.world.showNpcApproach(npcId, res.text);
        if (res.panel) {
          this.dialogNpc = npcId;
          this.ui.dialogNpc = npcId;
          this.ui.showDialog([
            {
              id: "r",
              speaker: NPCS[npcId].name,
              text: res.text,
              opts: [{ text: "好", action: res.panel === "shop" ? "shop" : res.panel === "learn" ? "learn" : "forge" }]
            }
          ]);
          return;
        }
        this.refreshUi();
        return;
      }
      case action.startsWith("npc-initiates:"): {
        const npcId = action.split(":")[1];
        if (!NPCS[npcId]) return;
        const intents = ["talk", "kind", "hostile"] as const;
        const res = resolveSocialIntent(s, npcId, intents[Math.floor(Math.random() * intents.length)]);
        mutateRelation(s, "player", npcId, res.deltas, res.text.slice(0, 42));
        releaseLock(s.world, "player", npcId);
        if (res.battle && Math.random() < 0.4) {
          this.ui.closePanels();
          this.startBattle(res.battle, npcId);
          return;
        }
        this.ui.showNarrative(`${NPCS[npcId].name}走了过来。\n${res.text}`);
        this.world.showPlayerFloating(res.text.split("\n")[0]);
        this.world.showNpcApproach(npcId, res.text);
        return;
      }
      case action.startsWith("master-skill:"): {
        const id = action.split(":")[1];
        if (masterSkill(s, id)) {
          this.toast(`你已通过穿越者天书记住并掌握了「${SKILLS[id].name}」。`);
        }
        this.refreshUi();
        this.ui.showCheat(s);
        return;
      }
      case action.startsWith("romance-menu:"): {
        const npcId = action.split(":")[1];
        const npc = NPCS[npcId];
        if (!npc) return;
        if (!npc.gender || npc.gender === p.gender) {
          this.toast("情缘只存在于异性之间。");
          return;
        }
        this.ui.showRomanceMenu(npcId, s);
        return;
      }
      case action.startsWith("romance-gift:"): {
        const npcId = action.split(":")[1];
        const npc = NPCS[npcId];
        if (!npc || !npc.gender || npc.gender === p.gender) {
          this.toast("情缘只存在于异性之间。");
          return;
        }
        this.ui.showGiftPanel(npcId, s);
        return;
      }
      case action.startsWith("romance-give:"): {
        const [, npcId, item] = action.split(":");
        const npc = NPCS[npcId];
        if (!npc || !npc.gender || npc.gender === p.gender) {
          this.toast("情缘只存在于异性之间。");
          return;
        }
        const rom = ROMANCE[npcId];
        const gift = rom?.gifts.find((g) => g.item === item);
        if (!rom || !gift || (p.items[item] || 0) <= 0) {
          this.toast("这份礼物现在拿不出来。");
          return;
        }
        removeItem(s, item);
        const aff = Math.min(100, (p.affections[npcId] || 0) + gift.value);
        p.affections[npcId] = aff;
        this.toast(gift.text);
        this.refreshUi();
        this.ui.showGiftPanel(npcId, s);
        return;
      }
      case action.startsWith("romance-talk:"): {
        const npcId = action.split(":")[1];
        const npc = NPCS[npcId];
        if (!npc) return;
        if (!npc.gender || npc.gender === p.gender) {
          this.toast("情缘只存在于异性之间。");
          return;
        }
        const aff = Math.min(100, (p.affections[npcId] || 0) + 3);
        p.affections[npcId] = aff;
        const partner = !!p.flags[`partner-${npcId}`];
        const pet = partner
          ? npc.gender === "female"
            ? "相公"
            : "娘子"
          : "";
        const relKind = partner
          ? "partner"
          : p.flags[`casual-${npcId}`]
            ? "casual"
            : aff >= 50
              ? "close"
              : null;
        const text = pet
          ? `${pet}，` + (relKind ? randomRelationTalkText(relKind) : randomTalkText())
          : relKind
            ? randomRelationTalkText(relKind)
            : randomTalkText();
        this.ui.closePanels();
        this.ui.showDialog([
          { id: "r", speaker: npc.name, text, opts: [] }
        ]);
        this.toast(`你与${npc.name}说了些体己话，好感 +3（${aff}）。`);
        this.refreshUi();
        return;
      }
      case action.startsWith("romance-intimacy:"): {
        const npcId = action.split(":")[1];
        const npc = NPCS[npcId];
        if (!npc) return;
        if (!npc.gender || npc.gender === p.gender) {
          this.toast("情缘只存在于异性之间。");
          return;
        }
        if ((npc.age ?? 18) < 16) {
          this.toast("对方年纪尚小，此事不可。");
          return;
        }
        const aff = p.affections[npcId] || 0;
        const married = p.spouse === npc.name;
        if (p.age < 16) {
          this.toast(`你今年才 ${p.age} 岁，年纪尚小。可在客栈「闭关七日」快快长大，或去作弊器里调龄。`);
          return;
        }
        if (aff < (married ? 40 : 60)) {
          this.toast(married ? "她（他）今日兴致不高，多陪陪再说。" : "你们还未亲近到那一步，先把好感养到 60 以上。");
          return;
        }
        p.lastIntimacyDay = p.time.day;
        p.flags[`everIntimate-${npcId}`] = true;
        p.flags[`intimate-${npcId}`] = true;
        p.flags[`partner-${npcId}`] = true;
        advanceTime(s, 8);
        this.ui.closePanels();
        this.startIntimacyBattle(npcId);
        return;
      }
      case action.startsWith("romance-breakup:"): {
        const npcId = action.split(":")[1];
        const npc = NPCS[npcId];
        if (!npc) return;
        if (!p.flags[`partner-${npcId}`]) {
          this.toast("你们尚未结为道侣，谈不上分道扬镳。");
          return;
        }
        p.affections[npcId] = 0;
        delete p.flags[`partner-${npcId}`];
        delete p.flags[`intimate-${npcId}`];
        if (p.spouse === npc.name) {
          p.married = false;
          p.spouse = null;
        }
        this.ui.closePanels();
        this.ui.showDialog([
          { id: "r", speaker: npc.name, text: "「" + randomBreakupText() + "」", opts: [] }
        ]);
        this.toast(`你与${npc.name}分道扬镳，好感已归零。`);
        this.refreshUi();
        return;
      }
      case action.startsWith("romance-steal:"): {
        const npcId = action.split(":")[1];
        const rom = ROMANCE[npcId];
        if (!rom || rom.gender !== "female") return;
        const npc = NPCS[npcId];
        if (!npc) return;
        if (p.gender !== "male") {
          this.toast("偷香是女儿家的私事，你一个姑娘家，还是去寻些正经营生吧。");
          return;
        }
        if ((npc.age ?? 18) < 16) {
          this.toast("对方年纪尚小，此事不可。");
          return;
        }
        if (p.age < 16) {
          this.toast(`你今年才 ${p.age} 岁，年纪尚小。可在客栈「闭关七日」快快长大，或去作弊器里调龄。`);
          return;
        }
        if (p.spouse === npc.name) {
          this.toast("枕边人面前，不必偷香；你们早已相守。");
          return;
        }
        this.ui.closePanels();
        this.ui.showDialog([
          {
            id: "r",
            speaker: npc.name,
            text: `夜色正浓，你叩了叩${npc.name}的窗。\n\n窗纸后静了片刻，灯影一晃，门闩轻轻拨开——\n\n「……就今晚。」`,
            opts: [
              { text: "应邀入内", action: `steal-confirm:${npcId}` },
              { text: "改日再来", action: "ui-close" }
            ]
          }
        ]);
        return;
      }
      case action.startsWith("steal-confirm:"): {
        const npcId = action.split(":")[1];
        if (!ROMANCE[npcId]) return;
        const npc = NPCS[npcId];
        if (!npc || p.gender !== "male" || (npc.age ?? 18) < 16 || p.age < 16 || p.spouse === npc.name) return;
        advanceTime(s, 8);
        this.ui.closePanels();
        this.startIntimacyBattle(npcId, true);
        return;
      }
      case action === "give-baozi": {
        const msg = giveBaozi(s);
        this.toast(msg);
        this.refreshDialog();
        return;
      }
      case action === "give-maobi": {
        const msg = giveMaobi(s);
        this.toast(msg);
        this.refreshDialog();
        return;
      }
      case action === "give-baiyuxiao": {
        const msg = giveBaiyuXiao(s);
        this.toast(msg);
        this.refreshDialog();
        return;
      }
      case action === "event-qipo-give": {
        if (p.money < 10) {
          this.toast("你摸遍全身，连十两碎银都凑不出。");
          return;
        }
        p.money -= 10;
        p.moral = clamp(p.moral + 2, -100, 100);
        if (Math.random() < 0.1) {
          p.potential += 50;
          p.exp += 30;
          this.eventOut(
            "老乞婆千恩万谢，颤巍巍从怀里摸出半张残页塞给你：「恩人，这个老婆子留着也没用……」\n\n残页上是几行口诀。（善恶 +2，潜能 +50，经验 +30）"
          );
        } else {
          this.eventOut("老乞婆千恩万谢，一瘸一拐地走了。你看着她的背影，心里踏实。（善恶 +2）");
        }
        return;
      }
      case action === "event-qipo-ignore":
        this.eventOut("老乞婆叹了口气，缩回墙角。你走出几步，又忍不住回头看了一眼。");
        return;
      case action === "event-shenyao-buy": {
        if (p.money < 50) {
          this.toast("五十两？你囊中羞涩。");
          return;
        }
        p.money -= 50;
        if (Math.random() < 0.4) {
          addItem(s, "daHuan");
          this.eventOut("回去一验——竟然真是大还丹！那商贩这回竟没骗人。（获得「大还丹」）");
        } else {
          p.hp = Math.max(1, p.hp - Math.floor(p.effHp * 0.15));
          this.eventOut("丹药下肚，腹中绞痛——假药！你蹲在路边缓了半天。（气血受损）");
        }
        return;
      }
      case action === "event-shenyao-leave":
        this.eventOut("你走出老远，还听见他在后面喊：「三十两也行！」");
        return;
      case action === "event-zuihan-fight": {
        if (Math.random() < 0.5) {
          p.exp += 40;
          addItem(s, "huangjiu");
          this.eventOut("三个回合，你把他按在地上。他服了，非把怀里的酒葫芦塞给你赔罪。（经验 +40，获得「黄酒」）");
        } else {
          p.hp = Math.max(1, p.hp - Math.floor(p.effHp * 0.1));
          p.potential += 20;
          this.eventOut("他一个踉跄撞进你怀里，你摔了个四脚朝天。这一跤，倒摔出几分醉拳的韵味。（气血受损，潜能 +20）");
        }
        return;
      }
      case action === "event-zuihan-go":
        this.eventOut("你侧身让过，他冲你背影喊：「胆小鬼——嗝！」");
        return;
      case action === "event-shusheng-help": {
        p.moral = clamp(p.moral + 3, -100, 100);
        this.eventOut("你把外衣披在他肩上。书生抬起头，眼眶通红，深深一揖到地。（善恶 +3）\n\n你打了个寒战，心里却是暖的。");
        return;
      }
      case action === "event-shusheng-ignore": {
        p.moral = clamp(p.moral - 1, -100, 100);
        this.eventOut("你径自走过。身后的读书声停了一瞬，又低低地响起来。（善恶 -1）");
        return;
      }
      case action === "event-baotu-buy": {
        if (p.money < 30) {
          this.toast("三十两？你囊中羞涩。");
          return;
        }
        p.money -= 30;
        if (Math.random() < 0.3) {
          addItem(s, "tiekuang", 2);
          this.eventOut("按图寻去，竟真从老槐树下刨出两块铁矿石！那货郎竟没骗人。（获得「铁矿石」×2）");
        } else {
          this.eventOut("图上画着一只乌龟，旁边一行小字：『认真你就输了』。");
        }
        return;
      }
      case action === "event-baotu-leave":
        this.eventOut("货郎也不恼，卷起羊皮哼着小曲走了。");
        return;
      case action === "xiaoyao-grant": {
        if (!p.flags["xiaoyao"] || p.flags["xiaoyaoDone"]) {
          this.toast("老者摆了摆手：机缘未到。");
          return;
        }
        p.flags["xiaoyaoDone"] = true;
        p.flags["learned-xiaoyaoXinfa"] = true;
        p.skills.xiaoyaoXinfa = Math.max(p.skills.xiaoyaoXinfa || 0, 80);
        if (!p.neigong) p.neigong = "xiaoyaoXinfa";
        if (!p.titles.includes("逍遥散人")) p.titles.push("逍遥散人");
        this.ui.showDialog([
          {
            id: "r",
            speaker: "无名老者",
            text: "老者接过三本秘籍，只翻了三页，忽然抚须长叹：\n\n「猛虎、惊天、醉仙——三路人马，殊途同归。你不拜师、不立派，一个人把这三本书啃下来，老夫等了几十年，等的就是你这样的人。」\n\n他并指如剑，在你眉心轻轻一点：「拿去，这是老夫晚年所悟的『逍遥心法』，配以绝招『逍遥游』。无所待于天地，方为逍遥。\n\n从今往后，江湖上叫你——逍遥散人。」",
            opts: [{ text: "拜谢老丈", node: "bye" }]
          },
          { id: "bye", speaker: "无名老者", text: "老者重新眯起眼晒太阳，仿佛什么都没发生过。", opts: [] }
        ]);
        this.toast("你领悟了「逍遥心法」（80 级），悟出绝招「逍遥游」！获得称号「逍遥散人」。");
        this.refreshUi();
        return;
      }
      case action === "heal-langzhong": {
        if (p.money < 20) {
          this.toast("二十两诊金都掏不出，郎中摇着串铃走开了。");
          return;
        }
        p.money -= 20;
        p.hp = p.effHp = maxHp(p);
        p.mp = maxMp(p);
        p.poison = 0;
        this.toast("郎中三根手指往你腕上一搭，开方、行针、灌药一气呵成。你顿觉百骸俱暖，伤病尽去。");
        this.refreshUi();
        return;
      }
      case action === "give-luopo-wine": {
        if (!hasItem(s, "huangjiu")) {
          this.toast("没有黄酒。茶棚和客栈都有得卖。");
          return;
        }
        removeItem(s, "huangjiu");
        const cur = p.skills.jibenDao || 0;
        if (cur >= 150) {
          p.potential += 30;
          this.toast("刀客灌了口酒，摆手道：你的刀理已通，我教不动了。这顿酒，换成几句江湖经验吧。（潜能 +30）");
        } else {
          const to = Math.min(150, cur + 8);
          p.skills.jibenDao = to;
          if (!p.flags["luopoTaught"]) {
            p.flags["luopoTaught"] = true;
            p.potential += 30;
            this.ui.showDialog([
              {
                id: "r",
                speaker: "落魄刀客",
                text: "他接过酒壶灌了一大口，眼睛忽然亮了，反手抽出腰间那口雪亮的刀：\n\n「看好了——刀不是这么握的，是这么『让』它自己走。」\n\n刀光在他指间转了个花，又稳稳归鞘。「我教你的不是招式，是当年拿命换来的手感。基本刀法，回去照着练。」",
                opts: []
              }
            ]);
            this.toast(`基本刀法提升至 ${to} 级，另有所悟（潜能 +30）。`);
          } else {
            this.toast(`刀客喝得痛快，又指点了你几手刀法（基本刀法 ${to} 级）。`);
          }
        }
        this.refreshDialog();
        this.refreshUi();
        return;
      }
      case action === "taohun-help": {
        const qt = p.quests.qTaoHun;
        if (!qt || qt.done || qt.stage !== 0) return;
        p.flags["taohun-branchA"] = true;
        advanceQuest(s, "qTaoHun", 1);
        this.ui.showDialog([
          {
            id: "r",
            speaker: "逃婚少女阿沅",
            text: "「真的？！」她眼泪一下子涌出来，深深福了下去，「恩公大恩，阿沅没齿难忘！\n\n我听你的，这就动身——劳恩公护我到百花谷，听说过了谷口，就没人敢撒野了。」",
            opts: []
          }
        ]);
        this.refreshUi();
        return;
      }
      case action === "taohun-report": {
        const qt = p.quests.qTaoHun;
        if (!qt || qt.done || qt.stage !== 0) return;
        advanceQuest(s, "qTaoHun", 2);
        this.ui.showDialog([
          {
            id: "r",
            speaker: "逃婚少女阿沅",
            text: "你劝她：逃得了一时，逃不了一世；婚事可以回去当面回绝，报官备案，叫那富商不敢强求。\n\n她低着头想了很久，终于点了点头：「……你说得对。我回去把话说清楚。少侠，官府那边，劳你替我递个话，也叫他们别再把这事当拐案办了。」",
            opts: []
          }
        ]);
        this.refreshUi();
        return;
      }
      case action === "taohun-report-done": {
        const qt = p.quests.qTaoHun;
        if (!qt || qt.done || qt.stage !== 2) return;
        qt.done = true;
        qt.stage = 0;
        p.money += 200;
        p.exp += 60;
        p.moral = clamp(p.moral - 5, -100, 100);
        this.ui.showDialog([
          {
            id: "r",
            speaker: "捕快",
            text: "「原来如此，人自己回去了就好。」捕快松了口气，撇了撇嘴，「那富商倒是大方，谢仪二百两，说是官府办案得力——你跑的这一趟，分你一半。\n\n只是……」他压低声音，「镇上有人说你多管闲事，也有人说你拆人姻缘。唉，这差事办的，名声总归是两面。（得银 200 两，经验 +60，善恶 -5）」",
            opts: []
          }
        ]);
        this.refreshUi();
        return;
      }
      case action.startsWith("deliver-shu:"): {
        const npcId = action.split(":")[1];
        if (!hasItem(s, "chuanShiLing")) {
          this.toast("传书令不在身上。");
          return;
        }
        if (p.flags[`shu-${npcId}`]) {
          this.toast("这位掌门已经送达过了。");
          return;
        }
        removeItem(s, "chuanShiLing");
        p.flags[`shu-${npcId}`] = true;
        p.money += 100;
        p.exp += 80;
        const npcName = NPCS[npcId]?.name || "掌门";
        const done = ["qingXu", "wangWeiYang", "baiRuiDe"].filter((id) => p.flags[`shu-${id}`]).length;
        this.toast(`${npcName}拆阅传书令，颔首收下。官府回执到手：银 +100，经验 +80（已送达 ${done}/3）。`);
        if (done >= 3) {
          completeQuest(s, "qChuanShu");
          this.toast("三枚传书令全部送达！回县衙看看县令的笑脸吧。（善恶 +5）");
        }
        this.refreshDialog();
        this.refreshUi();
        return;
      }
      case action.startsWith("store:"): {
        const id = action.split(":")[1];
        if ((p.items[id] || 0) <= 0) return;
        removeItem(s, id);
        p.storage[id] = (p.storage[id] || 0) + 1;
        this.refreshUi();
        return;
      }
      case action.startsWith("take:"): {
        const id = action.split(":")[1];
        if ((p.storage[id] || 0) <= 0) return;
        p.storage[id] -= 1;
        if (p.storage[id] <= 0) delete p.storage[id];
        addItem(s, id);
        this.refreshUi();
        return;
      }
      case action === "open-end":
        if ((p.items.sanJiaoBan || 0) >= 6) {
          p.flags["endOpen"] = true;
          advanceQuest(s, "qMain", 8);
          this.toast("六块石板齐齐发光，通往时空尽头的大门缓缓开启。");
        } else {
          this.toast("还差几块三角石板。");
        }
        this.refreshDialog();
        return;
      case action.startsWith("boss:"): {
        const enemyId = action.split(":")[1];
        if (ENEMIES[enemyId]) {
          this.closeUi();
          this.startBattle(enemyId);
        }
        return;
      }
      case action.startsWith("fight:"): {
        const enemyId = action.split(":")[1];
        if (ENEMIES[enemyId]) {
          this.closeUi();
          this.startBattle(enemyId);
        }
        return;
      }
      case action === "buy-house": {
        const msg = buyHouse(s);
        this.toast(msg);
        this.refreshUi();
        return;
      }
      case action === "marry": {
        const msg = marry(s);
        this.toast(msg);
        this.refreshUi();
        return;
      }
      case action === "shrine": {
        if (p.area === "end" && p.flags["endOpen"]) {
          this.finalBossChoice();
        } else if (p.area === "wudang" && p.x > 900) {
          this.ui.showDialog([
            {
              id: "r",
              speaker: "桃花源小筑",
              text: p.house
                ? "推开柴门，院子里还晾着你上次晒的衣裳。这是你的家。"
                : "一座三进的小院，院中有桃树，屋后有山泉。挂牌写着：桃花源小筑，价银两千两。",
              opts: p.house
                ? [{ text: "歇一歇", action: "house-rest" }]
                : [
                    { text: "买下这座小筑", action: "buy-house" },
                    { text: "再看看", node: "bye" }
                  ]
            },
            { id: "bye", speaker: "桃花源小筑", text: "山风吹过桃树，叶子沙沙作响。", opts: [] }
          ]);
        } else {
          this.ui.showDialog([
            { id: "r", speaker: "石壁", text: "石壁上刻着一行旧字：功夫再好，也不过是人。", opts: [] }
          ]);
        }
        return;
      }
      case action === "house-rest":
        // 家就是家：桃花源小筑卧榻免费全恢复
        p.hp = p.effHp = maxHp(p);
        p.mp = maxMp(p);
        p.poison = 0;
        p.hunger = clamp(p.hunger + 20, 0, 100);
        p.thirst = clamp(p.thirst + 20, 0, 100);
        advanceTime(s, 6);
        this.toast("你在自己家里踏踏实实睡了一觉，醒来气血尽复，窗外正有鸟叫。");
        this.refreshUi();
        return;
      case action === "tree": {
        const msg = interactAction(s, "tree");
        if (msg === "tree") {
          this.ui.showDialog([
            {
              id: "r",
              speaker: "歪脖树",
              text: "你把麻绳甩上枝桠，打了个结。\n\n真的要这样么？",
              opts: [
                { text: "一了百了", action: "hang" },
                { text: "……还是算了", node: "bye" }
              ]
            },
            { id: "bye", speaker: "歪脖树", text: "你解开绳结，长出一口气。风把树上的名字吹得哗哗响。", opts: [] }
          ]);
        } else {
          this.toast(msg);
        }
        return;
      }
      case action === "hang":
        hangEnding(s);
        this.ui.showEnding(HANG_TEXT, "歪脖树");
        this.closeUi();
        return;
      case action.startsWith("use:"): {
        const msg = useItem(s, action.split(":")[1]);
        this.toast(msg);
        this.refreshUi();
        return;
      }
      case action.startsWith("env-item:"): {
        const id = action.split(":")[1];
        if (ITEMS[id]) this.ui.showEnvTargets(id, s);
        return;
      }
      case action.startsWith("use-item-env:"): {
        const parts = action.split(":");
        const itemId = parts[1];
        const objId = parts.slice(2).join(":");
        const obj = s.world.dynamicObjects.find((o) => o.id === objId);
        if (!ITEMS[itemId] || !obj) return;
        const text = useItemOnObject(s, itemId, obj);
        this.ui.showNarrative(text);
        this.world.showPlayerFloating(text);
        this.world.syncDynamicObjects();
        this.refreshUi();
        this.ui.showEnvTargets(itemId, s);
        return;
      }
      case action.startsWith("drop:"): {
        const id = action.split(":")[1];
        removeItem(s, id);
        this.refreshUi();
        return;
      }
      case action.startsWith("equip-weapon:"): {
        const id = action.split(":")[1];
        if (p.weaponsOwned.includes(id)) {
          p.forgeEquipped = false;
          p.weapon = id;
          this.toast(`你装备了「${WEAPONS[id]?.name || id}」。`);
        }
        this.refreshUi();
        return;
      }
      case action === "unequip-weapon":
        p.forgeEquipped = false;
        p.weapon = "fist";
        this.toast("你收起了兵器，赤手空拳。");
        this.refreshUi();
        return;
      case action === "equip-forge":
        if (p.forgeWeapon) {
          p.forgeEquipped = true;
          this.toast(`你装备了亲手打造的「${p.forgeWeapon.name}」。`);
        }
        this.refreshUi();
        return;
      case action.startsWith("equip-armor:"): {
        const id = action.split(":")[1];
        if (p.armorsOwned.includes(id)) {
          p.armor = id;
          this.toast(`你穿上了「${ARMORS[id]?.name || id}」。`);
        }
        this.refreshUi();
        return;
      }
      case action === "unequip-armor":
        p.armor = "none";
        this.toast("你脱下了护甲。");
        this.refreshUi();
        return;
      case action.startsWith("equip-accessory:"): {
        const id = action.split(":")[1];
        if (p.accessoriesOwned.includes(id)) {
          p.accessory = id;
          this.toast(`你佩戴了「${ARMORS[id]?.name || id}」。`);
        }
        this.refreshUi();
        return;
      }
      case action === "unequip-accessory":
        p.accessory = "noneAcc";
        this.toast("你取下了饰品。");
        this.refreshUi();
        return;
      case action === "water" || action === "chop" || action === "sweep": {
        this.doChore(action);
        return;
      }
      case action === "rest2":
      case action === "desk":
      case action === "chest": {
        if (action === "chest" && p.room === "taohua") {
          this.lastPanelAction = "storage";
          this.ui.showStorage(s);
          return;
        }
        const msg = interactAction(s, action);
        this.toast(msg || "这里没什么特别的。");
        return;
      }
      case action === "well":
      case action === "mine":
      case action === "herb": {
        const msg = interactAction(s, action);
        this.toast(msg);
        this.refreshUi();
        return;
      }
      case action === "look": {
        const msg = interactAction(s, "look");
        this.toast(msg);
        return;
      }
      case action === "sign": {
        this.ui.showTravel(s);
        return;
      }
      case action === "crack": {
        if ((p.skills.jibenQingGong || 0) < 30) {
          this.toast("裂缝幽深陡峭，基本轻功 30 级以上方可攀下。");
        } else {
          this.ui.showDialog([
            {
              id: "r",
              speaker: "深不见底的裂缝",
              text: "你提气轻身，沿壁攀下数十丈。下方黑得连火把都照不透，只听见幽幽风声，像极远处有人低语。\n\n石壁上留着几道深深的抓痕，五趾分明，像是某种鹤爪功夫——守墓老人说过，采花大盗云中鹤的老巢，据说就藏在这地底深处的什么地方。\n\n再往下黑得没了路，且待日后再探。",
              opts: []
            }
          ]);
        }
        return;
      }
      case action === "meditate2":
      case action === "meditate3":
        this.world.toggleMeditate();
        return;
      case action.startsWith("qte-key:"): {
        if (this.battle?.qteActive) {
          const key = action.split(":")[1]?.toUpperCase();
          if (key && key === this.battle.qteKey) this.resolveQte(true);
          else this.ui.flashQteError();
        }
        return;
      }
      case action === "qte-timeout":
        this.resolveQte(false);
        return;
      case action === "battle-attack":
        if (this.battle && !this.battle.over && !this.battle.qteActive) this.startQte("attack");
        return;
      case action.startsWith("battle-ult:"): {
        if (this.battle && !this.battle.over && !this.battle.qteActive) {
          const ultId = action.split(":")[1];
          const ult = availableUts(s).find((u) => u.id === ultId);
          if (ult) this.startQte("ult", ultId);
        }
        return;
      }
      case action === "battle-ult-menu":
        if (this.battle && !this.battle.over) {
          this.showUltMenu();
        }
        return;
      case action === "battle-defend":
        if (this.battle) {
          this.battle.log = [...this.battle.log, ...playerDefend(this.battle, s)].slice(-60);
          this.ui.showCombat(s, this.battle);
          this.scheduleBattleExit();
        }
        return;
      case action === "battle-item-menu":
        if (this.battle && !this.battle.over) this.showBattleItems(s);
        return;
      case action.startsWith("battle-item:"):
        if (this.battle) {
          this.battle.log = [...this.battle.log, ...playerItem(this.battle, s, action.split(":")[1])].slice(-60);
          this.ui.showCombat(s, this.battle);
          this.scheduleBattleExit();
        }
        return;
      case action === "battle-flee":
        if (this.battle) {
          this.battle.log = [...this.battle.log, ...playerFlee(this.battle, s)].slice(-60);
          this.ui.showCombat(s, this.battle);
          this.scheduleBattleExit();
        }
        return;
      case action.startsWith("battle-jiali:"):
        if (this.battle) setJiali(this.battle, Number(action.split(":")[1]));
        return;
      case action === "battle-close":
        this.finishBattle();
        return;
      case action.startsWith("cheat-"): {
        this.handleCheat(action, s);
        return;
      }
      case action === "ending-continue":
        this.ui.el("ending").classList.add("hidden");
        this.world.refresh();
        return;
      default:
        return;
    }
  }

  private createCharacter(): void {
    const nameInput = this.ui.q("#c-name") as HTMLInputElement;
    const genderInput = this.ui.q("#c-gender") as HTMLSelectElement;
    let name = nameInput.value.trim() || "小虾米";
    const yobdc = name.toUpperCase() === "YOBDC";
    if (yobdc) name = "无名侠客";
    const a = rollAttrs();
    const state = newGame(name, genderInput.value as "male" | "female", a);
    if (yobdc) {
      state.player.yobdc = true;
      state.player.potential = 9999;
      state.player.money = 9999;
    }
    this.state = state;
    autosave(state);
    this.startWorld();
    this.toast(yobdc ? "咒语应验：神功初成，银钱盈库。" : `少侠${name}，欢迎来到平安镇。`);
  }

  private loadSlot(n: number): void {
    const s = loadGame(n);
    if (!s) {
      this.toast("这个存档是空的。");
      return;
    }
    this.state = s;
    this.startWorld();
    this.toast(`已读取 ${s.player.name} 的江湖档案。`);
  }

  startWorld(): void {
    const s = this.state;
    if (!s) return;
    this.ui.el("title").classList.add("hidden");
    this.ui.el("title").innerHTML = "";
    this.ui.el("ending").classList.add("hidden");
    this.ui.closePanels();
    this.game.scene.start("World");
    this.ui.showHud(s);
    this.ui.showDock(true);
    this.applyClassicFilter();
  }

  startBattle(enemyId: string, sourceNpc?: string): void {
    const s = this.state;
    if (!s) return;
    this.battle = startBattle(s, enemyId, sourceNpc);
    this.ui.closePanels();
    this.ui.showCombat(s, this.battle);
    const theme = AREAS[s.player.area]?.theme || "town";
    // 进战斗转场：世界相机淡出后开战，BattleScene 自行淡入
    const cam = this.game.scene.getScene("World")?.cameras?.main;
    if (cam) cam.fadeOut(200, 0, 0, 0);
    const battle = this.battle;
    setTimeout(() => {
      if (this.battle === battle) this.game.scene.start("Battle", { battle, theme });
    }, 210);
  }

  private startIntimacyBattle(npcId: string, casual = false): void {
    const s = this.state;
    if (!s) return;
    this.battle = startIntimacyBattle(s, npcId, casual);
    this.ui.closePanels();
    this.ui.showCombat(s, this.battle);
    const cam = this.game.scene.getScene("World")?.cameras?.main;
    if (cam) cam.fadeOut(200, 0, 0, 0);
    const battle = this.battle;
    setTimeout(() => {
      if (this.battle === battle) this.game.scene.start("Battle", { battle, theme: "room" });
    }, 210);
  }

  private randomQteKey(): string {
    const keys = ["A", "S", "D", "F", "J", "K", "L", "W"];
    return keys[Math.floor(Math.random() * keys.length)];
  }

  // QTE 微操：攻击/绝招前约 75% 概率弹出随机字母，按对后大幅强化本次出招
  private startQte(kind: "attack" | "ult", ultId?: string): void {
    if (!this.battle || this.battle.over || this.battle.qteActive) return;
    if (Math.random() < 0.25) {
      this.doBattleAction(kind, false, ultId);
      return;
    }
    this.battle.qteActive = true;
    this.battle.qteKey = this.randomQteKey();
    this.battle.qteSuccess = false;
    this.pendingQteKind = kind;
    this.pendingQteUlt = ultId || null;
    this.ui.showQte(this.battle.qteKey);
    if (this.qteTimer) clearTimeout(this.qteTimer);
    this.qteTimer = window.setTimeout(() => this.resolveQte(false), 1800);
  }

  private resolveQte(success: boolean): void {
    if (this.qteTimer) {
      clearTimeout(this.qteTimer);
      this.qteTimer = null;
    }
    const b = this.battle;
    if (!b || !b.qteActive) return;
    b.qteActive = false;
    b.qteSuccess = success;
    if (success) b.qteStreak = Math.min(5, b.qteStreak + 1);
    else b.qteStreak = 0;
    this.ui.hideQte();
    const kind = this.pendingQteKind;
    const ultId = this.pendingQteUlt;
    this.pendingQteKind = null;
    this.pendingQteUlt = null;
    if (kind) this.doBattleAction(kind, success, ultId);
  }

  private doBattleAction(kind: "attack" | "ult", qteSuccess: boolean, ultId?: string | null): void {
    const s = this.state;
    if (!s || !this.battle || this.battle.over) return;
    if (kind === "attack") {
      const b = this.battle;
      const ults = availableUts(s).filter((u) => u.kind === "attack" && u.cost <= b.player.mp);
      if (ults.length && Math.random() < 0.45) {
        const ult = ults[Math.floor(Math.random() * ults.length)];
        this.battle.log = [...this.battle.log, ...playerUlt(this.battle, s, ult, qteSuccess)].slice(-60);
      } else {
        this.battle.log = [...this.battle.log, ...playerAttack(this.battle, s, qteSuccess)].slice(-60);
      }
    } else if (kind === "ult" && ultId) {
      const ult = availableUts(s).find((u) => u.id === ultId);
      if (ult) this.battle.log = [...this.battle.log, ...playerUlt(this.battle, s, ult, qteSuccess)].slice(-60);
    }
    this.ui.showCombat(s, this.battle);
    this.scheduleBattleExit();
  }

  finishBattle(): void {
    if (this.finishingBattle) return;
    if (this.qteTimer) {
      clearTimeout(this.qteTimer);
      this.qteTimer = null;
    }
    this.ui.hideQte();
    if (this.battle) this.battle.qteActive = false;
    this.finishingBattle = true;
    // 出战斗转场：战斗相机淡出后再收尾
    const cam = this.game.scene.getScene("Battle")?.cameras?.main;
    if (cam && this.battle) {
      cam.fadeOut(180, 0, 0, 0);
      setTimeout(() => this.doFinishBattle(), 190);
    } else {
      this.doFinishBattle();
    }
  }

  private doFinishBattle(): void {
    try {
      if (!this.battle) return;
      if (this.battleExitTimer) {
        clearTimeout(this.battleExitTimer);
        this.battleExitTimer = null;
      }
      const s = this.state;
      if (!s) return;
      const b = this.battle;
      this.battle = null;
      const sparNpcId = b.sourceNpc || (b.enemyId.startsWith("spar-") ? b.enemyId.slice(5) : null);
      const isSparBattle = !!sparNpcId && (!!b.sourceNpc || !!ENEMIES[b.enemyId]?.spar);
      const intimacyNpc = b.intimacyNpc;
      if (intimacyNpc) {
        if (!b.victory && b.player.hp <= 0) {
          s.player.hp = Math.max(1, s.player.hp);
        }
      } else if (sparNpcId && isSparBattle) {
        // 切磋与掌门挑战（带 sourceNpc）死亡无惩罚，不轮回不扣钱
        if (!b.victory) {
          s.player.hp = Math.max(1, s.player.hp);
        }
      } else if (!b.victory && b.player.hp <= 0) {
        handleDeath(s);
        this.toast("你倒在江湖路上……");
        this.ui.showDialog([{ id: "r", speaker: "轮回", text: DEATH_TEXT, opts: [] }]);
      }
      this.ui.el("combat-ui").classList.add("hidden");
      this.game.scene.stop("Battle");
      this.game.scene.start("World");
      this.refreshUi();
      if (intimacyNpc) {
        const npc = NPCS[intimacyNpc];
        const casual = !!b.casualIntimacy;
        const pet = npc?.gender === "female" ? "相公" : "娘子";
        const name = npc?.name || "对方";
        if (casual) {
          s.player.flags[`casual-${intimacyNpc}`] = true;
          s.player.flags[`casualTimes-${intimacyNpc}`] = Number(s.player.flags[`casualTimes-${intimacyNpc}`] || 0) + 1;
        } else {
          s.player.flags[`intimateTimes-${intimacyNpc}`] = Number(s.player.flags[`intimateTimes-${intimacyNpc}`] || 0) + 1;
        }
        if (b.victory) {
          if (casual) {
            this.ui.showDialog([
              {
                id: "r",
                speaker: name,
                text: `红烛摇影，帐幔低垂。\n\n一夜春风过，天光未亮时你们各自披衣起身，相视一笑。\n\n（一场春风，两不相欠。）`,
                opts: []
              }
            ]);
            this.toast("一夜春风过，各作天涯客。");
          } else {
            const gain = 5;
            s.player.affections[intimacyNpc] = Math.min(100, (s.player.affections[intimacyNpc] || 0) + gain);
            this.ui.showDialog([
              {
                id: "r",
                speaker: name,
                text: `红烛摇影，帐幔低垂。\n\n一夜过去，${name}披衣坐在床边，声音带着笑意：\n\n「${pet}，明日还来么。」\n\n（良宵尽兴，好感 +${gain}）`,
                opts: []
              }
            ]);
            this.toast(`${name}很满意，你们已是道侣。`);
          }
        } else {
          if (casual) {
            this.ui.showDialog([
              {
                id: "r",
                speaker: name,
                text: `烛花啪地一响，${name}背过身去，半晌才闷声道：\n\n「……你呀。」\n\n（这一夜不算尽兴，你被埋怨了几句。）`,
                opts: []
              }
            ]);
            this.toast(`${name}不大满意，埋怨了你几句。`);
          } else {
            const loss = 5;
            s.player.affections[intimacyNpc] = Math.max(0, (s.player.affections[intimacyNpc] || 0) - loss);
            this.ui.showDialog([
              {
                id: "r",
                speaker: name,
                text: `烛花啪地一响，${name}背过身去，声音闷闷的：\n\n「……就知道逞强。」\n\n（这一夜对方不大满意，好感 -${loss}）`,
                opts: []
              }
            ]);
            this.toast(`${name}不大满意，埋怨了你几句。`);
          }
        }
        return;
      }
      // 切磋/掌门战结束后的随机剧情反馈：输赢都有大量不同反应
      if (isSparBattle) {
        if (b.victory) {
          const npc = NPCS[sparNpcId];
          if (npc?.gender && npc.gender !== s.player.gender && (npc.age ?? 18) >= 16) {
            const gain = ROMANCE[sparNpcId] ? 12 : 6;
            s.player.affections[sparNpcId] = Math.min(100, (s.player.affections[sparNpcId] || 0) + gain);
            this.toast(`${npc.name}看你的眼神，似乎有些不一样了。（好感 +${gain}）`);
          }
        }
        this.ui.showDialog(sparReaction(sparNpcId, b.victory, s.player.gender));
      }
      if (b.victory) {
        const itemLines = b.rewardLines.filter(
          (l) => l.includes("捡到了") || l.includes("搜出了") || l.includes("三角石板") || l.includes("密信")
        );
        if (itemLines.length) this.toast("战利品：" + itemLines.join(" "));
      }
      // 逃婚风波·甲线：击退家丁，护送阿沅抵达百花谷，任务就此了结
      if (b.victory && b.enemyId === "jiading") {
        const qt = s.player.quests.qTaoHun;
        if (qt && !qt.done && qt.stage === 1) {
          qt.done = true;
          qt.stage = 0;
          s.player.exp += 150;
          s.player.potential += 100;
          s.player.moral = clamp(s.player.moral + 3, -100, 100);
          if (!s.player.accessoriesOwned.includes("taohuaZan")) s.player.accessoriesOwned.push("taohuaZan");
          this.ui.showDialog([
            {
              id: "r",
              speaker: "逃婚少女阿沅",
              text: "家丁们连滚带爬地逃出了谷口。\n\n阿沅望着满谷的繁花，忽然蹲下身哭了起来——这一回，是高兴的眼泪。\n\n「恩公，我到家了。」她从发间取下一支桃花簪，双手捧给你，「这是我娘留给我的，往后你替我戴着它走江湖，就当……就当我也看过江湖了。」\n\n（善恶 +3，经验 +150，潜能 +100，获得饰品「桃花簪」）",
              opts: []
            }
          ]);
          this.refreshUi();
        }
      }
      if (s.player.ending) {
        const text = ENDINGS[s.player.ending] || "你走完了这一程。";
        if (s.player.quests.qMain && !s.player.quests.qMain.done) {
          completeQuest(s, "qMain");
        }
        this.ui.showEnding(text, "结局");
      }
    } finally {
      this.finishingBattle = false;
    }
  }

  private scheduleBattleExit(): void {
    if (!this.battle?.over) return;
    if (this.battleExitTimer) return;
    this.battleExitTimer = setTimeout(() => {
      this.battleExitTimer = null;
      if (!this.battle?.over) return;
      // 战斗演出的事件队列未播完时稍后再试，退出以播完为准
      const scene = this.game.scene.getScene("Battle") as BattleScene | null;
      if (scene && !scene.eventsDrained()) {
        this.scheduleBattleExit();
        return;
      }
      this.handleAction("battle-close");
    }, 1600);
  }

  refreshUi(): void {
    if (this.state) {
      this.ui.showHud(this.state);
      const cur = this.ui.el("panel");
      if (!cur.classList.contains("hidden")) {
        // 面板结构可能被整体替换，标题元素缺失时跳过按标题匹配刷新
        const title = cur.querySelector(".panel-title")?.textContent || "";
        const lastAction = this.lastPanelAction;
        if (lastAction === "status") this.ui.showStatus(this.state);
        else if (lastAction === "bag") this.ui.showBag(this.state);
        else if (lastAction === "skill") this.ui.showSkills(this.state);
        else if (lastAction === "storage") this.ui.showStorage(this.state);
        else if (title.includes("买卖")) this.ui.showShop(this.state, this.dialogNpc || "");
        else if (title.includes("授艺")) this.ui.showLearn(this.state, this.dialogNpc || "");
      }
    }
  }

  lastPanelAction = "";

  closeUi(): void {
    this.ui.closePanels();
    this.ui.showHint(null);
    this.ui.dialogNpc = null;
    this.dialogNpc = null;
    this.world?.focusPlayer();
  }

  refreshDialog(): void {
    const s = this.state;
    if (s && this.dialogNpc) {
      const nodes = getNpcDialog(this.dialogNpc, s);
      if (nodes) this.ui.showDialog(nodes);
    }
    this.refreshUi();
  }

  toast(msg: string): void {
    this.ui.showToast(msg);
  }

  // 奇遇事件入口（投宿/闭关/旅行/打坐收功）：先掷选择支（走对话），否则掷文本事件（toast）
  maybeEvent(scene: EventScene): void {
    const s = this.state;
    if (!s) return;
    const nodes = rollChoiceEvent(s, scene);
    if (nodes) {
      // 事件对话不是 NPC 对话，清掉 NPC 上下文（否则会挂出切磋/送礼按钮）
      this.dialogNpc = null;
      this.ui.dialogNpc = null;
      this.ui.showDialog(nodes);
      return;
    }
    const ev = rollRandomEvent(s, scene);
    if (ev) {
      this.toast(ev);
      this.refreshUi();
    }
  }

  // 选择支事件的结算：替换为结果叙述 + 刷新界面
  private eventOut(text: string): void {
    this.ui.showNarrative(text);
    this.world?.showPlayerFloating(text.split("\n")[0]);
    this.refreshUi();
  }

  doChore(action: string): void {
    const s = this.state;
    if (!s) return;
    const p = s.player;
    const key = action === "water" ? "popoWater" : action === "chop" ? "popoChop" : "popoSweep";
    if (p.task[key] >= 3) {
      this.toast("这一项已经做完了。");
      return;
    }
    p.task[key] += 1;
    const labels: Record<string, string> = { water: "挑水", chop: "劈柴", sweep: "扫地" };
    this.toast(`你帮老婆婆${labels[action]}，干得干净利落。`);
    const qp = p.quests.qYigong;
    if (qp && !qp.done && p.task.popoWater >= 3 && p.task.popoChop >= 3 && p.task.popoSweep >= 3) {
      completeQuest(s, "qYigong");
      this.toast("老婆婆的活全干完了！她塞给你工钱和点心。");
      this.ui.showDialog([{ id: "r", speaker: "老婆婆", text: questDefText("qYigong"), opts: [] }]);
    }
    this.refreshUi();
  }

  eatAtInn(): void {
    const s = this.state;
    if (!s) return;
    if (s.player.money < 8) {
      this.toast("连一顿饭钱都没有。");
      return;
    }
    s.player.money -= 8;
    s.player.hunger = Math.min(100, s.player.hunger + 50);
    s.player.thirst = Math.min(100, s.player.thirst + 30);
    this.toast("你叫了一壶茶、两个肉包子，吃饱喝足。");
    this.refreshUi();
  }

  doForge(xuan: boolean): void {
    const s = this.state;
    if (!s) return;
    const p = s.player;
    const mat = xuan ? "xuantie" : "tiekuang";
    const cost = xuan ? 500 : 100;
    if (!p.items[mat]) {
      this.toast(xuan ? "没有玄铁。" : "没有铁矿石。");
      return;
    }
    if (p.money < cost) {
      this.toast("工钱不够。");
      return;
    }
    p.items[mat] -= 1;
    p.money -= cost;
    const kinds = ["sword", "blade", "staff", "whip"] as const;
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const base = xuan ? 30 + Math.floor(Math.random() * 18) : 12 + Math.floor(Math.random() * 10);
    const quality = Math.random();
    const nameInput = this.ui.root.querySelector("#forge-name") as HTMLInputElement | null;
    const name = (nameInput?.value || "无名兵刃").trim() || "无名兵刃";
    const atk = base + (quality > 0.92 ? 12 : quality > 0.7 ? 6 : 0);
    p.forgeWeapon = { name, kind, atk, weight: xuan ? 30 : 12 };
    p.forgeEquipped = true;
    this.toast(`铁匠张抡圆了膀子，火星四溅——「${name}」出炉了！（攻击 +${atk}）`);
    this.refreshUi();
  }

  private finalBossChoice(): void {
    this.ui.showDialog([
      {
        id: "r",
        speaker: "铜镜",
        text: "铜镜中缓缓浮出三道人影。一个没有面孔，一个身披袈裟，一个背着手、腰间悬剑。\n\n「选一个吧。也选你自己的答案。」",
        opts: [
          { text: "面对「我是谁」", action: "boss:woShiShui" },
          { text: "面对「道德和尚」", action: "boss:daoDeHeShang" },
          { text: "面对「东方求败」", action: "boss:dongFangQiuBai" },
          { text: "转身离开", node: "bye" }
        ]
      },
      { id: "bye", speaker: "铜镜", text: "镜面泛起涟漪，像是轻轻叹了口气。", opts: [] }
    ]);
  }

  private showUltMenu(): void {
    const s = this.state;
    if (!s || !this.battle) return;
    const ults = availableUts(s);
    const sub = this.ui.q("#cb-sub");
    if (!sub) return;
    sub.innerHTML = `<div class="cb-ult-list">${ults
      .map((u) => `<button class="btn" data-act="battle-ult:${u.id}">${u.name}<small>内${u.cost} · 需${u.lv}级</small></button>`)
      .join("") || "尚未悟出绝招：把对应武功练到火候（60 级起），并备足内力，方能施展。"}</div>`;
  }

  private showBattleItems(s: GameState): void {
    const usable = Object.entries(s.player.items)
      .filter(([id, n]) => n > 0 && ["food", "drink", "medicine"].includes(ITEMS[id]?.kind || ""))
      .map(([id, n]) => `<button class="btn" data-act="battle-item:${id}">${ITEMS[id].name} ×${n}</button>`)
      .join("");
    const sub = this.ui.q("#cb-sub");
    if (sub) sub.innerHTML = `<div class="cb-ult-list">${usable || "没有可用的物品。"}</div>`;
  }

  private handleCheat(action: string, s: GameState): void {
    const p = s.player;
    switch (action) {
      case "cheat-attrs": {
        cheat.cheatSetAttr(s, "li", this.inputVal("ch-li"));
        cheat.cheatSetAttr(s, "wu", this.inputVal("ch-wu"));
        cheat.cheatSetAttr(s, "min", this.inputVal("ch-min"));
        cheat.cheatSetAttr(s, "gen", this.inputVal("ch-gen"));
        this.toast("四项天赋已改写。");
        break;
      }
      case "cheat-money": cheat.cheatSetMoney(s, this.inputVal("ch-money")); this.toast("银两已改。"); break;
      case "cheat-potential": cheat.cheatSetPotential(s, this.inputVal("ch-potential")); this.toast("潜能已改。"); break;
      case "cheat-exp": cheat.cheatSetExp(s, this.inputVal("ch-exp")); this.toast("经验已改。"); break;
      case "cheat-moral": cheat.cheatSetMoral(s, this.inputVal("ch-moral")); this.toast("善恶已改。"); break;
      case "cheat-strength": cheat.cheatSetStrength(s, this.inputVal("ch-strength")); this.toast("内力强度已改。"); break;
      case "cheat-age": cheat.cheatSetAge(s, this.inputVal("ch-age")); this.toast("年龄已改。"); break;
      case "cheat-hp": cheat.cheatSetHp(s, this.inputVal("ch-hp")); this.toast("气血已改。"); break;
      case "cheat-mp": cheat.cheatSetMp(s, this.inputVal("ch-mp")); this.toast("内力已改。"); break;
      case "cheat-hunger": cheat.cheatSetHunger(s, this.inputVal("ch-hunger")); this.toast("饥饱已改。"); break;
      case "cheat-thirst": cheat.cheatSetThirst(s, this.inputVal("ch-thirst")); this.toast("口渴已改。"); break;
      case "cheat-poison": cheat.cheatSetPoison(s, this.inputVal("ch-poison")); this.toast("中毒已改。"); break;
      case "cheat-looks": cheat.cheatSetLooks(s, this.inputVal("ch-looks")); this.toast("容貌已改。"); break;
      case "cheat-time": {
        cheat.cheatSetTime(s, this.inputVal("ch-day"), this.inputVal("ch-hour"));
        this.world.refresh();
        this.toast("日期时辰已改。");
        break;
      }
      case "cheat-weather": {
        const w = (this.ui.q("#ch-weather") as HTMLSelectElement).value;
        cheat.cheatSetWeather(s, w);
        this.world.refresh();
        this.toast("天气已改。");
        break;
      }
      case "cheat-gender": {
        const g = (this.ui.q("#ch-gender") as HTMLSelectElement).value;
        cheat.cheatSetGender(s, g);
        this.world.refresh();
        this.toast("性别已改。");
        break;
      }
      case "cheat-sect": {
        const id = (this.ui.q("#ch-sect") as HTMLSelectElement).value;
        cheat.cheatSetSect(s, id);
        this.toast(id ? "门派已改。" : "已还俗，无门无派。");
        break;
      }
      case "cheat-house": {
        const v = (this.ui.q("#ch-house") as HTMLSelectElement).value === "1";
        cheat.cheatSetHouse(s, v);
        this.world.refresh();
        this.toast(v ? "桃花源小筑已是你的产业。" : "宅邸已售出。");
        break;
      }
      case "cheat-affection": {
        const id = (this.ui.q("#ch-npc") as HTMLSelectElement).value;
        cheat.cheatSetAffection(s, id, this.inputVal("ch-aff"));
        this.toast("好感已改。");
        break;
      }
      case "cheat-item": {
        const id = (this.ui.q("#ch-item") as HTMLSelectElement).value;
        cheat.cheatAddItem(s, id, this.inputVal("ch-item-n"));
        this.toast(`物品已添加（${id}）。`);
        break;
      }
      case "cheat-item-set": {
        const id = (this.ui.q("#ch-item") as HTMLSelectElement).value;
        cheat.cheatSetItem(s, id, this.inputVal("ch-item-n"));
        this.toast(`物品数量已设为 ${this.inputVal("ch-item-n")}（按 999 上限截断）。`);
        break;
      }
      case "cheat-area": {
        const id = (this.ui.q("#ch-area") as HTMLSelectElement).value;
        cheat.cheatTeleport(s, id);
        this.world.refreshWithFade();
        this.toast("你一步跨过了千山万水。");
        break;
      }
      case "cheat-heal":
        cheat.cheatHeal(s);
        this.toast("气血精神尽复。");
        break;
      case "cheat-lock":
        this.toast(cheat.cheatToggleLock(s) ? "已开启锁血无敌。" : "已解除锁血。");
        break;
      case "cheat-classic":
        this.toast(cheat.cheatToggleClassic(s) ? "进入经典黑白模式，梦回文曲星。" : "恢复彩色重制。");
        this.applyClassicFilter();
        break;
      case "cheat-reset":
        localStorage.removeItem("yxts-golden-save");
        this.state = null;
        this.battle = null;
        if (this.battleExitTimer) {
          clearTimeout(this.battleExitTimer);
          this.battleExitTimer = null;
        }
        this.ui.el("combat-ui").classList.add("hidden");
        this.game.scene.stop("World");
        this.game.scene.stop("Battle");
        this.ui.showTitle();
        return;
    }
    this.refreshUi();
    this.ui.showCheat(s);
  }

  private inputVal(id: string): number {
    const el = this.ui.root.querySelector("#" + id) as HTMLInputElement | null;
    return Number(el?.value) || 0;
  }

  applyClassicFilter(): void {
    const canvas = this.ui.root.querySelector("canvas") as HTMLCanvasElement;
    if (canvas) canvas.style.filter = this.state?.player.yobdc ? "grayscale(1) contrast(1.08)" : "";
  }

}

function requireSkill(id: string) {
  return SKILLS[id];
}

function questDefText(id: string): string {
  return QUESTS[id]?.doneText || "";
}

const DEATH_TEXT = "眼前一黑，你听见牛车吱呀吱呀的声响。「醒了？到平安镇了。」你在镇口醒来，腰包瘪了一些，身上还带着伤。镇口老者看了你一眼，只说：江湖就是这样，输过，才知道怎么赢。";
