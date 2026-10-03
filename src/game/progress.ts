import { SaveData } from "./types";

const KEY = "blochit.save";

const fresh = (): SaveData => ({ unlocked: [1], completed: [], starred: [] });

export function loadProgress(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const d = JSON.parse(raw) as Partial<SaveData>;
    return {
      unlocked: Array.from(new Set([1, ...(d.unlocked ?? [])])),
      completed: d.completed ?? [],
      starred: d.starred ?? [],
    };
  } catch {
    return fresh();
  }
}

function save(d: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* storage unavailable: progress is session-only */
  }
}

const addUnique = (arr: number[], v: number) => (arr.includes(v) ? arr : [...arr, v]);

/** Records a completed level, its star, and unlocks the next level. */
export function recordWin(levelId: number, starred: boolean, nextId?: number): SaveData {
  const d = loadProgress();
  d.completed = addUnique(d.completed, levelId);
  if (starred) d.starred = addUnique(d.starred, levelId);
  if (nextId !== undefined) d.unlocked = addUnique(d.unlocked, nextId);
  save(d);
  return d;
}

export const totalStars = (d: SaveData) => d.starred.length;
export const isUnlocked = (d: SaveData, id: number) => d.unlocked.includes(id);

export function resetProgress(): void {
  save(fresh());
}
