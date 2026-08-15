export const CONFIRM_KEYS = ["e", "enter"] as const;
export const CANCEL_KEYS = ["x", "escape"] as const;
export const MAIN_MENU_KEYS = ["c", "m"] as const;
export const MENU_TAB_KEYS = ["1", "2", "3", "4"] as const;

export const isConfirmKey = (key: string) =>
  (CONFIRM_KEYS as readonly string[]).includes(key);
export const isCancelKey = (key: string) =>
  (CANCEL_KEYS as readonly string[]).includes(key);
export const isMainMenuKey = (key: string) =>
  (MAIN_MENU_KEYS as readonly string[]).includes(key);
export const isMenuTabKey = (key: string) =>
  (MENU_TAB_KEYS as readonly string[]).includes(key);

export const menuTabFromKey = (key: string) =>
  isMenuTabKey(key) ? Number(key) - 1 : null;

export const KEYBOARD_HELP = [
  "移动：WASD / 方向键 · 互动与确认：E / Enter",
  "主菜单：C / M · 行囊 1 · 状态 2 · 功夫 3 · 秘技 4",
  "修炼：R · 轻功：H · 任务簿：T",
  "战斗绝招：Q · 战斗物品：I · 生死战逃跑：G",
  "返回与取消：X / Escape · 保存：右上角按钮",
] as const;
