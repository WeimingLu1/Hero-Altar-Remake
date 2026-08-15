import {
  isCancelKey,
  isConfirmKey,
  isMainMenuKey,
  isMenuTabKey,
  menuTabFromKey,
} from "../original/keybindings";

export type Direction = "up" | "down" | "left" | "right";

export type InputLayer =
  | "composition"
  | "editor"
  | "title"
  | "intro"
  | "help"
  | "creator"
  | "confirmation"
  | "dialogue"
  | "battle"
  | "arcade"
  | "modal"
  | "menu"
  | "world";

export type ConfirmationKind = "cheat" | "hidden-quest" | "item";
export type DialogueKind = "npc-chat" | "event-text";
export type BattleView = "action" | "outcome" | "items" | "specials";
export type ArcadeKind = "select" | "dance" | "ball";
export type ModalKind =
  | "life"
  | "appearance"
  | "fly"
  | "cultivation"
  | "npc"
  | "shop"
  | "study";

export interface InputContext {
  screen: "title" | "intro" | "help" | "create" | "play";
  confirmation?: ConfirmationKind | null;
  dialogue?: DialogueKind | null;
  battle?: { view?: BattleView } | null;
  arcade?: ArcadeKind | null;
  modal?: { kind: ModalKind; active?: boolean } | null;
  menu?: { tab: 0 | 1 | 2 | 3; cheatSubtab?: number } | null;
}

export interface InputTargetLike {
  tagName?: string;
  isContentEditable?: boolean;
}

export interface GameKeyEvent {
  key: string;
  isComposing?: boolean;
  keyCode?: number;
  target?: InputTargetLike | null;
}

export type GameCommand =
  | { type: "blur-editor" }
  | { type: "navigate"; direction: Direction }
  | { type: "confirm" }
  | { type: "cancel" }
  | { type: "screen-advance" }
  | { type: "screen-back" }
  | { type: "world-move"; direction: Direction }
  | { type: "world-interact" }
  | { type: "world-exit" }
  | { type: "menu-open"; tab: 0 | 1 | 2 | 3 }
  | { type: "menu-close" }
  | { type: "menu-next-tab" }
  | { type: "menu-next-cheat-subtab" }
  | { type: "menu-skill-secondary" }
  | { type: "cheat-adjust"; direction: -1 | 1 }
  | { type: "cheat-maximize" }
  | { type: "battle-specials-open" }
  | { type: "battle-items-open" }
  | { type: "battle-flee" }
  | { type: "cultivation-open" }
  | { type: "fly-open" }
  | { type: "task-journal-open" };

export interface GameInputResolution {
  key: string;
  layer: InputLayer;
  command: GameCommand | null;
  /** Arrow keys and Tab are captured only while the game owns the input. */
  preventDefault: boolean;
  /** Continuous movement can add this normalized key to the held-key set. */
  trackHeld: boolean;
  /** Explicitly prohibited bindings never fall through to a game command. */
  blocked: boolean;
}

const LEGACY_KEY_NAMES: Readonly<Record<string, string>> = {
  down: "arrowdown",
  esc: "escape",
  left: "arrowleft",
  right: "arrowright",
  spacebar: "space",
  up: "arrowup",
};

const DIRECTION_KEYS: Readonly<Record<string, Direction>> = {
  arrowdown: "down",
  arrowleft: "left",
  arrowright: "right",
  arrowup: "up",
  d: "right",
  a: "left",
  s: "down",
  w: "up",
};

const VERTICAL_DIRECTIONS = new Set<Direction>(["up", "down"]);

export const normalizeGameKey = (key: string) => {
  const normalized = key === " " ? "space" : key.toLowerCase();
  return LEGACY_KEY_NAMES[normalized] ?? normalized;
};

export const isEditableInputTarget = (target?: InputTargetLike | null) => {
  if (!target) return false;
  const tagName = target.tagName?.toUpperCase();
  return (
    target.isContentEditable === true ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT"
  );
};

