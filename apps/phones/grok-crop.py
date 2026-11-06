"""Crops Grok's figurines tight for the phones: python3 apps/phones/grok-crop.py

The delivered PNGs (assets/grok/part2/agents/png, 256 px) are transparent but the figure fills
only part of the canvas. Each agent's five states are cropped to one common box (the union of their
bounds, so the figure does not jump between states), the same size for every agent, then scaled to
OUT px. The results replace apps/phones/static/grok/agents/. Needs Pillow (a local tool, not a build
step: the small results are committed).
"""
from pathlib import Path
from PIL import Image

REPO = Path(__file__).resolve().parents[2]
SRC = REPO / "assets/grok/part2/agents/png"
DST = REPO / "apps/phones/static/grok/agents"
STATES = ["idle", "thinking", "talking", "success", "refused"]
OUT = 176
PAD = 0.06

roles = sorted({p.name.split("-")[0] for p in SRC.glob("*-idle.png")})
boxes = {}
for role in roles:
    union = None
    for state in STATES:
        im = Image.open(SRC / f"{role}-{state}.png").convert("RGBA")
        bb = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
        if bb is None:
            raise SystemExit(f"grok-crop: {role}-{state} is fully transparent")
        union = bb if union is None else (min(union[0], bb[0]), min(union[1], bb[1]), max(union[2], bb[2]), max(union[3], bb[3]))
    boxes[role] = union

side = max(max(b[2] - b[0], b[3] - b[1]) for b in boxes.values())
side = int(side * (1 + 2 * PAD))
DST.mkdir(parents=True, exist_ok=True)
for role, b in boxes.items():
    cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
    left, top = round(cx - side / 2), round(cy - side / 2)
    for state in STATES:
        im = Image.open(SRC / f"{role}-{state}.png").convert("RGBA")
        canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        canvas.paste(im, (-left, -top))
        canvas.resize((OUT, OUT), Image.LANCZOS).save(DST / f"{role}-{state}.png", optimize=True)
print(f"grok-crop: {len(roles) * len(STATES)} figurines, {side} px crop, {OUT} px out")
