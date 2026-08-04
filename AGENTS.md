# AGENTS.md

本文件面向后续接手本项目的开发代理，说明工程结构、架构边界、核心系统与开发约定。项目为文曲星《英雄坛说》的彩色横版重制：**英雄坛说 · 黄金重制**。

## 项目概述

- 类型：浏览器 2D 武侠 RPG（横版卷轴探索 + 回合制战斗 + 文字剧情）
- 风格：程序化像素/Canvas 美术、分层视差、天气与昼夜、水墨纸卷风 DOM 界面
- 核心循环：探索平安镇与世界 → 随机互动/战斗/修炼成长 → NPC 关系与物品世界演化 → 穿越者天书掌握所见武学
- 内容规模：约 1.1 万行 TypeScript/CSS；七大派、三十余个区域/房间（14 室外区域 + 19 室内房间）、五十个 NPC、十余场 BOSS 战

## 快速开始

```bash
npm install
npm run dev            # 开发服务器 http://127.0.0.1:5173/
npm run build          # 生产构建到 dist/
npm run build:single   # 单文件构建到 dist-single/index.html（可 file:// 双击打开）
npm run preview        # 预览 dist/，默认 http://127.0.0.1:4173/
npm run balance        # 战斗平衡模拟（scripts/balance-sim.mjs，输出 C1-C4 × 关键敌人表格）
```

注意：根目录 `index.html` 是 Vite 入口，**不要直接双击**（`file://` 下浏览器会拦截 ES Module 导致黑屏）。直接可玩的是 `dist-single/index.html`。

## 技术栈

- Phaser 3.90（Canvas 2D 渲染器，不用 WebGL，避免部分环境黑屏）
- TypeScript 5 + Vite 6
- 无 UI 框架；DOM 覆盖层负责所有文字界面
- `playwright-core`（devDependency）：无头 Chrome + 系统 Chrome 做 QA
- `vite-plugin-singlefile`：生成单文件版

## 目录结构

```text
.
├── AGENTS.md                  # 本文件
├── index.html                 # Vite 入口（勿 file:// 直接打开）
├── package.json
├── tsconfig.json
├── vite.config.ts             # 常规构建
├── vite.single.config.ts      # 单文件构建
├── src/
│   ├── main.ts                # 入口：创建 App、挂载致命错误遮罩、暴露 window.__app
│   ├── style.css              # 全局主题样式（纸卷/暗金/红烛/战斗/叙事流等）
│   ├── game/
│   │   ├── app.ts             # 总控：Phaser 启动、全部 action 分发、存档/战斗/恋爱/开放世界入口
│   │   ├── bus.ts             # App 单例访问（避免循环依赖）
│   │   ├── content/           # 纯数据与文案（尽可能 data-driven）
│   │   │   ├── types.ts       # 所有内容类型定义（EnemySkillDef 含 mpCost/heal/buff/debuff）
│   │   │   ├── skills.ts      # 武功：基本功/门派武学/奇遇武学 + 绝招
│   │   │   ├── sects.ts       # 七大派（太极/八卦/雪山/花间/尹贺/红莲/丐帮）
│   │   │   ├── items.ts       # 物品、武器、护甲、饰品
│   │   │   ├── enemies.ts     # 敌人/BOSS（五档 AI 字段）+ 动态生成的切磋敌人（spar-*）
│   │   │   ├── npcs.ts        # NPC 数据（性别/年龄/容貌/武艺/作息；缺省者按 npcId 哈希确定性生成）
│   │   │   ├── areas.ts       # 区域与房间地图数据（14 室外区域双向连通 + 19 房间，exits 步行触发区）
│   │   │   ├── quests.ts      # 旧版任务底料（不再接入玩家 UI）
│   │   │   ├── romance.ts     # 可攻略角色、礼物、亲密文本
│   │   │   ├── relations.ts   # NPC 关系网（12 对专属语料 + 六类通用闲聊池）
│   │   │   ├── story.ts       # 对话树、开场志、结局、传闻（randomRumor 统一出口）
│   │   ├── sim/               # 模拟层（规则源，不依赖 Phaser 场景）
│   │   │   ├── state.ts       # GameState / PlayerState 与初始角色
│   │   │   ├── formulas.ts    # 属性、攻防、上限、学习/打坐公式
│   │   │   ├── actions.ts     # 物品/修炼/商店/天气/随机事件（四场景 36 条）等
│   │   │   ├── battle.ts      # 回合制战斗状态机与事件
│   │   │   ├── cheat.ts       # 穿越者天书数值逻辑
│   │   │   ├── npcLife.ts     # NPC 生活引擎纯逻辑（关系对挑选、语料抽取）
│   │   │   ├── socialEngine.ts # 三意图社交结果与 1 对 1 互动锁
│   │   │   ├── objectLife.ts  # NPC-环境物品随机互动（修缮/破坏/复制/挪动）
│   │   │   ├── save.ts        # localStorage 存档（key: yxts-golden-save）
│   │   ├── scenes/
│   │   │   ├── BootScene.ts   # 生成全部贴图，启动 WorldScene
│   │   │   ├── WorldScene.ts  # 横版世界：视差/天气/昼夜/NPC/敌人/收集物/交互
│   │   │   ├── BattleScene.ts # 战斗演出：刀光/火花/光环/烟雾/飘字/震屏
│   │   ├── view/
│   │   │   ├── art.ts         # 程序化像素贴图生成器（角色模板/建筑/家具/天体/特效）
│   │   │   └── daynight.ts    # 昼夜纯函数：色温关键帧、日月弧线、夜色浓度
│   └── ui/
│       └── UIManager.ts       # 所有 DOM 界面：HUD/面板/对话/商店/学艺/战斗/作弊/亲密
├── dist/                      # 生产构建产物
├── dist-single/               # 单文件版（可双击）
├── scripts/
│   ├── balance-entry.ts       # 平衡模拟的 esbuild 入口（只引 sim/content 纯逻辑）
│   └── balance-sim.mjs        # npm run balance：打包 sim 层后跑 C1-C4 × 关键敌人模拟
└── tsconfig.tsbuildinfo       # tsc 增量缓存（生成物）
```

