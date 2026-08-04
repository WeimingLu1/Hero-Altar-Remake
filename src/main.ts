import "./style.css";
import { App } from "./game/app";

const root = document.getElementById("app");
if (!root) throw new Error("no #app");
const app = new App(root);
(window as unknown as { __app: App }).__app = app;

window.addEventListener("error", (ev) => {
  showFatal((ev.error?.message || ev.message || "未知错误") + "\n" + (ev.error?.stack || ""));
});
window.addEventListener("unhandledrejection", (ev) => {
  showFatal(String(ev.reason?.message || ev.reason));
});

function showFatal(msg: string): void {
  const existing = document.getElementById("fatal-overlay");
  if (existing) return;
  const div = document.createElement("div");
  div.id = "fatal-overlay";
  div.style.cssText =
    "position:fixed;inset:0;z-index:9999;background:#1a1014;color:#ffd9c9;display:flex;align-items:center;justify-content:center;text-align:center;font-family:monospace;font-size:14px;line-height:1.8;padding:24px;white-space:pre-wrap";
  div.textContent = "江湖中出了岔子：\n\n" + msg + "\n\n刷新页面可重试。";
  document.body.appendChild(div);
}
