// localStorage: миры (сейв=пауза/продолжение) + рекорды (§0, §10). Пермадеч — без меты.
import type { Rarity } from '../data/rarity';

const WORLDS_KEY = 'rr_worlds_v1';
const RECORDS_KEY = 'rr_records_v1';

// Снимок мира для продолжения. Хранит стартовый сид + прогресс.
export interface WorldSave {
  id: string;
  seedText: string;
  classId: string;
  classRarity: Rarity;
  createdAt: number;
  updatedAt: number;
  // прогресс
  level: number;
  xp: number;
  gold: number;
  evolutionStage: number;
  bossesKilled: string[];
  playtimeMs: number;
  allocatedTalents: string[];
  allocatedSkills: string[];
  talentPoints: number;
  skillPoints: number;
  dead: boolean;
}

export interface RecordEntry {
  classId: string;
  classRarity: Rarity;
  timeMs: number;
  level: number;
  bossesKilled: number;
  seedText: string;
  date: number;
  victory: boolean;
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* хранилище недоступно — молча пропускаем */
  }
}

export function listWorlds(): WorldSave[] {
  return readJSON<WorldSave[]>(WORLDS_KEY, []).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveWorld(world: WorldSave): void {
  const worlds = readJSON<WorldSave[]>(WORLDS_KEY, []);
  const idx = worlds.findIndex((w) => w.id === world.id);
  world.updatedAt = Date.now();
  if (idx >= 0) worlds[idx] = world;
  else worlds.push(world);
  writeJSON(WORLDS_KEY, worlds);
}

export function deleteWorld(id: string): void {
  const worlds = readJSON<WorldSave[]>(WORLDS_KEY, []).filter((w) => w.id !== id);
  writeJSON(WORLDS_KEY, worlds);
}

export function getWorld(id: string): WorldSave | undefined {
  return readJSON<WorldSave[]>(WORLDS_KEY, []).find((w) => w.id === id);
}

export function listRecords(): RecordEntry[] {
  return readJSON<RecordEntry[]>(RECORDS_KEY, []).sort((a, b) => {
    // победы выше; среди побед — по времени
    if (a.victory !== b.victory) return a.victory ? -1 : 1;
    return a.timeMs - b.timeMs;
  });
}

export function addRecord(rec: RecordEntry): void {
  const records = readJSON<RecordEntry[]>(RECORDS_KEY, []);
  records.push(rec);
  writeJSON(RECORDS_KEY, records);
}

export function newWorldId(): string {
  return `w_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}
