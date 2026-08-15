import assert from "node:assert/strict";
import test from "node:test";
import {
  readJsonStorage,
  readStorageItem,
  removeStorageItem,
  writeJsonStorage,
  writeStorageItem,
  type StorageBackend,
} from "../app/game-core/safe-storage";

function memoryStorage(): StorageBackend {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

test("safe storage distinguishes missing values from unavailable storage", () => {
  const storage = memoryStorage();
  assert.deepEqual(readStorageItem("missing", storage), { ok: false, reason: "missing" });
  assert.deepEqual(readStorageItem("missing", null), { ok: false, reason: "unavailable" });

  const blocked: StorageBackend = {
    getItem: () => { throw new DOMException("blocked", "SecurityError"); },
    setItem: () => undefined,
    removeItem: () => undefined,
  };
  const result = readStorageItem("save", blocked);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "unavailable");
});

test("safe JSON storage reports invalid data without deleting it", () => {
  const storage = memoryStorage();
  storage.setItem("save", "{not-json");
  const parsed = readJsonStorage("save", storage);
  assert.equal(parsed.ok, false);
  if (!parsed.ok) assert.equal(parsed.reason, "invalid");
  assert.equal(storage.getItem("save"), "{not-json");

  const circular: { self?: unknown } = {};
  circular.self = circular;
  const written = writeJsonStorage("save", circular, storage);
  assert.equal(written.ok, false);
  if (!written.ok) assert.equal(written.reason, "invalid");
});

test("safe storage distinguishes quota failures and supports JSON round trips", () => {
  const full: StorageBackend = {
    getItem: () => null,
    setItem: () => { throw new DOMException("full", "QuotaExceededError"); },
    removeItem: () => undefined,
  };
  const quota = writeStorageItem("save", "{}", full);
  assert.equal(quota.ok, false);
  if (!quota.ok) assert.equal(quota.reason, "quota");

  const storage = memoryStorage();
  assert.deepEqual(writeJsonStorage("save", { level: 9 }, storage), {
    ok: true,
    value: undefined,
  });
  assert.deepEqual(readJsonStorage("save", storage), {
    ok: true,
    value: { level: 9 },
  });
  assert.deepEqual(removeStorageItem("save", storage), { ok: true, value: undefined });
  assert.deepEqual(readStorageItem("save", storage), { ok: false, reason: "missing" });
});
