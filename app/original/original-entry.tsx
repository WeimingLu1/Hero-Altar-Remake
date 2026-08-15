"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { LOCAL_SAVE_KEY } from "../game-core/save-constants";
import type { LlmSettings } from "../game-core/lm-studio";
import type { WorldSave } from "../game-core/save-system";
import { KEYBOARD_HELP } from "./keybindings";
import "./world.css";

const OriginalWorld = lazy(() => import("./original-world"));

type StartState = {
  screen: "intro" | "play";
  save?: WorldSave;
};

export default function OriginalEntry() {
  const [start, setStart] = useState<StartState | null>(null);
  const [help, setHelp] = useState(false);
  const [hasSave, setHasSave] = useState(false);
  const [error, setError] = useState("");
  const [llmOnline, setLlmOnline] = useState<boolean | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [llmSettings, setLlmSettings] = useState<LlmSettings | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setHasSave(localStorage.getItem(LOCAL_SAVE_KEY) !== null),
      0,
    );
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void import("../game-core/lm-studio")
      .then(({ loadLlmSettings, probeLlmHealth }) => {
        const settings = loadLlmSettings();
        setLlmSettings(settings);
        return probeLlmHealth(controller.signal, settings);
      })
      .then((online) => setLlmOnline(online))
      .catch(() => setLlmOnline(false));
    return () => controller.abort();
  }, []);

  const resume = async () => {
    const raw = localStorage.getItem(LOCAL_SAVE_KEY);
    if (!raw) {
      setStart({ screen: "intro" });
      return;
    }
    try {
      const { parseSave } = await import("../game-core/save-system");
      const parsed = parseSave(JSON.parse(raw));
      if (!parsed.ok) throw new Error(parsed.error);
      setStart({ screen: "play", save: parsed.value });
    } catch {
      setHasSave(false);
      setError("本地存档已损坏，请读取 JSON 备份或开始新游戏。");
    }
  };

  const importJson = async (selected?: File) => {
    if (!selected) return;
    try {
      const { parseSave } = await import("../game-core/save-system");
      const parsed = parseSave(JSON.parse(await selected.text()));
      if (!parsed.ok) throw new Error(parsed.error);
      localStorage.setItem(LOCAL_SAVE_KEY, JSON.stringify(parsed.value));
      setStart({ screen: "play", save: parsed.value });
    } catch {
      setError("JSON 存档格式无效或无法写入浏览器存储。");
    }
  };

  if (start)
    return (
      <Suspense fallback={<LoadingGame />}>
        <OriginalWorld
          initialScreen={start.screen}
          initialSave={start.save}
          restoreLocalSave={false}
        />
      </Suspense>
    );

  if (settingsOpen && llmSettings)
    return (
      <main className="launch-screen help-screen">
        <form
          className="llm-settings"
          onSubmit={(event) => {
            event.preventDefault();
            void import("../game-core/lm-studio").then(async ({ saveLlmSettings, probeLlmHealth }) => {
              const saved = saveLlmSettings(llmSettings);
              setLlmSettings(saved);
              setLlmOnline(null);
              setLlmOnline(await probeLlmHealth(undefined, saved));
              setSettingsOpen(false);
            });
          }}
        >
          <h1>本地模型设置</h1>
          <label>
            服务地址
            <input
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
          <p>部署站点访问本机服务时需要在 LM Studio 开启 CORS。模型不可用不会影响原作玩法。</p>
          <div>
            <button type="submit">保存并检测</button>
            <button type="button" onClick={() => setSettingsOpen(false)}>取消</button>
          </div>
        </form>
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
        <small>RMXP 原版规则网页重制</small>
        <h1>英雄坛说</h1>
        <p>云游志</p>
        <nav aria-label="开始游戏">
          <button onClick={() => void resume()}>
            {hasSave ? "继续游戏" : "开始游戏"}
          </button>
          <button onClick={() => setStart({ screen: "intro" })}>开始新游戏</button>
          <button onClick={() => file.current?.click()}>读取 JSON 存档</button>
          <button onClick={() => setHelp(true)}>操作说明</button>
          <button onClick={() => setSettingsOpen(true)}>模型设置</button>
        </nav>
        {error && <strong role="alert">{error}</strong>}
        <span className={`llm-health ${llmOnline ? "online" : "offline"}`}>
          {llmOnline === null
            ? "正在检测本地模型…"
            : llmOnline
              ? "本地模型已连接"
              : "本地模型未连接（不影响原作玩法）"}
        </span>
        <em>完整游戏将在选择后载入</em>
      </section>
      <input
        hidden
        ref={file}
        type="file"
        accept=".json,application/json"
        onChange={(event) => void importJson(event.target.files?.[0])}
      />
    </main>
  );
}

function LoadingGame() {
  return (
    <main className="launch-screen title-screen" aria-live="polite">
      <section className="title-card">
        <small>正在展开江湖画卷</small>
        <h1>英雄坛说</h1>
        <p>载入地图、人物与武学数据……</p>
      </section>
    </main>
  );
}
