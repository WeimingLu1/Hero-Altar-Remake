import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const heavyRuntimeChunk = /\/(?:original-world|game-(?:maps|characters|items))-[^/]+\.js(?:\?|$)/;
const lmRuntimeChunk = /\/lm-studio-[^/]+\.js(?:\?|$)/;
const lmRequest = /\/api\/lm-studio(?:\?|$)|127\.0\.0\.1:1234\/api\/v1\/(?:chat|models)/;

test("标题页保持轻量，并且不会自动探测本地模型", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (request) => requested.push(request.url()));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "英雄坛说" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "开始游戏" })).toBeVisible();
  await expect(page.getByText(/本地模型尚未检测/)).toBeVisible();

  // Give post-hydration effects time to run; title rendering must remain local.
  await page.waitForTimeout(500);
  expect(requested.filter((url) => heavyRuntimeChunk.test(url))).toEqual([]);
  expect(requested.filter((url) => lmRuntimeChunk.test(url))).toEqual([]);
  expect(requested.filter((url) => lmRequest.test(url))).toEqual([]);
});

test("标题页通过基础无障碍扫描", async ({ page }) => {
  await page.goto("/");
  const titleResults = await new AxeBuilder({ page }).analyze();
  expect(titleResults.violations).toEqual([]);

  await page.getByRole("button", { name: "模型设置" }).click();
  await expect(page.getByRole("dialog", { name: "本地模型设置" })).toBeVisible();
  const settingsResults = await new AxeBuilder({ page }).analyze();
  expect(settingsResults.violations).toEqual([]);
});

test("标题页可以查看操作说明并返回", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "操作说明" }).click();

  await expect(page.getByRole("heading", { name: "操作说明" })).toBeVisible();
  await expect(page.getByText(/移动：WASD/)).toBeVisible();
  await expect(page.getByText(/互动与确认：E \/ Enter/)).toBeVisible();

  await page.getByRole("button", { name: "返回标题" }).click();
  await expect(page.getByRole("heading", { name: "英雄坛说" })).toBeVisible();
});

test("模型设置仅在玩家主动检测时访问受控端点", async ({ page }) => {
  const modelRequests: string[] = [];
  page.on("request", (request) => {
    if (lmRequest.test(request.url())) modelRequests.push(request.url());
  });
  await page.route("**/api/lm-studio", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "test endpoint unavailable" }),
    }),
  );
  await page.route("http://127.0.0.1:1234/**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "test endpoint unavailable" }),
    }),
  );

  await page.goto("/");
  await page.getByRole("button", { name: "模型设置" }).click();
  await expect(page.getByRole("heading", { name: "本地模型设置" })).toBeVisible();
  await expect(page.getByLabel("服务地址")).toHaveValue("http://127.0.0.1:1234");
  await expect(page.getByLabel("服务地址")).toBeFocused();
  expect(modelRequests).toEqual([]);

  await page.getByRole("button", { name: "仅检测连接", exact: true }).click();
  await expect.poll(() => modelRequests.length).toBe(1);
  await expect(page.getByText(/本地模型未连接|连接失败|检测失败/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "英雄坛说" })).toBeVisible();
});

test("开始新游戏后才载入完整世界", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (request) => requested.push(request.url()));

  await page.goto("/");
  expect(requested.some((url) => heavyRuntimeChunk.test(url))).toBe(false);

  await page.getByRole("button", { name: "开始新游戏", exact: true }).click();
  await expect(page.getByRole("heading", { name: "序 · 时空转换" })).toBeVisible();
  expect(requested.some((url) => /\/original-world-[^/]+\.js(?:\?|$)/.test(url))).toBe(true);
  expect(requested.some((url) => /\/game-maps-[^/]+\.js(?:\?|$)/.test(url))).toBe(true);
});

test("损坏的本地存档会保留并给出可恢复提示", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("rmxp-original-world-v1", "{broken-json");
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "继续游戏" })).toBeVisible();
  await page.getByRole("button", { name: "继续游戏" }).click();
  await expect(page.getByRole("alert")).toContainText("本地存档已损坏");
  await expect.poll(() =>
    page.evaluate(() => window.localStorage.getItem("rmxp-original-world-v1")),
  ).toBe("{broken-json");
});

