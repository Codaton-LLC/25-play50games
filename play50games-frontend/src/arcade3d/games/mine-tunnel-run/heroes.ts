import { createHeroPick } from "../../menu2/heroes/heroPick";
import type { M2HeroId } from "../../menu2/heroModels";

// The shared Menu 2 hero pick for this game (World 1: Riko leads, defaultHeroFor).
export const HEROES = [
   { id: "riko" as const, name: "Riko", color: "#ef4444", powerLabel: "Dash bore · smash cracked rock" },
   { id: "nami" as const, name: "Nami", color: "#3b82f6", powerLabel: "Double jump · high air pockets" },
   { id: "kiro" as const, name: "Kiro", color: "#22c55e", powerLabel: "Shield · boulders, gas, floods" },
   { id: "zuno" as const, name: "Zuno", color: "#facc15", powerLabel: "Magnet · orbs through rock" },
   { id: "vexa" as const, name: "Vexa", color: "#a78bfa", powerLabel: "Phase · ghost-rock shafts" },
];
const pick = createHeroPick("mine-tunnel-run");
export const pickedHero = () => pick.get();
export const subscribeHero = (fn: () => void) => pick.subscribe(fn);
export const selectHero = (id: M2HeroId) => pick.set(id);
