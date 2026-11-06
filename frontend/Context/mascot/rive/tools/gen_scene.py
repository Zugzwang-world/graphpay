"""Generates ../scene.rml: the fox mascot redrawn as vector shapes in the
2048px space of mascot-01.jpg (the root node scales it onto a 1024 artboard)."""
import os
import re
from contextlib import contextmanager

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "scene.rml")
MX = 1914  # mirror axis (2 * face centre x)

C = dict(orange="FFFF6B0D", dark="FF47121F", cream="FFFDE7B8", yellow="FFFDDB7A",
         pink="FFFF54B0", blue="FF00A9EC", dkblue="FF0083D1", peach="FFFFB583",
         white="FFFFFFFF")

lines, _ids, offs = [], [20], [(0, 0)]
tracks = {}
PX, PY, ROT, SX, SY, OPA, VX, VY = 13, 14, 15, 16, 17, 18, 24, 25
ID = {}


def nid():
    _ids[0] += 1
    return f"0:{_ids[0]}"


def w(s):
    lines.append("    " * (len(offs) + 1) + s)


def f(v):
    return f"{v:.4g}" if isinstance(v, float) else str(v)


@contextmanager
def node(name, px=0, py=0, ident=None, attrs=""):
    ox, oy = offs[-1]
    i = ident or nid()
    w(f'<Node x="{f(px - ox)}" y="{f(py - oy)}" {attrs} name="{name}" id="{i}">')
    offs.append((px, py))
    yield i
    offs.pop()
    w("</Node>")


def paint(fill, stroke, thick):
    if fill:
        w(f'<Fill name="Fill"><SolidColor colorValue="{C[fill]}" name="C"/></Fill>')
    if stroke:
        w(f'<Stroke thickness="{thick}" cap="round" join="round" name="Stroke">'
          f'<SolidColor colorValue="{C[stroke]}" name="C"/></Stroke>')


def ellipse(name, cx, cy, ew, eh, fill, rot=0, ident=None):
    ox, oy = offs[-1]
    i = ident or nid()
    r = f' rotation="{rot}"' if rot else ""
    w(f'<Shape x="{f(cx - ox)}" y="{f(cy - oy)}"{r} name="{name}" id="{i}">')
    w(f'  <Ellipse width="{ew}" height="{eh}" name="Path"/>')
    paint(fill, None, 0)
    w("</Shape>")
    return i


def rect(name, cx, cy, rw, rh, corner, fill, rot=0, oy_n=0.5):
    ox, oy = offs[-1]
    r = f' rotation="{rot}"' if rot else ""
    w(f'<Shape x="{f(cx - ox)}" y="{f(cy - oy)}"{r} name="{name}">')
    w(f'  <Rectangle width="{rw}" height="{rh}" originY="{oy_n}" cornerRadiusTL="{corner}" name="Path"/>')
    paint(fill, None, 0)
    w("</Shape>")


def poly(name, pts, fill, radius=0, mirror=False, stroke=None, thick=8, closed=True, vids=None, ident=None):
    if mirror:
        pts = [(MX - x, y) for x, y in pts]
    ox, oy = offs[-1]
    area = sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1]
               for i in range(len(pts)))
    idattr = f' id="{ident}"' if ident else ""
    w(f'<Shape name="{name}"{idattr}>')
    w(f'  <PointsPath isClosed="{str(closed).lower()}" isClockwise="{str(area > 0).lower()}" name="Path">')
    for n, (x, y) in enumerate(pts):
        vid = f' id="{vids[n]}"' if vids else ""
        rd = f' radius="{radius}"' if radius and (closed or 0 < n < len(pts) - 1) else ""
        w(f'    <StraightVertex x="{f(x - ox)}" y="{f(y - oy)}"{rd}{vid}/>')
    w("  </PointsPath>")
    paint(fill, stroke, thick)
    w("</Shape>")


def lid(name, cx, cy, hw, sag, thick, ident):
    ox, oy = offs[-1]
    w(f'<Shape x="{f(cx - ox)}" y="{f(cy - oy)}" opacity="0" name="{name}" id="{ident}">')
    w('  <PointsPath isClockwise="true" name="Path">')
    w(f'    <StraightVertex x="{-hw}" y="0"/><StraightVertex x="0" y="{sag}" radius="40"/>'
      f'<StraightVertex x="{hw}" y="0"/>')
    w("  </PointsPath>")
    paint(None, "dark", thick)
    w("</Shape>")


