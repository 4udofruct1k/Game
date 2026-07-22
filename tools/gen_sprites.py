#!/usr/bin/env python3
"""Процедурный генератор пиксель-арт спрайтов: злобные существа + иконки оружия.
Высокая детализация, объёмная тень (тёмный кант + верхний хайлайт),
клыки/когти/шипы/светящиеся глаза. Ничего не берётся из арт-борды.
"""
import os
import random
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'sprites')
os.makedirs(OUT, exist_ok=True)

OUTLINE = (18, 14, 22)
BONE = (232, 228, 210)
FANG = (244, 242, 232)


def mix(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))

def dark(c, f):
    return tuple(round(x * f) for x in c)

def lite(c, f):
    return tuple(min(255, round(x + (255 - x) * f)) for x in c)


# палитры: (base, shade, light, accent-свечение)
PAL = {
    'green':  ((88, 150, 70),  (44, 88, 40),   (150, 200, 110), (240, 70, 60)),
    'bog':    ((92, 122, 60),  (48, 70, 34),   (150, 170, 90),  (180, 240, 90)),
    'fire':   ((196, 66, 30),  (104, 26, 18),  (255, 170, 60),  (255, 240, 130)),
    'ice':    ((120, 172, 210),(56, 96, 150),  (210, 238, 255), (150, 240, 255)),
    'void':   ((92, 52, 140),  (44, 22, 78),   (168, 110, 230), (236, 80, 220)),
    'bone':   ((206, 200, 178),(120, 116, 100),(240, 238, 224), (180, 40, 40)),
    'demon':  ((150, 42, 40),  (78, 18, 22),   (214, 90, 70),   (255, 200, 60)),
    'gray':   ((120, 128, 144),(66, 72, 88),   (196, 204, 220), (255, 90, 60)),
    'rat':    ((120, 96, 78),  (68, 52, 42),   (176, 150, 128), (220, 60, 60)),
    'ghost':  ((150, 186, 208),(84, 120, 154), (224, 240, 255), (140, 240, 220)),
    'hero':   ((70, 120, 200), (34, 66, 130),  (150, 196, 255), (255, 214, 84)),
    'steel':  ((150, 158, 172),(80, 86, 100),  (224, 230, 244), (120, 200, 255)),
    'gold':   ((208, 168, 66), (128, 96, 30),  (255, 232, 150), (255, 255, 210)),
    'wood':   ((132, 92, 52),  (78, 52, 28),   (186, 140, 90),  (150, 240, 120)),
}


