"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  readJsonStorage,
  readStorageItem,
  writeJsonStorage,
  type StorageFailureReason,
} from "../game-core/safe-storage";
import { LOCAL_SAVE_KEY } from "../game-core/save-constants";
import type { LlmSettings } from "../game-core/lm-studio";
import type { WorldSave } from "../game-core/save-system";
import { KEYBOARD_HELP } from "./keybindings";
import "./world.css";

const OriginalWorld = lazy(() => import("./original-world"));

type StartState = {
  screen: "intro" | "play";
  save?: WorldSave;
  storageWarning?: string;
};

type LlmHealth = "unchecked" | "checking" | "online" | "offline";

function storageWriteMessage(reason: StorageFailureReason, subject: string) {
  if (reason === "quota") return `浏览器存储空间已满，${subject}尚未保存。`;
  if (reason === "invalid") return `${subject}无法序列化，尚未保存。`;
  return `浏览器存储不可用，${subject}尚未保存。`;
}

export default function OriginalEntry() {
  const [start, setStart] = useState<StartState | null>(null);
  const [help, setHelp] = useState(false);
  const [hasSave, setHasSave] = useState(false);
  const [error, setError] = useState("");
  const [llmHealth, setLlmHealth] = useState<LlmHealth>("unchecked");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [llmSettings, setLlmSettings] = useState<LlmSettings | null>(null);
  const [storageWarningAccepted, setStorageWarningAccepted] = useState(false);
  const healthController = useRef<AbortController | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const serviceInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = readStorageItem(LOCAL_SAVE_KEY);
      setHasSave(stored.ok);
      if (!stored.ok && stored.reason === "unavailable")
        setError("浏览器存储不可用；仍可开始游戏，但请及时导出 JSON 备份。");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => {
      const controller = healthController.current;
      healthController.current = null;
      controller?.abort();
    };
  }, []);

  const resume = async () => {
    setError("");
    const stored = readJsonStorage(LOCAL_SAVE_KEY);
    if (!stored.ok && stored.reason === "missing") {
      setStart({ screen: "intro" });
      return;
    }
    if (!stored.ok && stored.reason === "unavailable") {
      setStorageWarningAccepted(false);
      setStart({
        screen: "intro",
        storageWarning: "浏览器无法读取或保存本地进度。进入游戏后请使用“导出 JSON”保留备份。",
      });
      return;
    }
    if (!stored.ok) {
      setHasSave(false);
      setError("本地存档已损坏，请读取 JSON 备份或开始新游戏；损坏数据未被自动删除。");
      return;
    }
    try {
      const { parseSave } = await import("../game-core/save-system");
      const parsed = parseSave(stored.value);
      if (!parsed.ok) throw new Error(parsed.error);
      setStart({ screen: "play", save: parsed.value });
    } catch {
      setHasSave(false);
      setError("本地存档已损坏，请读取 JSON 备份或开始新游戏；损坏数据未被自动删除。");
    }
  };

  const importJson = async (selected?: File) => {
    if (!selected) return;
    setError("");
    let source: unknown;
    try {
      source = JSON.parse(await selected.text());
    } catch {
      setError("无法读取该文件，或文件不是有效的 JSON。");
      return;
    }
    const { parseSave } = await import("../game-core/save-system");
    const parsed = parseSave(source);
    if (!parsed.ok) {
      setError(`JSON 存档格式无效：${parsed.error}`);
      return;
    }
    const written = writeJsonStorage(LOCAL_SAVE_KEY, parsed.value);
    if (!written.ok) {
      setStorageWarningAccepted(false);
      setStart({
        screen: "play",
        save: parsed.value,
        storageWarning: `${storageWriteMessage(written.reason, "导入的存档")} 本次仍可进入游戏，请立即导出 JSON 备份。`,
      });
      return;
    }
    setStart({ screen: "play", save: parsed.value });
  };

  const openLlmSettings = async () => {
    setSettingsLoading(true);
    setSettingsError("");
    try {
      const { DEFAULT_LLM_SETTINGS, loadLlmSettingsResult } = await import("../game-core/lm-studio");
      const loaded = loadLlmSettingsResult();
      setLlmSettings(loaded.ok ? loaded.value : DEFAULT_LLM_SETTINGS);
      if (!loaded.ok && loaded.reason === "invalid")
        setSettingsError("已保存的模型设置已损坏，现已载入默认值；重新保存即可修复。");
      else if (!loaded.ok && loaded.reason === "unavailable")
        setSettingsError("浏览器无法读取模型设置，本次使用默认值。");
      setSettingsOpen(true);
    } catch {
      setError("模型设置组件载入失败，请稍后重试。");
    } finally {
      setSettingsLoading(false);
    }
  };

  const checkLlmConnection = async (settings: LlmSettings) => {
    const previous = healthController.current;
    const controller = new AbortController();
    healthController.current = controller;
    previous?.abort();
    setLlmHealth("checking");
    try {
      const { normalizeLlmSettings, probeLlmHealth } = await import("../game-core/lm-studio");
      const normalized = normalizeLlmSettings(settings);
      setLlmSettings(normalized);
      const online = await probeLlmHealth(controller.signal, normalized);
      if (healthController.current === controller)
        setLlmHealth(online ? "online" : "offline");
    } catch {
      if (healthController.current === controller) setLlmHealth("offline");
    } finally {
      if (healthController.current === controller) healthController.current = null;
    }
  };

  const closeLlmSettings = () => {
    const controller = healthController.current;
    healthController.current = null;
    controller?.abort();
    setSettingsOpen(false);
  };

  useEffect(() => {
    if (!settingsOpen) return;
    const focusTimer = window.setTimeout(() => serviceInput.current?.focus(), 0);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      const controller = healthController.current;
      healthController.current = null;
      controller?.abort();
      setSettingsOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [settingsOpen]);

  if (start?.storageWarning && !storageWarningAccepted)
    return (
      <main className="launch-screen help-screen">
        <section role="alertdialog" aria-modal="true" aria-labelledby="storage-warning-title">
          <h1 id="storage-warning-title">本地存储不可用</h1>
          <p>{start.storageWarning}</p>
          <button onClick={() => setStorageWarningAccepted(true)}>了解并进入游戏</button>
          <button onClick={() => setStart(null)}>返回标题</button>
        </section>
      </main>
    );

  if (start)
    return (
      <Suspense fallback={<LoadingGame />}>
        <OriginalWorld
          initialScreen={start.screen}
          initialSave={start.save}
          restoreLocalSave={false}
          exitToTitle={() => {
            // 从游戏内主菜单返回时刷新存档标记，使“继续游戏”文案与本地存档一致。
            setHasSave(readStorageItem(LOCAL_SAVE_KEY).ok);
            setStart(null);
          }}
        />
      </Suspense>
    );

  if (settingsOpen && llmSettings)
    return (
      <main className="launch-screen help-screen">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="llm-settings-title"
        >
          <form
            className="llm-settings"
            onSubmit={(event) => {
              event.preventDefault();
              setSettingsError("");
              void import("../game-core/lm-studio")
                .then(({ saveLlmSettings }) => {
                  const saved = saveLlmSettings(llmSettings);
                  if (!saved.ok) {
                    setSettingsError(storageWriteMessage(saved.reason, "模型设置"));
                    return;
                  }
                  setLlmSettings(saved.value);
                  void checkLlmConnection(saved.value);
                })
                .catch(() => setSettingsError("模型设置组件载入失败，请稍后重试。"));
            }}
          >
            <h1 id="llm-settings-title">本地模型设置</h1>
            <label>
              服务地址
              <input
                ref={serviceInput}
                value={llmSettings.endpoint}
                onChange={(event) => setLlmSettings({ ...llmSettings, endpoint: event.target.value })}
                placeholder="http://127.0.0.1:1234"
              />
            </label>
            <label>
              模型名称
              <input
                value={llmSettings.model}
                onChange={(event) => setLlmSettings({ ...llmSettings, model: event.target.value })}
              />
            </label>
            <label>
              超时（毫秒）
              <input
                type="number"
                min="3000"
                max="60000"
                step="1000"
                value={llmSettings.timeoutMs}
                onChange={(event) => setLlmSettings({ ...llmSettings, timeoutMs: Number(event.target.value) })}
              />
            </label>
            <label>
              环境对话并发数（1–6）
              <input
                type="number"
                min="1"
                max="6"
                step="1"
                value={llmSettings.concurrency}
                onChange={(event) => setLlmSettings({ ...llmSettings, concurrency: Number(event.target.value) })}
              />
            </label>
            <p>部署站点访问本机服务时需要在 LM Studio 开启 CORS。模型不可用不会影响原作玩法。</p>
            {settingsError && <strong role="alert">{settingsError}</strong>}
            <span className={`llm-health ${llmHealth}`} aria-live="polite">
              {llmHealth === "checking"
                ? "正在检测本地模型…"
                : llmHealth === "online"
                  ? "本地模型已连接"
                  : llmHealth === "offline"
                    ? "本地模型未连接（不影响原作玩法）"
                    : "本地模型尚未检测"}
            </span>
            <div>
              <button type="submit">保存并检测</button>
              <button type="button" onClick={() => void checkLlmConnection(llmSettings)}>仅检测连接</button>
              <button type="button" onClick={closeLlmSettings}>返回标题</button>
            </div>
          </form>
        </div>
      </main>
    );

  if (help)
    return (
      <main className="launch-screen help-screen">
        <section>
          <h1>操作说明</h1>
          {KEYBOARD_HELP.map((line) => <p key={line}>{line}</p>)}
          <button onClick={() => setHelp(false)}>返回标题</button>
        </section>
      </main>
    );

  return (
    <main className="launch-screen title-screen">
      <div className="title-mountains" aria-hidden="true" />
      <section className="title-card">
        <h1>英雄坛说</h1>
        <nav aria-label="开始游戏">
          <button onClick={() => void resume()}>
            {hasSave ? "继续游戏" : "开始游戏"}
          </button>
          <button onClick={() => setStart({ screen: "intro" })}>开始新游戏</button>
          <button onClick={() => file.current?.click()}>读取 JSON 存档</button>
          <button onClick={() => setHelp(true)}>操作说明</button>
          <button disabled={settingsLoading} onClick={() => void openLlmSettings()}>
            {settingsLoading ? "正在载入模型设置…" : "模型设置"}
          </button>
        </nav>
        {error && <strong role="alert">{error}</strong>}
        <span className={`llm-health ${llmHealth}`} aria-live="polite">
          {llmHealth === "checking"
            ? "正在检测本地模型…"
            : llmHealth === "online"
              ? "本地模型已连接"
              : llmHealth === "offline"
                ? "本地模型未连接（不影响原作玩法）"
                : "本地模型尚未检测（可在模型设置中手动检测）"}
        </span>
      </section>
      <input
        hidden
        ref={file}
        type="file"
        accept=".json,application/json"
        onChange={(event) => {
          void importJson(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
    </main>
  );
}

function LoadingGame() {
  return (
    <main className="launch-screen title-screen" aria-live="polite">
      <section className="title-card">
        <h1>英雄坛说</h1>
        <em>正在载入…</em>
      </section>
    </main>
  );
}
