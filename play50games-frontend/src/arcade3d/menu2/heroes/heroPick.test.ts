// The Menu 2 default hero per world and the remembered pick per game.
import { beforeEach, describe, expect, it } from "vitest";
import { WORLDS } from "../worldMap/worlds";
import { HERO_PICK_KEY, createHeroPick, defaultHeroFor, initialHeroFor, memoryHeroStorage, parseHeroPicks, rememberHeroPick, setHeroPickStorage } from "./heroPick";

describe("defaultHeroFor", () => {
   beforeEach(() => setHeroPickStorage(memoryHeroStorage()));

   it("each world's games default to its lead hero: W1 Riko, W2 Nami, W3 Kiro, W4 Zuno, W5 Vexa", () => {
      const lead = { 1: "riko", 2: "nami", 3: "kiro", 4: "zuno", 5: "vexa" } as const;
      for (const w of WORLDS) {
         if (w.id === 6) continue;
         for (const g of w.games) expect(defaultHeroFor(g.slug)).toBe(lead[w.id]);
      }
      expect(defaultHeroFor("sky-tower-jump")).toBe("nami");
   });

   it("W6 takes the player's last pick anywhere, or Riko; an unknown slug is Riko", () => {
      const w6 = WORLDS.find((w) => w.id === 6)!.games[0].slug;
      expect(defaultHeroFor(w6)).toBe("riko");
      rememberHeroPick("cloud-hopper", "zuno");
      expect(defaultHeroFor(w6)).toBe("zuno");
      expect(defaultHeroFor("not-a-menu2-game")).toBe("riko");
   });
});

describe("the remembered pick", () => {
   beforeEach(() => setHeroPickStorage(memoryHeroStorage()));

   it("the player's own last pick in a game wins over its default, per game", () => {
      expect(initialHeroFor("sky-tower-jump")).toBe("nami");
      rememberHeroPick("sky-tower-jump", "kiro");
      expect(initialHeroFor("sky-tower-jump")).toBe("kiro");
      expect(initialHeroFor("cloud-hopper")).toBe("nami"); // another W2 game keeps its own default
   });

   it("createHeroPick: lazy default, set remembers and tells listeners once per change, survives a reload", () => {
      const store = memoryHeroStorage();
      setHeroPickStorage(store);
      const pick = createHeroPick("sky-tower-jump");
      expect(pick.get()).toBe("nami");
      let calls = 0;
      const off = pick.subscribe(() => calls++);
      pick.set("vexa");
      pick.set("vexa");
      expect(calls).toBe(1);
      off();
      expect(parseHeroPicks(store.items[HERO_PICK_KEY])).toEqual({ last: "vexa", bySlug: { "sky-tower-jump": "vexa" } });
      const reloaded = createHeroPick("sky-tower-jump");
      expect(reloaded.get()).toBe("vexa");
   });

   it("bad stored data is ignored", () => {
      setHeroPickStorage(memoryHeroStorage({ [HERO_PICK_KEY]: '{"last":"bob","bySlug":{"sky-tower-jump":"x","cloud-hopper":"kiro"}}' }));
      expect(initialHeroFor("sky-tower-jump")).toBe("nami");
      expect(initialHeroFor("cloud-hopper")).toBe("kiro");
      setHeroPickStorage(memoryHeroStorage({ [HERO_PICK_KEY]: "{oops" }));
      expect(initialHeroFor("sky-tower-jump")).toBe("nami");
   });
});
