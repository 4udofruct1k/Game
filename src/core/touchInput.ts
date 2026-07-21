// Общий синглтон сенсорного ввода. UIScene пишет, WorldScene читает/потребляет.
export interface TouchInput {
  enabled: boolean; // устройство с тачем (показывать экранные контролы)
  moveX: number; // -1..1
  moveY: number;
  moving: boolean;
  // одноразовые нажатия (edge-triggered)
  dash: boolean;
  skill: boolean;
  ult: boolean;
  heal: boolean;
  hub: boolean;
  menu: boolean;
}

export const touch: TouchInput = {
  enabled: false,
  moveX: 0,
  moveY: 0,
  moving: false,
  dash: false,
  skill: false,
  ult: false,
  heal: false,
  hub: false,
  menu: false,
};

// Потребить одноразовое нажатие (сбрасывает флаг).
export function consumeTouch(key: 'dash' | 'skill' | 'ult' | 'heal' | 'hub' | 'menu'): boolean {
  if (touch[key]) {
    touch[key] = false;
    return true;
  }
  return false;
}

export function resetTouchMove(): void {
  touch.moveX = 0;
  touch.moveY = 0;
  touch.moving = false;
}
