#!/usr/bin/env python3
"""Build a Codex-style CabbageCrow pet package from generated row strips."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ROW_SOURCE_DIR = ROOT / "assets" / "source" / "cabbagecrow-rows"
OUT_DIR = ROOT / "public" / "pets" / "cabbagecrow"

CELL_WIDTH = 192
CELL_HEIGHT = 208
COLUMNS = 8
ROWS = 9
ATLAS_WIDTH = CELL_WIDTH * COLUMNS
ATLAS_HEIGHT = CELL_HEIGHT * ROWS
MAGENTA = np.array([255, 0, 255], dtype=np.int16)
KEY_DISTANCE_THRESHOLD = 260

ROW_STATES = [
    "idle",
    "running-right",
    "running-left",
    "waving",
    "jumping",
    "failed",
    "waiting",
    "running",
    "review",
]


@dataclass(frozen=True)
class Box:
    x0: int
    y0: int
    x1: int
    y1: int

    @property
    def width(self) -> int:
        return self.x1 - self.x0

    @property
    def height(self) -> int:
        return self.y1 - self.y0


def non_key_mask(rgb: np.ndarray) -> np.ndarray:
    distances = np.linalg.norm(rgb.astype(np.int16) - MAGENTA, axis=2)
    return distances > KEY_DISTANCE_THRESHOLD


def tight_content_box(slot: Image.Image) -> Box:
    mask = non_key_mask(np.array(slot.convert("RGB")))
    ys, xs = np.where(mask)
    if len(xs) == 0:
        raise RuntimeError("No sprite pixels found in generated row slot")

    pad = 6
    return Box(
        x0=max(0, int(xs.min()) - pad),
        y0=max(0, int(ys.min()) - pad),
        x1=min(slot.width, int(xs.max()) + 1 + pad),
        y1=min(slot.height, int(ys.max()) + 1 + pad),
    )


def expanded_slot_bounds(row_source: Image.Image, frame: int) -> tuple[int, int, int]:
    slot_width = row_source.width / COLUMNS
    center = round((frame + 0.5) * slot_width)
    bleed = round(slot_width * 0.42)
    x0 = max(0, round(frame * slot_width) - bleed)
    x1 = min(row_source.width, round((frame + 1) * slot_width) + bleed)
    return x0, x1, center


def component_center_score(component: tuple[int, Box, list[tuple[int, int]]], center_x: int) -> tuple[float, int]:
    area, box, _pixels = component
    component_center = (box.x0 + box.x1) / 2
    return (abs(component_center - center_x), -area)


def crop_selected_component(expanded_slot: Image.Image, center_x_in_slot: int) -> Image.Image:
    rgba = apply_chroma_alpha(expanded_slot)
    arr = np.array(rgba)
    components = component_boxes(arr[:, :, 3] > 0)
    if not components:
        raise RuntimeError("No sprite pixels found in expanded generated row slot")

    viable = [
        component
        for component in components
        if component[0] >= 700 and component[1].height >= 40 and component[1].width >= 40
    ]
    if not viable:
        viable = components

    _area, box, _pixels = min(viable, key=lambda component: component_center_score(component, center_x_in_slot))
    pad = 8
    crop_box = (
        max(0, box.x0 - pad),
        max(0, box.y0 - pad),
        min(expanded_slot.width, box.x1 + pad),
        min(expanded_slot.height, box.y1 + pad),
    )
    return rgba.crop(crop_box)


def crop_generated_slot(row_source: Image.Image, frame: int) -> Image.Image:
    x0, x1, center = expanded_slot_bounds(row_source, frame)
    slot = row_source.crop((x0, 0, x1, row_source.height)).convert("RGBA")
    return crop_selected_component(slot, center - x0)


def apply_chroma_alpha(sprite: Image.Image) -> Image.Image:
    arr = np.array(sprite.convert("RGBA"))
    rgb = arr[:, :, :3].astype(np.int16)
    key_distance = np.linalg.norm(rgb - MAGENTA, axis=2)
    alpha = np.where(key_distance <= KEY_DISTANCE_THRESHOLD, 0, 255).astype(np.uint8)
    arr[:, :, 3] = alpha
    arr[alpha == 0, 0:3] = 0
    return Image.fromarray(arr, "RGBA")


def component_boxes(mask: np.ndarray) -> list[tuple[int, Box, list[tuple[int, int]]]]:
    height, width = mask.shape
    visited = np.zeros_like(mask, dtype=bool)
    components: list[tuple[int, Box, list[tuple[int, int]]]] = []

    for start_y in range(height):
        for start_x in range(width):
            if not mask[start_y, start_x] or visited[start_y, start_x]:
                continue
            stack = [(start_x, start_y)]
            visited[start_y, start_x] = True
            pixels: list[tuple[int, int]] = []
            while stack:
                x, y = stack.pop()
                pixels.append((x, y))
                for ny in range(max(0, y - 1), min(height, y + 2)):
                    for nx in range(max(0, x - 1), min(width, x + 2)):
                        if visited[ny, nx] or not mask[ny, nx]:
                            continue
                        visited[ny, nx] = True
                        stack.append((nx, ny))
            xs = [p[0] for p in pixels]
            ys = [p[1] for p in pixels]
            components.append(
                (
                    len(pixels),
                    Box(min(xs), min(ys), max(xs) + 1, max(ys) + 1),
                    pixels,
                )
            )

    return components


def boxes_are_near(a: Box, b: Box, distance: int = 3) -> bool:
    return not (
        a.x1 + distance < b.x0
        or b.x1 + distance < a.x0
        or a.y1 + distance < b.y0
        or b.y1 + distance < a.y0
    )


def remove_detached_artifacts(sprite: Image.Image) -> Image.Image:
    arr = np.array(sprite.convert("RGBA"))
    mask = arr[:, :, 3] > 0
    components = component_boxes(mask)
    if not components:
        return sprite

    main_area, main_box, _ = max(components, key=lambda item: item[0])
    cleaned_alpha = arr[:, :, 3].copy()
    height, width = mask.shape

    for area, box, pixels in components:
        is_main = area == main_area
        is_substantial = area >= max(700, main_area * 0.12)
        is_attached_enough = boxes_are_near(box, main_box)
        touches_slot_edge = box.x0 <= 1 or box.x1 >= width - 1
        if is_main or ((is_substantial or is_attached_enough) and not touches_slot_edge):
            continue
        for x, y in pixels:
            cleaned_alpha[y, x] = 0

    arr[:, :, 3] = cleaned_alpha
    arr[cleaned_alpha == 0, 0:3] = 0
    return Image.fromarray(arr, "RGBA")


def fit_sprite(sprite: Image.Image) -> Image.Image:
    max_width = 184
    max_height = 198
    scale = min(max_width / sprite.width, max_height / sprite.height, 1.0)
    new_size = (max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale)))
    if new_size == sprite.size:
        return sprite
    return sprite.resize(new_size, Image.Resampling.LANCZOS)


def make_contact_sheet(atlas: Image.Image) -> Image.Image:
    scale = 0.5
    cell_w = round(CELL_WIDTH * scale)
    cell_h = round(CELL_HEIGHT * scale)
    contact = Image.new("RGBA", (cell_w * COLUMNS, cell_h * ROWS), (18, 28, 24, 255))
    for row in range(ROWS):
        for col in range(COLUMNS):
            frame = atlas.crop(
                (
                    col * CELL_WIDTH,
                    row * CELL_HEIGHT,
                    (col + 1) * CELL_WIDTH,
                    (row + 1) * CELL_HEIGHT,
                )
            )
            frame.thumbnail((cell_w, cell_h), Image.Resampling.LANCZOS)
            contact.alpha_composite(frame, (col * cell_w, row * cell_h))
    return contact


def find_edge_contact_frames(atlas: Image.Image) -> list[dict[str, int | str]]:
    edge_contacts: list[dict[str, int | str]] = []
    for row, state in enumerate(ROW_STATES):
        for col in range(COLUMNS):
            frame = atlas.crop(
                (
                    col * CELL_WIDTH,
                    row * CELL_HEIGHT,
                    (col + 1) * CELL_WIDTH,
                    (row + 1) * CELL_HEIGHT,
                )
            )
            alpha = np.array(frame.convert("RGBA"))[:, :, 3] > 0
            touches_edge = (
                bool(alpha[:, 0].any())
                or bool(alpha[:, -1].any())
                or bool(alpha[0, :].any())
                or bool(alpha[-1, :].any())
            )
            if touches_edge:
                edge_contacts.append({"state": state, "frame": col})
    return edge_contacts


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    atlas = Image.new("RGBA", (ATLAS_WIDTH, ATLAS_HEIGHT), (0, 0, 0, 0))
    detected_frames: list[dict[str, int | str]] = []

    for row, state in enumerate(ROW_STATES):
        source_path = ROW_SOURCE_DIR / f"{state}.png"
        row_source = Image.open(source_path).convert("RGBA")
        row_bottom = (row + 1) * CELL_HEIGHT

        for col in range(COLUMNS):
            raw_sprite = crop_generated_slot(row_source, col)
            sprite = fit_sprite(remove_detached_artifacts(raw_sprite))
            x = col * CELL_WIDTH + (CELL_WIDTH - sprite.width) // 2
            y = row_bottom - 8 - sprite.height
            y = max(row * CELL_HEIGHT + 4, min(y, row_bottom - sprite.height - 4))
            atlas.alpha_composite(sprite, (x, y))
            detected_frames.append(
                {
                    "state": state,
                    "frame": col,
                    "source": str(source_path),
                    "sourceWidth": row_source.width,
                    "sourceHeight": row_source.height,
                    "spriteWidth": sprite.width,
                    "spriteHeight": sprite.height,
                }
            )

    spritesheet_path = OUT_DIR / "spritesheet.webp"
    atlas.save(spritesheet_path, "WEBP", lossless=True, quality=100)
    atlas.save(OUT_DIR / "spritesheet.png")
    make_contact_sheet(atlas).save(OUT_DIR / "contact-sheet.png")

    pet_json = {
        "id": "cabbagecrow",
        "displayName": "CabbageCrow",
        "description": "A clever bio-mech corvid with cabbage-leaf wings, bright sensor eyes, and chaotic scout energy.",
        "spritesheetPath": "spritesheet.webp",
        "cellWidth": CELL_WIDTH,
        "cellHeight": CELL_HEIGHT,
        "columns": COLUMNS,
        "states": ROW_STATES,
        "sourceMode": "generated-row-strips",
    }
    (OUT_DIR / "pet.json").write_text(json.dumps(pet_json, indent=2) + "\n")

    edge_contact_frames = find_edge_contact_frames(atlas)
    validation = {
        "ok": True,
        "sourceMode": "generated-row-strips",
        "atlasWidth": ATLAS_WIDTH,
        "atlasHeight": ATLAS_HEIGHT,
        "cellWidth": CELL_WIDTH,
        "cellHeight": CELL_HEIGHT,
        "columns": COLUMNS,
        "rows": ROWS,
        "detectedFrames": len(detected_frames),
        "edgeContactFrames": edge_contact_frames,
        "spritesheet": str(spritesheet_path),
        "frames": detected_frames,
    }
    (OUT_DIR / "validation.json").write_text(json.dumps(validation, indent=2) + "\n")

    print(
        json.dumps(
            {
                "ok": validation["ok"],
                "sourceMode": validation["sourceMode"],
                "atlasWidth": validation["atlasWidth"],
                "atlasHeight": validation["atlasHeight"],
                "detectedFrames": validation["detectedFrames"],
            }
        )
    )


if __name__ == "__main__":
    main()
