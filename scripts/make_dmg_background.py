from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
WIDTH = 760
HEIGHT = 480


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/Supplemental/Avenir Next.ttc",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size=size, index=1 if bold and candidate.endswith(".ttc") else 0)
        except OSError:
            continue
    return ImageFont.load_default()


def draw_scan_grid(draw: ImageDraw.ImageDraw) -> None:
    for x in range(0, WIDTH, 38):
        fill = (92, 195, 96, 9 if x % 76 == 0 else 5)
        draw.line([(x, 0), (x, HEIGHT)], fill=fill, width=1)
    for y in range(0, HEIGHT, 38):
        fill = (92, 195, 96, 8 if y % 76 == 0 else 4)
        draw.line([(0, y), (WIDTH, y)], fill=fill, width=1)


def centered_text(draw: ImageDraw.ImageDraw, y: int, text: str, font: ImageFont.ImageFont, fill: tuple[int, int, int, int]) -> None:
    bbox = draw.textbbox((0, 0), text, font=font)
    draw.text(((WIDTH - (bbox[2] - bbox[0])) / 2, y), text, font=font, fill=fill)


def main() -> None:
    output = ROOT / "src-tauri" / "dmg" / "background.png"
    output.parent.mkdir(parents=True, exist_ok=True)

    base = Image.new("RGBA", (WIDTH, HEIGHT), (3, 8, 8, 255))
    glow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((-130, -150, 390, 390), fill=(74, 127, 36, 28))
    glow_draw.ellipse((380, 42, 980, 630), fill=(25, 120, 113, 22))
    glow = glow.filter(ImageFilter.GaussianBlur(66))
    base.alpha_composite(glow)

    draw = ImageDraw.Draw(base)
    draw_scan_grid(draw)

    draw.rounded_rectangle((24, 24, WIDTH - 24, HEIGHT - 24), radius=20, outline=(154, 232, 79, 82), width=2)
    draw.rounded_rectangle((38, 38, WIDTH - 38, HEIGHT - 38), radius=14, outline=(53, 214, 191, 34), width=1)

    icon_source = Image.open(ROOT / "src-tauri" / "icons" / "icon.png").convert("RGBA")
    icon = icon_source.crop(icon_source.getbbox()).resize((118, 118), Image.LANCZOS)
    icon_shadow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    icon_shadow.alpha_composite(icon, ((WIDTH - 118) // 2, 52))
    icon_shadow = icon_shadow.filter(ImageFilter.GaussianBlur(12))
    base.alpha_composite(Image.new("RGBA", base.size, (0, 0, 0, 0)))
    base.alpha_composite(icon_shadow, (0, 10))
    base.alpha_composite(icon, ((WIDTH - 118) // 2, 50))

    title_font = load_font(36, bold=True)
    label_font = load_font(16)
    tiny_font = load_font(12, bold=True)
    draw.rounded_rectangle((210, 168, WIDTH - 210, 246), radius=14, fill=(2, 8, 7, 206), outline=(72, 210, 187, 34), width=1)
    centered_text(draw, 174, "CabbageCrow", title_font, (236, 255, 208, 255))
    centered_text(draw, 218, "Drag into Applications", label_font, (110, 231, 216, 230))

    left_center = (196, 330)
    right_center = (564, 330)
    for center in [left_center, right_center]:
        x, y = center
        draw.ellipse((x - 70, y - 70, x + 70, y + 70), outline=(153, 232, 79, 70), width=2)
        draw.ellipse((x - 48, y - 48, x + 48, y + 48), outline=(53, 214, 191, 54), width=1)

    draw.line((left_center[0] + 92, left_center[1], right_center[0] - 92, right_center[1]), fill=(166, 232, 72, 172), width=4)
    draw.polygon(
        [
            (right_center[0] - 92, right_center[1]),
            (right_center[0] - 116, right_center[1] - 13),
            (right_center[0] - 116, right_center[1] + 13),
        ],
        fill=(166, 232, 72, 190),
    )
    draw.rounded_rectangle((282, 412, 478, 440), radius=8, fill=(2, 8, 7, 190))
    centered_text(draw, 420, "MIDNIGHT ROOST FORM", tiny_font, (166, 232, 72, 210))

    base.save(output)


if __name__ == "__main__":
    main()