test("JSON 存档可导入并进入完整世界", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "save.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({
      format: "rmxp-hero-original-world-save",
      version: 2,
      savedAt: "",
      position: { mapId: 1, x: 9, y: 7, direction: 2 },
      actor: {},
      tasks: {},
      flags: {},
      variables: {},
    })),
  });
  await expect(page.getByRole("img", { name: /地图，主角位于/ })).toBeVisible();
  await expect.poll(() =>
    page.evaluate(() => Boolean(window.localStorage.getItem("rmxp-original-world-v1"))),
  ).toBe(true);
});

test("战斗中可打开完整行囊并临阵切换攻防武学", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "battle-loadout-save.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({
      format: "rmxp-hero-original-world-save",
      version: 4,
      savedAt: "",
      position: { mapId: 3, x: 9, y: 10, direction: 8 },
      actor: {
        hp: 2000,
        maxHp: 2000,
        fp: 2000,
        maxFp: 2000,
        mp: 2000,
        maxMp: 2000,
        inventory: { "1:8": 2, "2:2": 1, "3:4": 1 },
        skills: Object.fromEntries(
          Array.from({ length: 60 }, (_, index) => [
            String(index + 1),
            { level: 120, points: 0 },
          ]),
        ),
        skillUse: [0, 0, 0, 1, 10, 0, 0],
      },
      tasks: {},
      flags: {},
      variables: {},
    })),
  });
  await expect(page.getByRole("img", { name: /地图，主角位于/ })).toBeVisible();
  await page.keyboard.press("E");
  await page.getByRole("dialog", { name: "道德和尚" })
    .getByRole("button", { name: "战斗" }).click();

  const battle = page.getByRole("dialog", { name: /与道德和尚战斗/ });
  await expect(battle.getByRole("button", { name: /行囊 I/ })).toBeVisible();
  await expect(battle.getByRole("button", { name: /武学 M/ })).toBeVisible();

  await page.keyboard.press("q");
  const specials = page.getByRole("dialog", { name: "选择绝招" }),
    specialList = specials.locator(".special-picker-list");
  await expect(specialList.getByRole("option")).toHaveCount(40);
  const specialMetrics = await specials.evaluate((element) => {
    const panel = element.getBoundingClientRect(),
      list = element.querySelector<HTMLElement>(".special-picker-list")!;
    return {
      panelBottom: panel.bottom,
      viewportHeight: window.innerHeight,
      overflow: getComputedStyle(element).overflow,
      listOverflowY: getComputedStyle(list).overflowY,
      listClientHeight: list.clientHeight,
      listScrollHeight: list.scrollHeight,
    };
  });
  expect(specialMetrics.panelBottom).toBeLessThanOrEqual(specialMetrics.viewportHeight);
  expect(specialMetrics.overflow).toBe("hidden");
  expect(specialMetrics.listOverflowY).toBe("auto");
  expect(specialMetrics.listScrollHeight).toBeGreaterThan(specialMetrics.listClientHeight);
  await page.keyboard.press("w");
  await expect.poll(() => specialList.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await page.keyboard.press("x");

  await page.keyboard.press("m");
  // 战斗武学面板与主菜单「功夫」页同构：全部已学功夫按门类完整列出。
  const skills = page.getByRole("dialog", { name: "临阵调整武学" });
  await expect(skills.getByRole("button", { name: /八卦游身掌/ })).toBeVisible();
  await expect(skills.getByRole("button", { name: /太极剑/ })).toBeVisible();
  await expect(skills.getByRole("button", { name: /混元一气功/ })).toBeVisible();
  // 行内主按钮 = 运用与主菜单同一套规则；右侧按钮 = 设为招架。
  await skills.getByRole("button", { name: /八卦游身掌/ }).click();
  await expect(page.getByText(/八卦游身掌已装备/)).toBeVisible();
  await skills
    .locator(".battle-kungfu-row", { hasText: "八卦游身掌" })
    .getByRole("button", { name: /招架/ })
    .click();
  await expect(page.getByText(/八卦游身掌(已)?设为招架/)).toBeVisible();
  await page.keyboard.press("m");

  await page.keyboard.press("i");
  const bag = page.getByRole("dialog", { name: "战斗行囊" });
  await expect(bag.getByRole("button", { name: /匕首/ })).toBeVisible();
  await expect(bag.getByRole("button", { name: /布衣/ })).toBeVisible();
  await page.keyboard.press("i");

  // 引擎先结算、界面再逐事实播放：播放期间不能叠加下一回合。
  const attack = battle.getByRole("button", { name: /普通攻击 E/ });
  await attack.click();
  await expect(battle.locator(".battle-live-fact")).toBeVisible();
  await expect(battle).toHaveAttribute("aria-busy", "true");
  await expect(attack).toBeDisabled();
  await expect(battle.locator(".battle-live-fact")).toBeHidden({ timeout: 10_000 });
  await expect(battle).toHaveAttribute("aria-busy", "false");
  await expect(attack).toBeEnabled();
});