export const isForbiddenGameKey = (key: string) => {
  const normalized = normalizeGameKey(key);
  return (
    normalized === "z" ||
    normalized === "space" ||
    normalized === "f" ||
    normalized === "k" ||
    /^f(?:[1-9]|1[0-2])$/.test(normalized)
  );
};

export const directionFromGameKey = (key: string) =>
  DIRECTION_KEYS[normalizeGameKey(key)] ?? null;

export const resolveInputLayer = (context: InputContext): InputLayer => {
  if (context.screen !== "play") {
    return context.screen === "create" ? "creator" : context.screen;
  }
  // Keep this order aligned with the global keyboard contract. A command is
  // resolved in exactly one layer and never falls through to the world.
  if (context.confirmation) return "confirmation";
  if (context.dialogue) return "dialogue";
  if (context.battle) return "battle";
  if (context.arcade) return "arcade";
  if (context.modal) return "modal";
  if (context.menu) return "menu";
  return "world";
};

const navigationCommand = (
  key: string,
  verticalOnly = false,
): GameCommand | null => {
  const direction = directionFromGameKey(key);
  if (!direction || (verticalOnly && !VERTICAL_DIRECTIONS.has(direction))) {
    return null;
  }
  return { type: "navigate", direction };
};

const basicChoiceCommand = (key: string, verticalOnly = true) =>
  navigationCommand(key, verticalOnly) ??
  (isConfirmKey(key)
    ? ({ type: "confirm" } as const)
    : isCancelKey(key)
      ? ({ type: "cancel" } as const)
      : null);

const resolveScreenCommand = (
  layer: "title" | "intro" | "help" | "creator",
  key: string,
): GameCommand | null => {
  if (layer === "title") {
    return navigationCommand(key, true) ??
      (isConfirmKey(key) ? { type: "confirm" } : null);
  }
  if (layer === "intro") {
    return isConfirmKey(key) || isCancelKey(key)
      ? { type: "screen-advance" }
      : null;
  }
  if (layer === "help") {
    return isConfirmKey(key) || isCancelKey(key)
      ? { type: "screen-back" }
      : null;
  }
  return basicChoiceCommand(key, false);
};

const resolveDialogueCommand = (
  kind: DialogueKind,
  key: string,
): GameCommand | null => {
  if (kind === "npc-chat") {
    return isCancelKey(key) ? { type: "cancel" } : null;
  }
  return isConfirmKey(key) || isCancelKey(key)
    ? { type: "screen-advance" }
    : null;
};

const resolveBattleCommand = (
  view: BattleView,
  key: string,
): GameCommand | null => {
  if (view === "items") {
    if (key === "i") return { type: "cancel" };
    return basicChoiceCommand(key);
  }
  if (view === "specials" || view === "outcome") {
    return basicChoiceCommand(key);
  }
  if (key === "q" || key === "c") return { type: "battle-specials-open" };
  if (key === "i") return { type: "battle-items-open" };
  if (key === "g") return { type: "battle-flee" };
  return isConfirmKey(key)
    ? { type: "confirm" }
    : isCancelKey(key)
      ? { type: "cancel" }
      : null;
};

const resolveArcadeCommand = (kind: ArcadeKind, key: string) => {
  if (kind === "dance") {
    return (
      navigationCommand(key) ??
      (isCancelKey(key) ? ({ type: "cancel" } as const) : null)
    );
  }
  if (kind === "select") return basicChoiceCommand(key);
  return isConfirmKey(key)
    ? ({ type: "confirm" } as const)
    : isCancelKey(key)
      ? ({ type: "cancel" } as const)
      : null;
};

const resolveModalCommand = (kind: ModalKind, key: string) => {
  if (kind === "fly") {
    if (key === "h") return { type: "cancel" } as const;
    return basicChoiceCommand(key, false);
  }
  if (kind === "cultivation" && key === "r") {
    return { type: "cancel" } as const;
  }
  return basicChoiceCommand(key);
};

