import { createHeroPick, defaultHeroFor } from "@/arcade3d/menu2/heroes/heroPick";
import type { M2HeroId } from "@/arcade3d/menu2/heroModels";
export type HeroId = M2HeroId;
export const HEROES = [
   { id: "riko" as const, name: "Riko", color: "#ef4444", powerLabel: "Cell dash", cooldownMs: 5000 },
   { id: "nami" as const, name: "Nami", color: "#3b82f6", powerLabel: "Double jump", cooldownMs: 2500 },
   { id: "kiro" as const, name: "Kiro", color: "#22c55e", powerLabel: "Laser shield", cooldownMs: 9000 },
   { id: "zuno" as const, name: "Zuno", color: "#facc15", powerLabel: "Cell magnet", cooldownMs: 7000 },
   { id: "vexa" as const, name: "Vexa", color: "#a78bfa", powerLabel: "Maintenance phase", cooldownMs: 7000 },
];
export const DEFAULT_HERO = defaultHeroFor("robot-factory-run");
export const heroById = (id: HeroId) => HEROES.find((h) => h.id === id)!;
const pick = createHeroPick("robot-factory-run");
export const pickedHero = pick.get;
export const subscribeHero = pick.subscribe;
export const selectHero = pick.set;
