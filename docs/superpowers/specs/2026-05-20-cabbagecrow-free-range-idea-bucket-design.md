# CabbageCrow Free Range And Idea Bucket Design

## Goal

Turn CabbageCrow from a static desktop pet into a small companion with three new capabilities:

1. Resizing that never crops the art.
2. A compact Mini Dashboard for settings and ideas.
3. A "free range" mode where CabbageCrow can wander and periodically surface random unresolved ideas.

The app should still feel like a desktop pet first. The dashboard is a utility surface, not the main experience.

## Resize Fix

Current resizing scales the pet inside a fixed visual box, so enlarged sprites can exceed the window and get cropped. The fix is to make the native Tauri window size derive from the selected scale.

The app will keep a base pet stage size and calculate:

- logical window width = scaled pet width plus transparent padding
- logical window height = scaled pet height plus transparent padding
- sprite transform = visual scale only after the containing window has room

The resize setting remains persistent in local storage. `+`, `-`, `0`, and `Shift + drag` continue to work, but all of them resize the native window enough to contain CabbageCrow.

## Mini Dashboard

The user selected the Mini Dashboard direction. This will be a separate compact Tauri window, opened from the pet by a clear interaction such as right-click/context action or a keyboard shortcut.

The dashboard will contain:

- Size controls.
- Free range toggle.
- Random spark cadence control.
- Add spark input.
- Currently nudged spark.
- Scrollable pending spark list.
- Resolve controls.

The visual style should feel like CabbageCrow's bioscan console: dark green/black, small utility typography, crisp 6-8px radii, and scan-console accents. It should not become a generic productivity dashboard.

## Idea Bucket

The todo concept is replaced with an Idea Bucket. It stores random thoughts, half-formed notes, and sparks.

A spark has:

- `id`
- `text`
- `createdAt`
- `lastSurfacedAt`
- `resolvedAt`, optional

Pending sparks are unresolved sparks. Resolved sparks leave the random selection pool. The dashboard can still show resolved counts, but the active list focuses on pending sparks.

The pending list must be scrollable inside a bounded dashboard area. The add input and currently nudged spark stay fixed while only the pending list scrolls.

## Random Surfacing

CabbageCrow periodically picks one unresolved spark and surfaces it. Surfacing can happen in two ways:

- In the dashboard as the "currently nudged" spark.
- From the pet as a small thought bubble while the pet reacts.

Selection rules:

- Only unresolved sparks are eligible.
- If possible, avoid picking the exact same spark twice in a row.
- Update `lastSurfacedAt` when a spark is surfaced.
- If the pool is empty, do nothing except possibly show an empty dashboard state.

Resolving a spark removes it from future random picks. Keeping it pending leaves it in the pool.

## Free Range Mode

Free range lets CabbageCrow wander around the visible monitor instead of staying at the original perch.

Behavior:

- When enabled, CabbageCrow periodically chooses a destination inside the current monitor's safe bounds.
- It switches into a movement state while traveling.
- It returns to idle/waiting between excursions.
- It never intentionally moves off-screen.
- It should pause direct wandering while the dashboard is focused or while the user is dragging/resizing the pet.

The first implementation can use window-position animation from the frontend/Tauri APIs. It does not need full physics. Movement should feel curious and occasional, not frantic.

## Data Flow

Local storage is acceptable for the first version:

- `cabbagecrow.petScale`
- `cabbagecrow.freeRangeEnabled`
- `cabbagecrow.sparkCadence`
- `cabbagecrow.sparks`

Pure logic should live in small modules:

- sizing math
- spark CRUD and random selection
- free range route/window bounds math
- shortcut/deep-link command parsing

React components consume those helpers and persist state. Tauri is responsible for native windows, window sizing, window positioning, and the custom URL scheme.

## Error Handling

If local storage is unavailable or corrupted, the app should fall back to defaults and keep running.

If native window operations fail in browser preview, the UI should still work as a preview. Native failures should not break rendering.

If no sparks are pending, random surfacing should silently skip and the dashboard should invite the user to add a spark.

## Testing

Add focused tests for:

- resize geometry keeps the scaled pet inside the native window dimensions
- spark add/resolve/list behavior
- random picker ignores resolved sparks and avoids immediate repeats when possible
- local storage parsing handles invalid data
- free range destination calculation stays inside bounds

Existing animation, interaction, shortcut, and asset tests should keep passing.

## Out Of Scope For This Pass

- Cloud sync.
- Calendar or notification integration.
- Real macOS Notification Center reminders.
- Cross-device idea buckets.
- Advanced multi-monitor choreography beyond staying inside the current visible monitor.