const resolveMenuCommand = (
  menu: NonNullable<InputContext["menu"]>,
  key: string,
): GameCommand | null => {
  if (key === "tab") return { type: "menu-next-tab" };
  if (isMenuTabKey(key)) {
    return { type: "menu-open", tab: (menuTabFromKey(key) ?? 0) as 0 | 1 | 2 | 3 };
  }
  if (menu.tab === 3) {
    if (key === "q") return { type: "menu-next-cheat-subtab" };
    if (key === "m") {
      return menu.cheatSubtab === 1 || menu.cheatSubtab === 3
        ? { type: "cheat-maximize" }
        : { type: "menu-close" };
    }
    if (menu.cheatSubtab === 1 || menu.cheatSubtab === 3) {
      if (key === "arrowleft" || key === "a") {
        return { type: "cheat-adjust", direction: -1 };
      }
      if (key === "arrowright" || key === "d") {
        return { type: "cheat-adjust", direction: 1 };
      }
    }
    return (
      navigationCommand(key, true) ??
      (isConfirmKey(key)
        ? { type: "confirm" }
        : isCancelKey(key)
          ? { type: "menu-close" }
          : null)
    );
  }
  if (menu.tab === 2 && (key === "c" || key === "r")) {
    return { type: "menu-skill-secondary" };
  }
  if (isCancelKey(key) || isMainMenuKey(key)) return { type: "menu-close" };
  return navigationCommand(key) ??
    (isConfirmKey(key) ? { type: "confirm" } : null);
};

const resolveWorldCommand = (key: string): GameCommand | null => {
  const direction = directionFromGameKey(key);
  if (direction) return { type: "world-move", direction };
  if (isConfirmKey(key)) return { type: "world-interact" };
  if (isMainMenuKey(key)) return { type: "menu-open", tab: 0 };
  if (isMenuTabKey(key)) {
    return { type: "menu-open", tab: (menuTabFromKey(key) ?? 0) as 0 | 1 | 2 | 3 };
  }
  if (key === "r") return { type: "cultivation-open" };
  if (key === "h") return { type: "fly-open" };
  if (key === "t") return { type: "task-journal-open" };
  if (isCancelKey(key)) return { type: "world-exit" };
  return null;
};

export const resolveGameKey = (
  event: GameKeyEvent,
  context: InputContext,
): GameInputResolution => {
  const key = normalizeGameKey(event.key);
  if (event.isComposing || event.keyCode === 229) {
    return {
      key,
      layer: "composition",
      command: null,
      preventDefault: false,
      trackHeld: false,
      blocked: false,
    };
  }
  if (isEditableInputTarget(event.target)) {
    return {
      key,
      layer: "editor",
      command: key === "escape" ? { type: "blur-editor" } : null,
      preventDefault: false,
      trackHeld: false,
      blocked: false,
    };
  }

  const layer = resolveInputLayer(context);
  const blocked = isForbiddenGameKey(key);
  let command: GameCommand | null = null;
  if (!blocked) {
    if (
      layer === "title" ||
      layer === "intro" ||
      layer === "help" ||
      layer === "creator"
    ) {
      command = resolveScreenCommand(layer, key);
    } else if (layer === "confirmation") {
      command = basicChoiceCommand(key);
    } else if (layer === "dialogue") {
      command = resolveDialogueCommand(context.dialogue!, key);
    } else if (layer === "battle") {
      command = resolveBattleCommand(context.battle?.view ?? "action", key);
    } else if (layer === "arcade") {
      command = resolveArcadeCommand(context.arcade!, key);
    } else if (layer === "modal") {
      command = resolveModalCommand(context.modal!.kind, key);
    } else if (layer === "menu") {
      command = resolveMenuCommand(context.menu!, key);
    } else {
      command = resolveWorldCommand(key);
    }
  }

  return {
    key,
    layer,
    command,
    preventDefault:
      !blocked && (key.startsWith("arrow") || key === "tab"),
    trackHeld: layer === "world" && command?.type === "world-move",
    blocked,
  };
};
