from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SPRITESHEET = ROOT / "public" / "pets" / "cabbagecrow" / "spritesheet.png"
OUTPUT = ROOT / "src-tauri" / "app-icon.png"

CELL_WIDTH = 192
CELL_HEIGHT = 208
ICON_SIZE = 1024


def main() -> None:
    sheet = Image.open(SPRITESHEET).convert("RGBA")
    frame = sheet.crop((0, 0, CELL_WIDTH, CELL_HEIGHT))
    bbox = frame.split()[3].getbbox()
    if not bbox:
        raise RuntimeError(f"No visible pixels found in {SPRITESHEET}")

    crow = frame.crop(bbox)
    beak_backing = Image.new("RGBA", crow.size, (0, 0, 0, 0))
    beak_draw = ImageDraw.Draw(beak_backing)
    beak_draw.polygon(
        [(83, 66), (149, 76), (132, 95), (83, 90)],
        fill=(92, 84, 72, 255),
    )
    beak_draw.line([(88, 76), (132, 80), (111, 84)], fill=(151, 138, 112, 230), width=2)
    beak_backing.alpha_composite(crow)
    crow = beak_backing
    max_sprite = int(ICON_SIZE * 0.64)
    scale = max_sprite / max(crow.width, crow.height)
    crow = crow.resize(
        (round(crow.width * scale), round(crow.height * scale)),
        Image.Resampling.LANCZOS,
    )

    icon = Image.new("RGBA", (ICON_SIZE, ICON_SIZE), (0, 0, 0, 0))
    shadow = Image.new("RGBA", (ICON_SIZE, ICON_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow)
    draw.ellipse((120, 140, 904, 924), fill=(8, 26, 22, 235))
    shadow = shadow.filter(ImageFilter.GaussianBlur(4))
    icon.alpha_composite(shadow)

    ring = Image.new("RGBA", (ICON_SIZE, ICON_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(ring)
    draw.ellipse((128, 148, 896, 916), outline=(142, 220, 55, 215), width=18)
    draw.ellipse((170, 190, 854, 874), outline=(24, 202, 177, 110), width=8)
    icon.alpha_composite(ring)

    x = (ICON_SIZE - crow.width) // 2
    y = (ICON_SIZE - crow.height) // 2 + 18
    icon.alpha_composite(crow, (x, y))

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    icon.save(OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    main()