## 架构边界（重要）

- **模拟层**（`sim/*`）拥有全部规则与可存档状态；Phaser 场景只做渲染与输入适配。
- **内容层**（`content/*`）是纯数据/文案，新增角色、武功、世界观碎片、区域优先改这里。
- **App**（`app.ts`）是唯一 action 分发中心，DOM 按钮只发字符串 action（如 `use:jinchuang`、`quest-advance:qMain:1`）。
- **DOM 覆盖层**（`UIManager`）负责对话、面板、战斗菜单、穿越者天书、叙事流、亲密演出；Canvas 负责世界与战斗动画。
- 场景之间不直接传状态；世界切换用 `game.scene.start("World")`，`WorldScene.create()` 会调 `app.world.refresh()` 重新渲染当前区域。

## 视觉与美术（Phase 3 重制）

- 贴图全部程序化生成于 BootScene（art.ts），零外部资源；Canvas 2D 渲染器，不用 WebGL 专属 API。
- **角色体系**（art.ts）：
  - 人形模板 16×24：idle/walk/walk2 三帧，walk2 为 walk 镜像，腿部真正交替（不再是同帧复制）。
  - 壮汉模板 20×26（周三/寨主/冷铁衣，`brute-*`）；掌门+终局 BOSS 模板 16×28 戴冠高袍（`boss-*`，BOSS_PALETTES 十套独立配色，NPC 与敌人两态共用）。
  - 兽形模板 20×24（`beast-*`）：wolf/snowwolf/boar/snake，四蹄交替、蛇身波浪两帧；夜行鬼 `ghost-dark-*` 半透明无腿悬浮。
  - `visualForEnemy / visualForNpc / visualForBattleEnemy` 返回 CharVisual（key(frame)/w/h/scaleMul）；场景按 `FOOT_Y - h×scale/2` 对齐脚底；NPC 体型差异用 `npcScaleHint`（婆婆驼背、小孩 0.78 倍）。
  - 原 `paletteForEnemy/paletteForNpc/genEnemyExtra` 已移除，引用全部改走 visual 系列。
- **天空与昼夜**（view/daynight.ts 纯函数 + WorldScene）：
  - `sky-{theme}` 为纯三段纵向渐变（240×540 平铺），日月云星不画进贴图，彻底消除拉伸变形与“凌晨挂太阳”。
  - 太阳/月亮独立 sprite 按时辰走弧线（sunArc/moonArc，6-18 时 / 18-6 时）；`dayTint` 关键帧（黎明橙粉→清晨淡金→正午青蓝→黄昏金红→入夜→深夜）lerp 全屏 tint，取代 24% 固定蓝罩。
  - `nightness` 驱动：星点闪烁呼吸、云夜间变淡、建筑窗户/门口灯笼叠 fx-glow 暖光（呼吸 alpha）。
  - `displayHour` 向真实时辰缓动，投宿/旅行跳时时平滑扫过不跳变。
- **天气 v2**（WorldScene）：
  - 雨：80 滴落至 GROUND_Y 消隐并触发溅射（fx-splash 16 个对象池复用）；10% 概率雷雨（全屏白闪 100ms + 震屏 + 延迟闷雷二次轻震），`WorldScene.thunderstorm` 供 HUD 显示 ⛈️。
  - 雪：落地消隐、横向正弦斜落；雾：后层（scrollFactor 0.55）+ 前景层（1.15）宽大雾带漂移呼吸；风：按区域主题吹落叶/花瓣+沙尘/雪粒/沙尘/火星。
  - 天气变化（rollWeather 后由 update 检测差异）：旧粒子 1 秒淡出销毁、新粒子淡入；进入区域时整体淡入。
  - HUD 天气 chip 图标化（☀️🌧️❄️🌫️💨⛈️）。
- **战斗场景**（BattleScene）：
  - `App.startBattle` 传入区域 theme；`buildBackdrop` 按主题生成天空/远山/两段中景/地面与装饰（森林树影、雪山雪原、海岛海浪线、dark 火把光晕、镇子建筑剪影），装饰避开 320/650 战斗位；并按当前时辰叠 dayTint 与星点。
  - 绝招专属演出：battle.ts 的 BattleEvent 增加展示字段 `ultName/ultType/mult`（`ultOwnerType` 反查武功类型，不改规则）；`ultStrike` 按类型出形态——剑=青色横斩剑气、刀=金色斜劈刀芒、拳=红色冲击波环、杖=橙色竖劈、鞭=紫红蛇形鞭影、内功/异术=紫白光环爆发；顿帧（tweens.timeScale 0.08 × 110ms）+ 按 mult 分级震屏；命中刀光沿用 ultType 配色。
  - phase：全屏红光脉冲 + BOSS 变大变色；stance：青色护盾弧；opening：目标头顶黄星；flee：扬尘平移出屏。
