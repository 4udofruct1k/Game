#!/usr/bin/env python3
"""Процедурный генератор пиксель-арт спрайтов существ.
Чистые силуэты, высокий контраст, жирный тёмный контур.
Ничего не берёт из арт-борды — рисует с нуля по семействам/палитрам.
"""
import os
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'sprites')
os.makedirs(OUT, exist_ok=True)

# ---- палитры (base, shade, light, accent) в RGB ----
PAL = {
    'green':  ((74, 168, 92),  (40, 110, 56),  (150, 214, 120), (230, 210, 90)),
    'bog':    ((104, 150, 70), (60, 96, 42),   (168, 196, 96),  (176, 90, 190)),
    'fire':   ((228, 96, 40),  (150, 44, 24),  (255, 190, 70),  (255, 240, 120)),
    'ice':    ((96, 176, 224), (44, 104, 168), (198, 234, 255), (255, 255, 255)),
    'void':   ((120, 70, 190), (62, 30, 110),  (196, 130, 255), (236, 90, 220)),
    'bone':   ((214, 210, 190),(150, 146, 128),(244, 242, 230), (170, 60, 60)),
    'demon':  ((176, 52, 52),  (104, 26, 30),  (232, 110, 90),  (255, 210, 60)),
    'gray':   ((150, 156, 172),(92, 98, 116),  (206, 212, 226), (120, 200, 240)),
    'rat':    ((150, 120, 96), (96, 74, 56),   (200, 176, 150), (200, 90, 90)),
    'ghost':  ((186, 214, 232),(120, 156, 186),(238, 248, 255), (150, 220, 255)),
    'hero':   ((70, 130, 210), (36, 78, 150),  (150, 196, 255), (255, 214, 84)),
}
OUTLINE = (22, 20, 30)
EYE = (250, 250, 255)
PUPIL = (30, 20, 30)

