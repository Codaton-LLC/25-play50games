import { describe, expect, it } from "vitest";
import {
   collectSecret,
   copySecretTracker,
   countKinds,
   createSecretTracker,
   foundIds,
   foundMask,
   idsFromMask,
   secretKey,
   secretProblems,
   type SecretSpec,
} from "./secrets";

const LIST: SecretSpec[] = [
   { id: "pad-sky", kind: "shard", name: "Sky shard", hero: "nami" },
   { id: "ledge", kind: "shard", name: "Ledge shard" },
   { id: "gate", kind: "sticker", name: "Gate sticker" },
];

describe("secrets", () => {
   it("validates a level's list", () => {
      expect(secretProblems(LIST)).toEqual([]);
      expect(secretProblems([])).toHaveLength(1);
      expect(secretProblems([...LIST, { id: "x", kind: "shard", name: "X" }])).toHaveLength(1);
      expect(secretProblems([LIST[0], { ...LIST[0] }])).toEqual(['duplicate id "pad-sky"']);
      expect(secretProblems([{ id: "Bad Id", kind: "shard", name: "" }])).toHaveLength(2);
   });

   it("collects once, reports ids, masks and kinds", () => {
      const t = createSecretTracker(LIST);
      expect(collectSecret(t, 2)).toBe(true);
      expect(collectSecret(t, 2)).toBe(false);
      expect(collectSecret(t, 9)).toBe(false);
      expect(collectSecret(t, 0)).toBe(true);
      expect(t.count).toBe(2);
      expect(foundIds(LIST, t)).toEqual(["pad-sky", "gate"]);
      expect(foundMask(t)).toBe(0b101);
      expect(idsFromMask(LIST, 0b101)).toEqual(["pad-sky", "gate"]);
      expect(countKinds(LIST, ["gate", "pad-sky", "nope"])).toEqual({ shards: 1, stickers: 1 });
      const c = createSecretTracker(LIST);
      copySecretTracker(t, c);
      expect(foundIds(LIST, c)).toEqual(["pad-sky", "gate"]);
   });

   it("keys are slug:level:id", () => {
      expect(secretKey("sky-tower-jump", 2, "ledge")).toBe("sky-tower-jump:2:ledge");
   });
});
