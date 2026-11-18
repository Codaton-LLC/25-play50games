// Local multiplayer modes as config (framework "Multiplayer"): co-op and versus race. A game reads
// the mode's switches; it never branches on the mode's name. Party arena comes later.
//
// Co-op combines powers: when one hero fires its power, dispatchAllyPower() calls the game's
// onAllyPower hook once for every other active player (co-op only), so e.g. Kiro's shield covers
// the group or Zuno's magnet pulls orbs for everyone. What a power does to an ally is the game's
// rule (it lives next to its rules.ts), the framework only decides who receives it.

export type ModeId = "coop" | "versus";

export interface ModeConfig {
   id: ModeId;
   label: string;
   /** one line for the join screen */
   blurb: string;
   /** two players may not pick the same hero */
   uniqueHeroes: boolean;
   /** a checkpoint reached by one hero is everyone's respawn point */
   sharedCheckpoints: boolean;
   /** a power also acts on allies (onAllyPower) */
   allyPowers: boolean;
   /** "team": one result for everyone (all must finish); "race": a podium by finish order */
   ranking: "team" | "race";
   /** race only: once the first hero finishes, the others get this long (ms) before the run ends */
   finishGraceMs: number;
}

export const MODES: Record<ModeId, ModeConfig> = {
   coop: {
      id: "coop",
      label: "Co-op",
      blurb: "Climb together. Powers help the whole team, checkpoints are shared, everyone must reach the goal.",
      uniqueHeroes: true,
      sharedCheckpoints: true,
      allyPowers: true,
      ranking: "team",
      finishGraceMs: 0,
   },
   versus: {
      id: "versus",
      label: "Versus race",
      blurb: "Same course, first to the goal wins. Orbs go to whoever grabs them first.",
      uniqueHeroes: false,
      sharedCheckpoints: false,
      allyPowers: false,
      ranking: "race",
      finishGraceMs: 15_000,
   },
};

export const MODE_IDS: readonly ModeId[] = ["coop", "versus"];

export function modeConfig(id: ModeId): ModeConfig {
   return MODES[id];
}

/** What onAllyPower receives. `Sim` is the game's per-player simulation (e.g. SkyRun). */
export interface AllyPowerEvent<Sim, Power extends string = string> {
   /** player index that fired */
   from: number;
   /** player index that receives it */
   to: number;
   power: Power;
   source: Sim;
   ally: Sim;
}

export type OnAllyPower<Sim, Power extends string = string> = (event: AllyPowerEvent<Sim, Power>) => void;

/**
 * Calls onAllyPower for every ally of player `from` (in index order), only when the mode combines
 * powers. `active[i] === false` skips a player (finished, dropped). Returns how many allies it reached.
 */
export function dispatchAllyPower<Sim, Power extends string>(
   mode: ModeConfig,
   sims: readonly Sim[],
   from: number,
   power: Power,
   onAllyPower: OnAllyPower<Sim, Power> | undefined,
   active?: readonly boolean[],
): number {
   if (!mode.allyPowers || !onAllyPower) return 0;
   let reached = 0;
   for (let to = 0; to < sims.length; to++) {
      if (to === from || active?.[to] === false) continue;
      onAllyPower({ from, to, power, source: sims[from], ally: sims[to] });
      reached++;
   }
   return reached;
}
