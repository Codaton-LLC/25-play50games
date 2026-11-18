import { describe, expect, it } from "vitest";
import { ALL_STARS, STAR_BIT } from "../stars/stars";
import {
   XP,
   applyLevelResult,
   emptyProgress,
   gameShards,
   gameStars,
   hasPlayed,
   isGameCleared,
   levelOf,
   levelXp,
   mergeProgress,
   parseProgress,
   totals,
   xpLevel,
   type LevelResult,
} from "./progress";
import { loadProgress, memoryProgressStorage, progressKey, recordLevelResult, syncProgress, type ProgressSync } from "./progressStore";

const WIN: LevelResult = {
   slug: "sky-tower-jump",
   level: 1,
   cleared: true,
   stars: STAR_BIT.clear | STAR_BIT.orbs,
   noHit: false,
   secrets: [{ id: "pad-sky", kind: "shard" }],
};

describe("applyLevelResult", () => {
   it("pays XP for firsts only", () => {
      const a = applyLevelResult(emptyProgress(), WIN, 1);
      expect(a.xpGained).toBe(XP.clear + 2 * XP.star + XP.shard);
      expect(a.firstClear).toBe(true);
      expect(a.newStars).toBe(STAR_BIT.clear | STAR_BIT.orbs);
      expect(a.newSecrets).toEqual(["pad-sky"]);
      // the same run again: nothing new
      const b = applyLevelResult(a.data, WIN, 2);
      expect(b.xpGained).toBe(0);
      expect(b.firstClear).toBe(false);
      expect(levelOf(b.data, WIN.slug, 1)).toMatchObject({ clears: 2, stars: 3, shards: ["pad-sky"] });
      // the goal star and a no-hit and a sticker later
      const c = applyLevelResult(b.data, { ...WIN, stars: STAR_BIT.clear | STAR_BIT.goal, noHit: true, secrets: [{ id: "gate", kind: "sticker" }] }, 3);
      expect(c.xpGained).toBe(XP.star + XP.noHit + XP.sticker);
      expect(c.firstNoHit).toBe(true);
      expect(levelOf(c.data, WIN.slug, 1)).toMatchObject({ stars: ALL_STARS, noHit: true, stickers: ["gate"] });
      expect(c.data.xp).toBe(a.xpGained + c.xpGained);
      expect(c.data.games[WIN.slug].xp).toBe(c.data.xp);
      expect(c.data.updatedAt).toBe(3);
   });

   it("a lost run earns no stars but keeps the secrets it found", () => {
      const r = applyLevelResult(emptyProgress(), { ...WIN, cleared: false, stars: ALL_STARS, noHit: true });
      expect(r.newStars).toBe(0);
      expect(r.xpGained).toBe(XP.shard);
      expect(levelOf(r.data, WIN.slug, 1)).toMatchObject({ stars: 0, clears: 0, noHit: false, shards: ["pad-sky"] });
   });

   it("never changes its input", () => {
      const before = emptyProgress();
      const copy = JSON.stringify(before);
      applyLevelResult(before, WIN);
      expect(JSON.stringify(before)).toBe(copy);
   });
});

describe("queries", () => {
   it("stars, shards, clears and totals", () => {
      let d = emptyProgress();
      for (const level of [1, 2, 3, 4, 5]) d = applyLevelResult(d, { ...WIN, level, stars: level === 5 ? ALL_STARS : STAR_BIT.clear }).data;
      expect(gameStars(d, WIN.slug)).toBe(7);
      expect(gameShards(d, WIN.slug)).toBe(5);
      expect(isGameCleared(d, WIN.slug, 5)).toBe(true);
      expect(isGameCleared(d, WIN.slug, 6)).toBe(false);
      expect(isGameCleared(d, "cloud-hopper", 5)).toBe(false);
      expect(hasPlayed(d, WIN.slug)).toBe(true);
      expect(hasPlayed(d, "cloud-hopper")).toBe(false);
      expect(totals(d)).toEqual({ xp: d.xp, stars: 7, shards: 5, stickers: 0 });
   });

   it("XP levels grow 10 % per level", () => {
      expect(xpLevel(0)).toEqual({ level: 1, into: 0, need: 500 });
      expect(xpLevel(499).level).toBe(1);
      expect(xpLevel(500)).toEqual({ level: 2, into: 0, need: 550 });
      expect(xpLevel(1049).level).toBe(2);
      expect(xpLevel(1050).level).toBe(3);
   });
});