def build(which, base):
    global tracks, ID
    tracks, ID = {}, {}
    offs[:] = [(0, 0)]
    _ids[0] = base
    # ---------- the fox ----------

    w(f'<Artboard defaultStateMachineId="0:7" styleId="0:5" width="1024" height="1024" name="{which}" id="0:2">')
    w('  <LayoutComponentStyle name="Artboard Style" id="0:5"/>')
    w('  <Fill name="Background"><SolidColor colorValue="FFFFFFFF" name="C"/></Fill>')

    with node("Fox", 0, 0, attrs='scaleX="0.5" scaleY="0.5"'):
        with node("Arm", 1340, 1580, ident="0:9", attrs='rotation="0.9" opacity="0"'):
            ellipse("Toe", 1302, 1112, 36, 50, "dark")
            ellipse("Toe 2", 1378, 1112, 36, 50, "dark")
            ellipse("Paw", 1340, 1170, 160, 150, "dark")
            rect("Arm Cream", 1340, 1490, 80, 230, 40, "cream", oy_n=1)
            rect("Arm Fur", 1340, 1580, 150, 430, 75, "orange", oy_n=1)

        with node("Sparks", 990, 225, ident="0:10"):
            poly("Spark L", [(900, 185), (938, 250)], None, stroke="dark", thick=9, closed=False)
            poly("Spark R", [(1088, 178), (1045, 268)], None, stroke="dark", thick=9, closed=False)

        with node("Breath", 960, 1840, ident="0:11"):
            with node("Head", 960, 1300, ident="0:12"):
                mv = [nid() for _ in range(4)]
                ID["mouth"] = mv
                ID["mouthShape"], ID["openMouth"] = nid(), nid()
                ID["browL"], ID["browR"], ID["lidHL"], ID["lidHR"] = nid(), nid(), nid(), nid()
                lid("Brow L", 745, 585, 85, -34, 18, ID["browL"])
                lid("Brow R", 1160, 600, 85, -34, 18, ID["browR"])
                lid("Happy Eye L", 745, 855, 100, -62, 16, ID["lidHL"])
                lid("Happy Eye R", 1160, 855, 100, -62, 16, ID["lidHR"])
                ox, oy = offs[-1]
                w(f'<Node x="{937 - ox}" y="{1215 - oy}" opacity="0" name="Open Smile" id="{ID["openMouth"]}">')
                offs.append((937, 1215))
                ellipse("Tongue", 937, 1262, 90, 36, "pink")
                poly("Open Mouth", [(838, 1195), (1036, 1195), (1010, 1262), (937, 1296), (864, 1262)], "dark", radius=40)
                offs.pop()
                w("</Node>")
                poly("Mouth", [(885, 1245), (1000, 1240), (1085, 1185), (1130, 1070)], None,
                     radius=70, stroke="dark", thick=9, closed=False, vids=mv, ident=ID["mouthShape"])
                poly("Philtrum", [(937, 1160), (937, 1238)], None, stroke="dark", thick=8, closed=False)
                ellipse("Nose Shine", 975, 1078, 58, 30, "white", rot=-0.3)
                ellipse("Nose", 937, 1115, 185, 150, "dark")
                ID["blushL"] = ellipse("Blush L", 732, 1066, 122, 58, "pink")
                ID["blushR"] = ellipse("Blush R", 1222, 1066, 122, 58, "pink")

                for side, cx, sq in (("L", 745, 0.45), ("R", 1160, 0.7)):
                    ID["lidB" + side], ID["lidS" + side] = nid(), nid()
                    lid("Lid Closed " + side, cx, 830, 112, 14, 14, ID["lidB" + side])
                    lid("Lid Squint " + side, cx, 830 - 180 * sq, 100, 4, 15, ID["lidS" + side])

                for side, cx, px_ in (("L", 745, 772), ("R", 1160, 1177)):
                    blink, mood, pup = nid(), nid(), nid()
                    ID["eyeB" + side], ID["eyeM" + side], ID["pup" + side] = blink, mood, pup
                    with node("Eye " + side, cx, 830, ident=blink):
                        with node("Eye Mood " + side, cx, 830, ident=mood):
                            ellipse("Pupil " + side, px_, 795, 95, 165, "dark", ident=pup)
                            ellipse("Eye White " + side, cx, 830, 235, 360, "white")
                            ID["pupBase" + side] = (px_ - cx, 795 - 830)

                ellipse("Eye Patch L", 758, 870, 390, 480, "cream", rot=0.04)
                ellipse("Eye Patch R", 1156, 870, 390, 480, "cream", rot=-0.04)
                rect("Forehead Shine", 790, 545, 200, 46, 23, "peach", rot=-0.62)
                poly("Cheeks", [(260, 888), (420, 905), (540, 960), (700, 1030), (960, 1062), (1220, 1030),
                                (1380, 960), (1490, 905), (1670, 888), (1560, 1010), (1380, 1130),
                                (1150, 1215), (940, 1245), (740, 1215), (540, 1130), (350, 1010)],
                     "cream", radius=24)
                poly("Head", [(400, 930), (560, 760), (700, 580), (860, 450), (960, 430), (1060, 450),
                              (1220, 580), (1360, 760), (1520, 930), (1220, 1160), (960, 1250), (700, 1160)],
                     "orange", radius=70)
                poly("Tuft", [(858, 305), (940, 385), (1012, 345), (1062, 430), (1000, 480), (880, 450)],
                     "orange", radius=10)

                for side, mirror, bx in (("L", False, 700), ("R", True, 1214)):
                    eid = nid()
                    ID["ear" + side] = eid
                    with node("Ear " + side, bx, 690, ident=eid):
                        poly("Ear Tip " + side, [(470, 135), (640, 215), (700, 268), (610, 262), (572, 330),
                                                 (520, 290), (470, 480), (408, 430), (405, 300)],
                             "dark", radius=6, mirror=mirror)
                        poly("Ear Fluff " + side, [(560, 470), (650, 450), (735, 540), (742, 600), (640, 690)],
                             "yellow", radius=20, mirror=mirror)
                        poly("Ear Inner " + side, [(465, 330), (560, 285), (650, 345), (735, 460), (742, 600),
                                                   (600, 705), (530, 640), (470, 500)],
                             "cream", radius=40, mirror=mirror)
                        poly("Ear Outer " + side, [(470, 135), (640, 215), (760, 330), (830, 470), (790, 640),
                                                   (590, 745), (470, 640), (410, 470), (405, 300)],
                             "orange", radius=18, mirror=mirror)

            with node("Scarf", 1000, 1300, ident="0:13"):
                tid = nid()
                ID["tail"] = tid
                with node("Scarf Tail", 700, 1350, ident=tid):
                    poly("Tail Fabric", [(650, 1335), (800, 1360), (760, 1500), (705, 1585), (520, 1555), (570, 1440)],
                         "blue", radius=28)
                    poly("Tail Shade", [(735, 1375), (800, 1360), (760, 1505), (705, 1585), (668, 1570), (715, 1470)],
                         "dkblue", radius=20)
                poly("Scarf Band", [(600, 1270), (650, 1225), (1260, 1205), (1305, 1235), (1300, 1292),
                                    (1220, 1332), (1000, 1372), (780, 1362), (650, 1348)], "blue", radius=46)
                poly("Scarf Shade", [(1225, 1232), (1300, 1238), (1292, 1295), (1205, 1325)], "dkblue", radius=22)

            with node("Torso", 960, 1830):
                poly("Belly", [(760, 1440), (850, 1385), (1050, 1375), (1180, 1440), (1232, 1650), (1232, 1832),
                               (655, 1832), (660, 1600)], "cream", radius=70)
                poly("Body", [(560, 1450), (700, 1335), (1000, 1295), (1300, 1335), (1395, 1475), (1455, 1700),
                              (1405, 1835), (560, 1835), (500, 1700)], "orange", radius=60)
                ellipse("Burrow", 968, 1828, 1130, 112, "dark")


    # ---------- animations ----------
    def key(anim, obj, prop, seq):
        tracks.setdefault(anim, {}).setdefault(obj, {})[prop] = seq


    def kf(fr, v, it):
        fa = f' frame="{fr}"' if fr else ""
        if it == "cubic":
            return (f'<KeyFrameDouble value="{f(v)}"{fa} interpolationType="cubic">'
                    f'<CubicEaseInterpolator x1="0.42" y1="0" x2="0.58" y2="1"/></KeyFrameDouble>')
        return f'<KeyFrameDouble value="{f(v)}"{fa} interpolationType="{it}"/>'


    LOOPS = set()


    def anim_xml(name, aid, dur):
        out = [f'<LinearAnimation loopValue="{"loop" if name in LOOPS else "oneShot"}" duration="{dur}" '
               f'name="{name}" id="{aid}">']
        for obj, props in tracks.get(name, {}).items():
            out.append(f'  <KeyedObject objectId="{obj}">')
            for pk, seq in props.items():
                out.append(f'    <KeyedProperty propertyKey="{pk}">')
                out += ["      " + kf(*k) for k in seq]
                out.append("    </KeyedProperty>")
            out.append("  </KeyedObject>")
        out.append("</LinearAnimation>")
        return out


    base_mouth = [(885, 1245), (1000, 1240), (1085, 1185), (1130, 1070)]
    smile_mouth = [(872, 1243), (985, 1252), (1098, 1165), (1160, 1030)]
    doubt_mouth = [(890, 1236), (1000, 1246), (1088, 1218), (1135, 1100)]


    def mouth(anim, target, fr):
        a, b, c, d = fr
        for n, vid in enumerate(ID["mouth"]):
            for prop, idx, org in ((VX, 0, 960), (VY, 1, 1300)):
                bv, tv = base_mouth[n][idx] - org, target[n][idx] - org
                key(anim, vid, prop, [(a, bv, "cubic"), (b, tv, "linear"), (c, tv, "cubic"), (d, bv, "linear")])


    def hold(anim, obj, prop, base, target, fr):
        a, b, c, d = fr
        key(anim, obj, prop, [(a, base, "cubic"), (b, target, "linear"), (c, target, "cubic"), (d, base, "linear")])


    B = ID
    DUR = {"EarTwitch": 360, "Idle": 360, "Blink": 270, "Smile": 140, "Wave": 200, "Squint": 300}
    LOOPS.update(DUR)

    # Ear twitch: runs on every artboard
    key("EarTwitch", B["earL"], ROT, [(0, 0, "hold"), (200, 0, "cubic"), (208, -0.16, "cubic"), (216, 0.04, "cubic"),
                                      (224, -0.1, "cubic"), (236, 0, "linear"), (360, 0, "linear")])
    key("EarTwitch", B["earR"], ROT, [(0, 0, "hold"), (300, 0, "cubic"), (307, 0.15, "cubic"), (315, -0.03, "cubic"),
                                      (324, 0, "linear"), (360, 0, "linear")])

    if which == "Idle":
        key("Idle", "0:11", SY, [(0, 1, "cubic"), (90, 1.014, "cubic"), (180, 1, "cubic"), (270, 1.014, "cubic"), (360, 1, "linear")])
        key("Idle", "0:12", ROT, [(0, 0, "cubic"), (120, 0.012, "cubic"), (240, -0.012, "cubic"), (360, 0, "linear")])
        key("Idle", B["tail"], ROT, [(0, 0, "cubic"), (90, 0.05, "cubic"), (180, 0, "cubic"), (270, -0.04, "cubic"), (360, 0, "linear")])
        key("Idle", "0:13", ROT, [(0, 0, "cubic"), (180, 0.006, "cubic"), (360, 0, "linear")])

    if which == "Blink":
        for s in "LR":
            key("Blink", B["eyeB" + s], SY, [(0, 1, "hold"), (150, 1, "linear"), (155, 0.05, "linear"),
                                              (159, 0.05, "linear"), (165, 1, "linear"), (270, 1, "linear")])
            key("Blink", B["lidB" + s], OPA, [(0, 0, "hold"), (154, 0, "hold"), (155, 1, "hold"), (161, 1, "hold"),
                                               (162, 0, "hold"), (270, 0, "hold")])

    if which == "Smile":
        # Big happy smile: eyes close into happy arcs, an open mouth with a tongue pops in
        fr = (0, 22, 120, 150)
        for s in "LR":
            hold("Smile", B["blush" + s], SX, 1, 1.35, fr)
            hold("Smile", B["blush" + s], SY, 1, 1.35, fr)
            key("Smile", B["eyeB" + s], SY, [(0, 1, "hold"), (14, 1, "linear"), (16, 0.02, "hold"), (126, 0.02, "linear"), (128, 1, "hold"), (150, 1, "linear")])
            key("Smile", B["lidH" + s], OPA, [(0, 0, "hold"), (15, 1, "hold"), (127, 0, "hold"), (150, 0, "hold")])
        key("Smile", B["mouthShape"], OPA, [(0, 1, "hold"), (14, 0, "hold"), (136, 1, "hold"), (150, 1, "hold")])
        key("Smile", B["openMouth"], OPA, [(0, 0, "hold"), (14, 1, "hold"), (136, 0, "hold"), (150, 0, "hold")])
        key("Smile", B["openMouth"], SY, [(0, 0.3, "cubic"), (14, 0.3, "cubic"), (30, 1.12, "cubic"), (40, 1, "linear"), (150, 1, "linear")])
        key("Smile", B["openMouth"], SX, [(0, 0.8, "cubic"), (14, 0.8, "cubic"), (30, 1.08, "cubic"), (40, 1, "linear"), (150, 1, "linear")])
        key("Smile", "0:12", ROT, [(0, 0, "cubic"), (22, 0.04, "cubic"), (50, -0.04, "cubic"), (80, 0.04, "cubic"),
                                    (110, -0.03, "cubic"), (140, 0, "linear"), (150, 0, "linear")])
        key("Smile", "0:12", PY, [(0, -540, "cubic"), (30, -552, "cubic"), (50, -540, "cubic"), (80, -552, "cubic"), (100, -540, "cubic"),
                                   (150, -540, "linear")])
    if which == "Wave":
        # Same happy smile as the Smile artboard (closed happy eyes, open mouth) while the paw waves
        fr = (0, 22, 170, 200)
        for s in "LR":
            hold("Wave", B["blush" + s], SX, 1, 1.35, fr)
            hold("Wave", B["blush" + s], SY, 1, 1.35, fr)
            key("Wave", B["eyeB" + s], SY, [(0, 1, "hold"), (14, 1, "linear"), (16, 0.02, "hold"), (176, 0.02, "linear"), (178, 1, "hold"), (200, 1, "linear")])
            key("Wave", B["lidH" + s], OPA, [(0, 0, "hold"), (15, 1, "hold"), (177, 0, "hold"), (200, 0, "hold")])
        key("Wave", B["mouthShape"], OPA, [(0, 1, "hold"), (14, 0, "hold"), (186, 1, "hold"), (200, 1, "hold")])
        key("Wave", B["openMouth"], OPA, [(0, 0, "hold"), (14, 1, "hold"), (186, 0, "hold"), (200, 0, "hold")])
        key("Wave", B["openMouth"], SY, [(0, 0.3, "cubic"), (14, 0.3, "cubic"), (30, 1.12, "cubic"), (40, 1, "linear"), (200, 1, "linear")])
        key("Wave", B["openMouth"], SX, [(0, 0.8, "cubic"), (14, 0.8, "cubic"), (30, 1.08, "cubic"), (40, 1, "linear"), (200, 1, "linear")])
        key("Wave", "0:12", ROT, [(0, 0, "cubic"), (22, -0.04, "cubic"), (60, 0.03, "cubic"), (100, -0.04, "cubic"),
                                   (140, 0.03, "cubic"), (170, -0.03, "cubic"), (200, 0, "linear")])
        key("Wave", "0:9", OPA, [(0, 0, "cubic"), (18, 1, "linear"), (176, 1, "cubic"), (194, 0, "linear"), (200, 0, "linear")])
        key("Wave", "0:9", ROT, [(0, 0.9, "cubic"), (24, 0.3, "cubic"), (48, 0.75, "cubic"), (72, 0.3, "cubic"),
                                 (96, 0.75, "cubic"), (120, 0.3, "cubic"), (144, 0.75, "cubic"), (168, 0.35, "cubic"),
                                 (194, 0.9, "linear"), (200, 0.9, "linear")])
        for ax in (SX, SY):
            key("Wave", "0:10", ax, [(0, 1, "cubic"), (12, 1.3, "cubic"), (24, 1, "cubic"), (60, 1.2, "cubic"),
                                     (72, 1, "linear"), (200, 1, "linear")])
    if which == "Squint":
        # "What are you doing, bro?": leans toward the viewer, stares straight at them with
        # half-lidded eyes, one brow shoots up, the head cocks further, a slow unimpressed beat.
        flat_mouth = [(890, 1243), (1000, 1247), (1090, 1243), (1135, 1218)]
        key("Squint", "0:12", ROT, [(0, 0, "cubic"), (26, -0.1, "cubic"), (70, -0.1, "cubic"), (100, -0.2, "cubic"),
                                    (200, -0.2, "cubic"), (235, -0.1, "cubic"), (270, 0, "cubic"), (300, 0, "linear")])
        key("Squint", "0:12", PX, [(0, 0, "cubic"), (26, -18, "cubic"), (100, -40, "cubic"), (200, -40, "cubic"),
                                    (270, 0, "cubic"), (300, 0, "linear")])
        for ax in (SX, SY):
            key("Squint", "0:12", ax, [(0, 1, "cubic"), (26, 1.05, "cubic"), (200, 1.05, "cubic"), (270, 1, "cubic"), (300, 1, "linear")])
        for s, sq in (("L", 0.45), ("R", 0.7)):
            bx, by = B["pupBase" + s]
            key("Squint", B["eyeM" + s], SY, [(0, 1, "cubic"), (26, sq, "cubic"), (235, sq, "cubic"), (270, 1, "cubic"), (300, 1, "linear")])
            key("Squint", B["pup" + s], PX, [(0, bx, "cubic"), (26, 0, "cubic"), (235, 0, "cubic"), (270, bx, "cubic"), (300, bx, "linear")])
            key("Squint", B["pup" + s], PY, [(0, by, "cubic"), (26, 4, "cubic"), (235, 4, "cubic"), (270, by, "cubic"), (300, by, "linear")])
            key("Squint", B["lidS" + s], OPA, [(0, 0, "hold"), (22, 0, "cubic"), (28, 1, "linear"), (232, 1, "cubic"),
                                               (238, 0, "linear"), (300, 0, "linear")])
            hold("Squint", B["blush" + s], SX, 1, 0.85, (0, 26, 235, 270))
        # brows: right one shoots up, left one drops
        key("Squint", B["browL"], OPA, [(0, 0, "hold"), (40, 0, "cubic"), (60, 1, "linear"), (215, 1, "cubic"), (235, 0, "linear"), (300, 0, "linear")])
        key("Squint", B["browR"], OPA, [(0, 0, "hold"), (40, 0, "cubic"), (60, 1, "linear"), (215, 1, "cubic"), (235, 0, "linear"), (300, 0, "linear")])
        key("Squint", B["browL"], PY, [(0, -705, "hold"), (60, -690, "cubic"), (100, -682, "cubic"), (215, -682, "linear"), (300, -682, "linear")])
        key("Squint", B["browR"], PY, [(0, -700, "hold"), (60, -715, "cubic"), (100, -775, "cubic"), (130, -765, "cubic"),
                                       (160, -775, "cubic"), (215, -775, "linear"), (300, -775, "linear")])
        key("Squint", B["browR"], ROT, [(0, 0, "cubic"), (100, -0.12, "cubic"), (215, -0.12, "linear"), (300, -0.12, "linear")])
        mouth("Squint", flat_mouth, (0, 26, 235, 270))
        key("Squint", "0:10", OPA, [(0, 1, "cubic"), (26, 0, "linear"), (235, 0, "cubic"), (270, 1, "linear"), (300, 1, "linear")])
    # ---------- state machine ----------
    names = ("EarTwitch", which)
    aid = {k: nid() for k in names}
    w('<StateMachine name="Fox" id="0:7">')
    for lname, anim in (("Ears", "EarTwitch"), (which, which)):
        s_id = nid()
        w(f'  <StateMachineLayer name="{lname}" id="{nid()}">')
        w('    <AnyState x="200" y="-120"/><ExitState x="400" y="-120"/>')
        w(f'    <EntryState><StateTransition stateToId="{s_id}"/></EntryState>')
        w(f'    <AnimationState x="200" animationId="{aid[anim]}" id="{s_id}"/>')
        w("  </StateMachineLayer>")
    w("</StateMachine>")
    for name in names:
        lines.extend("        " + ln for ln in anim_xml(name, aid[name], DUR[name]))
    w("</Artboard>")


w('<Rive version="1" kind="fragment">')
for n, which in enumerate(("Idle", "Blink", "Smile", "Wave", "Squint")):
    offs[:] = [(0, 0)]
    start = len(lines)
    build(which, 20)
    chunk = "\n".join(lines[start:])
    chunk = re.sub(r'"0:(\d+)"', lambda m: f'"0:{int(m.group(1)) + 1000 * n}"', chunk)
    lines[start:] = chunk.split("\n")
w('</Rive>')

with open(OUT, "w", encoding="utf-8") as fh:
    fh.write("\n".join(lines) + "\n")
print("wrote", os.path.normpath(OUT), len(lines), "lines")




