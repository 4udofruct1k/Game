import Phaser from 'phaser';
import { MOBS_BY_RING } from '../data/mobs';
import { BOSSES_BY_RING } from '../data/bosses';
import { WEAPON_ARCHETYPES } from '../data/weapons';

const WEAPON_ARCH_IDS = Object.keys(WEAPON_ARCHETYPES);

// Генерация placeholder-текстур (круги/квадраты/кольца) — тинтуются на инстансах.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    // спрайты вырезаны из арт-борды (public/sprites). Если файла нет — фолбэк на круг.
    this.load.image('hero', 'sprites/hero.png');
    for (const ring of Object.values(MOBS_BY_RING)) {
      for (const m of ring) this.load.image('mob_' + m.id, 'sprites/mob_' + m.id + '.png');
    }
    for (const b of Object.values(BOSSES_BY_RING)) {
      this.load.image('boss_' + b.id, 'sprites/boss_' + b.id + '.png');
    }
    // иконки оружия по архетипам
    for (const a of WEAPON_ARCH_IDS) this.load.image('wpn_' + a, 'sprites/wpn_' + a + '.png');
    // снаряды (тинтуются стихией)
    for (const s of ['orb', 'arrow', 'bolt', 'star']) this.load.image('proj_' + s, 'sprites/proj_' + s + '.png');
    // зелья и броня по слотам
    for (const k of ['small_potion', 'big_potion', 'regen_flask', 'elixir']) this.load.image('item_' + k, 'sprites/item_' + k + '.png');
    for (const s of ['helm', 'shoulders', 'chest', 'gloves', 'boots', 'belt']) this.load.image('armor_' + s, 'sprites/armor_' + s + '.png');
    // пропы хаба
    for (const pr of ['house', 'forge', 'stall', 'fountain', 'portal', 'torch', 'barrel', 'statue', 'tree'])
      this.load.image('prop_' + pr, 'sprites/prop_' + pr + '.png');
    // декор биомов + сундуки
    for (const dc of ['rock', 'bush', 'deadtree', 'bones', 'crystal', 'column', 'stump', 'chest', 'chest_open'])
      this.load.image('deco_' + dc, 'sprites/deco_' + dc + '.png');
    // надеваемая броня (оверлеи поверх героя)
    for (const wa of ['helm', 'chest', 'shoulders']) this.load.image('worn_' + wa, 'sprites/worn_' + wa + '.png');
    // не валимся, если какой-то спрайт не загрузился
    this.load.on('loaderror', () => {});
  }

  create(): void {
    this.makeCircle('circle', 64);
    this.makeCircle('circleSoft', 64, 0.85);
    this.makeSquare('square', 64);
    this.makeRing('ring', 128, 6);
    this.makeTriangle('triangle', 48);
    this.makeNoise('noise', 160);
    // тайлы земли биомов: base, dark, light, accent (индекс = кольцо, 0 = хаб)
    const P: [number, number, number, number][] = [
      [0x2a3a5c, 0x1e2a44, 0x40547c, 0x516896], // хаб — камень
      [0x2f7a42, 0x236032, 0x49a65c, 0x6ac07a], // равнины — трава
      [0x3d5a30, 0x2a4222, 0x577a3a, 0x7a8a34], // топи
      [0x5c2e1c, 0x3e2014, 0x7e4022, 0xe0742a], // пустоши — угли
      [0x3a6088, 0x2c4a6c, 0x6fa0cc, 0xbfe4ff], // мёрзлые руины
      [0x3c1c5e, 0x281044, 0x5c2e8a, 0xd83ad0], // бездна
    ];
    P.forEach((c, i) => this.makeBiomeTile('biome' + i, c[0], c[1], c[2], c[3]));

    this.scene.start('StartRoll');
  }

  // Тайл земли биома: база + тёмные кляксы + светлые/акцентные крапинки (тайлится).
  private makeBiomeTile(key: string, base: number, dark: number, light: number, accent: number): void {
    const size = 128;
    const g = this.add.graphics();
    g.fillStyle(base, 1).fillRect(0, 0, size, size);
    const rnd = (n: number) => Math.floor(Math.random() * n);
    // тёмные кляксы
    for (let i = 0; i < 26; i++) g.fillStyle(dark, 0.5).fillCircle(rnd(size), rnd(size), 4 + rnd(9));
    // светлые пятна
    for (let i = 0; i < 22; i++) g.fillStyle(light, 0.45).fillCircle(rnd(size), rnd(size), 3 + rnd(6));
    // мелкие крапинки (детализация)
    for (let i = 0; i < 320; i++) {
      g.fillStyle(Math.random() > 0.5 ? light : dark, 0.5);
      g.fillRect(rnd(size), rnd(size), 1, 1);
    }
    // редкие акценты (угли/иней/магия)
    for (let i = 0; i < 14; i++) g.fillStyle(accent, 0.6).fillCircle(rnd(size), rnd(size), 1 + rnd(2));
    g.generateTexture(key, size, size);
    g.destroy();
  }

  private makeCircle(key: string, size: number, alpha = 1): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, alpha);
    g.fillCircle(size / 2, size / 2, size / 2);
    g.generateTexture(key, size, size);
    g.destroy();
  }

  private makeSquare(key: string, size: number): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, size, size);
    g.generateTexture(key, size, size);
    g.destroy();
  }

  private makeRing(key: string, size: number, thickness: number): void {
    const g = this.add.graphics();
    g.lineStyle(thickness, 0xffffff, 1);
    g.strokeCircle(size / 2, size / 2, size / 2 - thickness);
    g.generateTexture(key, size, size);
    g.destroy();
  }

  // Шум для текстуры земли биомов (тайлится, скроллится с камерой).
  private makeNoise(key: string, size: number): void {
    const g = this.add.graphics();
    const dots = Math.floor(size * size * 0.14);
    for (let i = 0; i < dots; i++) {
      const x = Math.floor(Math.random() * size);
      const y = Math.floor(Math.random() * size);
      const light = Math.random() > 0.5;
      g.fillStyle(light ? 0xffffff : 0x000000, 0.5);
      const s = Math.random() > 0.85 ? 2 : 1;
      g.fillRect(x, y, s, s);
    }
    g.generateTexture(key, size, size);
    g.destroy();
  }

  private makeTriangle(key: string, size: number): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(size / 2, 0, size, size, 0, size);
    g.generateTexture(key, size, size);
    g.destroy();
  }
}