describe("parseProgress", () => {
   it("survives junk and drops bad parts", () => {
      expect(parseProgress(null)).toEqual(emptyProgress());
      expect(parseProgress("{bad")).toEqual(emptyProgress());
      expect(parseProgress("[]")).toEqual(emptyProgress());
      const d = parseProgress(
         JSON.stringify({
            xp: -5,
            games: {
               "sky-tower-jump": { xp: 10, levels: { 1: { stars: 15, noHit: "yes", clears: 2.7, shards: ["a", "a", 3, ""] }, x: {} } },
               "Bad Slug": { levels: {} },
               "cloud-hopper": "nope",
            },
         }),
      );
      expect(d.xp).toBe(0);
      expect(Object.keys(d.games)).toEqual(["sky-tower-jump"]);
      expect(d.games["sky-tower-jump"].levels).toEqual({ 1: { stars: 7, noHit: false, clears: 2, shards: ["a"], stickers: [] } });
   });

   it("round-trips", () => {
      const d = applyLevelResult(emptyProgress(), WIN, 5).data;
      expect(parseProgress(JSON.stringify(d))).toEqual(d);
   });
});

describe("mergeProgress (future sync)", () => {
   it("unions stars and secrets, recomputes XP without double pay", () => {
      const a = applyLevelResult(emptyProgress(), WIN, 1).data;
      const b = applyLevelResult(emptyProgress(), { ...WIN, stars: STAR_BIT.clear | STAR_BIT.goal, secrets: [{ id: "ledge", kind: "shard" }] }, 2).data;
      const m = mergeProgress(a, b);
      const l = levelOf(m, WIN.slug, 1)!;
      expect(l.stars).toBe(ALL_STARS);
      expect(l.shards.sort()).toEqual(["ledge", "pad-sky"]);
      expect(m.xp).toBe(levelXp(l));
      expect(m.xp).toBe(XP.clear + 3 * XP.star + 2 * XP.shard);
      expect(mergeProgress(m, m)).toEqual(m);
      expect(m.updatedAt).toBe(2);
   });
});

describe("progressStore", () => {
   it("keys follow core/scores.ts (guest / u<id>)", () => {
      expect(progressKey(null)).toBe("play50games_m2_progress:guest");
      expect(progressKey(42)).toBe("play50games_m2_progress:u42");
   });

   it("records through the adapter, per user", () => {
      const s = memoryProgressStorage();
      const r = recordLevelResult(null, WIN, s);
      expect(r.firstClear).toBe(true);
      expect(Object.keys(s.items)).toEqual(["play50games_m2_progress:guest"]);
      expect(loadProgress(null, s)).toEqual(r.data);
      expect(loadProgress(7, s)).toEqual(emptyProgress());
      expect(recordLevelResult(null, WIN, s).xpGained).toBe(0);
   });

   it("sync merges the account copy and saves it; a failing pull keeps local", async () => {
      const s = memoryProgressStorage();
      recordLevelResult(7, WIN, s);
      const remote = applyLevelResult(emptyProgress(), { ...WIN, level: 2 }).data;
      const sync: ProgressSync = { pull: async () => remote, push: async () => undefined };
      const merged = await syncProgress(7, s, sync);
      expect(Object.keys(merged.games[WIN.slug].levels).sort()).toEqual(["1", "2"]);
      expect(loadProgress(7, s)).toEqual(merged);
      const failing: ProgressSync = { pull: async () => Promise.reject(new Error("offline")), push: async () => undefined };
      expect(await syncProgress(7, s, failing)).toEqual(merged);
   });
});
