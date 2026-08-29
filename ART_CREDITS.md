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
  character portraits used by the unified active-talk layer, status, and battle UI.
- `public/game-assets/generated/wuxia-characters-faction-signatures-v1.webp`:
  directional Flower School, Red Lotus, Wudang, and Snow Mountain sprites.
- `public/game-assets/generated/wuxia-faction-portraits-v1.webp`: 4 × 4 named
  Flower School, Red Lotus, Wudang, Snow Mountain, and Ice-Fire portraits.
- `public/game-assets/generated/wuxia-characters-flower-variants-v1.webp`: four
  distinct directional Flower School women matching named portraits.
- `public/game-assets/generated/wuxia-characters-notable-masters-v2.webp`,
  `wuxia-characters-notable-women-v2.webp`,
  `wuxia-characters-notable-wanderers-v2.webp`, and
  `wuxia-characters-underworld-v2.webp`: sixteen named-character direction sets
  for masters, heroines, physically distinctive wanderers, underworld envoys,
  judges, and bandit leaders.
- `public/game-assets/generated/wuxia-characters-beast-school-v3.webp`: four
  direction sets for the Snow Mountain leopard and three visually distinctive
  Beast School figures, repacked into strict equal cells so every head and
  weapon remains inside its runtime crop.
- `public/game-assets/generated/wuxia-notable-portraits-v2.webp` and
  `wuxia-roster-portraits-v2.webp`: two 4 × 4 portrait grids containing 32
  named, age-specific, disability-aware, animal, foreign-school, Taoist,
  Buddhist, and underworld portraits. The first grid directly matches the
  sixteen new named-character direction sets.
- `public/game-assets/generated/wuxia-npc-portraits-001-016-v1.webp` through
  `wuxia-npc-portraits-193-198-v1.webp`: thirteen 4 × 4 portrait grids generated
  in strict database-ID order. Their 198 occupied cells give every NPC record a
  dedicated face, age, clothing, profession/faction detail, body type, and
  equipment treatment; the final grid leaves its ten unused cells empty.
- `public/game-assets/generated/wuxia-indoor-furniture-v1.webp`: 8 × 8 modular
  ancient Chinese furniture and interior-prop atlas.
- `public/game-assets/generated/wuxia-ui-title-mountains-v2.webp`,
  `wuxia-ui-archive-v2.webp`, and `wuxia-ui-battle-courtyard-v2.webp`: three
  original 16:9 cinematic interface plates depicting a misty mountain gate,
  a night archive pavilion, and a rain-soaked temple courtyard. They are used
  behind the title, character-preparation, and battle interfaces respectively;
  all typography, focus states, and interaction controls remain live HTML/CSS.
- `public/game-assets/redrawn/overlay-nature-v3.webp` and
  `public/game-assets/redrawn/overlay-interior-v3.webp`: two 4 × 4 transparent
  prop atlases. Each cell contains one complete object with verified transparent
  padding on every edge; nature and interior props are kept in separate images
  so no object crosses a crop boundary.

Each character atlas is 4 × 4. Its generated checker/chroma background was
removed locally and the edge alpha was prepared for Canvas downscaling; the
columns are front, screen-facing right, screen-facing left, and back.

These files do not incorporate or use the original project's published bitmap
files as image inputs or visual references.

## Documentation screenshots

The files under `docs/screenshots/` are direct full-game browser captures from
the current production build. The detailed 2026-08-09 set was supplied by the
project owner and includes full-resolution regional maps, NPC profiles,
apprenticeship and teaching, tasks, status and kung-fu configuration,
environmental conversations, the former free-dialogue layout, and a multi-round
battle. The free-dialogue capture is retained as historical visual documentation;
the current product uses the map-bottom dual-portrait active-talk layer. These
screenshots document game output and do not add third-party runtime artwork.

## Future third-party assets

Every third-party asset added later must record its title, creator, source URL,
license, required attribution, modifications, and the exact files used. “Free”
is not treated as equivalent to CC0 or an open-content license.