class Grid:
    def __init__(self, n):
        self.n = n
        self.px = [[None] * n for _ in range(n)]

    def set(self, x, y, c):
        if 0 <= x < self.n and 0 <= y < self.n and c is not None:
            self.px[int(y)][int(x)] = c

    def get(self, x, y):
        if 0 <= x < self.n and 0 <= y < self.n:
            return self.px[int(y)][int(x)]
        return None

    def ellipse(self, cx, cy, rx, ry, c):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                dx = (x - cx) / max(rx, 0.01); dy = (y - cy) / max(ry, 0.01)
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
                if self._in(( x, y), pts):
                    self.set(x, y, c)

    def line(self, x0, y0, x1, y1, c, w=1):
        steps = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for i in range(steps + 1):
            t = i / steps
            x = x0 + (x1 - x0) * t; y = y0 + (y1 - y0) * t
            self.ellipse(x, y, w / 2, w / 2, c)

    @staticmethod
    def _in(p, t):
        def s(a, b, c):
            return (a[0]-c[0])*(b[1]-c[1]) - (b[0]-c[0])*(a[1]-c[1])
        d1 = s(p, t[0], t[1]); d2 = s(p, t[1], t[2]); d3 = s(p, t[2], t[0])
        return not (((d1 < 0) or (d2 < 0) or (d3 < 0)) and ((d1 > 0) or (d2 > 0) or (d3 > 0)))

    def mirror_lr(self):
        for y in range(self.n):
            for x in range(self.n // 2):
                self.px[y][self.n - 1 - x] = self.px[y][x]

    def bbox(self):
        xs = []; ys = []
        for y in range(self.n):
            for x in range(self.n):
                if self.px[y][x] is not None:
                    xs.append(x); ys.append(y)
        if not xs:
            return (0, 0, self.n, self.n)
        return (min(xs), min(ys), max(xs), max(ys))

    def shade(self):
        # объём: тёмный внутренний кант + лёгкий верхний хайлайт
        n = self.n
        _, y0, _, y1 = self.bbox()
        h = max(1, y1 - y0)
        src = [row[:] for row in self.px]
        for y in range(n):
            for x in range(n):
                c = src[y][x]
                if c is None:
                    continue
                # кол-во пустых соседей → близость к краю
                empt = 0
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        if src[(y+dy) % n][(x+dx) % n] is None if 0 <= y+dy < n and 0 <= x+dx < n else True:
                            empt += 1
                nc = c
                if empt >= 3:
                    nc = mix(nc, dark(nc, 0.5), 0.55)     # жёсткий кант
                elif empt >= 1:
                    nc = mix(nc, dark(nc, 0.6), 0.30)
                # верхний хайлайт
                fy = (y - y0) / h
                if fy < 0.32 and empt < 3:
                    nc = mix(nc, lite(nc, 0.6), 0.22 * (1 - fy / 0.32))
                elif fy > 0.7:
                    nc = mix(nc, dark(nc, 0.7), 0.18)
                self.px[y][x] = nc

    def outline(self):
        n = self.n
        out = [row[:] for row in self.px]
        for y in range(n):
            for x in range(n):
                if self.px[y][x] is None:
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            xx, yy = x+dx, y+dy
                            if 0 <= xx < n and 0 <= yy < n and self.px[yy][xx] is not None:
                                out[y][x] = OUTLINE
        self.px = out

    def render(self, scale):
        n = self.n
        img = Image.new('RGBA', (n * scale, n * scale), (0, 0, 0, 0))
        p = img.load()
        for y in range(n):
            for x in range(n):
                c = self.px[y][x]
                if c is None:
                    continue
                for sy in range(scale):
                    for sx in range(scale):
                        p[x*scale+sx, y*scale+sy] = (c[0], c[1], c[2], 255)
        return img


# ---- декоративные примитивы (глаза/клыки/когти/шипы/рога) ----
def eyes(g, cy, spread, r, glow, brow=True):
    n = g.n; cx = n // 2
    for sx in (-1, 1):
        ex = cx + sx * spread
        g.ellipse(ex, cy, r + 1, r + 1, dark(glow, 0.3))
        g.ellipse(ex, cy, r, r, glow)
        g.ellipse(ex, cy, max(r*0.5, 0.7), max(r*0.5, 0.7), (255, 255, 255))
        g.set(ex, cy, (10, 8, 12))
        if brow:  # злая бровь (диагональ к центру)
            g.line(ex - sx*(r+1), cy - r - 2, ex + sx*(r+1), cy - 1, dark(glow, 0.2), 1.4)

def fangs_down(g, y, x0, x1, n=4, col=FANG, h=3):
    step = (x1 - x0) / n
    for i in range(n):
        x = x0 + step * (i + 0.5)
        g.tri([(x - step*0.4, y), (x + step*0.4, y), (x, y + h)], col)

def teeth_row(g, y, x0, x1, n=5, col=FANG):
    step = (x1 - x0) / n
    for i in range(n):
        x = x0 + step * i
        g.rect(x, y, x + step*0.6, y + 1.5, col)

def horns(g, hy, spread, col):
    n = g.n; cx = n // 2
    for sx in (-1, 1):
        bx = cx + sx * spread
        g.tri([(bx, hy), (bx + sx*4, hy - 8), (bx + sx*4, hy - 2)], col)

def spikes_back(g, cx, y0, y1, dirx, col, count=4):
    step = (y1 - y0) / count
    for i in range(count):
        y = y0 + step * i
        g.tri([(cx, y), (cx, y + step*0.8), (cx + dirx*6, y + step*0.4)], col)

def legs(g, cy, span, count, col, drop):
    n = g.n; cx = n // 2
    for sx in (-1, 1):
        for i in range(count):
            ay = cy - span*0.4 + (span*0.8) * i / max(1, count-1)
            g.line(cx, ay, cx + sx*span, ay - 3, col, 1.6)
            g.line(cx + sx*span, ay - 3, cx + sx*(span+2), ay + drop, col, 1.6)


# ---- СЕМЕЙСТВА (рисуют левую половину + центр; потом mirror/shade/outline) ----
def f_goblin(g, p, hood=False, staff=False, big=False):
    n = g.n; cx = n // 2
    base, shade, light, acc = p
    # хилое сгорбленное тело
    g.ellipse(cx, n*0.68, n*0.2, n*0.18, base)
    g.rect(cx - n*0.14, n*0.5, cx + n*0.14, n*0.74, base)
    # тощие ноги
    g.rect(cx - n*0.13, n*0.76, cx - n*0.03, n*0.9, shade)
    # когтистая рука
    g.line(cx - n*0.16, n*0.54, cx - n*0.24, n*0.72, base, 2)
    for k in range(3):
        g.line(cx - n*0.24, n*0.72 + k, cx - n*0.29, n*0.78 + k*2, shade, 1)
    hy = n*0.34
    if hood:
        g.ellipse(cx, hy, n*0.2, n*0.21, shade)
        g.tri([(cx, hy-n*0.2), (cx-n*0.1, hy-n*0.02), (cx+n*0.1, hy-n*0.02)], shade)
        g.ellipse(cx, hy+2, n*0.13, n*0.13, (12, 10, 18))
        eyes(g, hy+2, int(n*0.06), 1.3, acc, brow=False)
    else:
        g.ellipse(cx, hy, n*0.17, n*0.16, base)
        # большие острые уши
        g.tri([(cx-n*0.14, hy-2), (cx-n*0.34, hy-n*0.05), (cx-n*0.1, hy+4)], base)
        eyes(g, hy-1, int(n*0.07), 1.5, acc)
        # оскал с клыками
        g.rect(cx-n*0.09, hy+n*0.09, cx+n*0.09, hy+n*0.13, (30, 20, 22))
        fangs_down(g, hy+n*0.09, cx-n*0.09, cx+n*0.09, 4, FANG, 3)
    if staff:
        g.rect(cx+n*0.22, n*0.28, cx+n*0.25, n*0.82, (96, 70, 44))
        g.ellipse(cx+n*0.235, n*0.26, n*0.06, n*0.06, acc)

def f_beast(g, p):
    # припавший хищник с оскалом
    n = g.n; cx = n // 2
    base, shade, light, acc = p
    g.ellipse(cx, n*0.6, n*0.3, n*0.19, base)
    spikes_back(g, cx, n*0.44, n*0.62, -1, shade, 4)   # шерсть-шипы на загривке
    # лапы с когтями
    for lx in (-0.22, -0.06):
        g.rect(cx+n*lx, n*0.68, cx+n*lx+2.5, n*0.86, shade)
        for k in range(2):
            g.line(cx+n*lx, n*0.86, cx+n*lx - 1 + k*2, n*0.9, FANG, 1)
    hy = n*0.44
    g.ellipse(cx, hy, n*0.19, n*0.16, base)
    g.tri([(cx-n*0.12, hy-n*0.08), (cx-n*0.24, hy-n*0.28), (cx-n*0.02, hy-n*0.05)], shade)  # ухо
    # раскрытая пасть
    g.tri([(cx-n*0.02, hy+n*0.04), (cx-n*0.2, hy+n*0.1), (cx-n*0.02, hy+n*0.2)], (26, 14, 16))
    fangs_down(g, hy+n*0.06, cx-n*0.18, cx-n*0.02, 3, FANG, 4)
    g.tri([(cx-n*0.18, hy+n*0.2), (cx-n*0.02, hy+n*0.16), (cx-n*0.06, hy+n*0.22)], FANG)  # нижний клык
    eyes(g, hy-n*0.04, int(n*0.09), 1.5, acc)

def f_ooze(g, p):
    # кислотная тварь с зубастой пастью
    n = g.n; cx = n // 2
    base, shade, light, acc = p
    g.ellipse(cx, n*0.62, n*0.32, n*0.28, base)
    g.rect(cx-n*0.3, n*0.6, cx+n*0.3, n*0.78, base)
    # потёки
    for ox in (-0.2, -0.05):
        g.ellipse(cx+n*ox, n*0.84, n*0.05, n*0.08, base)
    # пузыри
    g.ellipse(cx-n*0.12, n*0.44, n*0.05, n*0.05, lite(base, 0.4))
    # разинутая пасть с зубами
    g.ellipse(cx, n*0.66, n*0.16, n*0.1, (24, 16, 14))
    teeth_row(g, n*0.6, cx-n*0.14, cx+n*0.14, 5, FANG)
    fangs_down(g, n*0.72, cx-n*0.14, cx+n*0.14, 5, FANG, 3)
    eyes(g, n*0.46, int(n*0.13), 2.0, acc)

def f_swarm(g, p):
    # рой мелких злых тварей с лапками
    n = g.n; cx = n // 2
    base, shade, light, acc = p
    spots = [(cx, 0.56, 0.15), (cx-n*0.2, 0.4, 0.1), (cx-n*0.14, 0.72, 0.1), (cx, 0.3, 0.08)]
    for (sx, fy, rr) in spots:
        y = n*fy
        g.ellipse(sx, y, n*rr, n*rr*0.85, base)
        for s in (-1, 1):  # лапки
            g.line(sx, y, sx+s*n*rr*1.5, y+2, shade, 1)
            g.line(sx, y+1, sx+s*n*rr*1.4, y+n*rr, shade, 1)
        g.ellipse(sx-1, y-1, n*rr*0.35, n*rr*0.35, acc)
        g.set(sx, y-1, (255, 255, 255))

def f_spider(g, p):
    n = g.n; cx = n // 2
    base, shade, light, acc = p
    g.ellipse(cx, n*0.62, n*0.22, n*0.2, base)      # брюшко
    g.line(cx-n*0.06, n*0.56, cx, n*0.68, dark(base, 0.6), 2)  # узор
    g.ellipse(cx, n*0.42, n*0.13, n*0.11, shade)    # головогрудь
    legs(g, n*0.5, n*0.36, 3, dark(base, 0.7), 8)
    # хелицеры-клыки
    g.tri([(cx-n*0.06, n*0.5), (cx-n*0.02, n*0.58), (cx-n*0.09, n*0.56)], FANG)
    # много глаз
    eyes(g, n*0.4, int(n*0.06), 1.2, acc, brow=False)
    g.ellipse(cx-n*0.05, n*0.36, 1, 1, acc); g.ellipse(cx+n*0.05, n*0.36, 1, 1, acc)

def f_skull(g, p, armor=False):
    n = g.n; cx = n // 2
    base, shade, light, acc = p
    g.rect(cx-n*0.13, n*0.5, cx+n*0.13, n*0.8, shade)     # позвоночник/тело
    # рёбра
    for ry in (0.56, 0.64, 0.72):
        g.line(cx-n*0.13, n*ry, cx+n*0.13, n*ry, base, 1)
    # руки-кости
    g.line(cx-n*0.13, n*0.52, cx-n*0.22, n*0.72, base, 1.6)
    g.ellipse(cx, n*0.34, n*0.2, n*0.2, base)             # череп
    g.rect(cx-n*0.1, n*0.46, cx+n*0.1, n*0.54, base)      # челюсть
    # глазницы (светятся)
    for s in (-1, 1):
        g.ellipse(cx+s*n*0.08, n*0.34, n*0.055, n*0.06, (14, 12, 16))
        g.ellipse(cx+s*n*0.08, n*0.35, n*0.03, n*0.035, acc)
    g.tri([(cx, n*0.38), (cx-2, n*0.44), (cx+2, n*0.44)], (14, 12, 16))  # нос
    teeth_row(g, n*0.47, cx-n*0.09, cx+n*0.09, 5, dark(base, 0.85))
    if armor:
        g.rect(cx-n*0.22, n*0.5, cx+n*0.22, n*0.7, acc)
        g.tri([(cx-n*0.22, n*0.5), (cx-n*0.3, n*0.44), (cx-n*0.14, n*0.5)], acc)  # шип наплечника
        g.rect(cx-n*0.22, n*0.5, cx+n*0.22, n*0.53, lite(acc, 0.3))

def f_golem(g, p):
    # каменный/ледяной колосс с трещинами и ядром
    n = g.n; cx = n // 2
    base, shade, light, acc = p
    g.tri([(cx-n*0.3, n*0.82), (cx, n*0.28), (cx+n*0.3, n*0.82)], base)  # массивный торс-клин
    g.rect(cx-n*0.28, n*0.5, cx+n*0.28, n*0.82, base)
    # рваные плечи-глыбы
    g.tri([(cx-n*0.28, n*0.4), (cx-n*0.42, n*0.5), (cx-n*0.2, n*0.56)], shade)
    # руки-кувалды
    g.rect(cx-n*0.4, n*0.5, cx-n*0.28, n*0.78, shade)
    # ноги
    g.rect(cx-n*0.2, n*0.82, cx-n*0.04, n*0.94, shade)
    # трещины со свечением
    g.line(cx-n*0.14, n*0.5, cx-n*0.02, n*0.7, acc, 1.4)
    g.line(cx-n*0.02, n*0.7, cx+n*0.1, n*0.78, acc, 1.2)
    g.ellipse(cx, n*0.62, n*0.05, n*0.05, acc)  # ядро
    # тяжёлые светящиеся глаза
    eyes(g, n*0.42, int(n*0.1), 1.8, acc)

def f_flame(g, p):
    # пламенная тварь с кричащим лицом
    n = g.n; cx = n // 2
    base, shade, light, acc = p
    g.tri([(cx, n*0.1), (cx-n*0.28, n*0.82), (cx+n*0.28, n*0.82)], base)
    # языки пламени
    g.tri([(cx-n*0.18, n*0.4), (cx-n*0.3, n*0.2), (cx-n*0.06, n*0.44)], base)
    g.tri([(cx, n*0.24), (cx-n*0.12, n*0.6), (cx+n*0.12, n*0.6)], light)
    g.tri([(cx, n*0.42), (cx-n*0.06, n*0.66), (cx+n*0.06, n*0.66)], acc)
    # хищное лицо
    eyes(g, n*0.56, int(n*0.09), 1.6, (20, 12, 12))
    g.tri([(cx, n*0.64), (cx-n*0.08, n*0.62), (cx+n*0.08, n*0.62)], (20, 12, 12))  # раскрытый рот
    fangs_down(g, n*0.62, cx-n*0.07, cx+n*0.07, 3, light, 2)

def f_ghost(g, p):
    # вопящий призрак с рваным саваном
    n = g.n; cx = n // 2
    base, shade, light, acc = p
    g.ellipse(cx, n*0.4, n*0.24, n*0.26, base)
    g.rect(cx-n*0.24, n*0.4, cx+n*0.24, n*0.72, base)
    for ox in (-0.16, 0.02):   # рваный низ
        g.tri([(cx+n*ox-3, n*0.68), (cx+n*ox, n*0.88), (cx+n*ox+3, n*0.68)], base)
    # когтистые призрачные руки
    g.line(cx-n*0.2, n*0.44, cx-n*0.3, n*0.6, base, 2)
    for k in range(2):
        g.line(cx-n*0.3, n*0.6, cx-n*0.33+k*2, n*0.68, light, 1)
    # впалое лицо
    g.ellipse(cx-n*0.08, n*0.34, n*0.05, n*0.07, (20, 26, 34))
    eyes(g, n*0.36, int(n*0.09), 1.6, acc, brow=False)
    g.ellipse(cx, n*0.5, n*0.05, n*0.08, (20, 26, 34))  # вопящий рот

def f_demon(g, p, hood=False):
    n = g.n; cx = n // 2
    base, shade, light, acc = p
    g.ellipse(cx, n*0.66, n*0.22, n*0.2, base)
    g.rect(cx-n*0.16, n*0.48, cx+n*0.16, n*0.74, base)
    g.rect(cx-n*0.14, n*0.76, cx-n*0.02, n*0.9, shade)
    # мускулистая когтистая рука
    g.ellipse(cx-n*0.22, n*0.58, n*0.07, n*0.11, base)
    for k in range(3):
        g.line(cx-n*0.24, n*0.68, cx-n*0.28-k, n*0.76, FANG, 1)
    hy = n*0.34
    if hood:
        g.ellipse(cx, hy, n*0.2, n*0.2, shade)
        g.ellipse(cx, hy+2, n*0.13, n*0.13, (10, 8, 14))
        eyes(g, hy+2, int(n*0.06), 1.3, acc, brow=False)
    else:
        g.ellipse(cx, hy, n*0.17, n*0.16, base)
        horns(g, hy-n*0.08, int(n*0.11), shade)
        eyes(g, hy-1, int(n*0.08), 1.6, acc)
        g.rect(cx-n*0.08, hy+n*0.08, cx+n*0.08, hy+n*0.12, (24, 14, 16))
        fangs_down(g, hy+n*0.08, cx-n*0.08, cx+n*0.08, 4, FANG, 3)

def f_amorph(g, p):
    # писклявая масса плоти с глазами и щупальцами
    n = g.n; cx = n // 2
    base, shade, light, acc = p
    g.ellipse(cx, n*0.58, n*0.3, n*0.28, base)
    g.ellipse(cx-n*0.16, n*0.4, n*0.12, n*0.12, base)
    # щупальца
    for s in (-1, 1):
        g.line(cx+s*n*0.2, n*0.7, cx+s*n*0.36, n*0.86, base, 2)
        g.line(cx+s*n*0.28, n*0.5, cx+s*n*0.44, n*0.44, base, 2)
    # центральная пасть
    g.ellipse(cx, n*0.6, n*0.1, n*0.08, (18, 10, 22))
    fangs_down(g, n*0.56, cx-n*0.09, cx+n*0.09, 5, FANG, 3)
    # разбросанные глаза
    for (ex, fy, r) in [(0, 0.44, 2.2), (-0.18, 0.52, 1.4), (0.2, 0.5, 1.5), (-0.08, 0.7, 1.3)]:
        gx = cx + n*ex
        g.ellipse(gx, n*fy, r+0.6, r+0.6, dark(acc, 0.3))
        g.ellipse(gx, n*fy, r, r, acc)
        g.set(gx, n*fy, (10, 8, 12))

def f_rat(g, p):
    n = g.n; cx = n // 2
    base, shade, light, acc = p
    # стая крыс: две крупные морды
    for (sx, fy, sc) in [(cx, 0.6, 1.0), (cx-n*0.22, 0.44, 0.7)]:
        r = n*0.16*sc
        g.ellipse(sx, n*fy, r, r*0.85, base)
        g.tri([(sx-r*0.9, n*fy-r*0.2), (sx-r*1.6, n*fy-r*0.6), (sx-r*0.6, n*fy+r*0.4)], base)  # морда
        g.ellipse(sx+r*0.3, n*fy-r*0.7, r*0.5, r*0.5, shade)  # ухо
        g.line(sx+r*0.6, n*fy+r*0.3, sx+r*1.8, n*fy+r*0.6, shade, 1.4)  # хвост
        g.ellipse(sx-r*0.7, n*fy-r*0.1, 1.4, 1.4, acc)  # красный глаз


def M(fn, pal, **kw):
    return (fn, pal, kw)

SPRITES = {
    'hero':           M(f_goblin, PAL['hero']),  # герой — гуманоид (без клыков/ушей ниже переопределим)
    'goblin_melee':   M(f_goblin, PAL['green']),
    'goblin_archer':  M(f_goblin, PAL['green'], staff=True),
    'goblin_shaman':  M(f_goblin, PAL['green'], hood=True, staff=True),
    'wolf':           M(f_beast,  PAL['gray']),
    'rat_swarm':      M(f_rat,    PAL['rat']),
    'spider':         M(f_spider, PAL['bog']),
    'slime':          M(f_ooze,   PAL['green']),
    'flying_swarm':   M(f_swarm,  PAL['bog']),
    'bog_spitter':    M(f_ooze,   PAL['bog']),
    'skeleton':       M(f_skull,  PAL['bone']),
    'ghost':          M(f_ghost,  PAL['ghost']),
    'necro_mage':     M(f_demon,  PAL['void'], hood=True),
    'shadow_swarm':   M(f_swarm,  PAL['void']),
    'fire_elemental': M(f_flame,  PAL['fire']),
    'magma_golem':    M(f_golem,  PAL['fire']),
    'demon_raider':   M(f_demon,  PAL['demon']),
    'demon_cultist':  M(f_demon,  PAL['demon'], hood=True),
    'ash_swarm':      M(f_swarm,  PAL['fire']),
    'ice_golem':      M(f_golem,  PAL['ice']),
    'undead_knight':  M(f_skull,  PAL['gray'], armor=True),
    'shard_swarm':    M(f_swarm,  PAL['ice']),
    'void_spawn':     M(f_amorph, PAL['void']),
    'abyss_guard':    M(f_golem,  PAL['void']),
    'abyss_cultist':  M(f_demon,  PAL['void'], hood=True),
    'chaos_beast':    M(f_amorph, PAL['demon']),
}

BOSSES = {
    'tree_warden':   M(f_golem,  PAL['green']),
    'rot_leviathan': M(f_amorph, PAL['bog']),
    'ash_lord':      M(f_flame,  PAL['fire']),
    'ice_titan':     M(f_golem,  PAL['ice']),
    'world_eater':   M(f_amorph, PAL['void']),
}

# герой рисуется отдельной функцией (дружелюбнее, без клыков)
def f_hero(g, p, **kw):
    n = g.n; cx = n // 2
    base, shade, light, acc = p
    g.ellipse(cx, n*0.66, n*0.2, n*0.2, base)
    g.rect(cx-n*0.15, n*0.48, cx+n*0.15, n*0.74, base)
    g.rect(cx-n*0.13, n*0.76, cx-n*0.03, n*0.9, shade)
    g.ellipse(cx-n*0.19, n*0.58, n*0.06, n*0.1, shade)  # рука
    # плащ-акцент
    g.rect(cx-n*0.15, n*0.5, cx+n*0.15, n*0.56, acc)
    hy = n*0.32
    g.ellipse(cx, hy, n*0.16, n*0.16, light)
    eyes(g, hy, int(n*0.06), 1.3, (40, 60, 90), brow=False)
    # капюшон/шлем
    g.tri([(cx, hy-n*0.18), (cx-n*0.16, hy+n*0.02), (cx+n*0.16, hy+n*0.02)], shade)


# ---- ОРУЖИЕ (иконки 32 лог.px) ----
def w_sword(g):
    n = g.n; cx = n//2
    steel, sh, lt, ac = PAL['steel']; wd = PAL['wood'][0]
    g.rect(cx-1.5, n*0.12, cx+1.5, n*0.66, steel)          # клинок
    g.line(cx-1.5, n*0.12, cx, n*0.08, lt, 1)
    g.rect(cx-0.5, n*0.14, cx+0.5, n*0.64, lt)             # блик
    g.rect(cx-n*0.16, n*0.66, cx+n*0.16, n*0.7, PAL['gold'][0])  # гарда
    g.rect(cx-1.5, n*0.7, cx+1.5, n*0.86, wd)             # рукоять
    g.ellipse(cx, n*0.88, n*0.05, n*0.05, PAL['gold'][0])

def w_greatsword(g):
    n = g.n; cx = n//2
    steel, sh, lt, ac = PAL['steel']
    g.tri([(cx, n*0.06), (cx-n*0.11, n*0.62), (cx+n*0.11, n*0.62)], steel)
    g.rect(cx-n*0.09, n*0.2, cx+n*0.09, n*0.62, steel)
    g.rect(cx-0.5, n*0.1, cx+0.5, n*0.6, lt)
    g.rect(cx-n*0.2, n*0.62, cx+n*0.2, n*0.68, PAL['gold'][0])
    g.rect(cx-2, n*0.68, cx+2, n*0.9, PAL['wood'][0])

def w_daggers(g):
    n = g.n
    steel, sh, lt, ac = PAL['steel']
    for s, cx in ((1, n*0.36), (-1, n*0.64)):
        g.line(cx, n*0.7, cx+s*n*0.2, n*0.14, steel, 3)
        g.line(cx, n*0.72, cx+s*n*0.06, n*0.86, PAL['wood'][0], 2)
        g.line(cx-s*n*0.05, n*0.66, cx+s*n*0.12, n*0.68, PAL['gold'][0], 2)

def w_spear(g):
    n = g.n; cx = n//2
    steel, sh, lt, ac = PAL['steel']
    g.rect(cx-1.2, n*0.2, cx+1.2, n*0.92, PAL['wood'][0])   # древко
    g.tri([(cx, n*0.06), (cx-n*0.09, n*0.24), (cx+n*0.09, n*0.24)], steel)  # наконечник
    g.line(cx, n*0.08, cx, n*0.22, lt, 1)

def w_bow(g):
    import math
    n = g.n; cx = n//2
    wd = PAL['wood']; steel = PAL['steel']
    # изогнутый лук слева (дуга «D», выпуклостью влево)
    bx = cx + n*0.02
    for k in range(49):
        t = k/48
        ang = (t - 0.5) * 2.3                     # -1.15..1.15 рад → верх..низ
        ay = n*0.5 + math.sin(ang) * n*0.4
        ax = bx - math.cos(ang) * n*0.24
        g.ellipse(ax, ay, 1.7, 1.7, wd[0])
        g.ellipse(ax-0.6, ay, 0.8, 0.8, wd[1])
    # тетива (прямая, между концами лука)
    g.line(bx, n*0.1, bx, n*0.9, (235, 235, 225), 1)
    # стрела на тетиве, летит вправо
    g.rect(bx, n*0.49, cx+n*0.34, n*0.51, PAL['wood'][0])
    g.tri([(cx+n*0.42, n*0.5), (cx+n*0.3, n*0.44), (cx+n*0.3, n*0.56)], steel[2])  # наконечник
    g.line(bx-1, n*0.44, bx-1, n*0.56, wd[1], 1)  # оперение

def w_staff(g):
    n = g.n; cx = n//2
    wd = PAL['wood']; ac = PAL['void'][3]
    g.rect(cx-1.5, n*0.24, cx+1.5, n*0.92, wd[0])
    g.ellipse(cx, n*0.2, n*0.12, n*0.12, ac)          # кристалл-свечение
    g.ellipse(cx, n*0.2, n*0.06, n*0.06, (255, 255, 255))
    g.line(cx, n*0.32, cx, n*0.24, ac, 1)

def w_claws(g):
    n = g.n; cx = n//2
    steel = PAL['steel']
    g.rect(cx-n*0.16, n*0.6, cx+n*0.16, n*0.74, PAL['wood'][0])  # хват
    for i, ox in enumerate((-0.16, 0, 0.16)):
        g.line(cx+n*ox, n*0.6, cx+n*ox+n*0.06, n*0.12, steel[0], 2.4)
        g.line(cx+n*ox, n*0.6, cx+n*ox+n*0.06, n*0.12, steel[2], 0.8)

def w_whip(g):
    n = g.n; cx = n//2
    lth = (120, 70, 40)
    g.rect(cx-n*0.28, n*0.68, cx-n*0.14, n*0.82, PAL['wood'][0])  # рукоять
    px, py = cx-n*0.14, n*0.72
    for i in range(24):
        t = i/23
        nx = cx-n*0.14 + n*0.42*t
        ny = n*0.72 - n*0.5*t + n*0.12* (1 if int(t*6)%2 else -1) * t
        g.line(px, py, nx, ny, lth, 2 - t)
        px, py = nx, ny

def w_thrown(g):
    n = g.n; cx = n//2; cy = n//2
    steel = PAL['steel']
    for a in range(4):
        import math
        ang = a * math.pi/2 + math.pi/4
        ex = cx + math.cos(ang)*n*0.34; ey = cy + math.sin(ang)*n*0.34
        g.tri([(cx+math.cos(ang-0.4)*n*0.12, cy+math.sin(ang-0.4)*n*0.12),
               (cx+math.cos(ang+0.4)*n*0.12, cy+math.sin(ang+0.4)*n*0.12),
               (ex, ey)], steel[0])
    g.ellipse(cx, cy, n*0.1, n*0.1, steel[1])
    g.ellipse(cx, cy, n*0.04, n*0.04, (20, 20, 24))

def w_maul(g):
    n = g.n; cx = n//2
    steel = PAL['steel']
    g.rect(cx-1.5, n*0.24, cx+1.5, n*0.92, PAL['wood'][0])   # рукоять
    g.rect(cx-n*0.2, n*0.14, cx+n*0.2, n*0.34, steel[0])     # голова молота
    g.rect(cx-n*0.2, n*0.14, cx+n*0.2, n*0.19, steel[2])
    g.rect(cx-n*0.2, n*0.3, cx+n*0.2, n*0.34, steel[1])

WEAPONS = {
    'sword': w_sword, 'greatsword': w_greatsword, 'daggers': w_daggers,
    'spear': w_spear, 'bow': w_bow, 'staff': w_staff, 'claws': w_claws,
    'whip': w_whip, 'thrown': w_thrown, 'maul': w_maul,
}


# ---- СНАРЯДЫ (белые/серые, тинтуются стихией в движке; смотрят вправо +X) ----
def p_orb(g):
    n = g.n; c = n/2
    g.ellipse(c, c, n*0.34, n*0.34, (150, 150, 160))
    g.ellipse(c, c, n*0.24, n*0.24, (225, 225, 235))
    g.ellipse(c-n*0.06, c-n*0.06, n*0.12, n*0.12, (255, 255, 255))

def p_arrow(g):
    n = g.n; c = n/2
    st = (210, 214, 224); wd = (150, 110, 70)
    g.rect(n*0.16, c-1, n*0.72, c+1, wd)                    # древко
    g.tri([(n*0.9, c), (n*0.6, c-n*0.16), (n*0.6, c+n*0.16)], st)  # наконечник
    g.tri([(n*0.1, c-n*0.14), (n*0.28, c), (n*0.1, c+n*0.14)], (230, 230, 235))  # оперение

def p_bolt(g):
    n = g.n; c = n/2
    g.tri([(n*0.92, c), (n*0.4, c-n*0.2), (n*0.2, c)], (225, 225, 235))
    g.tri([(n*0.92, c), (n*0.4, c+n*0.2), (n*0.2, c)], (180, 182, 196))

def p_star(g):
    import math
    n = g.n; c = n/2
    st = (215, 219, 230)
    for a in range(4):
        ang = a*math.pi/2
        ex = c+math.cos(ang)*n*0.42; ey = c+math.sin(ang)*n*0.42
        g.tri([(c+math.cos(ang-0.5)*n*0.14, c+math.sin(ang-0.5)*n*0.14),
               (c+math.cos(ang+0.5)*n*0.14, c+math.sin(ang+0.5)*n*0.14),
               (ex, ey)], st)
    g.ellipse(c, c, n*0.12, n*0.12, (140, 144, 156))
    g.ellipse(c, c, n*0.05, n*0.05, (20, 20, 24))

PROJECTILES = {'orb': p_orb, 'arrow': p_arrow, 'bolt': p_bolt, 'star': p_star}


# ---- ЗЕЛЬЯ и БРОНЯ (полноцветные иконки) ----
def _flask(g, liquid, big=False):
    n = g.n; cx = n/2
    glass = (200, 214, 224)
    top = n*0.2 if not big else n*0.16
    g.rect(cx-n*0.06, top, cx+n*0.06, n*0.34, glass)       # горлышко
    g.rect(cx-n*0.05, top-n*0.06, cx+n*0.05, top, (150, 110, 70))  # пробка
    g.ellipse(cx, n*0.62, n*0.24, n*0.26, glass)           # колба
    g.ellipse(cx, n*0.64, n*0.19, n*0.2, liquid)           # жидкость
    g.ellipse(cx-n*0.08, n*0.54, n*0.05, n*0.07, (255, 255, 255))  # блик

def i_small_potion(g): _flask(g, (210, 60, 60))
def i_big_potion(g):   _flask(g, (230, 50, 70), big=True)
def i_regen_flask(g):  _flask(g, (80, 200, 110))
def i_elixir(g):
    n = g.n; cx = n/2
    _flask(g, (240, 200, 70))
    g.ellipse(cx+n*0.14, n*0.34, 1.6, 1.6, (255, 255, 210))   # искры
    g.ellipse(cx-n*0.16, n*0.46, 1.3, 1.3, (255, 255, 210))

def i_helm(g):
    n = g.n; cx = n/2; s = PAL['steel']
    g.ellipse(cx, n*0.44, n*0.26, n*0.24, s[0])
    g.rect(cx-n*0.26, n*0.44, cx+n*0.26, n*0.6, s[0])
    g.rect(cx-n*0.26, n*0.56, cx+n*0.26, n*0.62, s[1])       # низ
    g.rect(cx-0.8, n*0.24, cx+0.8, n*0.6, s[2])              # гребень-щель
    g.rect(cx-n*0.24, n*0.5, cx+n*0.24, n*0.54, (20,20,26))  # прорезь для глаз

def i_shoulders(g):
    n = g.n; cx = n/2; s = PAL['steel']
    for sx in (-1, 1):
        g.ellipse(cx+sx*n*0.18, n*0.5, n*0.18, n*0.16, s[0])
        g.ellipse(cx+sx*n*0.18, n*0.44, n*0.16, n*0.1, s[2])
        g.tri([(cx+sx*n*0.3, n*0.4),(cx+sx*n*0.42, n*0.46),(cx+sx*n*0.26, n*0.5)], s[1])  # шип

def i_chest(g):
    n = g.n; cx = n/2; s = PAL['steel']
    g.tri([(cx-n*0.28, n*0.32),(cx+n*0.28, n*0.32),(cx, n*0.8)], s[0])
    g.rect(cx-n*0.26, n*0.3, cx+n*0.26, n*0.42, s[0])
    g.line(cx, n*0.34, cx, n*0.7, s[1], 1.4)                 # центральный шов
    g.ellipse(cx-n*0.12, n*0.42, n*0.05, n*0.06, s[2])       # грудная пластина-блик

def i_gloves(g):
    n = g.n; cx = n/2; s = PAL['steel']
    g.rect(cx-n*0.16, n*0.4, cx+n*0.16, n*0.66, s[0])        # кисть
    for i in range(4):                                       # пальцы
        gx = cx-n*0.14 + i*n*0.095
        g.rect(gx, n*0.28, gx+n*0.06, n*0.42, s[0])
    g.rect(cx-n*0.2, n*0.66, cx+n*0.2, n*0.74, s[1])         # манжет
    g.rect(cx-n*0.16, n*0.46, cx+n*0.16, n*0.5, s[2])

def i_boots(g):
    n = g.n; cx = n/2; s = PAL['steel']; lth = (110, 74, 44)
    g.rect(cx-n*0.1, n*0.24, cx+n*0.1, n*0.62, lth)          # голенище
    g.rect(cx-n*0.1, n*0.58, cx+n*0.28, n*0.72, lth)         # стопа
    g.rect(cx-n*0.1, n*0.68, cx+n*0.3, n*0.76, s[1])         # подошва
    g.rect(cx-n*0.1, n*0.36, cx+n*0.1, n*0.4, s[2])

def i_belt(g):
    n = g.n; cx = n/2; lth = (120, 80, 46)
    g.rect(n*0.12, n*0.44, n*0.88, n*0.58, lth)              # ремень
    g.rect(n*0.12, n*0.44, n*0.88, n*0.48, (160, 112, 66))
    g.rect(cx-n*0.1, n*0.4, cx+n*0.1, n*0.62, PAL['gold'][0])  # пряжка
    g.rect(cx-n*0.05, n*0.46, cx+n*0.05, n*0.56, (30, 26, 20))

ITEMS = {
    'item_small_potion': i_small_potion, 'item_big_potion': i_big_potion,
    'item_regen_flask': i_regen_flask, 'item_elixir': i_elixir,
    'armor_helm': i_helm, 'armor_shoulders': i_shoulders, 'armor_chest': i_chest,
    'armor_gloves': i_gloves, 'armor_boots': i_boots, 'armor_belt': i_belt,
}


# ---- ПРОПЫ ХАБА и ОКРУЖЕНИЯ (фронт-вид, как в Soul Knight) ----
def pr_house(g):
    n = g.n; cx = n/2
    wall = (200, 176, 140); wsh = (150, 128, 96); roof = (150, 70, 54); rsh = (108, 46, 36)
    g.rect(cx-n*0.3, n*0.44, cx+n*0.3, n*0.86, wall)
    g.rect(cx-n*0.3, n*0.44, cx-n*0.22, n*0.86, wsh)              # тень стены
    g.tri([(cx-n*0.38, n*0.46), (cx, n*0.14), (cx+n*0.38, n*0.46)], roof)
    g.tri([(cx-n*0.38, n*0.46), (cx-n*0.19, n*0.3), (cx, n*0.46)], rsh)
    g.rect(cx-n*0.08, n*0.6, cx+n*0.08, n*0.86, (96, 62, 38))     # дверь
    g.ellipse(cx+n*0.05, n*0.73, 1.2, 1.2, PAL['gold'][0])        # ручка
    g.rect(cx+n*0.12, n*0.52, cx+n*0.24, n*0.64, (120, 200, 230)) # окно
    g.line(cx+n*0.18, n*0.52, cx+n*0.18, n*0.64, wsh, 1)

def pr_forge(g):
    n = g.n; cx = n/2
    st = (96, 100, 112); dk = (58, 60, 70)
    g.rect(cx-n*0.3, n*0.4, cx+n*0.3, n*0.86, dk)                 # кузница
    g.rect(cx+n*0.14, n*0.16, cx+n*0.26, n*0.4, st)               # труба
    g.ellipse(cx+n*0.2, n*0.16, n*0.07, n*0.05, (90, 90, 100))    # дым
    g.rect(cx-n*0.2, n*0.52, cx+n*0.06, n*0.76, (30, 26, 30))     # горн
    g.ellipse(cx-n*0.07, n*0.66, n*0.1, n*0.08, (255, 150, 40))   # огонь
    g.ellipse(cx-n*0.07, n*0.66, n*0.05, n*0.05, (255, 230, 120))
    g.rect(cx+n*0.1, n*0.66, cx+n*0.26, n*0.72, st)               # наковальня
    g.tri([(cx+n*0.26, n*0.66), (cx+n*0.32, n*0.68), (cx+n*0.26, n*0.7)], st)

def pr_stall(g):
    n = g.n; cx = n/2
    wood = (150, 104, 60); wsh = (104, 72, 40)
    g.rect(cx-n*0.34, n*0.24, cx+n*0.34, n*0.4, (200, 60, 60))    # тент
    for k in range(6):                                            # полосы тента
        x = cx-n*0.34 + k*n*0.113
        if k % 2 == 0: g.rect(x, n*0.24, x+n*0.056, n*0.4, (230, 220, 210))
    g.rect(cx-n*0.3, n*0.4, cx-n*0.24, n*0.84, wood)              # столбы
    g.rect(cx+n*0.24, n*0.4, cx+n*0.3, n*0.84, wood)
    g.rect(cx-n*0.34, n*0.6, cx+n*0.34, n*0.74, wood)             # прилавок
    g.rect(cx-n*0.34, n*0.6, cx+n*0.34, n*0.64, wsh)
    g.ellipse(cx-n*0.12, n*0.58, n*0.05, n*0.05, (210, 60, 60))   # товар (яблоки)
    g.ellipse(cx+n*0.06, n*0.58, n*0.05, n*0.05, (240, 200, 70))

def pr_fountain(g):
    n = g.n; cx = n/2
    st = (168, 172, 186); dk = (110, 114, 128); water = (90, 170, 220)
    g.ellipse(cx, n*0.72, n*0.34, n*0.16, dk)                     # чаша (низ)
    g.ellipse(cx, n*0.68, n*0.32, n*0.14, st)
    g.ellipse(cx, n*0.68, n*0.24, n*0.1, water)                   # вода
    g.rect(cx-n*0.05, n*0.4, cx+n*0.05, n*0.66, st)               # колонна
    g.ellipse(cx, n*0.38, n*0.1, n*0.06, st)                      # верхняя чаша
    g.ellipse(cx, n*0.38, n*0.06, n*0.03, water)
    for s in (-1, 1):                                             # струи
        g.line(cx, n*0.36, cx+s*n*0.14, n*0.56, (180, 220, 245), 1)

def pr_portal(g):
    n = g.n; cx = n/2
    st = (120, 110, 140); dk = (78, 70, 100); glow = PAL['void'][3]
    g.ellipse(cx, n*0.5, n*0.3, n*0.38, dk)                       # арка (камень)
    g.ellipse(cx, n*0.5, n*0.22, n*0.3, (20, 12, 30))            # проём
    g.ellipse(cx, n*0.5, n*0.18, n*0.26, glow)                    # свечение портала
    g.ellipse(cx, n*0.5, n*0.1, n*0.16, (230, 180, 255))
    g.rect(cx-n*0.32, n*0.78, cx+n*0.32, n*0.88, st)             # основание
    for s in (-1, 1):
        g.rect(cx+s*n*0.26, n*0.3, cx+s*n*0.32, n*0.8, st)       # колонны

def pr_torch(g):
    n = g.n; cx = n/2
    g.rect(cx-n*0.05, n*0.4, cx+n*0.05, n*0.88, (110, 74, 44))    # столб
    g.rect(cx-n*0.1, n*0.34, cx+n*0.1, n*0.44, (80, 84, 96))      # чаша
    g.tri([(cx, n*0.12), (cx-n*0.11, n*0.38), (cx+n*0.11, n*0.38)], (255, 140, 40))
    g.tri([(cx, n*0.2), (cx-n*0.06, n*0.36), (cx+n*0.06, n*0.36)], (255, 230, 120))

def pr_barrel(g):
    n = g.n; cx = n/2
    wood = (150, 100, 56); band = (90, 92, 104)
    g.ellipse(cx, n*0.5, n*0.2, n*0.32, wood)
    g.rect(cx-n*0.2, n*0.32, cx+n*0.2, n*0.7, wood)
    g.ellipse(cx, n*0.32, n*0.2, n*0.07, (180, 128, 74))         # верх
    g.rect(cx-n*0.21, n*0.4, cx+n*0.21, n*0.44, band)            # обручи
    g.rect(cx-n*0.21, n*0.58, cx+n*0.21, n*0.62, band)
    g.line(cx-n*0.08, n*0.34, cx-n*0.08, n*0.68, (120, 80, 44), 1)

def pr_statue(g):
    n = g.n; cx = n/2
    st = (176, 180, 194); dk = (120, 124, 138)
    g.rect(cx-n*0.24, n*0.78, cx+n*0.24, n*0.9, dk)              # пьедестал
    g.rect(cx-n*0.18, n*0.7, cx+n*0.18, n*0.8, st)
    g.ellipse(cx, n*0.62, n*0.14, n*0.16, st)                    # тело
    g.rect(cx-n*0.12, n*0.5, cx+n*0.12, n*0.72, st)
    g.ellipse(cx, n*0.36, n*0.1, n*0.11, st)                     # голова
    g.line(cx+n*0.12, n*0.3, cx+n*0.12, n*0.66, st, 2)           # меч/копьё вверх
    g.tri([(cx+n*0.12, n*0.22), (cx+n*0.08, n*0.32), (cx+n*0.16, n*0.32)], (210, 214, 226))

def pr_tree(g):
    n = g.n; cx = n/2
    trunk = (110, 74, 44); leaf = (70, 150, 66); lsh = (44, 104, 46); llt = (120, 194, 100)
    g.rect(cx-n*0.06, n*0.56, cx+n*0.06, n*0.88, trunk)
    g.ellipse(cx, n*0.4, n*0.28, n*0.26, leaf)
    g.ellipse(cx-n*0.14, n*0.5, n*0.16, n*0.16, lsh)
    g.ellipse(cx+n*0.12, n*0.34, n*0.16, n*0.16, llt)
    g.ellipse(cx, n*0.3, n*0.14, n*0.13, llt)

PROPS = {
    'prop_house': pr_house, 'prop_forge': pr_forge, 'prop_stall': pr_stall,
    'prop_fountain': pr_fountain, 'prop_portal': pr_portal, 'prop_torch': pr_torch,
    'prop_barrel': pr_barrel, 'prop_statue': pr_statue, 'prop_tree': pr_tree,
}


# ---- ДЕКОР БИОМОВ (разбросан по кольцам; часть тинтуется в движке) ----
def d_rock(g):
    n = g.n; cx = n/2
    st = (128, 132, 146); dk = (86, 90, 104)
    g.ellipse(cx, n*0.64, n*0.3, n*0.2, st)
    g.ellipse(cx-n*0.18, n*0.6, n*0.14, n*0.12, dk)
    g.ellipse(cx+n*0.12, n*0.54, n*0.16, n*0.14, st)
    g.line(cx-n*0.06, n*0.52, cx+n*0.02, n*0.7, dk, 1)

def d_bush(g):
    n = g.n; cx = n/2
    leaf = (70, 150, 66); lsh = (44, 104, 46); llt = (120, 194, 100)
    g.ellipse(cx, n*0.62, n*0.26, n*0.2, leaf)
    g.ellipse(cx-n*0.14, n*0.6, n*0.14, n*0.13, lsh)
    g.ellipse(cx+n*0.1, n*0.54, n*0.14, n*0.13, llt)
    g.ellipse(cx, n*0.5, n*0.12, n*0.11, llt)

def d_deadtree(g):
    n = g.n; cx = n/2
    tr = (96, 74, 54); ts = (62, 46, 32)
    g.rect(cx-n*0.05, n*0.4, cx+n*0.05, n*0.86, tr)
    g.rect(cx-n*0.05, n*0.4, cx-n*0.02, n*0.86, ts)
    g.line(cx, n*0.5, cx-n*0.24, n*0.32, tr, 2)     # голые ветви
    g.line(cx, n*0.44, cx+n*0.22, n*0.28, tr, 2)
    g.line(cx-n*0.14, n*0.4, cx-n*0.22, n*0.24, tr, 1)
    g.line(cx+n*0.12, n*0.36, cx+n*0.18, n*0.2, tr, 1)

def d_bones(g):
    n = g.n; cx = n/2
    b = (216, 212, 196); bs = (150, 146, 130)
    g.ellipse(cx-n*0.12, n*0.64, n*0.13, n*0.12, b)     # череп
    for s in (-1, 1):
        g.ellipse(cx-n*0.12+s*n*0.05, n*0.63, n*0.03, n*0.035, (30,28,26))  # глазницы
    g.line(cx+n*0.02, n*0.7, cx+n*0.28, n*0.6, b, 2)    # кость
    g.ellipse(cx+n*0.28, n*0.6, n*0.04, n*0.04, b)
    g.ellipse(cx+n*0.02, n*0.7, n*0.04, n*0.04, b)
    g.line(cx-n*0.02, n*0.78, cx+n*0.2, n*0.76, bs, 1)  # ребро

def d_crystal(g):    # белёсый — тинтуется по биому (лёд/пустота)
    n = g.n; cx = n/2
    c = (200, 224, 240); cs = (140, 176, 210); cl = (240, 250, 255)
    g.tri([(cx, n*0.16), (cx-n*0.14, n*0.7), (cx+n*0.1, n*0.66)], c)
    g.tri([(cx, n*0.16), (cx-n*0.14, n*0.7), (cx-n*0.03, n*0.66)], cs)
    g.tri([(cx-n*0.2, n*0.4), (cx-n*0.3, n*0.72), (cx-n*0.08, n*0.7)], cs)   # осколок
    g.tri([(cx+n*0.14, n*0.36), (cx+n*0.06, n*0.7), (cx+n*0.26, n*0.72)], c)
    g.line(cx-n*0.02, n*0.24, cx-n*0.06, n*0.6, cl, 1)  # блик

def d_column(g):     # разрушенная колонна (руины)
    n = g.n; cx = n/2
    st = (176, 172, 156); dk = (120, 116, 102)
    g.rect(cx-n*0.16, n*0.3, cx+n*0.16, n*0.82, st)
    g.rect(cx-n*0.16, n*0.3, cx-n*0.1, n*0.82, dk)      # тень
    g.rect(cx-n*0.22, n*0.78, cx+n*0.22, n*0.88, st)    # база
    g.rect(cx-n*0.2, n*0.28, cx+n*0.2, n*0.34, dk)      # скол верха
    for fy in (0.44, 0.58, 0.7):                        # желоба
        g.line(cx-n*0.08, n*fy, cx-n*0.08, n*fy+n*0.08, dk, 1)
        g.line(cx+n*0.04, n*fy, cx+n*0.04, n*fy+n*0.08, dk, 1)

def d_stump(g):
    n = g.n; cx = n/2
    tr = (120, 84, 50); top = (160, 120, 78)
    g.rect(cx-n*0.16, n*0.5, cx+n*0.16, n*0.78, tr)
    g.ellipse(cx, n*0.5, n*0.16, n*0.06, top)
    g.ellipse(cx, n*0.5, n*0.08, n*0.03, tr)            # кольца среза

def d_chest(g):
    n = g.n; cx = n/2
    wood = (150, 100, 56); wdk = (104, 68, 36); band = (150, 120, 60); gold = PAL['gold'][0]
    g.rect(cx-n*0.26, n*0.5, cx+n*0.26, n*0.8, wood)    # корпус
    g.rect(cx-n*0.26, n*0.5, cx-n*0.2, n*0.8, wdk)
    g.rect(cx-n*0.28, n*0.36, cx+n*0.28, n*0.52, wood)  # крышка
    g.ellipse(cx, n*0.36, n*0.28, n*0.1, wood)
    g.rect(cx-n*0.28, n*0.5, cx+n*0.28, n*0.54, band)   # обод
    for bx in (-0.18, 0.14):                            # вертик. полосы
        g.rect(cx+n*bx, n*0.36, cx+n*bx+n*0.04, n*0.8, band)
    g.rect(cx-n*0.04, n*0.5, cx+n*0.04, n*0.6, gold)    # замок
    g.rect(cx-n*0.02, n*0.53, cx+n*0.02, n*0.57, (40,32,16))

def d_chest_open(g):
    n = g.n; cx = n/2
    wood = (150, 100, 56); wdk = (104, 68, 36); band = (150, 120, 60); gold = PAL['gold'][0]
    g.rect(cx-n*0.26, n*0.52, cx+n*0.26, n*0.82, wood)  # корпус
    g.rect(cx-n*0.24, n*0.5, cx+n*0.24, n*0.56, (30,24,16))  # тёмное нутро
    g.ellipse(cx, n*0.54, n*0.2, n*0.06, gold)          # золото внутри
    for gx in (-0.1, 0.02, 0.12):
        g.ellipse(cx+n*gx, n*0.53, n*0.04, n*0.04, (255, 232, 150))
    g.rect(cx-n*0.28, n*0.2, cx+n*0.28, n*0.34, wood)   # открытая крышка (вверху)
    g.ellipse(cx, n*0.2, n*0.28, n*0.09, wdk)
    g.rect(cx-n*0.28, n*0.32, cx+n*0.28, n*0.36, band)

DECOS = {
    'deco_rock': d_rock, 'deco_bush': d_bush, 'deco_deadtree': d_deadtree,
    'deco_bones': d_bones, 'deco_crystal': d_crystal, 'deco_column': d_column,
    'deco_stump': d_stump, 'deco_chest': d_chest, 'deco_chest_open': d_chest_open,
}


# ---- НАДЕВАЕМАЯ БРОНЯ (оверлеи поверх героя; тот же холст 48px, что и f_hero) ----
def wa_helm(g, p=None):
    n = g.n; cx = n/2; s = PAL['steel']
    g.ellipse(cx, n*0.28, n*0.19, n*0.15, s[0])         # купол поверх макушки
    g.rect(cx-n*0.19, n*0.3, cx+n*0.19, n*0.35, s[1])   # кромка
    g.rect(cx-1, n*0.14, cx+1, n*0.28, s[2])            # гребень
    g.rect(cx-n*0.19, n*0.35, cx-n*0.13, n*0.44, s[0])  # нащёчник (левый; зеркалится)

def wa_chest(g, p=None):
    n = g.n; cx = n/2; s = PAL['steel']
    g.tri([(cx-n*0.2, n*0.48), (cx+n*0.2, n*0.48), (cx, n*0.72)], s[0])  # нагрудник
    g.rect(cx-n*0.16, n*0.46, cx+n*0.16, n*0.56, s[0])
    g.rect(cx-n*0.16, n*0.46, cx+n*0.16, n*0.5, s[2])   # верхний блик
    g.line(cx, n*0.5, cx, n*0.68, s[1], 1)              # центр. шов
    g.ellipse(cx-n*0.09, n*0.55, n*0.035, n*0.05, s[2])

def wa_shoulders(g, p=None):
    n = g.n; cx = n/2; s = PAL['steel']
    g.ellipse(cx-n*0.2, n*0.5, n*0.1, n*0.08, s[0])     # левый наплечник (зеркалится)
    g.ellipse(cx-n*0.2, n*0.47, n*0.09, n*0.05, s[2])
    g.tri([(cx-n*0.3, n*0.46), (cx-n*0.22, n*0.42), (cx-n*0.14, n*0.5)], s[1])  # шип

WORN = {'worn_helm': wa_helm, 'worn_chest': wa_chest, 'worn_shoulders': wa_shoulders}


# ---- ГЕРОЙ ПО РАСАМ (детальный, 2 кадра ходьбы; голова/торс на общих якорях,
#      чтобы броня-оверлеи совпадали). Front-вид, зеркалится движком по стороне. ----
RACE_CFG = {
    'human':     {'body': ((70,120,200),(34,66,130),(150,196,255)), 'skin': ((226,188,150),(180,140,110)), 'feat': 'hood', 'hair': (96,64,38)},
    'beastkin':  {'body': ((150,110,70),(96,68,42),(198,160,120)), 'skin': ((214,182,142),(168,138,104)), 'feat': 'ears', 'hair': (110,78,46), 'tail': (120,88,54)},
    'dwarf':     {'body': ((160,66,54),(100,36,32),(212,110,90)), 'skin': ((224,180,140),(178,138,104)), 'feat': 'beard', 'beard': (200,130,60)},
    'undead':    {'body': ((92,104,98),(52,64,60),(150,162,150)), 'skin': ((182,196,182),(132,150,134)), 'feat': 'hood', 'hair': (70,84,74), 'eyeglow': (140,240,160)},
    'demon':     {'body': ((156,46,42),(90,22,24),(216,92,72)), 'skin': ((196,86,74),(140,52,48)), 'feat': 'horns', 'horn': (52,26,28), 'eyeglow': (255,190,70), 'tail': (120,36,36)},
    'elf':       {'body': ((66,150,120),(38,100,80),(150,214,180)), 'skin': ((226,206,170),(182,160,128)), 'feat': 'longears', 'hair': (210,196,150)},
    'golem':     {'body': ((120,124,138),(70,74,88),(196,202,214)), 'skin': ((140,144,158),(92,96,110)), 'feat': 'stone', 'eyeglow': (150,224,255)},
    'dragonkin': {'body': ((78,150,90),(44,100,54),(150,204,120)), 'skin': ((110,170,96),(70,120,64)), 'feat': 'scales', 'horn': (58,96,52), 'eyeglow': (240,220,90), 'tail': (70,130,80)},
}

def f_race(g, cfg, frame):
    n = g.n; cx = n // 2
    body, bsh, blt = cfg['body']
    skin, sksh = cfg['skin']
    feat = cfg['feat']
    hy = n * 0.3
    # хвост позади (звероид/демон/дракон)
    if feat in ('ears', 'horns', 'scales'):
        tc = cfg.get('tail', bsh)
        g.line(cx + n*0.15, n*0.7, cx + n*0.28, n*0.58, tc, 3)
        g.line(cx + n*0.28, n*0.58, cx + n*0.32, n*0.44, tc, 2)
        if feat == 'horns':
            g.tri([(cx+n*0.32, n*0.46), (cx+n*0.4, n*0.42), (cx+n*0.32, n*0.38)], cfg.get('eyeglow', (255,180,60)))
    # ноги (шаг: одна поднята/выдвинута — чередуется по кадру)
    legw = n * 0.055
    def leg(x, lifted):
        top = n*0.7; bot = n*0.9 - (n*0.05 if lifted else 0); fwd = n*0.04 if lifted else 0
        g.rect(x-legw+fwd, top, x+legw+fwd, bot, bsh)
        g.rect(x-legw+fwd, bot-n*0.035, x+legw+fwd+n*0.02, bot, (40,32,28))  # ботинок
    leg(cx - n*0.07, frame == 1)
    leg(cx + n*0.07, frame == 0)
    # торс
    g.rect(cx-n*0.15, n*0.46, cx+n*0.15, n*0.72, body)
    g.rect(cx-n*0.15, n*0.46, cx-n*0.1, n*0.72, bsh)          # тень бока
    g.rect(cx-n*0.15, n*0.46, cx+n*0.15, n*0.5, blt)          # верхний блик
    g.rect(cx-n*0.15, n*0.63, cx+n*0.15, n*0.67, cfg.get('belt', (58,44,30)))  # пояс
    g.rect(cx-n*0.03, n*0.63, cx+n*0.03, n*0.67, (210,168,66))  # пряжка
    # руки (мах в противофазе ногам)
    def arm(x, fwd):
        sw = n*0.05 if fwd else -n*0.02
        g.ellipse(x, n*0.52+sw, n*0.055, n*0.1, bsh)
        g.ellipse(x, n*0.6+sw, n*0.042, n*0.042, skin)
    arm(cx - n*0.185, frame == 0)
    arm(cx + n*0.185, frame == 1)
    # голова
    if feat == 'stone':
        g.rect(cx-n*0.15, hy-n*0.13, cx+n*0.15, hy+n*0.14, skin)
    else:
        g.ellipse(cx, hy, n*0.15, n*0.15, skin)
    g.ellipse(cx-n*0.09, hy+n*0.02, n*0.05, n*0.06, sksh)     # тень щеки
    gl = cfg.get('eyeglow')
    eyes(g, hy, int(n*0.055), 1.2, gl if gl else (36,40,56), brow=bool(gl))
    # черты рас
    if feat == 'hood':
        g.ellipse(cx, hy-n*0.07, n*0.15, n*0.08, cfg['hair'])          # волосы
    elif feat == 'ears':
        for s in (-1, 1):
            g.tri([(cx+s*n*0.1, hy-n*0.1), (cx+s*n*0.18, hy-n*0.28), (cx+s*n*0.02, hy-n*0.08)], cfg.get('hair', bsh))
    elif feat == 'beard':
        g.ellipse(cx, hy+n*0.1, n*0.14, n*0.1, cfg['beard'])          # борода
        g.rect(cx-n*0.16, hy-n*0.1, cx+n*0.16, hy-n*0.02, (150,158,172))
        g.tri([(cx, hy-n*0.24), (cx-n*0.16, hy-n*0.06), (cx+n*0.16, hy-n*0.06)], (120,128,144))  # шлем
    elif feat == 'horns':
        for s in (-1, 1):
            g.tri([(cx+s*n*0.08, hy-n*0.1), (cx+s*n*0.16, hy-n*0.3), (cx+s*n*0.02, hy-n*0.12)], cfg.get('horn', (60,30,30)))
    elif feat == 'longears':
        for s in (-1, 1):
            g.tri([(cx+s*n*0.12, hy), (cx+s*n*0.32, hy-n*0.12), (cx+s*n*0.1, hy+n*0.05)], skin)
        g.rect(cx-n*0.1, hy-n*0.11, cx+n*0.1, hy-n*0.07, (210,168,66))  # обруч
    elif feat == 'stone':
        g.line(cx-n*0.05, hy-n*0.05, cx-n*0.01, hy+n*0.1, cfg.get('eyeglow', (150,220,255)), 1)
        g.ellipse(cx, n*0.57, n*0.045, n*0.055, cfg.get('eyeglow', (150,220,255)))  # ядро в груди
    elif feat == 'scales':
        g.tri([(cx-n*0.14, hy+n*0.03), (cx-n*0.26, hy+n*0.01), (cx-n*0.12, hy+n*0.11)], skin)  # морда
        for s in (-1, 1):
            g.tri([(cx+s*n*0.1, hy-n*0.08), (cx+s*n*0.16, hy-n*0.24), (cx+s*n*0.04, hy-n*0.06)], cfg.get('horn', (60,90,50)))
        for yy in (0.52, 0.58, 0.64):
            g.rect(cx-n*0.07, n*yy, cx+n*0.07, n*yy+n*0.02, blt)   # брюшные пластины

def build_aura():
    import math
    size = 96; img = Image.new('RGBA', (size, size), (0, 0, 0, 0)); px = img.load()
    c = size / 2
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - c, y - c) / c
            if d < 1:
                a = int(210 * (1 - d) ** 2)
                ring = int(90 * max(0, 1 - abs(d - 0.82) / 0.14))  # мягкое кольцо по краю
                px[x, y] = (255, 255, 255, min(255, a + ring))
    img.save(os.path.join(OUT, 'aura.png'))


