import assert from "node:assert/strict";
import test from "node:test";
import {
  directionFromGameKey,
  isEditableInputTarget,
  isForbiddenGameKey,
  normalizeGameKey,
  resolveGameKey,
  resolveInputLayer,
  type InputContext,
} from "../app/game-core/game-input";

const play = (overrides: Partial<InputContext> = {}): InputContext => ({
  screen: "play",
  ...overrides,
});

test("按键归一、方向识别和禁止键保持唯一规则", () => {
  assert.equal(normalizeGameKey("E"), "e");
  assert.equal(normalizeGameKey("Esc"), "escape");
  assert.equal(normalizeGameKey(" "), "space");
  assert.equal(directionFromGameKey("ArrowLeft"), "left");
  assert.equal(directionFromGameKey("D"), "right");
  for (const key of ["z", " ", "f", "F1", "f12", "k"]) {
    assert.equal(isForbiddenGameKey(key), true, `${key} should be forbidden`);
    const result = resolveGameKey({ key }, play());
    assert.equal(result.blocked, true);
    assert.equal(result.command, null);
    assert.equal(result.trackHeld, false);
  }
  assert.equal(isForbiddenGameKey("enter"), false);
});

test("中文输入法和编辑控件先于所有游戏输入", () => {
  const context = play({ battle: {}, menu: { tab: 0 } });
  assert.deepEqual(resolveGameKey({ key: "e", isComposing: true }, context), {
    key: "e",
    layer: "composition",
    command: null,
    preventDefault: false,
    trackHeld: false,
    blocked: false,
  });
  assert.equal(
    resolveGameKey({ key: "Enter", keyCode: 229 }, context).layer,
    "composition",
  );
  assert.equal(isEditableInputTarget({ tagName: "textarea" }), true);
  assert.equal(isEditableInputTarget({ isContentEditable: true }), true);
  assert.equal(
    resolveGameKey(
      { key: "e", target: { tagName: "INPUT" } },
      context,
    ).command,
    null,
  );
  assert.deepEqual(
    resolveGameKey(
      { key: "Escape", target: { tagName: "TEXTAREA" } },
      context,
    ).command,
    { type: "blur-editor" },
  );
});

test("输入层严格按确认、对话、战斗、小游戏、模态、菜单、世界排序", () => {
  const all = play({
    confirmation: "item",
    dialogue: "event-text",
    battle: {},
    arcade: "dance",
    modal: { kind: "study" },
    menu: { tab: 0 },
  });
  assert.equal(resolveInputLayer(all), "confirmation");
  assert.equal(
    resolveInputLayer({ ...all, confirmation: null }),
    "dialogue",
  );
  assert.equal(
    resolveInputLayer({ ...all, confirmation: null, dialogue: null }),
    "battle",
  );
  assert.equal(
    resolveInputLayer({
      ...all,
      confirmation: null,
      dialogue: null,
      battle: null,
    }),
    "arcade",
  );
  assert.equal(
    resolveInputLayer({
      ...all,
      confirmation: null,
      dialogue: null,
      battle: null,
      arcade: null,
    }),
    "modal",
  );
  assert.equal(
    resolveInputLayer(play({ menu: { tab: 0 } })),
    "menu",
  );
  assert.equal(resolveInputLayer(play()), "world");
});

test("标题、序章、帮助和创建页面只产生页面层命令", () => {
  assert.deepEqual(
    resolveGameKey({ key: "w" }, { screen: "title" }).command,
    { type: "navigate", direction: "up" },
  );
  assert.deepEqual(
    resolveGameKey({ key: "e" }, { screen: "title" }).command,
    { type: "confirm" },
  );
  assert.deepEqual(
    resolveGameKey({ key: "x" }, { screen: "intro" }).command,
    { type: "screen-advance" },
  );
  assert.deepEqual(
    resolveGameKey({ key: "Enter" }, { screen: "help" }).command,
    { type: "screen-back" },
  );
  assert.deepEqual(
    resolveGameKey({ key: "d" }, { screen: "create" }).command,
    { type: "navigate", direction: "right" },
  );
});

