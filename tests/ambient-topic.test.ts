import assert from "node:assert/strict";
import test from "node:test";
import { ambientTopics, pickAmbientTopic } from "../app/game-core/ambient-npc";

test("议题池提供多个世界契合、非空泛的议题", () => {
  assert.ok(ambientTopics.length >= 6, `应有多个议题，实际 ${ambientTopics.length}`);
  assert.ok(ambientTopics.every((t) => t.length >= 4), "议题应足够具体");
});

test("议题选取是确定性的且来自议题池", () => {
  assert.equal(pickAmbientTopic(42), pickAmbientTopic(42));
  for (let seed = 0; seed < 20; seed++)
    assert.ok(
      ambientTopics.includes(pickAmbientTopic(seed)),
      `议题 ${seed} 应来自议题池`,
    );
});