- **房间**（renderRoom + genFurnitureTextures 十六种 `furn-*`）：墙纸竖纹 + 护墙裙 + 木地板；`roomFurniture` 按 theme/roomId 摆家具组合；交互物经 `furnitureIcon` 映射家具图（柜台/床/铁砧/宝座/书架/木人桩…）；顶部吊灯 + 暖光晕呼吸；视觉宽度 ≥960 防止右侧露边。
- **转场与细节**：区域/房间切换、进出战斗统一相机 fadeOut(200ms)→fadeIn(300ms)（WorldScene.refreshWithFade、App.startBattle、finishBattle→doFinishBattle）；收集物光点 alpha/scale 脉动；near 视差层按区域宽度循环铺满；角色贴地阴影（fx-shadow）；建筑匾额文字 2 倍离屏绘制再缩放保清晰。

## 角色与属性

- 创建角色：姓名、性别（男/女）、四项天赋 膂力/悟性/敏捷/根骨（各 10-30，总和 ≤80），14 岁开局，容貌为隐藏属性（15 岁可见）。
- 年龄：每累计 10 天 +1 岁（投宿/闭关/旅行推进；闭关 7 天 ≈ 0.7 岁），不再有跨天跳龄。
- 天赋成长：对应基本功每 10 级 +1（膂力-基本拳脚、悟性-读书识字、敏捷-基本轻功、根骨-基本内功）。
- **上限**：天赋有效值 ≤60；内力强度 ≤999；武功按各自 max（基本 150、多数门派 150、轻功/读书 100）；善恶 -100~100；好感 0-100。
- 气血三层：当前 / 有效（受伤）/ 最大；重伤（绝招、重击）会削减有效值，恢复慢。
- 内力：蓄存量（战斗消耗）与内力强度（上限与成长），打坐把潜能转化为内力强度。当前生效内功存 `p.neigong`（加成 maxMp/防御/治疗绝招）；此前无赋值渠道，Phase 5b 起由逍遥线授予「逍遥心法」时设置。

## 战斗系统

- 回合制：攻击、绝招、运功防御、物品、逃跑；另有加力滑杆（0-10，按次耗内力）。
- **伤害公式（比例减伤）**：`base = atk × (crit?1.7:1) × mult × atk / (atk + def×0.9)`，再乘 0.85-1.15 浮动，下限 1。防御收益递减、永不免疫（攻=防时减伤约 47%）。
- 判定：命中/闪避/会心/招架；招架概率与基本招架等级挂钩（6% 起，上限 30%）。
- **破绽**：攻击被闪避或被招架的一方露出破绽，下次受击伤害 ×1.5（双方通用，受击即消费，推 `opening` 事件）。
- 状态：中毒、攻/防/身法/闪避/招架 buff、debuff。攻/防/身法为数值加减；闪避/招架 buff 为概率加成（0.15 即 +15%），全部经 `effectiveStat` 生效；闪避含 buff 后钳到 0.6。
- **敌方 AI 五档**（读 `EnemyDef.ai`，`enemyDecide` 实现）：wild 八成本能普攻、不防御；bandit 抢攻（攻击技能权重 ×1.5）、气血 <30% 时 15% 落荒而逃（按玩家胜利结算但奖励减半）；guard 气血 >60% 三成概率摆守势（下次受伤 ×0.5）、被击后反击率提升、偏好自 buff；master 气血 <40% 优先治疗/守势、玩家防御时用 debuff 破防、按 mp 管理绝招；boss 阶段化（>66% 常规 / 33-66% atk+15% 偏好重招 / <33% 狂暴 atk+30% def-20%，推 `phase` 事件）。
- 敌方技能耗 mp：`EnemySkillDef.mpCost`（10-40），mp 不足不可用；敌方可带 heal（按最大气血比例）与自 buff 技能。
- 伤害成长采用开方衰减，防止后期一刀秒；天赋、武功、兵器、内功共同影响攻防。
- 战斗中吃食物回 8% 最大气血、喝酒水回 10% 最大内力；药品按 effect 正常生效。
- 加力先扣内力再算伤害，内力不足当次加力作废。
- 运功防御：减伤 ×(0.58 − 基本招架等级×0.002)，下限 ×0.30（150 级招架）；同时回 3% 气血与 5% 内力。
- 治疗绝招（kind:"heal"）：固定 120 + 最大气血 8% + 当前内功等级 ×0.8；同一治疗绝招每场战斗冷却 4 回合（`lastHealTurn/lastHealUlt`）。
- 胜利后战斗日志顶部显示金色“战利品”栏：经验/潜能/银两/道德/掉落/石板/密信全部列出。
- 战斗事件由 BattleScene 按队列逐条演出（每条约 0.3~0.5 秒，绝招 move 事件 0.56 秒）；战斗结束（胜负/逃跑）待队列播完约 1.4 秒后自动退出，手动按钮也保留；退出逻辑幂等。`phase/stance/opening/flee` 均有专属演出（见「视觉与美术」）；BattleEvent 可带展示字段 `ultName/ultType/mult`，仅供演出配色与震屏分级，不改战斗规则。
- 切磋（NPC 对话里的“切磋武艺”）死亡无惩罚；掌门挑战死亡同样无惩罚，胜利可拿三角石板。

