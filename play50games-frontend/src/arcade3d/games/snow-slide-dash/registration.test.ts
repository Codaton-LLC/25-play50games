import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { snowSlideDashMeta } from "./meta";
import { defaultHeroFor } from "../../menu2/heroes/heroPick";

describe("Snow Slide Dash registration", () => {
   it("keeps the game title, levels, disabled backend and World 4 lead in sync", () => {
      const wp = JSON.parse(readFileSync(new URL("../../../../../play50games-backend/play50games/includes/arcade-games.json", import.meta.url), "utf8"));
      const entry = wp.games["snow-slide-dash"];
      expect(entry.title).toBe(snowSlideDashMeta.title);
      expect(entry.enabled).toBe(false);
      expect(entry.levels.map((l: { title: string }) => l.title)).toEqual(snowSlideDashMeta.levels!.map((l) => l.title));
      expect(snowSlideDashMeta.order).toBe(80);
      expect(defaultHeroFor("snow-slide-dash")).toBe("zuno");
   });
});
