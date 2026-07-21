import Phaser from 'phaser';

// Генерация placeholder-текстур (круги/квадраты/кольца) — тинтуются на инстансах.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.makeCircle('circle', 64);
    this.makeCircle('circleSoft', 64, 0.85);
    this.makeSquare('square', 64);
    this.makeRing('ring', 128, 6);
    this.makeTriangle('triangle', 48);

    this.scene.start('StartRoll');
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

  private makeTriangle(key: string, size: number): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(size / 2, 0, size, size, 0, size);
    g.generateTexture(key, size, size);
    g.destroy();
  }
}