# ---- сетка-рисовалка ----
class Grid:
    def __init__(self, n):
        self.n = n
        self.px = [[None] * n for _ in range(n)]

    def set(self, x, y, c):
        if 0 <= x < self.n and 0 <= y < self.n and c is not None:
            self.px[y][x] = c

    def ellipse(self, cx, cy, rx, ry, c):
        for y in range(int(cy - ry), int(cy + ry) + 1):
            for x in range(int(cx - rx), int(cx + rx) + 1):
                dx = (x - cx) / max(rx, 0.01)
                dy = (y - cy) / max(ry, 0.01)
                if dx * dx + dy * dy <= 1.0:
                    self.set(x, y, c)

    def rect(self, x0, y0, x1, y1, c):
        for y in range(int(y0), int(y1) + 1):
            for x in range(int(x0), int(x1) + 1):
                self.set(x, y, c)

    def tri(self, pts, c):
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        for y in range(int(min(ys)), int(max(ys)) + 1):
            for x in range(int(min(xs)), int(max(xs)) + 1):
                if self._in_tri((x, y), pts):
                    self.set(x, y, c)

    @staticmethod
    def _in_tri(p, t):
        def sign(a, b, c):
            return (a[0]-c[0])*(b[1]-c[1]) - (b[0]-c[0])*(a[1]-c[1])
        d1 = sign(p, t[0], t[1]); d2 = sign(p, t[1], t[2]); d3 = sign(p, t[2], t[0])
        neg = (d1 < 0) or (d2 < 0) or (d3 < 0)
        pos = (d1 > 0) or (d2 > 0) or (d3 > 0)
        return not (neg and pos)

    def mirror_lr(self):
        # правую половину = зеркало левой
        for y in range(self.n):
            for x in range(self.n // 2):
                self.px[y][self.n - 1 - x] = self.px[y][x]

    def add_outline(self):
        n = self.n
        out = [[self.px[y][x] for x in range(n)] for y in range(n)]
        for y in range(n):
            for x in range(n):
                if self.px[y][x] is None:
                    near = False
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            xx, yy = x + dx, y + dy
                            if 0 <= xx < n and 0 <= yy < n and self.px[yy][xx] is not None \
                               and self.px[yy][xx] != OUTLINE:
                                near = True
                    if near:
                        out[y][x] = OUTLINE
        self.px = out

    def render(self, scale):
        n = self.n
        img = Image.new('RGBA', (n * scale, n * scale), (0, 0, 0, 0))
        px = img.load()
        for y in range(n):
            for x in range(n):
                c = self.px[y][x]
                if c is None:
                    continue
                r, g, b = c
                for sy in range(scale):
                    for sx in range(scale):
                        px[x * scale + sx, y * scale + sy] = (r, g, b, 255)
        return img


def eyes(g, cy, spread, r=1, glow=None):
    n = g.n; cx = n // 2
    for sx in (-1, 1):
        ex = cx + sx * spread
        g.ellipse(ex, cy, r + 0.6, r + 0.6, glow or EYE)
        g.ellipse(ex, cy, max(r - 0.4, 0.6), max(r - 0.4, 0.6), PUPIL)


# ---- семейства существ (рисуют на сетке n, палитра p) ----
def draw_humanoid(g, p, horns=False, ears=False, hood=False, staff=False):
    n = g.n; cx = n // 2
    base, shade, light, acc = p
    body_top = int(n * 0.42)
    # тело
    g.ellipse(cx, int(n * 0.66), n * 0.24, n * 0.22, base)
    g.rect(cx - int(n*0.16), int(n*0.5), cx + int(n*0.16), int(n*0.78), base)
    # ноги
    g.rect(cx - int(n*0.14), int(n*0.78), cx - int(n*0.04), int(n*0.9), shade)
    g.rect(cx + int(n*0.04), int(n*0.78), cx + int(n*0.14), int(n*0.9), shade)
    # руки
    g.ellipse(cx - int(n*0.2), int(n*0.6), n*0.06, n*0.1, shade)
    # голова
    hy = int(n * 0.32)
    if hood:
        g.ellipse(cx, hy, n * 0.2, n * 0.2, shade)
        g.ellipse(cx, hy + 2, n * 0.14, n * 0.14, (14, 12, 22))
        eyes(g, hy + 1, int(n*0.06), 1, acc)
    else:
        g.ellipse(cx, hy, n * 0.17, n * 0.17, light)
        eyes(g, hy, int(n*0.07), 1.4)
    if ears:
        g.tri([(cx - int(n*0.16), hy - 2), (cx - int(n*0.28), hy - int(n*0.1)), (cx - int(n*0.13), hy + 2)], base)
        g.tri([(cx + int(n*0.16), hy - 2), (cx + int(n*0.28), hy - int(n*0.1)), (cx + int(n*0.13), hy + 2)], base)
    if horns:
        g.tri([(cx - int(n*0.1), hy - int(n*0.12)), (cx - int(n*0.2), hy - int(n*0.32)), (cx - int(n*0.03), hy - int(n*0.14))], acc)
    if staff:
        g.rect(cx + int(n*0.22), int(n*0.3), cx + int(n*0.25), int(n*0.82), (120, 96, 60))
        g.ellipse(cx + int(n*0.235), int(n*0.28), n*0.06, n*0.06, acc)
    # блик на теле
    g.ellipse(cx - int(n*0.08), int(n*0.58), n*0.05, n*0.08, light)


def draw_blob(g, p, drips=True):
    n = g.n; cx = n // 2
    base, shade, light, acc = p
    g.ellipse(cx, int(n*0.62), n*0.32, n*0.28, base)
    g.rect(cx - int(n*0.3), int(n*0.6), cx + int(n*0.3), int(n*0.78), base)
    # блик
    g.ellipse(cx - int(n*0.12), int(n*0.5), n*0.1, n*0.09, light)
    eyes(g, int(n*0.58), int(n*0.12), 1.8)
    if drips:
        g.ellipse(cx - int(n*0.22), int(n*0.82), n*0.05, n*0.07, base)
        g.ellipse(cx + int(n*0.18), int(n*0.84), n*0.04, n*0.06, base)


def draw_beast(g, p):
    # четвероногий хищник, вид 3/4
    n = g.n; cx = n // 2
    base, shade, light, acc = p
    g.ellipse(cx, int(n*0.6), n*0.3, n*0.2, base)          # тело
    g.rect(cx - int(n*0.24), int(n*0.6), cx + int(n*0.24), int(n*0.76), shade)  # ноги-зона
    for lx in (-0.2, -0.06, 0.08, 0.22):
        g.rect(cx + int(n*lx), int(n*0.7), cx + int(n*lx) + 2, int(n*0.88), shade)
    # голова
    hy = int(n*0.4)
    g.ellipse(cx, hy, n*0.19, n*0.17, base)
    # уши
    g.tri([(cx - int(n*0.14), hy - int(n*0.08)), (cx - int(n*0.22), hy - int(n*0.26)), (cx - int(n*0.04), hy - int(n*0.06))], shade)
    g.tri([(cx + int(n*0.14), hy - int(n*0.08)), (cx + int(n*0.22), hy - int(n*0.26)), (cx + int(n*0.04), hy - int(n*0.06))], shade)
    # морда
    g.ellipse(cx, hy + int(n*0.08), n*0.08, n*0.06, light)
    eyes(g, hy - 1, int(n*0.08), 1.3, acc)
    # клыки
    g.tri([(cx - 2, hy + int(n*0.1)), (cx - 3, hy + int(n*0.16)), (cx, hy + int(n*0.11))], (255,255,255))


def draw_swarm(g, p):
    # рой мелких тел
    n = g.n; cx = n // 2
    base, shade, light, acc = p
    spots = [(cx, int(n*0.55), 0.16), (cx - int(n*0.2), int(n*0.4), 0.11),
             (cx + int(n*0.22), int(n*0.46), 0.12), (cx - int(n*0.16), int(n*0.72), 0.1),
             (cx + int(n*0.14), int(n*0.72), 0.11), (cx, int(n*0.3), 0.09)]
    for (sx, sy, rr) in spots:
        g.ellipse(sx, sy, n*rr, n*rr, base)
        g.ellipse(sx - 1, sy - 1, n*rr*0.4, n*rr*0.4, light)
        g.set(sx - 1, sy, PUPIL); g.set(sx + 1, sy, PUPIL)


def draw_spider(g, p):
    n = g.n; cx = n // 2
    base, shade, light, acc = p
    g.ellipse(cx, int(n*0.6), n*0.22, n*0.2, base)     # брюшко
    g.ellipse(cx, int(n*0.42), n*0.14, n*0.12, shade)  # голова
    # лапы
    for i, ly in enumerate((0.46, 0.56, 0.66)):
        g.rect(cx - int(n*0.42), int(n*ly), cx - int(n*0.14), int(n*ly)+1, base)
        g.rect(cx + int(n*0.14), int(n*ly), cx + int(n*0.42), int(n*ly)+1, base)
    eyes(g, int(n*0.4), int(n*0.05), 1, acc)
    g.ellipse(cx - int(n*0.08), int(n*0.55), n*0.05, n*0.06, light)


def draw_flame(g, p):
    n = g.n; cx = n // 2
    base, shade, light, acc = p
    g.tri([(cx, int(n*0.14)), (cx - int(n*0.26), int(n*0.8)), (cx + int(n*0.26), int(n*0.8))], base)
    g.ellipse(cx, int(n*0.74), n*0.26, n*0.16, base)
    g.tri([(cx, int(n*0.3)), (cx - int(n*0.16), int(n*0.74)), (cx + int(n*0.16), int(n*0.74))], light)
    g.tri([(cx, int(n*0.46)), (cx - int(n*0.08), int(n*0.72)), (cx + int(n*0.08), int(n*0.72))], acc)
    eyes(g, int(n*0.62), int(n*0.09), 1.4, PUPIL)


def draw_golem(g, p):
    n = g.n; cx = n // 2
    base, shade, light, acc = p
    g.rect(cx - int(n*0.26), int(n*0.34), cx + int(n*0.26), int(n*0.8), base)   # торс
    g.rect(cx - int(n*0.34), int(n*0.4), cx - int(n*0.26), int(n*0.72), shade)  # плечо
    g.rect(cx - int(n*0.2), int(n*0.8), cx - int(n*0.04), int(n*0.92), shade)   # ноги
    g.rect(cx + int(n*0.04), int(n*0.8), cx + int(n*0.2), int(n*0.92), shade)
    # трещины/грани
    g.rect(cx - int(n*0.18), int(n*0.44), cx - int(n*0.02), int(n*0.5), light)
    g.rect(cx + int(n*0.06), int(n*0.58), cx + int(n*0.2), int(n*0.64), light)
    eyes(g, int(n*0.44), int(n*0.09), 1.6, acc)


def draw_ghost(g, p):
    n = g.n; cx = n // 2
    base, shade, light, acc = p
    g.ellipse(cx, int(n*0.4), n*0.24, n*0.24, base)
    g.rect(cx - int(n*0.24), int(n*0.4), cx + int(n*0.24), int(n*0.72), base)
    # рваный низ
    for i, ox in enumerate((-0.18, -0.06, 0.06, 0.18)):
        g.tri([(cx + int(n*ox) - 3, int(n*0.68)), (cx + int(n*ox), int(n*0.86)), (cx + int(n*ox) + 3, int(n*0.68))], base)
    g.ellipse(cx - int(n*0.09), int(n*0.34), n*0.06, n*0.08, light)
    eyes(g, int(n*0.4), int(n*0.1), 1.6, acc)


def draw_skull(g, p, armor=False):
    n = g.n; cx = n // 2
    base, shade, light, acc = p
    # тело/кости
    g.rect(cx - int(n*0.14), int(n*0.52), cx + int(n*0.14), int(n*0.82), shade)
    g.ellipse(cx, int(n*0.36), n*0.2, n*0.2, base)   # череп
    g.rect(cx - int(n*0.1), int(n*0.5), cx + int(n*0.1), int(n*0.58), base)  # челюсть
    # глазницы
    for sx in (-1, 1):
        g.ellipse(cx + sx * int(n*0.08), int(n*0.36), n*0.05, n*0.06, (10,10,14))
    g.ellipse(cx, int(n*0.44), n*0.02, n*0.03, (10,10,14))
    if armor:
        g.rect(cx - int(n*0.2), int(n*0.5), cx + int(n*0.2), int(n*0.68), acc)
        g.rect(cx - int(n*0.2), int(n*0.5), cx + int(n*0.2), int(n*0.54), light)
    # ребра
    for ry in (0.62, 0.7):
        g.rect(cx - int(n*0.1), int(n*ry), cx + int(n*0.1), int(n*ry), light)


def draw_amorph(g, p):
    # аморфное существо (void/chaos) с множеством глаз
    n = g.n; cx = n // 2
    base, shade, light, acc = p
    g.ellipse(cx, int(n*0.55), n*0.3, n*0.3, base)
    g.ellipse(cx - int(n*0.18), int(n*0.38), n*0.12, n*0.12, base)
    g.ellipse(cx + int(n*0.2), int(n*0.44), n*0.1, n*0.1, base)
    g.ellipse(cx, int(n*0.5), n*0.16, n*0.16, shade)
    for (ex, ey, r) in [(0, 0.52, 2.2), (-0.16, 0.42, 1.3), (0.18, 0.48, 1.4), (-0.1, 0.66, 1.2)]:
        gx = cx + int(n*ex)
        g.ellipse(gx, int(n*ey), r, r, acc)
        g.ellipse(gx, int(n*ey), r*0.45, r*0.45, PUPIL)


# ---- маппинг id -> (функция, палитра, kwargs) ----
def M(fn, pal, **kw):
    return (fn, pal, kw)

SPRITES = {
    'hero':            M(draw_humanoid, PAL['hero'], ears=False, staff=False),
    # ring 1 — зелёные равнины
    'goblin_melee':    M(draw_humanoid, PAL['green'], ears=True),
    'goblin_archer':   M(draw_humanoid, PAL['green'], ears=True, staff=True),
    'goblin_shaman':   M(draw_humanoid, PAL['green'], hood=True, staff=True),
    'wolf':            M(draw_beast,    PAL['gray']),
    'rat_swarm':       M(draw_swarm,    PAL['rat']),
    'spider':          M(draw_spider,   PAL['bog']),
    'slime':           M(draw_blob,     PAL['green']),
    'flying_swarm':    M(draw_swarm,    PAL['bog']),
    # ring 2 — топи
    'bog_spitter':     M(draw_blob,     PAL['bog']),
    'skeleton':        M(draw_skull,    PAL['bone']),
    'ghost':           M(draw_ghost,    PAL['ghost']),
    'necro_mage':      M(draw_humanoid, PAL['void'], hood=True, staff=True),
    'shadow_swarm':    M(draw_swarm,    PAL['void']),
    # ring 3 — пустоши/огонь
    'fire_elemental':  M(draw_flame,    PAL['fire']),
    'magma_golem':     M(draw_golem,    PAL['fire']),
    'demon_raider':    M(draw_humanoid, PAL['demon'], horns=True, ears=True),
    'demon_cultist':   M(draw_humanoid, PAL['demon'], hood=True, staff=True),
    'ash_swarm':       M(draw_swarm,    PAL['fire']),
    # ring 4 — мёрзлые руины
    'ice_golem':       M(draw_golem,    PAL['ice']),
    'undead_knight':   M(draw_skull,    PAL['gray'], armor=True),
    'shard_swarm':     M(draw_swarm,    PAL['ice']),
    # ring 5 — бездна
    'void_spawn':      M(draw_amorph,   PAL['void']),
    'abyss_guard':     M(draw_golem,    PAL['void']),
    'abyss_cultist':   M(draw_humanoid, PAL['void'], hood=True, horns=True, staff=True),
    'chaos_beast':     M(draw_amorph,   PAL['demon']),
}

BOSSES = {
    'tree_warden':    M(draw_golem,   PAL['green']),
    'rot_leviathan':  M(draw_blob,    PAL['bog']),
    'ash_lord':       M(draw_flame,   PAL['fire']),
    'ice_titan':      M(draw_golem,   PAL['ice']),
    'world_eater':    M(draw_amorph,  PAL['void']),
}


def build(name, spec, n, scale):
    fn, pal, kw = spec
    g = Grid(n)
    fn(g, pal, **kw)
    g.mirror_lr()
    g.add_outline()
    img = g.render(scale)
    img.save(os.path.join(OUT, name + '.png'))


def main():
    for name, spec in SPRITES.items():
        fname = name if name == 'hero' else 'mob_' + name
        build(fname, spec, 40, 4)
    for name, spec in BOSSES.items():
        build('boss_' + name, spec, 48, 5)
    print('готово: %d мобов+герой, %d боссов' % (len(SPRITES), len(BOSSES)))


if __name__ == '__main__':
    main()
