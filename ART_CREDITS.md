# Art assets and provenance

The production Web build does not publish the bitmap artwork from the original
RPG Maker XP project.

## Project-original generated artwork

The following assets were generated specifically for this Web adaptation with
OpenAI Image Generation and then prepared locally for use as sprite atlases:

- `public/game-assets/generated/wuxia-environment-atlas-v1.png`: 8 × 8 ancient
  Chinese wuxia environment atlas.
- `public/game-assets/generated/wuxia-map-modules-v2.png`: second-generation
  8 × 8 seamless terrain, road-edge, water-bank, modular building, boundary,
  vegetation, landmark, and prop atlas.
- `public/game-assets/generated/wuxia-characters-v1.png`: player and general
  wandering-character directions.
- `public/game-assets/generated/wuxia-characters-ages-v1.png`: children and
  elderly character directions.
- `public/game-assets/generated/wuxia-characters-townsfolk-v1.png`: official,
  merchant, scholar, and worker directions.
- `public/game-assets/generated/wuxia-characters-factions-v1.png`: swordsman,
  bandit, monk, and Taoist directions.
- `public/game-assets/generated/wuxia-characters-women-v1.png`: swordswoman,
  merchant, Buddhist nun, and worker directions.
- `public/game-assets/generated/wuxia-portrait-atlas-v1.png`: 5 × 4 matching
  character portraits used by dialogue, status, free-chat, and battle UI.
- `public/game-assets/generated/wuxia-characters-faction-signatures-v1.png`:
  directional Flower School, Red Lotus, Wudang, and Snow Mountain sprites.
- `public/game-assets/generated/wuxia-faction-portraits-v1.png`: 4 × 4 named
  Flower School, Red Lotus, Wudang, Snow Mountain, and Ice-Fire portraits.
- `public/game-assets/generated/wuxia-characters-flower-variants-v1.png`: four
  distinct directional Flower School women matching named portraits.
- `public/game-assets/generated/wuxia-indoor-furniture-v1.png`: 8 × 8 modular
  ancient Chinese furniture and interior-prop atlas.

Each character atlas is 4 × 4. Its flat chroma-key background was removed
locally; the columns are front, screen-facing right, screen-facing left, and
back.

These files do not incorporate or use the original project's published bitmap
files as image inputs or visual references.

## Documentation screenshots

The files under `docs/screenshots/` are project gameplay captures supplied by
the repository owner. They show the actual browser build, including the title
screen, ambient NPC simulation, player proximity dialogue, free dialogue, and
battle narration. The current README images were resized and JPEG-compressed
locally from the 2026-08-08 captures; no third-party artwork was added during
that documentation pass.

## Future third-party assets

Every third-party asset added later must record its title, creator, source URL,
license, required attribution, modifications, and the exact files used. “Free”
is not treated as equivalent to CC0 or an open-content license.