## 修炼与成长

- 潜能：战斗、随机事件、穿越者天书调整获得，用于学艺与打坐。
- 经验：战斗与随机事件获得，是高级武功与江湖成长的门槛。
- 学艺曲线：`learnCost = Σ(l+2)^1.55 × factor / (1+悟性×0.012)`（门派 factor 0.5、基本 0.35、读书 1.6）；门派武功 0→100 级约 2.5 万潜能（悟性 0 时），100→150 再加约 4.5 万。
- 读书识字：每 10 级 +2% 战斗领悟率（`gainExpForSkill`，上限 +20%），另加悟性。
- 打坐（键 5）：消耗潜能提升内力强度并缓慢恢复；客栈“闭关七日”（50 两）可快速推进时间与年龄。
- 学艺：向师父请教，消耗潜能；读书识字还消耗银两；有经验/基础武功/天赋/道德门槛。
- 数值调参：`npm run balance` 输出 C1-C4 检查点 × 关键敌人的胜率/回合/战损表，改敌人数值后以此回归。

## 门派

- 七派：太极门、八卦门、雪山剑派、花间派（仅女）、尹贺谷、红莲教、丐帮。
- 每派有入门要求（道德、性别、天赋、基本功等级），被拒时给明确指引；门槛由对话层（story.ts sectJoinNode）与模拟层（actions.ts joinSect）双重校验，绕过对话直接发 `join-sect:` action 同样会被拒。
- 各派有独门内功、轻功、兵器路数与绝招；六大门派（除丐帮）掌门各持一块三角石板。

## 装备与穿戴

- 槽位：武器、护甲、饰品；背包面板可穿上/脱下，脱武器回“一双肉掌”。
- 购买装备自动入持有列表并装备；铁匠铺可打造自定义命名兵器（铁矿石/玄铁），可随时装卸。
- 存档会迁移 `weaponsOwned/armorsOwned/accessoriesOwned/forgeEquipped` 等字段。

## 任务（旧版底料，已不接入玩家 UI）

- 主线 `qMain`：采药 → 读书 → 除恶霸 → 青龙坛地图 → 破黑风寨/冷铁衣 → 密信 → 六块石板 → 时空尽头终局（我是谁/道德和尚/东方求败 三选一）。
- 支线：`qYigong`（婆婆义工）、`qXunWu`（马大哈寻物）、`qChuE`（捕快除恶，可重复）、`qSha`（平一指杀人，可重复）、`qBeiFang`（村长拜访）、`qTieJiang`（玄铁难求）。
- Phase 5b 新支线（详见下文「Phase 5b 接线」）：`qYunZhongHe`（缉拿云中鹤）、`qTaoHun`（逃婚风波，甲乙双分支）、`qShiKu`（石窟残碑）、`qChuanShu`（传书令）、`qWudangDaily` / `qGaibangDaily`（日常，可重复）。
- 任务推进后对话会自动重算（`App.refreshDialog` 重新读取对话树）。

## Phase 5b 接线（新 NPC / 新任务 / 断线内容）

