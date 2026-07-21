import Phaser from 'phaser';
import { COLORS } from '../data/theme';
import { HEALS } from '../data/items';
import { TouchControls } from '../ui/TouchControls';
import { touch } from '../core/touchInput';
import { GAMEPLAY, ringOuterRadius, RING_COUNT } from '../data/balance';

// HUD-оверлей. Читает состояние из registry['hud'], которое пишет WorldScene.
export class UIScene extends Phaser.Scene {
  private hpBar!: Phaser.GameObjects.Rectangle;
  private hpText!: Phaser.GameObjects.Text;
  private xpBar!: Phaser.GameObjects.Rectangle;
  private lvlText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private energyBar!: Phaser.GameObjects.Rectangle;
  private ultBar!: Phaser.GameObjects.Rectangle;
  private ultText!: Phaser.GameObjects.Text;
  private dashText!: Phaser.GameObjects.Text;
  private skillText!: Phaser.GameObjects.Text;
  private healText!: Phaser.GameObjects.Text;
  private pointsText!: Phaser.GameObjects.Text;
  private bannerText!: Phaser.GameObjects.Text;
  private bossName!: Phaser.GameObjects.Text;
  private bossBarBg!: Phaser.GameObjects.Rectangle;
  private bossBar!: Phaser.GameObjects.Rectangle;
  private minimap!: Phaser.GameObjects.Graphics;
  private readonly mmR = 76; // радиус миникарты, px
  private readonly mmC = new Phaser.Math.Vector2(94, 184); // центр миникарты на экране
  private mapExpanded = false;
  private mapCloseZone!: Phaser.GameObjects.Zone;
  private mapHint!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'UI', active: false });
  }

  create(): void {
    const w = this.scale.width;

    // HP
    this.add.rectangle(16, 16, 260, 20, COLORS.hpBg).setOrigin(0, 0);
    this.hpBar = this.add.rectangle(16, 16, 260, 20, COLORS.hp).setOrigin(0, 0);
    this.hpText = this.add.text(20, 17, '', { fontFamily: 'system-ui', fontSize: '13px', color: '#fff' });

    // XP
    this.add.rectangle(16, 40, 260, 8, 0x22283a).setOrigin(0, 0);
    this.xpBar = this.add.rectangle(16, 40, 0, 8, COLORS.xp).setOrigin(0, 0);
    this.lvlText = this.add.text(16, 52, '', { fontFamily: 'system-ui', fontSize: '12px', color: '#bcd6f0' });

    // Энергия
    this.add.rectangle(16, 70, 200, 6, 0x1a2a2a).setOrigin(0, 0);
    this.energyBar = this.add.rectangle(16, 70, 200, 6, COLORS.energy).setOrigin(0, 0);

    // Золото
    this.goldText = this.add.text(w - 16, 16, '', { fontFamily: 'system-ui', fontSize: '16px', color: '#f0c040' }).setOrigin(1, 0);

    // Ульта
    this.add.rectangle(16, 84, 200, 8, 0x2a1a3a).setOrigin(0, 0);
    this.ultBar = this.add.rectangle(16, 84, 0, 8, COLORS.ult).setOrigin(0, 0);
    this.ultText = this.add.text(220, 82, '', { fontFamily: 'system-ui', fontSize: '11px', color: '#c9a0e0' });

    // низ: способности/хилка/очки
    const y = this.scale.height - 26;
    this.dashText = this.add.text(16, y, '', { fontFamily: 'system-ui', fontSize: '13px', color: '#cfd6e0' });
    this.skillText = this.add.text(120, y, '', { fontFamily: 'system-ui', fontSize: '13px', color: '#cfd6e0' });
    this.healText = this.add.text(260, y, '', { fontFamily: 'system-ui', fontSize: '13px', color: '#8fe0a0' });
    this.pointsText = this.add.text(w - 16, y, '', { fontFamily: 'system-ui', fontSize: '13px', color: '#f0c040' }).setOrigin(1, 0);

    this.add
      .text(w / 2, this.scale.height - 8, 'WASD ход · мышь прицел · авто-атака · Space рывок · J навык · K ульта · H хилка · E хаб · Tab меню', {
        fontFamily: 'system-ui',
        fontSize: '11px',
        color: '#6a6a80',
      })
      .setOrigin(0.5, 1);

    // баннер
    this.bannerText = this.add.text(w / 2, 110, '', { fontFamily: 'system-ui', fontSize: '18px', color: '#ffe08a', fontStyle: 'bold' }).setOrigin(0.5);

    // босс-бар
    this.bossName = this.add.text(w / 2, 30, '', { fontFamily: 'system-ui', fontSize: '14px', color: '#ff9a9a' }).setOrigin(0.5);
    this.bossBarBg = this.add.rectangle(w / 2, 50, 420, 12, 0x3a1518).setOrigin(0.5).setVisible(false);
    this.bossBar = this.add.rectangle(w / 2 - 210, 50, 420, 12, 0xd64550).setOrigin(0, 0.5).setVisible(false);

    // миникарта (рисуется в update) + разворот по тапу/клавише M
    this.minimap = this.add.graphics().setScrollFactor(0).setDepth(60);
    this.mapHint = this.add
      .text(this.scale.width / 2, 16, 'КАРТА — нажми, чтобы закрыть', { fontFamily: 'system-ui', fontSize: '15px', color: '#f0c040' })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(212)
      .setVisible(false);
    const zone = this.add
      .zone(this.mmC.x, this.mmC.y, this.mmR * 2 + 16, this.mmR * 2 + 16)
      .setScrollFactor(0)
      .setDepth(72)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerup', () => this.setMapExpanded(!this.mapExpanded));
    this.mapCloseZone = this.add
      .zone(0, 0, this.scale.width, this.scale.height)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(205);
    this.mapCloseZone.on('pointerup', () => this.setMapExpanded(false));
    this.input.keyboard?.on('keydown-M', () => this.setMapExpanded(!this.mapExpanded));

    // сенсорные контролы — на тач-устройствах (или ?touch=1 для отладки)
    const forceTouch = typeof location !== 'undefined' && new URLSearchParams(location.search).has('touch');
    if (this.sys.game.device.input.touch || forceTouch) {
      touch.enabled = true;
      new TouchControls(this);
    }
  }

  update(): void {
    const hud = this.registry.get('hud') as Record<string, unknown> | undefined;
    if (!hud) return;
    const hp = hud.hp as number;
    const maxHp = hud.maxHp as number;
    this.hpBar.width = 260 * Phaser.Math.Clamp(hp / maxHp, 0, 1);
    this.hpText.setText(`${Math.ceil(hp)} / ${Math.ceil(maxHp)}`);

    this.xpBar.width = 260 * Phaser.Math.Clamp((hud.xp as number) / Math.max(1, hud.xpNext as number), 0, 1);
    this.lvlText.setText(`Ур. ${hud.level} / ${hud.levelCap}`);

    this.energyBar.width = 200 * Phaser.Math.Clamp((hud.energy as number) / (hud.energyMax as number), 0, 1);

    this.goldText.setText(`⦿ ${Math.floor(hud.gold as number)}`);

    const ultP = Phaser.Math.Clamp((hud.ultCharge as number) / (hud.ultFull as number), 0, 1);
    this.ultBar.width = 200 * ultP;
    this.ultText.setText(ultP >= 1 ? 'УЛЬТА готова (K)' : `Ульта ${Math.floor(ultP * 100)}%`);

    this.dashText.setText(`⟿ ${hud.dashCharges}/${hud.maxDash}`);
    const skillReady = (hud.skillCd as number) <= 0;
    this.skillText.setText(skillReady ? 'Навык (J) ✓' : `Навык ${((hud.skillCd as number) / 1000).toFixed(1)}с`);
    this.skillText.setColor(skillReady ? '#8fe0a0' : '#888');

    const healName = HEALS[hud.healKind as keyof typeof HEALS]?.name ?? '';
    this.healText.setText(`Хилка (H): ${healName} ×${hud.healCount} [1-4]`);

    const tp = hud.talentPoints as number;
    const sp = hud.skillPoints as number;
    this.pointsText.setText(tp + sp > 0 ? `Очки: талант ${tp} / навык ${sp} (Tab)` : '');

    const banner = hud.banner as string;
    this.bannerText.setText(banner);

    const bn = hud.bossName as string;
    if (bn) {
      this.bossName.setText(bn);
      this.bossBarBg.setVisible(true);
      this.bossBar.setVisible(true);
      this.bossBar.width = 420 * Phaser.Math.Clamp((hud.bossHp as number) / (hud.bossMaxHp as number), 0, 1);
    } else {
      this.bossName.setText('');
      this.bossBarBg.setVisible(false);
      this.bossBar.setVisible(false);
    }

    this.drawMinimap(hud);
  }

  private setMapExpanded(v: boolean): void {
    this.mapExpanded = v;
    this.mapHint.setVisible(v);
    this.mapHint.setPosition(this.scale.width / 2, 14);
    this.minimap.setDepth(v ? 210 : 60);
    if (v) this.mapCloseZone.setInteractive();
    else this.mapCloseZone.disableInteractive();
  }

  private drawMinimap(hud: Record<string, unknown>): void {
    const g = this.minimap;
    g.clear();
    const exp = this.mapExpanded;
    const R = exp ? Math.min(this.scale.width, this.scale.height) * 0.42 : this.mmR;
    const cx = exp ? this.scale.width / 2 : this.mmC.x;
    const cy = exp ? this.scale.height / 2 : this.mmC.y;
    const dm = exp ? 1.8 : 1; // множитель размера точек
    if (exp) g.fillStyle(0x05060c, 0.82).fillRect(0, 0, this.scale.width, this.scale.height);
    const wc = GAMEPLAY.worldRadius; // мир центрирован в (wc, wc)
    const scale = R / wc;

    // фон + рамка
    g.fillStyle(0x0a0e18, 0.62).fillCircle(cx, cy, R + 3);
    g.lineStyle(2, 0x3a4a66, 0.9).strokeCircle(cx, cy, R + 3);
    // биом-кольца (от внешнего к внутреннему)
    const biome = [0x1c2233, 0x1a3a24, 0x233024, 0x352016, 0x1f2c3a, 0x241432];
    for (let i = RING_COUNT; i >= 1; i--) {
      g.fillStyle(biome[i], 0.55).fillCircle(cx, cy, ringOuterRadius(i) * scale);
    }
    for (let i = 1; i <= RING_COUNT; i++) {
      g.lineStyle(1, 0x000000, 0.4).strokeCircle(cx, cy, ringOuterRadius(i) * scale);
    }
    // хаб
    g.fillStyle(0x1c2740, 0.95).fillCircle(cx, cy, GAMEPLAY.hubRadius * scale);
    g.lineStyle(1, 0x4a7ac0, 0.9).strokeCircle(cx, cy, GAMEPLAY.hubRadius * scale);

    const toMap = (wx: number, wy: number): { x: number; y: number; out: boolean } => {
      let dx = (wx - wc) * scale;
      let dy = (wy - wc) * scale;
      const len = Math.hypot(dx, dy);
      let out = false;
      if (len > R) {
        dx = (dx / len) * R;
        dy = (dy / len) * R;
        out = true;
      }
      return { x: cx + dx, y: cy + dy, out };
    };

    // мобы
    const blips = (hud.blips as { x: number; y: number; elite: boolean }[]) ?? [];
    for (const b of blips) {
      const p = toMap(b.x, b.y);
      if (p.out) continue;
      g.fillStyle(b.elite ? 0xff8a3a : 0xd64550, 0.95).fillCircle(p.x, p.y, (b.elite ? 3.0 : 2.1) * dm);
    }
    // босс
    if (hud.hasBoss) {
      const p = toMap(hud.bossX as number, hud.bossY as number);
      g.fillStyle(0xff9a2a, 1).fillCircle(p.x, p.y, 4.4 * dm);
      g.lineStyle(2, 0xffd080, 0.9).strokeCircle(p.x, p.y, 6 * dm);
    }
    // игрок
    const pp = toMap(hud.px as number, hud.py as number);
    g.fillStyle(0xffffff, 1).fillCircle(pp.x, pp.y, 3.6 * dm);
    g.lineStyle(2, 0x8fc0ff, 0.95).strokeCircle(pp.x, pp.y, 5.6 * dm);
  }
}
