// The five Color Roll Heroes in Color Boss Tower (World 6: the tag-switch, menu2/heroTag). All five
// climb together; the active hero's colour is yours, and the claws take only their own colour. The
// picked hero (menu2/heroes HeroPicker) is the one who starts the run; tag any of them in mid-run
// (keys 1-5, T for the next, or the portrait strip).
//
// - Riko (red): a dash (20 m/s for 0.3 s, 3 s recharge) across a gap or through the cracked window.
// - Nyla (blue): a second jump, fresh after every tag, up the two skip ledges to a high blue claw.
// - Kiro (green): a shield (1.5 s): the guardian's sweep and the hazard orbs bounce off.
// - Zuno (yellow): a magnet (3 s): charges a yellow claw high on the wall from 6 m.
// - Vexa (purple): a phase (0.8 s): through a hazard orb, and through the ghost panel to its niche.
import { createHeroPick } from "@/arcade3d/menu2/heroes/heroPick";
import type { TagHeroId } from "@/arcade3d/menu2/heroTag/rules";
import { POWER } from "./rules";

export type HeroId = TagHeroId;

export interface HeroDef {
   id: HeroId;
   name: string;
   color: string;
   powerLabel: string;
   cooldownMs: number;
}

export const HEROES: readonly HeroDef[] = [
   { id: "riko", name: "Riko", color: "#EF4444", powerLabel: "Dash", cooldownMs: POWER.riko.cooldown },
   { id: "nami", name: "Nyla", color: "#2563EB", powerLabel: "Double jump", cooldownMs: POWER.nami.cooldown },
   { id: "kiro", name: "Kiro", color: "#22C55E", powerLabel: "Shield", cooldownMs: POWER.kiro.cooldown },
   { id: "zuno", name: "Zuno", color: "#FACC15", powerLabel: "Magnet", cooldownMs: POWER.zuno.cooldown },
   { id: "vexa", name: "Vexa", color: "#8B5CF6", powerLabel: "Phase", cooldownMs: POWER.vexa.cooldown },
];

const BY_ID: Record<HeroId, HeroDef> = { riko: HEROES[0], nami: HEROES[1], kiro: HEROES[2], zuno: HEROES[3], vexa: HEROES[4] };

export function heroById(id: HeroId): HeroDef {
   return BY_ID[id];
}

const pick = createHeroPick("color-boss-tower");

export function pickedHero(): HeroId {
   return pick.get();
}

export function subscribeHero(fn: () => void): () => void {
   return pick.subscribe(fn);
}

export function selectHero(id: HeroId): void {
   pick.set(id);
}

export function resetHeroPick(): void {
   pick.reset();
}
