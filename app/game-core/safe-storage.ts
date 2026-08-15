export type StorageFailureReason = "missing" | "unavailable" | "invalid" | "quota";

export type StorageResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: StorageFailureReason; error?: unknown };

export type StorageBackend = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function failure(reason: StorageFailureReason, error?: unknown): StorageResult<never> {
  return error === undefined ? { ok: false, reason } : { ok: false, reason, error };
}

function resolveStorage(storage?: StorageBackend | null): StorageResult<StorageBackend> {
  if (storage === null) return failure("unavailable");
  if (storage) return { ok: true, value: storage };
  try {
    const browserStorage = globalThis.localStorage;
    return browserStorage
      ? { ok: true, value: browserStorage }
      : failure("unavailable");
  } catch (error) {
    return failure("unavailable", error);
  }
}

function isQuotaError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: unknown; code?: unknown };
  return candidate.name === "QuotaExceededError" ||
    candidate.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    candidate.code === 22 ||
    candidate.code === 1014;
}

export function readStorageItem(
  key: string,
  storage?: StorageBackend | null,
): StorageResult<string> {
  const resolved = resolveStorage(storage);
  if (!resolved.ok) return resolved;
  try {
    const value = resolved.value.getItem(key);
    return value === null ? failure("missing") : { ok: true, value };
  } catch (error) {
    return failure("unavailable", error);
  }
}

export function readJsonStorage<T = unknown>(
  key: string,
  storage?: StorageBackend | null,
): StorageResult<T> {
  const stored = readStorageItem(key, storage);
  if (!stored.ok) return stored;
  try {
    return { ok: true, value: JSON.parse(stored.value) as T };
  } catch (error) {
    return failure("invalid", error);
  }
}

export function writeStorageItem(
  key: string,
  value: string,
  storage?: StorageBackend | null,
): StorageResult<void> {
  const resolved = resolveStorage(storage);
  if (!resolved.ok) return resolved;
  try {
    resolved.value.setItem(key, value);
    return { ok: true, value: undefined };
  } catch (error) {
    return failure(isQuotaError(error) ? "quota" : "unavailable", error);
  }
}

export function writeJsonStorage(
  key: string,
  value: unknown,
  storage?: StorageBackend | null,
): StorageResult<void> {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch (error) {
    return failure("invalid", error);
  }
  if (serialized === undefined) return failure("invalid");
  return writeStorageItem(key, serialized, storage);
}

export function removeStorageItem(
  key: string,
  storage?: StorageBackend | null,
): StorageResult<void> {
  const resolved = resolveStorage(storage);
  if (!resolved.ok) return resolved;
  try {
    resolved.value.removeItem(key);
    return { ok: true, value: undefined };
  } catch (error) {
    return failure("unavailable", error);
  }
}
