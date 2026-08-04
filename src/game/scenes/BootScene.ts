import Phaser from "phaser";
import {
  genBuildingTexture,
  genCelestialTextures,
  genCharacters,
  genFlowerTexture,
  genFurnitureTextures,
  genFxTextures,
  genGrassTexture,
  genBushTexture,
  genHangTreeTexture,
  genRockTexture,
  genSignTexture,
  genStoneTexture,
  genTreeTexture,
  genWellTexture,
  genWoodTexture
} from "../view/art";
import { AREAS } from "../content/areas";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    genCharacters(this);
    for (const kind of ["gate", "inn", "hall", "smith", "drug", "study", "yamen", "home", "shrine", "shop", "hill"]) {
      genBuildingTexture(this, kind, 180);
    }
    for (const theme of ["town", "forest", "snow", "mountain", "island", "dark", "cloud", "temple", "cave"]) {
      genGrassTexture(this, theme);
      genTreeTexture(this, theme);
      genBushTexture(this, theme);
      genSkyTexture(this, theme);
    }
    genFlowerTexture(this, "#d9829f");
    genFlowerTexture(this, "#e8c850");
    genFlowerTexture(this, "#8fb4e8");
    genFxTextures(this);
    genCelestialTextures(this);
    genFurnitureTextures(this);
    genStoneTexture(this);
    genWoodTexture(this);
    genRockTexture(this);
    genWellTexture(this);
    genSignTexture(this);
    genHangTreeTexture(this);
    this.scene.start("World");
  }
}

// 纯渐变天空底：不含日月云星（天体由 WorldScene 昼夜系统按时辰驱动）。
// 水平方向均匀，任意宽度平铺/拉伸都不会变形。
export function genSkyTexture(scene: Phaser.Scene, theme: string): void {
  const palettes: Record<string, [string, string, string]> = {
    town: ["#7fb6d9", "#b8d9c9", "#e8e0b0"],
    forest: ["#6f9a92", "#a8c8a0", "#d8e0b0"],
    snow: ["#9dbfd4", "#d8e6ef", "#f0f6f9"],
    mountain: ["#6f8aad", "#b8c8b8", "#e0dcc0"],
    island: ["#6f9ec8", "#c8d8c0", "#f0e0b0"],
    dark: ["#12141f", "#241f30", "#3a3348"],
    cloud: ["#100f1a", "#262238", "#3c3854"],
    temple: ["#7f9088", "#c0c0a0", "#e0d8b8"],
    cave: ["#100d14", "#211c2a", "#332a3e"]
  };
  const [top, mid, bottom] = palettes[theme] || palettes.town;
  const tex = scene.textures.createCanvas(`sky-${theme}`, 240, 540);
  if (!tex) return;
  const ctx = tex.getContext();
  const grad = ctx.createLinearGradient(0, 0, 0, 540);
  grad.addColorStop(0, top);
  grad.addColorStop(0.55, mid);
  grad.addColorStop(1, bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 240, 540);
  // 轻微横向云气噪点，打破纯渐变的塑料感（水平平铺仍无缝）
  ctx.fillStyle = "rgba(255,255,255,.05)";
  for (let i = 0; i < 10; i++) {
    const y = 30 + ((i * 97) % 260);
    ctx.fillRect(0, y, 240, 1);
  }
  tex.refresh();
}

export function areaThemeKeys(): string[] {
  return [...new Set(Object.values(AREAS).map((a) => a.theme))];
}
