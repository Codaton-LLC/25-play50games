import { createHeroPick, defaultHeroFor } from "@/arcade3d/menu2/heroes/heroPick";
import type { M2HeroId } from "@/arcade3d/menu2/heroModels";
export type HeroId = M2HeroId;
export const HEROES = [
   { id: "kiro" as const, name: "Kiro", color: "#22c55e", powerLabel: "Shield" },
   { id: "riko" as const, name: "Riko", color: "#ef4444", powerLabel: "Dash" },
   { id: "nami" as const, name: "Nami", color: "#2563eb", powerLabel: "Double jump" },
   { id: "zuno" as const, name: "Zuno", color: "#facc15", powerLabel: "Magnet" },
   { id: "vexa" as const, name: "Vexa", color: "#8b5cf6", powerLabel: "Phase" },
];
export const DEFAULT_HERO = defaultHeroFor("temple-lantern-jump");
const pick = createHeroPick("temple-lantern-jump");
export const pickedHero = pick.get;
export const subscribeHero = pick.subscribe;
export const selectHero = pick.set;
