from pathlib import Path
from PIL import Image, ImageDraw

OUTPUT = Path("public/assets/icons")
SUPERSAMPLING = 4


def bezier(points, steps=36):
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

    def point(pair):
        return tuple(p(value) for value in pair)

    image = Image.new("RGB", (work_size, work_size), "#06162f")
    draw = ImageDraw.Draw(image)

    draw.rounded_rectangle((0, 0, work_size - 1, work_size - 1), radius=p(112), fill="#0b2851")
    draw.rounded_rectangle(
        (p(28), p(28), p(484), p(484)),
        radius=p(88), outline="#8d875f", width=max(2, p(6))
    )

    draw.rounded_rectangle(
        (p(86), p(109), p(426), p(356)),
        radius=p(39), fill="#f5f2e8"
    )
    draw.polygon([point((164, 337)), point((139, 423)), point((244, 337))], fill="#f5f2e8")

    question = bezier([(194, 201), (194, 157), (226, 131), (271, 131)])
    question += bezier([(271, 131), (314, 131), (346, 156), (346, 195)])[1:]
    question += bezier([(346, 195), (346, 257), (277, 256), (277, 303)])[1:]
    question = [point(pair) for pair in question]
    question_width = p(34)
    draw.line(question, fill="#0b2145", width=question_width, joint="curve")
    radius = question_width // 2
    for x, y in (question[0], question[-1]):
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill="#0b2145")
    draw.ellipse((p(257), p(307), p(297), p(347)), fill="#0b2145")

    draw.ellipse((p(308), p(286), p(460), p(438)), fill="#c8102e")
    check = [point((345, 361)), point((371, 386)), point((419, 330))]
    check_width = p(22)
    draw.line(check, fill="#ffffff", width=check_width, joint="curve")
    check_radius = check_width // 2
    for x, y in check:
        draw.ellipse((x - check_radius, y - check_radius, x + check_radius, y + check_radius), fill="#ffffff")

    image = image.resize((size, size), Image.Resampling.LANCZOS)
    image.save(OUTPUT / filename, optimize=True)


OUTPUT.mkdir(parents=True, exist_ok=True)
create_icon(192, "icon-192.png")
create_icon(512, "icon-512.png")
create_icon(512, "icon-maskable-512.png")
