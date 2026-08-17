from pathlib import Path
from collections import deque
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
src = ROOT / 'apple-touch-icon.png'
im = Image.open(src).convert('RGB')
w, h = im.size
pix = im.load()
seen = bytearray(w*h)
q = deque()

def dark(x, y):
    r, g, b = pix[x, y]
    return r < 35 and g < 35 and b < 35

for x in range(w):
    if dark(x, 0): q.append((x, 0))
    if dark(x, h-1): q.append((x, h-1))
for y in range(h):
    if dark(0, y): q.append((0, y))
    if dark(w-1, y): q.append((w-1, y))

while q:
    x, y = q.popleft()
    idx = y*w + x
    if seen[idx] or not dark(x, y):
        continue
    seen[idx] = 1
    pix[x, y] = (255, 255, 255)
    if x: q.append((x-1, y))
    if x+1 < w: q.append((x+1, y))
    if y: q.append((x, y-1))
    if y+1 < h: q.append((x, y+1))

for size, name in [(180, 'apple-touch-icon-fixed.png'), (192, 'icon-192-fixed.png'), (512, 'icon-512-fixed.png')]:
    out = im.resize((size, size), Image.Resampling.LANCZOS)
    out.save(ROOT / name, 'PNG', optimize=True)