def build_creature(name, fn, pal, kw, n, scale, mirror=True):
    random.seed(name)
    g = Grid(n)
    fn(g, pal, **kw)
    if mirror:
        g.mirror_lr()
    g.shade()
    g.outline()
    g.render(scale).save(os.path.join(OUT, name + '.png'))


def build_weapon(name, fn, n=32, scale=4):
    g = Grid(n)
    fn(g)
    g.shade()
    g.outline()
    g.render(scale).save(os.path.join(OUT, 'wpn_' + name + '.png'))


def build_flat(key, fn, n, scale, do_shade=True):
    g = Grid(n)
    fn(g)
    if do_shade:
        g.shade()
    g.outline()
    g.render(scale).save(os.path.join(OUT, key + '.png'))


def main():
    for name, (fn, pal, kw) in SPRITES.items():
        f = f_hero if name == 'hero' else fn
        out = name if name == 'hero' else 'mob_' + name
        build_creature(out, f, pal, kw, 48, 4, mirror=(f is not f_rat))
    for name, (fn, pal, kw) in BOSSES.items():
        build_creature('boss_' + name, fn, pal, kw, 60, 5)
    for name, fn in WEAPONS.items():
        build_weapon(name, fn)
    for name, fn in PROJECTILES.items():
        build_flat('proj_' + name, fn, 22, 4, do_shade=False)
    for key, fn in ITEMS.items():
        build_flat(key, fn, 30, 4)
    for key, fn in PROPS.items():
        build_flat(key, fn, 44, 4)
    for key, fn in DECOS.items():
        build_flat(key, fn, 40, 4)
    for key, fn in WORN.items():
        build_creature(key, fn, PAL['steel'], {}, 48, 4)
    # герои по расам: 2 кадра ходьбы (без зеркалирования при генерации — движок сам)
    for race, cfg in RACE_CFG.items():
        for fr in (0, 1):
            build_creature('hero_%s_%d' % (race, fr),
                           (lambda g, p, cfg=cfg, fr=fr: f_race(g, cfg, fr)),
                           None, {}, 48, 4, mirror=False)
    # запасной 'hero' = человек, кадр 0
    build_creature('hero', (lambda g, p: f_race(g, RACE_CFG['human'], 0)), None, {}, 48, 4, mirror=False)
    build_aura()
    print('готово: %d существ, %d боссов, %d оружий, %d снарядов, %d предметов, %d пропов, %d декора, %d брони, %d рас+аура'
          % (len(SPRITES), len(BOSSES), len(WEAPONS), len(PROJECTILES), len(ITEMS), len(PROPS), len(DECOS), len(WORN), len(RACE_CFG)))


if __name__ == '__main__':
    main()
