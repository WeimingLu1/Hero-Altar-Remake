import type { Metadata } from "next";
import HeroGame from "./hero-game";

export const metadata: Metadata = {
  title: "英雄坛说：云游志",
  description: "为浏览器重绘的像素武侠冒险。键盘游玩，可导入导出 JSON 存档。",
};

export default function Home() {
  return <HeroGame />;
}
