import { createHeroPick } from "../../menu2/heroes/heroPick";
import type { M2HeroId } from "../../menu2/heroModels";
export type HeroId = M2HeroId;
export const HEROES = [
   { id: "riko", name: "Riko", color: "#ef4444", powerLabel: "Break vent" },
   { id: "nami", name: "Nami", color: "#2563eb", powerLabel: "High ledge" },
   { id: "kiro", name: "Kiro", color: "#22c55e", powerLabel: "Shock shield" },
   { id: "zuno", name: "Zuno", color: "#facc15", powerLabel: "Orb magnet" },
   { id: "vexa", name: "Vexa", color: "#8b5cf6", powerLabel: "Phase duct" },
] as const;
const pick = createHeroPick("wind-tunnel-escape");
export const pickedHero = () => pick.get();
export const subscribeHero = (fn: () => void) => pick.subscribe(fn);
export const selectHero = (id: HeroId) => pick.set(id);
