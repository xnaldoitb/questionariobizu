from pathlib import Path
from PIL import Image, ImageDraw

OUTPUT = Path("public/assets/icons")
SUPERSAMPLING = 4


def cubic(points, steps=36):
    p0, p1, p2, p3 = points
    result = []
    for index in range(steps + 1):
        t = index / steps
        u = 1 - t
        result.append((
            u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0],
            u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1],
        ))
    return result


def create_icon(size, filename):
    work_size = size * SUPERSAMPLING
    scale = work_size / 512

    def p(value):
        return round(value * scale)

    def points(values):
        return [(p(x), p(y)) for x, y in values]

    image = Image.new("RGB", (work_size, work_size), "#07172f")
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((0, 0, work_size - 1, work_size - 1), radius=p(112), fill="#0d315f")
    draw.rounded_rectangle((p(28), p(28), p(484), p(484)), radius=p(88), outline="#918a60", width=p(6))

    left = [(72, 153)]
    left += cubic([(72, 153), (133, 120), (193, 124), (248, 167)])[1:]
    left += [(248, 382)]
    left += cubic([(248, 382), (191, 343), (132, 338), (72, 369)])[1:]
    draw.polygon(points(left), fill="#f7f4eb")

    right = [(440, 153)]
    right += cubic([(440, 153), (379, 120), (319, 124), (264, 167)])[1:]
    right += [(264, 382)]
    right += cubic([(264, 382), (321, 343), (380, 338), (440, 369)])[1:]
    draw.polygon(points(right), fill="#e4eaf2")

    draw.line(points([(256, 167), (256, 382)]), fill="#c9bf8a", width=p(12))
    for line in [
        [(109, 208), (143, 196), (176, 199), (210, 219)],
        [(109, 264), (143, 252), (176, 255), (210, 275)],
        [(403, 208), (369, 196), (336, 199), (302, 219)],
        [(403, 264), (369, 252), (336, 255), (302, 275)],
    ]:
        draw.line(points(line), fill="#183c6d", width=p(14), joint="curve")

    draw.ellipse((p(305), p(289), p(457), p(441)), fill="#cf1738")
    check = points([(342, 364), (368, 389), (418, 332)])
    width = p(22)
    draw.line(check, fill="#fff", width=width, joint="curve")
    radius = width // 2
    for x, y in check:
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill="#fff")

    image.resize((size, size), Image.Resampling.LANCZOS).save(OUTPUT / filename, optimize=True)


def create_maskable_icon(size, filename, source):
    """Mantém o livro dentro da área segura de 80% exigida por ícones maskable."""
    base = Image.new("RGB", (size, size), "#0d315f")
    artwork = Image.open(OUTPUT / source).convert("RGB")
    safe_size = round(size * 0.76)
    artwork = artwork.resize((safe_size, safe_size), Image.Resampling.LANCZOS)
    offset = (size - safe_size) // 2
    base.paste(artwork, (offset, offset))
    base.save(OUTPUT / filename, optimize=True)


OUTPUT.mkdir(parents=True, exist_ok=True)
create_icon(192, "icon-192-v448.png")
create_icon(512, "icon-512-v448.png")
create_maskable_icon(512, "icon-maskable-512-v448.png", "icon-512-v448.png")
