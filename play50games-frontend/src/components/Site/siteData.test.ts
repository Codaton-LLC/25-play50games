import { describe, expect, it } from "vitest";
import { ARCADE_GAMES, getGameMeta } from "@/arcade3d/registry";
import { SQUAD, WORLDS, toSiteGame } from "./siteData";

describe("site worlds", () => {
   it("names the third world Pangoroll Worlds and links its own page", () => {
      expect(WORLDS.squad).toMatchObject({ label: "Pangoroll Worlds", title: "Pangoroll Worlds", href: "/pangoroll-worlds" });
      expect(Object.values(WORLDS).map((world) => world.label).join(" ")).not.toMatch(/squad/i);
   });

   it("lists the five heroes with their powers", () => {
      expect(SQUAD.map((hero) => `${hero.name} ${hero.ability}`)).toEqual([
         "Riko Dash",
         "Nyla Double Jump",
         "Kiro Shield",
         "Zuno Coin Magnet",
         "Vexa Phase",
      ]);
   });

   it("tags every slim game with its world: 50 in the 3D Arcade, the rollheroes in Pangoroll Worlds", () => {
      expect(toSiteGame(getGameMeta("robot-collector")!).world).toBe("arcade");
      expect(toSiteGame(getGameMeta("sky-tower-jump")!).world).toBe("squad");
      const slim = ARCADE_GAMES.map(toSiteGame);
      expect(slim.filter((game) => game.world === "arcade")).toHaveLength(50);
      expect(slim.filter((game) => game.world === "squad")).toHaveLength(
         ARCADE_GAMES.filter((game) => game.collection === "rollheroes").length,
      );
   });
});
