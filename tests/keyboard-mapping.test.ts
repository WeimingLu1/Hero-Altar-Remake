import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../app/original/original-world.tsx", import.meta.url),
  "utf8",
);

test("正式版只用 E 或 Enter 进行互动和确认", () => {
  assert.match(source, /const confirm = \["e", "enter"\]\.includes\(k\)/);
  assert.doesNotMatch(source, /\["z",\s*"enter"/);
  assert.doesNotMatch(source, /"enter",\s*" "/);
});

test("正式版不绑定字母 F 或 F1-F12 功能键", () => {
  assert.doesNotMatch(source, /k === "f(?:\d+)?"/);
  assert.doesNotMatch(source, /<kbd>F\d*<\/kbd>/);
});
