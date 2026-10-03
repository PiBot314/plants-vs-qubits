import { describe, expect, it } from "vitest";
import content from "../src/data/content.json";
import entries from "../src/data/encyclopedia.json";

const ids = new Set(entries.map((e) => e.id));

describe("encyclopedia data", () => {
  it("has unique ids and Wikipedia links", () => {
    expect(ids.size).toBe(entries.length);
    for (const e of entries) expect(e.wiki).toMatch(/^https:\/\/en\.wikipedia\.org\/wiki\//);
  });

  it("every [[term]] link in content.json points at an entry introduced by then", () => {
    for (const c of content) {
      for (const m of c.text.matchAll(/\[\[([a-z0-9_-]+)(?:\|[^\]]+)?\]\]/gi)) {
        const entry = entries.find((e) => e.id === m[1]);
        expect(entry, `level ${c.level}: unknown term "${m[1]}"`).toBeDefined();
        expect(entry!.level, `level ${c.level}: "${m[1]}" isn't unlocked yet`).not.toBeNull();
        expect(entry!.level!).toBeLessThanOrEqual(c.level);
      }
    }
  });
});
