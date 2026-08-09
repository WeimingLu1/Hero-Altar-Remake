import assert from "node:assert/strict";
import test from "node:test";
import { originalMaps } from "../app/game-core/original-world";
import {
  allVisualMaps,
  canEnterVisualCell,
  loadVisualMap,
  migrateWorldPosition,
  originalAnchor,
  validateAnchorEnvironment,
} from "../app/game-core/visual-map";

test("all 69 maps preserve every original event as an immutable visual anchor", () => {
  assert.equal(allVisualMaps.length, 69);
  assert.equal(allVisualMaps.flatMap((map) => map.anchors).length, 400);
  for (const map of originalMaps) {
    const visual = loadVisualMap(map.id);
    assert.ok(visual, `missing visual map ${map.id}`);
    assert.equal(visual.width, map.width);
    assert.equal(visual.height, map.height);
    for (const event of map.events) {
      const anchor = originalAnchor(map.id, event.id);
      assert.ok(anchor, `missing ${map.id}:${event.id}`);
      assert.deepEqual([anchor.x, anchor.y, anchor.locked], [event.x, event.y, true]);
    }
    assert.deepEqual(validateAnchorEnvironment(visual), []);
  }
});

test("visual movement ignores scenery but blocks declared interactive objects", () => {
  const visual = loadVisualMap(3)!;
  const scenery = visual.layers["structures-low"][0];
  assert.ok(scenery);
  assert.equal(canEnterVisualCell(3, scenery.x, scenery.y), true);
  const well = visual.anchors.find((anchor) => anchor.kind === "well")!;
  assert.ok(well);
  assert.equal(canEnterVisualCell(3, well.x, well.y), false);
});

test("version-one positions remain stable unless invalid or blocked", () => {
  assert.deepEqual(migrateWorldPosition({ mapId: 3, x: 10, y: 10, direction: 8 }), { mapId: 3, x: 10, y: 10, direction: 8 });
  const migrated = migrateWorldPosition({ mapId: 3, x: 999, y: 999, direction: 2 });
  assert.equal(migrated.mapId, 3);
  assert.ok(migrated.x >= 0 && migrated.x < 22);
  assert.ok(migrated.y >= 0 && migrated.y < 15);
});

test("four vertical-slice maps contain authored anchor-led compositions", () => {
  for (const mapId of [3, 6, 7, 23]) {
    const map = loadVisualMap(mapId)!;
    assert.ok(map.layers["ground-detail"].length + map.layers["structures-low"].length + map.layers["props-low"].length > 8, `MAP ${mapId} lacks authored detail`);
  }
});
