// The picker updates the hero live: selectHero notifies subscribers (the Scene re-makes its run, so the
// start card and the intro show the picked hero before Play) and does nothing when the pick is unchanged.
// Each hero id maps to its own GLB (menu2/heroModels.ts). This file does not tint one mesh.
import { afterEach, describe, expect, it } from "vitest";
import { M2_HERO_IDS, heroModelAsset } from "@/arcade3d/menu2/heroModels";
import { DEFAULT_HERO, HEROES, pickedHero, selectHero, subscribeHero } from "./heroes";

describe("cloud-hopper: live hero pick", () => {
   afterEach(() => selectHero(DEFAULT_HERO));

   it("World 2's lead, Nami, is preselected", () => {
      expect(DEFAULT_HERO).toBe("nami");
      expect(pickedHero()).toBe("nami");
   });

   it("notifies a subscriber on a new pick, not on the same pick, and stops after unsubscribe", () => {
      let calls = 0;
      const off = subscribeHero(() => calls++);
      selectHero("zuno");
      expect(pickedHero()).toBe("zuno");
      expect(calls).toBe(1);
      selectHero("zuno");
      expect(calls).toBe(1);
      selectHero("vexa");
      expect(calls).toBe(2);
      off();
      selectHero("kiro");
      expect(calls).toBe(2);
      expect(pickedHero()).toBe("kiro");
   });

   it("gives every hero their own GLB and keeps the picker colour as a swatch only", () => {
      const urls = M2_HERO_IDS.map((id) => heroModelAsset(id).url);
      expect(new Set(urls).size).toBe(5);
      expect(HEROES.map((h) => h.id)).toEqual([...M2_HERO_IDS]);
      for (const id of M2_HERO_IDS) expect(heroModelAsset(id).url).toContain(`m2Hero`);
      expect(urls.some((url) => url === urls[0] && urls.filter((u) => u === url).length > 1)).toBe(false);
   });
});