- **云中鹤通缉链**：县衙捕快发布 `qYunZhongHe`（不可重复）→ 夜间（21-5 时）后山刷出云中鹤（WorldScene 参照夜行鬼模式，x=1650，任务激活且未击杀才刷）→ 击杀（battle.ts endBattle 写 `yunZhongHeDead` 并把任务推进到 stage 1）→ 回捕快领赏：800 两 + 善恶+5 + 称号「捕风者」（app.ts `quest-complete:qYunZhongHe` 特例）。云中鹤定位比冷铁衣略弱的中期 BOSS（boss AI，hp1300/atk52/def32），balance 验证 C2 约 13 回合。石窟裂缝（crack）文案带其老巢暗示。
- **逍遥线**：集齐猛虎拳/惊天刀法/醉拳且无门派 → `flags.xiaoyao`（actions.ts checkXiaoyao 原有）；镇口无名老者对话出现「请老丈过目」（`xiaoyao-grant`）：授 hidden 内功「逍遥心法」（skills.ts `xiaoyaoXinfa`，直接 80 级，80 级绝招「逍遥游」kind buff：身法+25、闪避+15% 三回合——`UltDef.buff2` 第二段增益，battle.ts playerUlt 应用），另赠称号「逍遥散人」，并设为当前内功（`p.neigong`——此前全游戏无任何赋值渠道，这是第一个）。
- **桃花源小筑**：WorldScene 的 taohua 特例改为未购房走买房对话、已购房（p.house）正常进 `ROOMS.taohua`。房间交互：卧榻（`house-rest`，免费全恢复，推进 6 时辰）+ 存物柜（`UIManager.showStorage`，背包/柜子双向挪物，action `store:`/`take:`）。存物数据存 `PlayerState.storage: Record<string, number>`（state.ts 新字段，save.ts fillDefaults 补 `{}`，旧档兼容）。
- **逃婚风波 `qTaoHun`**（阿沅发布）：stage 0 在对话里选——甲线「护送」（`taohun-help`，stage 1）→ 进入百花谷时 WorldScene.refresh 尾部的 `maybeTaohunAmbush` 触发家丁伏击对话 → `fight:jiading`（新敌人，山贼档 bandit AI）→ 胜利后在 `App.doFinishBattle` 结算：善恶+3、经验/潜能、饰品「桃花簪」（taohuaZan，def+6）；乙线「劝她回去报官」（`taohun-report`，stage 2）→ 找捕快 `taohun-report-done`：200 两 + 经验、善恶-5。两条线均为手动结算（不走 completeQuest），任务完成后阿沅离开官道（`WorldScene.npcPresent` 特例）。
- **石窟残碑 `qShiKu`**（守墓老人发布）：需 3 块石料；石窟（shiku）矿点必掉 1-2 块石料（actions.ts interactAction mine 按区域分支，后山矿洞不变）+ 行脚商人出售。交付（`quest-complete:qShiKu` 特例：验 3 块、扣料、发饰品「白玉佛」baiYuFo def+8）后老人讲一段石窟/青龙坛/时空尽头往事。
- **传书令 `qChuanShu`**（县令发布）：接任即发 3 枚 chuanShiLing（quest-accept 特例）；太极/八卦/雪山三位掌门对话出现「递交官府传书令」（story.ts masterCommon 注入，`deliver-shu:` action），每份 +100 两 +80 经验，送齐 3 份 completeQuest（善恶+5）。
- **日常两条**（qChuE 模式可重复）：`qWudangDaily`（道童：3 株药草，quest-advance 特例扣药草）、`qGaibangDaily`（丐帮弟子：馒头/包子/烧鸡任意 2 份，actions.ts `countBeggarFood/removeBeggarFood`）。
- **新 NPC 12 个**（npcs.ts + story.ts 对话树，均显式年龄/容貌）：chapeng 茶棚老板（官道，shop）、xingjiao 行脚商人（官道东段，shop 含石料）、langzhong 游方郎中（平安镇，`heal-langzhong` 20 两全恢复+解毒，兼卖药）、luopo 落魄刀客（官道茶棚旁，`give-luopo-wine` 一壶黄酒换基本刀法 +8 级，首次另 +30 潜能）、taohun 逃婚少女阿沅（官道南段）、shoumu 守墓老人（石窟）、daotong 武当道童、gaibangDizi 丐帮弟子、xueshanDizi 雪山弟子（切磋 flavor）、huajianShinv 花间侍女、honglianJiaotu 红莲教徒、yinheXuetu 尹贺学徒。
- **关系网新增 6 对**（relations.ts）：chapeng↔xingjiao（trade）、chapeng↔luopo（neighbor）、daotong↔gusong（master）、gaibangDizi↔zhanglao（friend）、honglianJiaotu↔xiangzhu（friend）、xueshanDizi↔xuewei（rival），全部同区域且 |Δx|<500。
- **剧情增量**：说书先生「听一段评话」按 qMain stage 换段子（<3 周三 / 3-5 黑风寨 / 6 石板传说 / ≥7 时空尽头寓言）；ENDINGS 三结局各扩至 4-5 段（上吊结局不动）；RUMORS_STATE 新增云中鹤已除组（2 条，与 800 两悬赏口径一致）。
- **舆图**：`MAP_POS.binghuo` 移至 (726,446)，与渡口标签错开。

## 恋爱 / 亲密 / 一夜情线

- 情缘只限异性，且玩家与对象均须 ≥16 岁；可攻略：阿绣（女）、唐晚词（女）、李振威（男）、商剑鸣（男），其余成年 NPC 也可谈心、亲近。
- 好感：谈心 +3，送礼按角色喜好，上限 100。
- 共度良宵：好感 ≥60（已婚 40）解锁，进入 QTE 良宵战斗；胜利好感 +5、失败 -5。之后对方成为道侣（`partner-<npcId>` / `everIntimate-<npcId>`），会用「相公/娘子」称呼，并出现「分道扬镳」（好感清零）。
- 偷香：双方主动的成年一夜风流，无需好感、无道德惩罚、不改变称呼、不成为道侣；同样走 QTE 良宵战斗，胜负各有反馈。状态里记录 `casual-<npcId>` 与次数。
- 人物状态「情缘录」记录共度良宵/一夜偷香/好感/次数，点击名字可查看 NPC 人物志；人物志会按关系追加随机文案（romance.ts `randomRelationshipStatus`）。
- 结婚须 ≥18 岁（月下老人牵线，`marry` action）。

## 开放世界框架（无任务）

