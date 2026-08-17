from pathlib import Path
import cairosvg

ROOT = Path(__file__).resolve().parents[1]
source = str(ROOT / 'icon-source.svg')
for size, name in [(180, 'apple-touch-icon-fixed.png'), (192, 'icon-192-fixed.png'), (512, 'icon-512-fixed.png')]:
    cairosvg.svg2png(url=source, write_to=str(ROOT / name), output_width=size, output_height=size)
