"""
生成 PWA 图标（自绘，不依赖第三方素材）。
底色用 PEARL TIDE 的石板蓝，字形用系统里的 HarmonyOS Sans SC Bold。
输出到 public/，Vite 会原样拷进 dist 根目录。
"""
import os
from PIL import Image, ImageDraw, ImageFont

PUBLIC = r"D:\ds 人机恋\public"
FONT_BOLD = r"C:\WINDOWS\Fonts\HarmonyOS_Sans_SC_Bold.ttf"
os.makedirs(PUBLIC, exist_ok=True)

# 石板蓝渐变：深 -> 略浅，保持低饱和
TOP = (58, 82, 106)      # #3A526A
BOTTOM = (36, 54, 74)    # #24364A
GLYPH = (245, 248, 251)  # 珍珠白


def gradient(size):
    w, h = size
    img = Image.new("RGB", (1, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        d.point((0, y), tuple(round(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3)))
    return img.resize((w, h), Image.BILINEAR)


def make(size, glyph_ratio, radius_ratio, out, bg_image=None):
    """glyph_ratio: 字形占边长比例；radius_ratio: 圆角比例；maskable 用 0 圆角、小字形"""
    base = bg_image.resize((size, size), Image.LANCZOS).convert("RGBA")

    if radius_ratio > 0:
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            (0, 0, size - 1, size - 1), radius=int(size * radius_ratio), fill=255
        )
        base.putalpha(mask)

    # 字形
    font_size = int(size * glyph_ratio)
    font = ImageFont.truetype(FONT_BOLD, font_size)
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    box = d.textbbox((0, 0), "伴", font=font)
    tw, th = box[2] - box[0], box[3] - box[1]
    # 视觉居中：按字形实际包围盒 + 基线微调
    x = (size - tw) / 2 - box[0]
    y = (size - th) / 2 - box[1] - size * 0.012
    d.text((x, y), "伴", font=font, fill=GLYPH)

    out_img = Image.alpha_composite(base, layer)
    out_img.save(os.path.join(PUBLIC, out), "PNG", optimize=True)
    return os.path.getsize(os.path.join(PUBLIC, out))


big = gradient((1024, 1024))
rows = []
# 普通图标：圆角 22%，字形 52%
for s in (192, 512):
    n = make(s, 0.52, 0.22, f"icon-{s}.png", big)
    rows.append((f"icon-{s}.png", s, n))
# maskable：直角铺满 + 字形收到 38%（落在安全区内）
n = make(512, 0.38, 0.0, "icon-maskable-512.png", big)
rows.append(("icon-maskable-512.png", 512, n))
# apple-touch-icon：iOS 会自己加圆角，所以给直角
n = make(180, 0.52, 0.0, "apple-touch-icon.png", big)
rows.append(("apple-touch-icon.png", 180, n))
# favicon 用 32 的 PNG（比 SVG 内联更稳，各浏览器都认）
n = make(32, 0.56, 0.2, "favicon-32.png", big)
rows.append(("favicon-32.png", 32, n))

for name, size, n in rows:
    print(f"  {name:<26} {size:>4}px  {n/1024:>6.1f} KB")
print("输出目录:", PUBLIC)