- 玩家可见任务系统已移除：无任务面板/按键/奖励路径；旧任务文案作为世界观底料保留在 story.ts/lore 类数据中，随机进入对话与传闻。
- 世界状态存 `GameState.world`：`npcRelations`（多对多关系网络）、`dynamicObjects`、`interactionLocks`、`objectHistory`、`seed`；存档 v3 持久化。
- 关系维度：`friendliness`（-100~100）、`respect`（-100~100）、`love`（0~100）、`trust`（0~100）；玩家与 NPC 平级，键 `"player"`。
- NPC 互动菜单只有三意图：对话/善意/敌意，统一走 `sim/socialEngine.ts` 的 `resolveSocialIntent`；商店、学艺、疗伤、切磋等作为随机结果出现。
- NPC 互动菜单额外提供「查看NPC状态」，直接打开 `showNpcStatus`。
- 敌意按概率演化：基础开战概率低，`flags["hostile-<npcId>"]` 累计挑衅次数、关系友好度越低，开战概率越高；多数敌意结果为口角/威胁文案。
- NPC 会主动对玩家发起互动（`npc-initiates:<npcId>`），也会随机对环境物品执行修缮/破坏/复制/挪动/使用（`sim/objectLife.ts`）。
- NPC 位置随机化：房间 NPC 可能外出进入当前区域，异区域无房间 NPC 也可能作为访客出现；`renderArea` 在正常 NPC 之外追加随机出现者。
- NPC 跨图迁移由 `sim/npcTravel.ts` 提供确定性位置：`npcLocation(npcId, day, hour)` 返回区域/房间/坐标，`renderArea` 按当前位置渲染所有应在该区域的 NPC。
- NPC 作息调度在 `sim/npcSchedule.ts`：工作日 9-16 `atWork` 固定岗位，非工作时间和周末 `shouldBeOut` 用 `npcId+day+hour` 哈希确定性判断是否外出；周末跨图访客概率更高。
- NPC 之间会随机爆发可见的 1 对 1 战斗：头顶气泡逐条展示招式/命中/收场（复用 story.ts 战斗文案），多组可同时发生，受 `interactionLocks` 保护。
- 所有 1 对 1 互动使用 `interactionLocks`：NPC-NPC、NPC-玩家、NPC-物品同一套锁；被锁主体不会参与其他互动。
- 所有叙事文字走 `UIManager.showNarrative` 打字机大字流，留存最近 8 条。
- 所有事件同时通过 `WorldScene.showFloatingText/showPlayerFloating/showNpcFloating` 在主体头顶悬浮展示，字号统一 16px。
- 玩家对话、NPC 互聊、随机事件结算统一走 `UIManager.showNarrative` 叙事流；`App.eventOut` 不再单独弹奇遇对话框。
- `world.npcLogs` 记录每个 NPC 的江湖日志；社交、互斗、物品事件会写入相关 NPC，人物志展示最近 6 条。
- 每个 NPC 的独门招式与随身物品由 `npcMoves/npcBelongings` 确定性分配；互斗文案会引用独门招式，人物志展示招式和物品。
- 战斗自动触发已掌握武学 + QTE；敌方技能写入 `observedSkills`，穿越者天书可瞬间掌握。
- 穿越者天书只能掌握已经见过的武学；未见过、未记入 `observedSkills` 的武功不能直接修改等级。

### 世界逻辑细节

#### 状态字段

- `world.npcRelations`：`Record<npcId, Record<npcId, NpcRelationState>>`，对称写入同一对象；玩家键固定 `"player"`。
- `world.dynamicObjects`：花草/灌木/石头/药草等，字段含 `integrity/growth/quantity/size/tint/history`。
- `world.interactionLocks`：`entityId -> { partner, kind, until }`，`Date.now()` 过期后自动视为可互动。
- `world.objectHistory`：环境事件叙事记录，最多在界面展示最近若干条。
- `world.areaVariations`：区域随机色调与演化标记，读档后继续保留。

#### 关系变更规则

- 每次社交结果调用 `mutateRelation`，四维分别 clamp：友好/敬畏 ±100，爱意/信任 0-100。
- 同一对关系在 `npcRelations[a][b]` 与 `npcRelations[b][a]` 引用同一对象，避免不同步。
- NPC-NPC 闲聊、NPC 互斗、玩家三意图、NPC-物品互动都会触发关系变更。

#### 敌意概率

- `flags["hostile-<npcId>"]` 记录连续挑衅次数。
- 开战概率 = 基础值（普通 NPC 8%、master/enemy 14%）+ 挑衅次数 × 10% + `max(0, -friendliness) × 0.2%`，上限 70%。
- 未开战的敌意输出口角/威胁文案并 +1 挑衅次数；真的开战后清空该 flag。

#### 对话生成管线

- `sim/dialogEngine.ts` 输入 `npcId + GameState + intent`，输出 3 条槽位化文案。
- 槽位：`{name}`、`{title}`、`{relation}`、`{weather}`、`{lore}`。
- `content/lore.ts` 提供世界观碎片；`sim/socialEngine.ts` 负责把对话结果转成关系变化、战斗或面板动作。

#### NPC 互斗

- `WorldScene.npcFights` 可同时存在多组；每个 NPC 受 `interactionLocks` 保护。
- 斗殴开始条件：关系 `friendliness < -20`，或小概率随机冲突；`tryLock` 成功才开演。
- 头顶气泡按 1.25 秒/条展示招式、命中、收场；结束后关系继续恶化并释放锁。

#### 环境物品

- 物品行动池：`repair / destroy / copy / move / use`。
- 修缮提升 `integrity/growth/size`；破坏降低，归零后移除；复制生成副本并 `quantity + 1`；挪动改变位置；使用轻微影响生长。
- `objectLife.ts` 负责物品状态变更，`WorldScene.renderDynamicObjects` 把状态映射为尺寸/颜色/透明度。
- 玩家物品对环境使用走 `sim/itemUse.ts`：背包任意物品可投向当前区域动态对象，按物品类型随机改变 `growth/integrity/quantity/size/tint` 并输出文案。
- `useItemOnNpc` 支持把背包物品交给 NPC，按类型随机回应并写入关系与日志；入口为 NPC 互动菜单「使用物品」。

