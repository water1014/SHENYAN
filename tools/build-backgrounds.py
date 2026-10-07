"""
临时脚本：从 D:\本地资源库\ins 里挑一批竖版壁纸，
裁成手机比例、压成 WebP，放进项目 src/assets/backgrounds/。
（这是构建素材的脚本，不属于应用运行时代码；可保留供以后换图）
"""
import os, glob, json
from PIL import Image

SRC = r"D:\本地资源库\ins"
DST = r"D:\ds 人机恋\src\assets\backgrounds"
TARGET_W, TARGET_H = 900, 1600          # 手机壁纸够用，WebP 后约 60-120KB
os.makedirs(DST, exist_ok=True)
for f in glob.glob(os.path.join(DST, "*")):
    os.remove(f)

def kind(size):
    w, h = size
    r = w / h
    if r < 0.7:
        return 'portrait'
    if 0.9 < r < 1.1:
        return 'square'
    return 'wide'

files = sorted(glob.glob(os.path.join(SRC, "*.jpg")))
portrait, square = [], []
for f in files:
    try:
        im = Image.open(f)
    except Exception:
        continue
    k = kind(im.size)
    if k == 'portrait':
        portrait.append(f)
    elif k == 'square':
        square.append(f)

def sample(lst, n):
    if len(lst) <= n:
        return lst
    step = len(lst) / n
    return [lst[int(i * step)] for i in range(n)]

# 竖版为主（手机壁纸），各取若干；分批挑选留出替换空间
picked = sample(portrait, 10) + sample(square, 6)
manifest = []
for i, f in enumerate(picked, 1):
    im = Image.open(f).convert("RGB")
    w, h = im.size
    # 居中裁成 9:16
    target_ratio = TARGET_W / TARGET_H
    if w / h > target_ratio:
        new_w = int(h * target_ratio)
        left = (w - new_w) // 2
        im = im.crop((left, 0, left + new_w, h))
    else:
        new_h = int(w / target_ratio)
        top = (h - new_h) // 2
        im = im.crop((0, top, w, top + new_h))
    im = im.resize((TARGET_W, TARGET_H), Image.LANCZOS)
    name = f"bg-{i:02d}.webp"
    im.save(os.path.join(DST, name), "WEBP", quality=72, method=6)
    manifest.append({
        "file": name,
        "source": os.path.basename(f),
        "kb": round(os.path.getsize(os.path.join(DST, name)) / 1024, 1),
    })

print("输出", len(manifest), "张")
total = 0
for m in manifest:
    total += m["kb"]
    print(f'  {m["file"]}  {m["kb"]:>6} KB   <- {m["source"]}')
print("合计", round(total / 1024, 2), "MB")
