# Standalone macOS Pet Design

Date: 2026-05-19

## Goal

Build a standalone macOS desktop pet inspired by the Codex pet experience, without any Codex sync in the first version. The app should feel playful, lightweight, and alive: a small companion floating over the desktop that reacts to direct local interactions.

## Decisions

- Platform: macOS-only for v1.
- App stack: Tauri + React + TypeScript.
- Experience: floating desktop pet, not a normal app window.
- Personality: playful mascot.
- Sync: no Codex integration in v1.
- Asset model: support a Codex-style `pet.json` plus `spritesheet.webp` package.

## Architecture

The app has two main layers.

The Tauri shell owns desktop behavior:

- Transparent, frameless, always-on-top macOS window.
- Fixed initial window size sized around a single pet frame.
- Local window position persistence.
- Right-click or tray/menu actions for quit and reset position.
- Safe local file loading for bundled pet assets.

The React runtime owns pet behavior:

- Load pet metadata and spritesheet assets.
- Render a single `192x208` sprite cell at a time.
- Advance animation frames on an interval.
- Choose animation rows from local state.
- Handle pointer interactions for click, drag, hover, and context menu behavior.

This separation keeps OS-specific window work in Rust/Tauri and keeps animation/state logic easy to iterate in TypeScript.

## Pet Package

The first version will bundle a demo pet package with this shape:

```text
pet/
  pet.json
  spritesheet.webp
```

`pet.json` contains:

- `id`
- `displayName`
- `description`
- `spritesheetPath`
- `cellWidth`, defaulting to `192` when absent
- `cellHeight`, defaulting to `208` when absent
- `columns`, defaulting to `8` when absent

The runtime assumes Codex-style cells:

- Cell width: `192`
- Cell height: `208`
- Columns: `8`
- Rows: up to `9`

The app maps supported rows to local runtime states:

- `idle`: calm idle loop.
- `running-right`: dragging or moving right.
- `running-left`: dragging or moving left.
- `waving`: greeting reaction.
- `jumping`: click reaction.
- `failed`: startled/sad reaction when requested by the runtime.
- `waiting`: curious/expectant reaction when requested by the runtime.
- `running`: busy/playful reaction when requested by the runtime.
- `review`: focused reaction when requested by the runtime.

If a pet package is missing a row or metadata, the runtime falls back to the default geometry and the `idle` row.

## Character Design Pipeline

The standalone app should use the same character-design discipline as the Codex Hatch Pet workflow when creating bundled or custom pet assets. This pipeline is separate from the desktop runtime: the Tauri app loads finished pet packages, while asset creation happens through scripts and review artifacts before packaging.

Asset creation starts from one or more of these inputs:

- a text concept
- reference images
- a brand, product, or company cue
- style notes

If the user provides only a brand, product, or company cue, the asset pipeline first produces a short discovery brief from official sources when available. That brief extracts mascot-safe cues such as palette, shapes, tone, domain motifs, and avoidances. The pipeline must avoid copying logos, readable marks, UI screenshots, slogans, or text unless the user explicitly provides approved artwork and asks for it.

Every pet asset run has four stages:

1. Getting the pet ready: choose name, description, concept, references, style preset, and working folder.
2. Imagining the main look: create or select a single canonical base pet image.
3. Picturing the poses: create animation rows grounded in the canonical base.
4. Hatching the pet: extract frames, compose the atlas, validate transparency, create QA previews, and package `pet.json` plus `spritesheet.webp`.

The canonical base image is the visual source of truth. Every generated row must preserve the same silhouette, face, proportions, markings, palette, material, style, prop design, and overall identity. A row that looks like a related but different pet fails QA even if its frame geometry is valid.

Supported pet-safe styles include:

- pixel
- plush
- clay
- sticker
- flat-vector
- 3d-toy
- painterly
- brand-inspired
- auto

Any style is acceptable only when it remains readable at `192x208`, has a compact full-body silhouette, uses stable colors and materials, and can be extracted cleanly from a chroma-key background.

Generated animation rows must follow strict artifact rules:

