import { SaveData } from "./types";

const KEY = "blochit.save";

const fresh = (): SaveData => ({ unlocked: [1], completed: [], starred: [], discovered: [], seen: [] });

export function loadProgress(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const d = JSON.parse(raw) as Partial<SaveData>;
    return {
      unlocked: Array.from(new Set([1, ...(d.unlocked ?? [])])),
      completed: d.completed ?? [],
      starred: d.starred ?? [],
      discovered: d.discovered ?? [],
      seen: d.seen ?? [],
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

/** Marks encyclopedia entries as discovered; returns the ids that are new. */
export function discover(ids: string[]): string[] {
  const d = loadProgress();
  const fresh = ids.filter((id) => !d.discovered.includes(id));
  if (fresh.length) {
    d.discovered = [...d.discovered, ...fresh];
    save(d);
  }
  return fresh;
}

export function markSeen(id: string): void {
  const d = loadProgress();
  if (d.seen.includes(id)) return;
  d.seen = [...d.seen, id];
  save(d);
}

export const totalStars = (d: SaveData) => d.starred.length;
export const isUnlocked = (d: SaveData, id: number) => d.unlocked.includes(id);

export function resetProgress(): void {
  save(fresh());
}
