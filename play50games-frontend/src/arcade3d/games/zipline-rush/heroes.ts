import { createHeroPick } from "../../menu2/heroes/heroPick";
import type { M2HeroId } from "../../menu2/heroModels";
export const HEROES = [
   { id: "riko" as const, name: "Riko", color: "#ef4444", powerLabel: "Air dash · cracked stair" },
   { id: "nami" as const, name: "Nami", color: "#3b82f6", powerLabel: "Double jump · express cable" },
   { id: "kiro" as const, name: "Kiro", color: "#22c55e", powerLabel: "Shield · spark storm" },
   { id: "zuno" as const, name: "Zuno", color: "#facc15", powerLabel: "Magnet · parallel orbs" },
   { id: "vexa" as const, name: "Vexa", color: "#a78bfa", powerLabel: "Phase · ghost signal" },
];
const pick = createHeroPick("zipline-rush");
export const pickedHero = () => pick.get();
export const subscribeHero = (fn: () => void) => pick.subscribe(fn);
export const selectHero = (id: M2HeroId) => pick.set(id);
