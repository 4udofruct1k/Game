import Phaser from 'phaser';

// Применить спрайт-текстуру к сущности с фолбэком на цветной круг.
// radius — «игровой» радиус (примерно половина желаемого размера).
export function applySprite(
  obj: Phaser.Physics.Arcade.Image,
  key: string,
  fallbackTint: number,
  radius: number,
  scaleMul = 2.9,
): void {
  const body = obj.body as Phaser.Physics.Arcade.Body;
  if (obj.scene.textures.exists(key)) {
    obj.setTexture(key);
    obj.clearTint();
    const fw = obj.width;
    const fh = obj.height;
    const target = radius * scaleMul;
    const s = target / Math.max(fw, fh);
    obj.setScale(s);
    // тело-круг ~ по меньшей стороне спрайта (в исходных пикселях)
    const br = Math.min(fw, fh) * 0.42;
    body.setCircle(br, fw / 2 - br, fh / 2 - br);
  } else {
    obj.setTexture('circle');
    obj.setTint(fallbackTint);
    obj.setScale(1);
    obj.setDisplaySize(radius * 2, radius * 2);
    body.setCircle(32, 0, 0);
  }
}