test("多轮奇遇日志仍可保存并在任务簿中纵向滚动", async ({ page }) => {
  const history = Array.from({ length: 12 }, (_, index) => ({
    version: 1,
    id: `history-${index + 1}`,
    kind: "visit",
    title: `第 ${index + 1} 桩江湖委托`,
    premise: "受人所托走访江湖人物，查明一桩旧事。",
    summary: "已经找到目标人物并回到发布人处复命。",
    issuerName: "发布人",
    issuerMapName: "平安镇",
    targetName: "受访者",
    targetMapName: "郊外",
    reward: { exp: 100, potential: 33, gold: 50 },
    closingLine: "此事已了，报酬拿好。",
    completedAt: index + 1,
  }));
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "quest-history-save.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({
      format: "rmxp-hero-original-world-save",
      version: 4,
      savedAt: "",
      position: { mapId: 1, x: 9, y: 7, direction: 2 },
      actor: {},
      tasks: { generatedQuestHistory: history },
      flags: {},
      variables: {},
    })),
  });
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("原版世界进度已保存")).toBeVisible();
  await page.getByRole("button", { name: /任务 T/ }).click();
  const log = page.locator(".task-history-list");
  await expect(log).toBeVisible();
  const metrics = await log.evaluate((element) => ({
    overflowY: getComputedStyle(element).overflowY,
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(metrics.overflowY).toBe("auto");
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
});

test("NPC 菜单只保留统一交谈，并支持双立绘与自由发展", async ({ page }) => {
  const llmPayloads: Array<Record<string, unknown>> = [];
  await page.route("**/api/lm-studio", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
      return;
    }
    llmPayloads.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: 'data: {"type":"message.delta","content":"这是一句模型生成的开场。"}\n\ndata: [DONE]\n\n',
    });
  });
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "npc-menu-save.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({
      format: "rmxp-hero-original-world-save",
      version: 3,
      savedAt: "",
      position: { mapId: 3, x: 9, y: 10, direction: 8 },
      actor: {},
      tasks: {},
      flags: {},
      variables: {},
    })),
  });
  await expect(page.getByRole("img", { name: /地图，主角位于/ })).toBeVisible();
  await page.keyboard.press("E");

  const npcMenu = page.getByRole("dialog", { name: "道德和尚" });
  await expect(npcMenu).toBeVisible();
  await expect(npcMenu.getByRole("button", { name: "交谈" })).toBeVisible();
  await expect(npcMenu.getByRole("button", { name: "自由对话" })).toHaveCount(0);

  await npcMenu.getByRole("button", { name: "交谈" }).click();
  const dialogue = page.locator(".npc-talk-dialog");
  await expect(dialogue).toContainText("这是一句模型生成的开场");
  await expect(dialogue).not.toContainText("状态 ·");
  await expect(dialogue).not.toContainText("动作 ·");
  await expect(dialogue.locator(".npc-talk-portrait")).toHaveCount(2);
  await expect(dialogue.getByRole("button", { name: "自由发展" })).toBeVisible();
  expect(llmPayloads.map((payload) => String(payload.transcript || "")))
    .toContainEqual(expect.stringContaining("准备交谈"));
  await page.keyboard.press("Space");
  await expect(dialogue.getByRole("button", { name: "暂停发展" })).toBeVisible();
  await page.keyboard.press("Space");
  await expect(dialogue.getByRole("button", { name: "自由发展" })).toBeVisible();
  for (let round = 0; round < 3; round += 1) {
    await dialogue.getByRole("button", { name: "继续" }).click();
    await expect(dialogue.locator(".player-speaker")).toBeVisible();
    await expect(dialogue.locator(".npc-talk-offer")).toHaveCount(0);
    await dialogue.getByRole("button", { name: "继续" }).click();
    if (round < 2) await expect(dialogue.locator(".npc-talk-offer")).toHaveCount(0);
  }
  await expect(dialogue.locator(".npc-talk-offer")).toBeVisible();
  await expect(dialogue).toContainText("是否接受");
});
