import assert from "node:assert/strict";
import test from "node:test";
import {
  SAVE_VERSION,
  fresh,
  normalize,
  parseSave,
} from "../app/game-core/save-system";
import {
  acceptGeneratedQuest,
  appendGeneratedQuestTranscript,
  createGeneratedQuestDraft,
  generatedQuestParticipant,
} from "../app/game-core/generated-task-system";

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

test("v3 saves preserve the complete active generated-task transcript", () => {
  const save = fresh(), issuer = generatedQuestParticipant(13)!;
  const draft = createGeneratedQuestDraft({
    issuer,
    actor: save.actor,
    tasks: save.tasks,
    random: () => 0,
  })!;
  acceptGeneratedQuest(save.tasks, draft);
  appendGeneratedQuestTranscript(save.tasks, {
    speaker: "player",
    speech: "此事我应下了。",
  });
  appendGeneratedQuestTranscript(save.tasks, {
    speaker: "npc",
    npcId: issuer.npcId,
    speech: "那便一言为定。",
  });
  const parsed = parseSave(JSON.parse(JSON.stringify(save)));
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.version, 3);
    assert.equal(parsed.value.tasks.generatedQuest?.id, draft.id);
    assert.deepEqual(
      parsed.value.tasks.generatedQuest?.transcript.map((entry) => entry.speech),
      ["此事我应下了。", "那便一言为定。"],
    );
  }
});

test("v2 saves migrate with an empty generated-task slot", () => {
  const legacy = fresh();
  legacy.version = 2 as typeof legacy.version;
  delete (legacy.tasks as Partial<typeof legacy.tasks>).generatedQuest;
  delete (legacy.tasks as Partial<typeof legacy.tasks>).generatedQuestNextOfferAt;
  delete (legacy.tasks as Partial<typeof legacy.tasks>).generatedQuestSerial;
  const migrated = normalize(legacy);
  assert.equal(migrated.version, 3);
  assert.equal(migrated.tasks.generatedQuest, null);
  assert.equal(migrated.tasks.generatedQuestNextOfferAt, 0);
  assert.equal(migrated.tasks.generatedQuestSerial, 0);
});

test("导入任务必须仍指向对应 NPC 的真实地图事件", () => {
  const save = fresh(), issuer = generatedQuestParticipant(13)!;
  const draft = createGeneratedQuestDraft({
    issuer,
    actor: save.actor,
    tasks: save.tasks,
    random: () => 0,
  })!;
  acceptGeneratedQuest(save.tasks, draft);
  save.tasks.generatedQuest!.target.eventId = 9999;
  const migrated = normalize(save);
  assert.equal(migrated.tasks.generatedQuest, null);
});
