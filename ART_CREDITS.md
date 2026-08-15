# Art assets and provenance

The production Web build does not publish the bitmap artwork from the original
RPG Maker XP project.

## Project-original generated artwork

The following assets were generated specifically for this Web adaptation with
OpenAI Image Generation and then prepared locally for use as sprite atlases:

- `public/game-assets/generated/wuxia-characters-v1.webp`: player and general
  wandering-character directions.
- `public/game-assets/generated/wuxia-characters-ages-v1.webp`: children and
  elderly character directions.
- `public/game-assets/generated/wuxia-characters-townsfolk-v1.webp`: official,
  merchant, scholar, and worker directions.
- `public/game-assets/generated/wuxia-characters-factions-v1.webp`: swordsman,
  bandit, monk, and Taoist directions.
- `public/game-assets/generated/wuxia-characters-women-v1.webp`: swordswoman,
  merchant, Buddhist nun, and worker directions.
- `public/game-assets/generated/wuxia-portrait-atlas-v1.webp`: 5 × 4 matching
  character portraits used by dialogue, status, free-chat, and battle UI.
- `public/game-assets/generated/wuxia-characters-faction-signatures-v1.webp`:
  directional Flower School, Red Lotus, Wudang, and Snow Mountain sprites.
- `public/game-assets/generated/wuxia-faction-portraits-v1.webp`: 4 × 4 named
  Flower School, Red Lotus, Wudang, Snow Mountain, and Ice-Fire portraits.
- `public/game-assets/generated/wuxia-characters-flower-variants-v1.webp`: four
  distinct directional Flower School women matching named portraits.
- `public/game-assets/generated/wuxia-indoor-furniture-v1.webp`: 8 × 8 modular
  ancient Chinese furniture and interior-prop atlas.
- `public/game-assets/redrawn/overlay-nature-v3.webp` and
  `public/game-assets/redrawn/overlay-interior-v3.webp`: two 4 × 4 transparent
  prop atlases. Each cell contains one complete object with verified transparent
  padding on every edge; nature and interior props are kept in separate images
  so no object crosses a crop boundary.

Each character atlas is 4 × 4. Its flat chroma-key background was removed
locally; the columns are front, screen-facing right, screen-facing left, and
back.

These files do not incorporate or use the original project's published bitmap
files as image inputs or visual references.

## Documentation screenshots

The files under `docs/screenshots/` are direct full-game browser captures from
the current production build. The detailed 2026-08-09 set was supplied by the
project owner and includes full-resolution regional maps, NPC profiles,
apprenticeship and teaching, tasks, status and kung-fu configuration,
environmental conversations, free dialogue, and a multi-round battle. The
screenshots document existing game output and do not add third-party runtime
artwork.

## Future third-party assets

Every third-party asset added later must record its title, creator, source URL,
license, required attribution, modifications, and the exact files used. “Free”
is not treated as equivalent to CC0 or an open-content license.
