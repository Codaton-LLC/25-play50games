import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { colorMatchJumpMeta } from "./meta";
import { LEVEL_IDS } from "../../types";
import { LIMITS } from "./rules";

describe("Color Match Jump registration", () => {
   it("keeps the title, the five levels, the order and the enabled backend entry in sync", () => {
      const wp = JSON.parse(readFileSync(new URL("../../../../../play50games-backend/play50games/includes/arcade-games.json", import.meta.url), "utf8"));
      const entry = wp.games["color-match-jump"];
      expect(entry.title).toBe(colorMatchJumpMeta.title);
      expect(entry.enabled).toBe(true);
      expect(entry.kind).toBe("time");
      expect(entry.levels.map((l: { title: string }) => l.title)).toEqual(colorMatchJumpMeta.levels!.map((l) => l.title));
      expect(entry.levels.map((l: { max_score: number; min_duration_ms: number; max_duration_ms: number; time_base_ms: number }) => [l.max_score, l.min_duration_ms, l.max_duration_ms, l.time_base_ms])).toEqual(
         LEVEL_IDS.map((id) => [LIMITS[id].maxScore, LIMITS[id].minDurationMs, LIMITS[id].maxDurationMs, LIMITS[id].timeBaseMs]),
      );
      expect(colorMatchJumpMeta.order).toBe(92);
      expect(colorMatchJumpMeta.status).toBe("live");
   });
});
