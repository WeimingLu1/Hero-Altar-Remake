import assert from "node:assert/strict";
import test from "node:test";
import {
  KUNGFU_SCHOOLS,
  kungfuSchoolId,
  kungfuSchoolName,
} from "../app/game-core/kungfu-school";
import { originalTables } from "../app/game-core/original-data";

test("基础功夫(1-11)归入基础功夫，不绑定门派", () => {
  for (let id = 1; id <= 11; id++) {
    assert.equal(kungfuSchoolId(id), -1, `基础功夫 ${id} 应归入基础`);
    assert.equal(kungfuSchoolName(id), "基础功夫");
  }
});

test("每个专门武功(id>=12)都归属门派或秘传", () => {
  originalTables.kungfus.forEach((skill, id) => {
    if (!skill || id < 12) return;
    const schoolId = kungfuSchoolId(id);
    assert.ok(
      schoolId === -2 || (schoolId >= 1 && schoolId <= 9),
      `武功 ${id} ${skill.name} 应有门派或秘传，实际 ${schoolId}`,
    );
  });
  // 秘传书(菜花宝典等)带来的无门派武功
  assert.equal(kungfuSchoolName(56), "秘传"); // 吸血大法
  assert.equal(kungfuSchoolName(59), "秘传"); // 旋风三连斩
});

test("知名武功归属正确", () => {
  assert.equal(kungfuSchoolName(12), "八卦门"); // 八卦游身掌
  assert.equal(kungfuSchoolName(17), "花间派"); // 一剪梅花手
  assert.equal(kungfuSchoolName(32), "太极门"); // 太极拳
  assert.equal(kungfuSchoolName(39), "雪山剑派"); // 雪山剑法
  assert.equal(kungfuSchoolName(43), "兽王派"); // 猛虎拳
  assert.equal(kungfuSchoolName(49), "茅山派"); // 天师掌法
  assert.equal(kungfuSchoolName(28), "尹贺谷"); // 无法拳
  assert.equal(kungfuSchoolName(23), "红莲教"); // 太祖长拳
});

test("门派列表与存档 classId 对应且无空门派漏配", () => {
  assert.equal(KUNGFU_SCHOOLS[0], "江湖小虾");
  assert.equal(KUNGFU_SCHOOLS.length, 10);
});
