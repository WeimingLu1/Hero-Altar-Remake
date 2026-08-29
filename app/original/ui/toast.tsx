"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// 轻量通知条：保存/自动保存/导入等操作的瞬时反馈。
// 渲染在 .world-shell 直下并固定定位，窄屏也始终可见（右侧栏会收起）。
export type ToastTone = "info" | "success" | "warn" | "danger";
export type ToastItem = {
  id: number;
  text: string;
  tone: ToastTone;
  sticky: boolean;
};

const TOAST_MS: Record<ToastTone, number> = {
  info: 3200,
  success: 3200,
  warn: 5200,
  danger: 5200,
};
const MAX_TOASTS = 3;

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const serial = useRef(0);
  const timers = useRef<number[]>([]);
  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);
  const pushToast = useCallback(
    (text: string, tone: ToastTone = "info", sticky = false) => {
      const id = ++serial.current;
      setToasts((current) => [
        ...current.slice(-(MAX_TOASTS - 1)),
        { id, text, tone, sticky },
      ]);
      if (!sticky) {
        const timer = window.setTimeout(
          () => dismissToast(id),
          TOAST_MS[tone],
        );
        timers.current.push(timer);
      }
      return id;
    },
    [dismissToast],
  );
  useEffect(
    () => () => {
      for (const timer of timers.current) window.clearTimeout(timer);
    },
    [],
  );
  return { toasts, pushToast, dismissToast };
}

export function ToastHost({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  if (!toasts.length) return null;
  const urgent = toasts.some(
    (toast) => toast.tone === "warn" || toast.tone === "danger",
  );
  return (
    <div
      className="wx-toast-stack"
      role={urgent ? "alert" : "status"}
      aria-live={urgent ? "assertive" : "polite"}
    >
      {toasts.map((toast) => (
        <div key={toast.id} className={`wx-toast ${toast.tone}`}>
          <span>{toast.text}</span>
          <button
            type="button"
            aria-label="关闭提示"
            onClick={() => onDismiss(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
