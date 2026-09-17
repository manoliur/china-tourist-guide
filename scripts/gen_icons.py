"""Генерирует PWA-иконки (192x192, 512x512, favicon) — простой щит на графите,
янтарный акцент. Чистый PIL, без внешних сервисов."""
from PIL import Image, ImageDraw

BG = (11, 14, 20)
ACCENT = (232, 115, 74)  # янтарно-терракотовый — safety/alert, не флаг КНР
FG = (240, 236, 230)


def shield_path(cx, cy, w, h):
    return [
        (cx, cy - h * 0.5),
        (cx + w * 0.42, cy - h * 0.32),
        (cx + w * 0.42, cy + h * 0.05),
        (cx, cy + h * 0.5),
        (cx - w * 0.42, cy + h * 0.05),
        (cx - w * 0.42, cy - h * 0.32),
    ]


def make_icon(size, maskable=False):
    img = Image.new("RGB", (size, size), BG)
    draw = ImageDraw.Draw(img)
    pad = size * 0.22 if maskable else size * 0.12
    cx, cy = size / 2, size / 2
    w = h = size - pad * 2
    pts = shield_path(cx, cy, w, h)
    draw.polygon(pts, outline=ACCENT, width=max(2, size // 40))
    # крест внутри — узнаваемый символ помощи/справочника
    cross_w = w * 0.10
    cross_len = h * 0.42
    draw.rectangle([cx - cross_w / 2, cy - cross_len / 2, cx + cross_w / 2, cy + cross_len / 2], fill=FG)
    draw.rectangle([cx - cross_len / 2, cy - cross_w / 2, cx + cross_len / 2, cy + cross_w / 2], fill=FG)
    return img


for size in (192, 512):
    make_icon(size).save(f"public/icon-{size}.png")
make_icon(512, maskable=True).save("public/icon-512-maskable.png")
make_icon(64).save("public/favicon.png")
print("иконки готовы")
