import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "英雄坛说：云游志",
  description: "像素武侠浏览器游戏",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "英雄坛说：云游志",
    description: "踏入平安镇，修习武艺，平定黑风之患。键盘可玩的像素武侠冒险。",
    images: [{ url: "/og.png", width: 1728, height: 912, alt: "英雄坛说：云游志" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
