import type { App } from "./app";

let current: App | null = null;

export function setApp(a: App): void {
  current = a;
}

export function getApp(): App {
  if (!current) throw new Error("app not ready");
  return current;
}
