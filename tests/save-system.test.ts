import assert from "node:assert/strict";
import test from "node:test";
import {
  SAVE_VERSION,
  fresh,
  normalize,
  parseSave,
} from "../app/game-core/save-system";

test("fresh saves are deterministic and use the current schema version", () => {
  const first = fresh();
  const second = fresh();
  assert.deepEqual(first, second);
  assert.equal(first.version, SAVE_VERSION);
  assert.equal(first.savedAt, "");
});

test("v1 custom swords migrate while legal unknown fields survive", () => {
  const legacy = fresh() as unknown as Record<string, unknown>;
  legacy.version = 1;
  legacy.customNote = "玩家手工字段";
  legacy.actor = {
    ...(legacy.actor as object),
    swords: [],
    swordType: 2,
    swordName: "试炼杖",
    sword1: 7,
    sword2: 1,
    sword3: 2,
    swordTimes: 3,
    inventory: { "2:31": 1 },
  };
  const migrated = normalize(legacy);
  assert.equal(migrated.version, SAVE_VERSION);
  assert.equal(migrated.customNote, "玩家手工字段");
  assert.equal(migrated.actor.swords?.[2].name, "试炼杖");
  assert.equal(migrated.actor.inventory["2:33"], 1);
  assert.equal(migrated.actor.inventory["2:31"], undefined);
});

test("imports reject unknown maps and clamp coordinates on valid maps", () => {
  const invalid = fresh();
  invalid.position.mapId = 9999;
  assert.equal(parseSave(invalid).ok, false);

  const outside = fresh();
  outside.position.x = 9999;
  outside.position.y = -10;
  const parsed = parseSave(outside);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.position.x, 19);
    assert.equal(parsed.value.position.y, 0);
  }
});
