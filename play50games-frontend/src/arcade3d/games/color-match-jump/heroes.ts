// The five Color Roll Heroes in Color Match Jump (World 6: the whole squad plays every level). The
// active hero's colour is the player's colour: tag a hero in (keys 1-5, T cycles, or the portrait
// strip) so the right colour touches down. The picked hero leads (starts the level).
// Powers (E / Enter / Power):
// - Riko red: a dash. In the air it carries the jump two hexes further (the void lines); on the
//   ground it is a three-hex dash hop.
// - Nami blue: the double jump (Space again in the air, or Power): clears the 4 m pillars and the golem.
// - Kiro green: a shield (1.5 s) to cross the lightning curtains.
// - Zuno yellow: a magnet (3 s) that pulls the floating orb trails in from 6 m.
// - Vexa purple: a phase (0.8 s) to pass and land through ghost pillars.
import { createHeroPick } from "../../menu2/heroes/heroPick";
import type { M2HeroId } from "../../menu2/heroModels";

export type HeroId = M2HeroId;

export interface HeroDef {
   id: HeroId;
   name: string;
   color: string;
   /** a colour-blind glyph name (the card's accessibility rule) */
   glyph: "chevron" | "wave" | "hexagon" | "horseshoe" | "spiral";
   powerLabel: string;
   cooldownMs: number;
   /** how long a timed power runs (ms; 0 = instant) */
   powerMs: number;
}

/** Index = colour index in the rules (0 red .. 4 purple). */
export const HEROES: readonly HeroDef[] = [
   { id: "riko", name: "Riko", color: "#EF4444", glyph: "chevron", powerLabel: "Dash", cooldownMs: 3000, powerMs: 0 },
   { id: "nami", name: "Nami", color: "#2563EB", glyph: "wave", powerLabel: "Double jump", cooldownMs: 0, powerMs: 0 },
   { id: "kiro", name: "Kiro", color: "#22C55E", glyph: "hexagon", powerLabel: "Shield", cooldownMs: 5000, powerMs: 1500 },
   { id: "zuno", name: "Zuno", color: "#FACC15", glyph: "horseshoe", powerLabel: "Magnet", cooldownMs: 7000, powerMs: 3000 },
   { id: "vexa", name: "Vexa", color: "#8B5CF6", glyph: "spiral", powerLabel: "Phase", cooldownMs: 5000, powerMs: 800 },
];

export const heroIndex = (id: HeroId): number => HEROES.findIndex((h) => h.id === id);

const pick = createHeroPick("color-match-jump");
export const pickedHero = pick.get;
export const selectHero = pick.set;
export const subscribeHero = pick.subscribe;
