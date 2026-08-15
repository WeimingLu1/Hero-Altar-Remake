"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("游戏运行时错误", error);
  }, [error]);

  return (
    <main className="launch-screen help-screen" role="alert">
      <section>
        <h1>江湖暂时失去响应</h1>
        <p>本地存档仍保存在这台设备上。可以重试，或返回标题后下载 JSON 备份。</p>
        <button onClick={reset}>重新载入游戏</button>
        <button onClick={() => { window.location.href = "/"; }}>返回标题</button>
      </section>
    </main>
  );
}
