from pathlib import Path
from PIL import Image, ImageDraw

OUTPUT = Path("public/assets/icons")


def s(size, value):
    return int(size * value)


def create_icon(size, filename):
    image = Image.new("RGB", (size, size), "#050f24")
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=s(size, .22), fill="#0b2145")
    draw.rounded_rectangle(
        (s(size, .055), s(size, .055), s(size, .945), s(size, .945)),
        radius=s(size, .17), outline="#2c4468", width=max(2, s(size, .015))
    )
    outer = [
        (s(size, .50), s(size, .14)), (s(size, .80), s(size, .25)),
        (s(size, .80), s(size, .49)), (s(size, .74), s(size, .68)),
        (s(size, .50), s(size, .87)), (s(size, .26), s(size, .68)),
        (s(size, .20), s(size, .49)), (s(size, .20), s(size, .25)),
    ]
    inner = [
        (s(size, .50), s(size, .19)), (s(size, .75), s(size, .28)),
        (s(size, .75), s(size, .49)), (s(size, .69), s(size, .64)),
        (s(size, .50), s(size, .81)), (s(size, .31), s(size, .64)),
        (s(size, .25), s(size, .49)), (s(size, .25), s(size, .28)),
    ]
    draw.polygon(outer, fill="#f4f7fb")
    draw.polygon(inner, fill="#0b2145")
    for y, width in ((.35, .30), (.46, .30), (.57, .18)):
        draw.rounded_rectangle(
            (s(size, .35), s(size, y), s(size, .35 + width), s(size, y + .05)),
            radius=max(2, s(size, .008)), fill="#cdd9ec"
        )
    draw.ellipse((s(size, .54), s(size, .53), s(size, .74), s(size, .73)), fill="#c8102e")
    draw.line([
        (s(size, .585), s(size, .63)),
        (s(size, .62), s(size, .665)),
        (s(size, .695), s(size, .575)),
    ], fill="#f4f7fb", width=max(5, s(size, .026)), joint="curve")
    image.save(OUTPUT / filename, optimize=True)


OUTPUT.mkdir(parents=True, exist_ok=True)
create_icon(192, "icon-192.png")
create_icon(512, "icon-512.png")
create_icon(512, "icon-maskable-512.png")