#### NPC 日志与开场

- `mutateRelation` 会把互动事件写入双方 `npcLogs`，上限 24 条。
- NPC 互斗收场、NPC 对物品操作也会写入 `npcLogs`。
- 新角色首次进入世界先看到「穿越者天书」开场介绍，`flags["intro-traveler"]` 标记后不再重复。

#### 叙事流

- `UIManager.showNarrative(text)` 追加一条打字机条目，每 24ms 打一个字符。
- 条目 11 秒后淡出，14.5 秒后移除；容器最多保留 8 条。

## 世界地图与舆图（Phase 4）

- 世界连接图（全部双向可达，areas.ts exits）：
  `武当山 ←→ 平安镇 ←→ 商家堡 ←→ 官道 ←┬→ 百花谷 ├→ 五指山 ├→ 莲花山 └→ 渡口 →（摆渡）→ 冰火岛`；镇内「后山入口」步行入后山；后山 ├→ 大雪山 ├→ 黑风寨（门槛）└→ 无名石窟（cave 主题）；时空尽头仅舆图进入（`endOpen` 机制不变）。
- **进入门槛**（`travelTo` 统一检查，被拦返回文案并留在原地）：黑风寨需背包有 `qingLongTu`（旧版主线奖励，现作为可收集底料）；石窟深处裂缝（`crack` action）需基本轻功 ≥30，深处内容为预留彩蛋。
- **已知区域**：`flags["known-areas"]: string[]`，初始 `[town, houshan, wudang, shangjia]`；`travelTo` 成功进入即记入（作弊瞬移 `cheatTeleport` 绕过 travelTo，不记入）。旧档缺省时 `fillDefaults` 补默认四区域 + 当前所在区域。
- **舆图界面**（UIManager.showTravel，DOM + inline SVG，viewBox 860×460）：羊皮纸底 + 程序化山川/河流/树林/海岸线；已知=墨点+名称（可点击传送，hover 金光），未知=灰点「???」，当前所在=红点+小红旗；两端都已知的连接画虚线路径；节点/路径布局常量在文件末尾 `MAP_POS/MAP_EDGES/MAP_DECOR`。
- 传送规则：仅 known-areas 内区域可传送（end 额外需 `endOpen`），未知区域在 App `travel:` action 拦阻；顶部小字「足迹所至，方入舆图」。
- 旧版主线目标指引 `mainQuestTarget` 已不用于开放世界；若仍渲染金色光圈，属旧版遗留逻辑。
- cave 主题渲染：WorldScene `caveMode` 恒暗（不随时辰变色温、无日月星云），远中近景按暗色调、地面装饰为灰紫石笋 + 火把光晕呼吸；`rollWeather` 把 cave 归入 dark/cloud 分支（不下雨雪）。

## 世界活性

- 天气：晴/雨/雪/雾/风（雨 10% 升级雷雨），随机变化，切换时粒子 1 秒淡入淡出；雨落地溅射、雪斜落、雾分前后两层、风按区域主题吹不同粒子；HUD 天气格带图标（☀️🌧️❄️🌫️💨⛈️）。天气罩按昼夜浓度动态变色：雨天夜里更沉、雪天夜里更冷、雾天夜里更浓。
- 昼夜：全天色温关键帧渐变（daynight.ts），日月按弧线运行、夜晚星空闪烁、建筑窗灯与门口灯笼亮起；NPC 作息（小乞丐 6-21 时夜里回破庙、阿绣 5-22 时夜里回屋、挑夫 6-18 时、说书人 19-23 时；商店/功能关键 NPC 一律不加作息）。
- **NPC 生活引擎**（content/relations.ts + sim/npcLife.ts + WorldScene 接线）：每 25-45 秒从当前区域/房间**在场且同屏**（|Δx|<500）的 NPC 中挑一对有关系的演出——互相走近至相距 60px → 轮流头顶冒气泡（emoji 大字号 + 短句，每条 1.6 秒，2-3 来回）→ 各自归位。语料 75% 取该对专属、25% 取 kind 通用池（couple/master/neighbor/rival/friend/trade 各 6 组），并按情境插入：雨雪雾风吐槽、夜晚寒暄、冷铁衣已除后的主线传闻。演出期间暂停单人闲聊气泡；同一对 10 分钟冷却（lifeCooldowns，按 this.time.now 真实时间）；玩家全程在互动中点 300px 内看完，10% 概率得一条传闻 toast（👂 你无意间听到……）。气泡用完即 destroy，`cleanup()` 中止演出防泄漏。12 对关系全部同区域/同房间且站位可达（为此微调了站位：挑夫 820→780、小乞丐 1850→1100、九袋长老 980→760、苍月 1160→640、神秘人 3150→3080）。
- **随机事件**（actions.ts，四场景）：投宿/闭关 30%、旅行 20%（travelTo 成功即掷，含舆图传送与步行出口）、打坐收功（满 8 秒）15%；统一入口 `App.maybeEvent(scene)`——先掷选择支（约占触发 15%，走 ui.showDialog 的「奇遇」对话，选项发 `event-*` action 在 App 结算奖惩），否则掷文本事件（31 条，按场景/天气/夜间过滤后加权抽取，toast 输出并刷新 HUD）。选择支 5 个：老乞婆施舍（善恶，10% 回赠残页）、神药商贩（40% 真大还丹/60% 假药）、醉汉比武（输赢各半）、寒夜书生（仅夜间旅行）、货郎藏宝图（30% 真货）。
- **传闻体系**：统一出口 story.ts 的 `randomRumor(s?)`——常识 12 条 + 区域 28 条（14 区域各 2 条）+ 状态感知 9 组（周三已除/冷铁衣已除/云中鹤已除/石板 ≥1/≥3/善恶 ≤-20/≥60/已婚/主线完成），不传 state 只出常识池；闲聊气泡与开场志都传 state。app.ts 旧 randomRumorText 已删除。
- 地图收集物：金银光点/药草随机刷新，拾取提示，40 秒后易位重刷。
- NPC 头顶随机闲聊气泡（randomRumor(s)，生活演出期间暂停）；区域首次进入有“开场志”文案。

