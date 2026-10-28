import { describe, expect, it } from "vitest";
import { defaultHeroFor } from "@/arcade3d/menu2/heroes/heroPick";
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";
import { DEFAULT_HERO, HEROES, pickedHero, resetHeroPick, selectHero } from "./heroes";

describe("hero pick", () => {
   it("World 1 leads with Riko, and each hero has its own model", () => {
      resetHeroPick();
      expect(DEFAULT_HERO).toBe("riko");
      expect(defaultHeroFor("color-city-sprint")).toBe("riko");
      expect(pickedHero()).toBe("riko");
      selectHero("vexa");
      expect(pickedHero()).toBe("vexa");
      resetHeroPick();
      const urls = new Set(HEROES.map((h) => heroModelAsset(h.id).url));
      expect(urls.size).toBe(5);
   });
});