test("世界键位覆盖移动、互动、菜单、修炼、轻功、任务和退出", () => {
  assert.deepEqual(resolveGameKey({ key: "W" }, play()).command, {
    type: "world-move",
    direction: "up",
  });
  const arrow = resolveGameKey({ key: "ArrowDown" }, play());
  assert.equal(arrow.preventDefault, true);
  assert.equal(arrow.trackHeld, true);
  assert.deepEqual(resolveGameKey({ key: "e" }, play()).command, {
    type: "world-interact",
  });
  assert.deepEqual(resolveGameKey({ key: "m" }, play()).command, {
    type: "menu-open",
    tab: 0,
  });
  assert.deepEqual(resolveGameKey({ key: "4" }, play()).command, {
    type: "menu-open",
    tab: 3,
  });
  assert.equal(resolveGameKey({ key: "r" }, play()).command?.type, "cultivation-open");
  assert.equal(resolveGameKey({ key: "h" }, play()).command?.type, "fly-open");
  assert.equal(resolveGameKey({ key: "t" }, play()).command?.type, "task-journal-open");
  assert.equal(resolveGameKey({ key: "x" }, play()).command?.type, "world-exit");
});

test("战斗、小游戏和通用模态各自截获命令", () => {
  const battle = (key: string) =>
    resolveGameKey({ key }, play({ battle: { view: "action" } })).command;
  assert.equal(battle("q")?.type, "battle-specials-open");
  assert.equal(battle("c")?.type, "battle-specials-open");
  assert.equal(battle("i")?.type, "battle-items-open");
  assert.equal(battle("g")?.type, "battle-flee");
  assert.equal(battle("x")?.type, "cancel");
  assert.equal(
    resolveGameKey(
      { key: "i" },
      play({ battle: { view: "items" } }),
    ).command?.type,
    "cancel",
  );
  assert.deepEqual(
    resolveGameKey({ key: "a" }, play({ arcade: "dance" })).command,
    { type: "navigate", direction: "left" },
  );
  assert.equal(
    resolveGameKey({ key: "h" }, play({ modal: { kind: "fly" } }))
      .command?.type,
    "cancel",
  );
  assert.equal(
    resolveGameKey(
      { key: "r" },
      play({ modal: { kind: "cultivation", active: true } }),
    ).command?.type,
    "cancel",
  );
});

test("菜单只用 Tab/数字切页，功夫和秘技保留上下文键位", () => {
  const bag = play({ menu: { tab: 0 } });
  assert.equal(resolveGameKey({ key: "Tab" }, bag).command?.type, "menu-next-tab");
  assert.deepEqual(resolveGameKey({ key: "3" }, bag).command, {
    type: "menu-open",
    tab: 2,
  });
  assert.deepEqual(resolveGameKey({ key: "d" }, bag).command, {
    type: "navigate",
    direction: "right",
  });
  assert.equal(
    resolveGameKey({ key: "c" }, play({ menu: { tab: 2 } })).command?.type,
    "menu-skill-secondary",
  );
  assert.equal(
    resolveGameKey({ key: "r" }, play({ menu: { tab: 2 } })).command?.type,
    "menu-skill-secondary",
  );
  assert.equal(
    resolveGameKey(
      { key: "q" },
      play({ menu: { tab: 3, cheatSubtab: 0 } }),
    ).command?.type,
    "menu-next-cheat-subtab",
  );
  assert.equal(
    resolveGameKey(
      { key: "m" },
      play({ menu: { tab: 3, cheatSubtab: 1 } }),
    ).command?.type,
    "cheat-maximize",
  );
  assert.deepEqual(
    resolveGameKey(
      { key: "a" },
      play({ menu: { tab: 3, cheatSubtab: 1 } }),
    ).command,
    { type: "cheat-adjust", direction: -1 },
  );
  assert.deepEqual(
    resolveGameKey(
      { key: "ArrowRight" },
      play({ menu: { tab: 3, cheatSubtab: 3 } }),
    ).command,
    { type: "cheat-adjust", direction: 1 },
  );
  assert.equal(resolveGameKey({ key: "k" }, bag).command, null);
});