## 穿越者天书（F8）

- 可改：四项天赋、银两、潜能、经验、善恶、内力强度、年龄、气血、内力、饥饱、口渴、中毒、容貌、日期时辰、天气、性别、门派、宅邸、好感、物品数量、单门或全部武功；另支持瞬移、锁血无敌、经典黑白模式（`YOBDC` 创建名可解锁并送资源）。
- 新增「所见武学」：战斗/事件观察到的武学自动记录，可瞬间掌握到该武学上限。
- 所有数值按江湖上限截断：天赋 10-60、善恶 ±100、内力强度 0-999、年龄 14-99、物品 0-999、气血/内力按公式上限、武功按各自 `max`。
- 作弊面板按钮必须 `bindPanelActions`；输入框带 id，取值用 `App.inputVal`（面板未打开时安全返回 0）。

## 存档

- `localStorage` key：`yxts-golden-save`；槽位 0 为自动存档，1-3 为手动。
- 存档版本：当前 v3（`newGame` 写入 `version`）。v1→v2 迁移 `axiuLiking`；v2→v3 新增 `world`/`observedSkills`/关系网络，并用 `fillDefaults` 补全缺省字段。
- 存档 JSON 损坏时：原始串备份到 `yxts-golden-save.corrupt`，置 `hadCorruptSave`，App 启动 toast 提示后按空档处理。
- 阿绣好感保留在 `affections.axiu` 供旧界面兼容，新关系系统统一走 `world.npcRelations["player"]["axiu"]`。
- 舆图已知区域只存 `flags["known-areas"]`（string[]），缺省由 `fillDefaults` 补默认四区域 + 当前区域，加新区域无需迁移。
- 角色死亡：回平安镇镇口，银两减半、潜能损失三成、有效气血减半（仅 battle.syncBack 一处执行）；切磋死亡无惩罚。

## 操作

- 移动：方向键 / A D；W 进入房间
- 交互：E 或回车；打开舆图：M（或底部“舆图”按钮，任意地点可用；Esc/面板按钮关闭；只能传送到已知区域）
- 菜单：1 状态 / 2 背包·穿戴 / 3 武功 / 5 打坐 / 6 存档 / M 舆图 / F8 穿越者天书
- NPC 互动按钮：对话 / 善意 / 敌意（商店、学艺、疗伤、切磋、亲密作为随机结果出现）

## 开发约定

- 默认使用 `rg`/`rg --files` 检索；文件修改用 `apply_patch`。
- 保持模拟/渲染/UI 分层，不要在 Phaser 场景里写规则。
- 新增玩法数据优先落 `src/game/content/`；新动作在 `App.handleAction` 注册。
- DOM 按钮：给元素加 `data-act`，再由 `UIManager.bindPanelActions` 绑定；动态面板渲染后必须重新绑定。
- 改动后至少跑 `npx tsc -b` 与 `npm run build`。
- QA：无单元测试框架；用 `playwright-core` + 系统 Chrome 无头跑临时脚本（见历史 `/tmp/yxts-*.mjs` 模式），验证标题→创角→世界→战斗→菜单等主流程，收集 `pageerror` 与 console error。
- 直接编辑 `dist/`、`dist-single/` 无效，修改源码后重新构建。

## 已知遗留

- `tsconfig.tsbuildinfo` 为 tsc 增量缓存。
- 生产构建有 Phaser 体积提示（1.6MB+），当前可接受。
- 战斗舞台下半部被 DOM 战斗面板（#cb-log）半透遮挡，角色立于其后偏暗，为既有布局设计。
- 战斗中敌方技能（EnemySkillDef）只有通用前摇光环，暂无按技能形态的专属特效。
- Phaser 在 scene 重启后偶发把同一次 keydown 双分发（时序竞争，根源未除）：WorldScene.interact 已加 250ms 节流防双触发；M/ESC 等键盘 action 务必保持幂等，不要做成 toggle 语义。
- 战斗收场（含逃跑）后玩家若仍站在敌人 30px 触发圈内，battleCooldown（约 1 秒）归零会再次撞上开战——逃跑后应立即走开；QA 脚本在战斗后原地挂机曾被此机制反复拖回战斗。