- Prefer pose, expression, and silhouette changes over decorative effects.
- Effects must be attached to or overlapping the pet, not floating separately.
- Avoid shadows, glows, smears, dust, speed lines, loose sparkles, floating punctuation, UI panels, text, checkerboards, visible guide marks, and scenery.
- Keep chroma-key colors out of the pet and props.
- Keep unused cells fully transparent after atlas composition.

Rows are created with row-specific layout guides and prompts. Only the base image may be prompt-only. Every row should use the canonical base and the row layout guide as grounding inputs. `running-right` is generated before `running-left`; `running-left` may be derived by mirroring only when doing so preserves identity, handedness, markings, prop placement, lighting, and direction semantics. Otherwise `running-left` is generated as its own row.

The asset pipeline should produce QA artifacts before accepting a pet:

- final `spritesheet.webp`
- `validation.json`
- contact sheet
- per-row motion previews
- review notes

Acceptance requires both deterministic validation and visual review. Identity drift, cropped bodies, slot overlap, copied guide marks, nontransparent backgrounds, detached effects, wrong direction, reversed timing, inert idle loops, and unintended size popping are blockers. Repairs should regenerate or reprocess only the smallest failing row or extraction step.

The first implementation should use this pipeline to create the bundled demo pet. It should not include an in-app pet generator.

## V1 Behavior

The first version should include:

- Floating transparent pet window with no visible chrome.
- Always-on-top behavior.
- Dragging the pet around the screen.
- Persisting the last pet position locally.
- Idle animation with frame cycling.
- Click reaction that briefly switches to `jumping`.
- Double-click or menu-triggered wave reaction.
- Drag direction changing between `running-left` and `running-right`.
- Right-click menu with reset position and quit.
- Bundled demo pet assets so the app works immediately after install.

The first version should not include:

- Codex sync or reading Codex task state.
- Cloud accounts.
- Pet marketplace or downloads.
- In-app AI pet generation.
- Complex productivity features like timers, reminders, or break scheduling.
- Multi-pet management.

## Data Flow

On startup:

1. Tauri creates a transparent always-on-top window.
2. Tauri loads or initializes local settings.
3. React loads bundled `pet.json`.
4. React loads the referenced spritesheet.
5. React starts the idle animation loop.

During interaction:

1. Pointer down starts drag tracking.
2. Horizontal movement chooses left or right drag state.
3. Pointer up persists the final window position and returns to an appropriate reaction or idle.
4. Click without drag triggers a short `jumping` reaction.
5. Menu actions call Tauri commands for reset position or quit.

## State Model

React should keep the pet state small and explicit:

- current animation state
- current frame index
- last movement direction
- interaction mode: idle, clicking, dragging, menu
- temporary reaction timeout

Animation selection should be centralized in a small TypeScript module so it can be unit-tested without a browser or Tauri runtime.

## Error Handling

- If the spritesheet fails to load, show a small fallback placeholder inside the transparent window.
- If `pet.json` is malformed, fall back to bundled defaults.
- If local settings cannot be read, start at the default position.
- If position persistence fails, keep the app running and log the error.

Errors should not crash the pet unless Tauri itself cannot create a window.

## Testing

Automated tests should cover:

- sprite coordinate calculation from row and frame index
- animation duration lookup for Codex row timing
- animation state fallback behavior
- click versus drag interaction decisions
- local settings parsing defaults

Manual verification should cover:

- transparent window rendering on macOS
- always-on-top behavior
- drag behavior and persisted position
- context menu actions
- bundled pet assets rendering correctly
- bundled pet contact sheet and row previews passing visual review

## Future Extensions

Likely v2 directions:

- Load custom Codex pet folders from `~/.codex/pets/`.
- Optional Codex integration that maps Codex task state to pet animation state.
- A small settings panel for size, always-on-top, launch-at-login, and pet selection.
- In-app pet creation powered by the same Hatch-style asset pipeline.
- More personality reactions and local mood loops.

These are intentionally outside v1 so the first app remains small and shippable.
