import { createHeroPick, defaultHeroFor } from "../../menu2/heroes/heroPick";
import type { M2HeroId } from "../../menu2/heroModels";
export type HeroId = M2HeroId;
export const DEFAULT_HERO = defaultHeroFor("snow-slide-dash");
export const HEROES = [
   { id: "riko" as const, name: "Riko", color: "#ef4444", powerLabel: "Pond dash", cooldownMs: 7000 },
   { id: "nami" as const, name: "Nami", color: "#3b82f6", powerLabel: "Ridge jump", cooldownMs: 5000 },
   { id: "kiro" as const, name: "Kiro", color: "#22c55e", powerLabel: "Snow shield", cooldownMs: 8000 },
   { id: "zuno" as const, name: "Zuno", color: "#facc15", powerLabel: "Creek magnet", cooldownMs: 6000 },
   { id: "vexa" as const, name: "Vexa", color: "#a78bfa", powerLabel: "Gully phase", cooldownMs: 7000 },
];
export const heroById = (id: HeroId) => HEROES.find((h) => h.id === id)!;
const pick = createHeroPick("snow-slide-dash");
export const pickedHero = pick.get;
export const selectHero = pick.set;
export const subscribeHero = pick.subscribe;
