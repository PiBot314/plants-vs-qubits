import entriesJson from "../data/encyclopedia.json";
import { discover, loadProgress } from "./progress";
import { EncyclopediaEntry } from "./types";

export const ENTRIES = entriesJson as unknown as EncyclopediaEntry[];

export const getEntry = (id: string) => ENTRIES.find((e) => e.id === id);

/** Unlocks every entry introduced at or before `levelId`; returns the newly unlocked entries. */
export function discoverForLevel(levelId: number): EncyclopediaEntry[] {
  const ids = ENTRIES.filter((e) => e.level !== null && e.level <= levelId).map((e) => e.id);
  const fresh = discover(ids);
  return ENTRIES.filter((e) => fresh.includes(e.id));
}

export function isDiscovered(id: string): boolean {
  return loadProgress().discovered.includes(id);
}

/** True if any discovered entry hasn't been opened yet. */
export function hasUnseen(): boolean {
  const d = loadProgress();
  return d.discovered.some((id) => !d.seen.includes(id));
}
