// What to do next, as one line for the hint (Hud.tsx). Purely visual: it reads the stats the Scene
// already writes (and the level's map) and never changes the run.
import type { HintTone } from "@/arcade3d/core/hud/hintTiming";
import type { IslandMap } from "./maps";

export interface Hint {
   text: string;
   tone: HintTone;
}

/** Map pieces in the first `found` finds of a chain. */
export const mapPiecesIn = (map: IslandMap | undefined, found: number) => (map?.chain ?? []).slice(0, found).filter((t) => t === "map").length;

/** Map pieces a chain level has in all. */
export const mapPiecesOf = (map: IslandMap | undefined) => mapPiecesIn(map, Infinity);

const finds = (n: number) => (n === 1 ? "1 more find opens it" : `${n} more finds open it`);

/** The line for `found` of `total` finds; a map level adds its gates and its clue → map → chest chain. */
export function hintFor(found: number, total: number, map?: IslandMap): Hint {
   if (found >= total) return { text: "Every treasure found!", tone: "ready" };
   const chain = Boolean(map?.chain);
   if (chain && found === total - 1) return { text: "Map complete! Follow the red X to the final chest, then hold Dig", tone: "ready" };
   if (found <= 0) {
      if (chain) return { text: "Walk until the detector ring turns gold, then hold Dig: the first find is a clue", tone: "info" };
      return { text: "Walk until the detector ring turns gold and pulses fast, then hold Dig", tone: "info" };
   }
   // a gate that opens with the whole map (Pirate Peak's rockfall) is told by the chain's lines
   const shut = map?.gates.find((g) => g.opensAfter > found && !(chain && g.opensAfter >= total - 1));
   if (shut) return { text: `${shut.label}: ${finds(shut.opensAfter - found)}`, tone: "warn" };
   if (chain) {
      const pieces = mapPiecesIn(map, found);
      const all = mapPiecesOf(map);
      const last = map!.chain![found - 1];
      if (last === "clue") return { text: `A clue! The gull circles over the next spot. Map ${pieces}/${all}`, tone: "info" };
      const rockfall = map!.gates.some((g) => g.opensAfter >= total - 1);
      return { text: `Map ${pieces}/${all}: find every piece to ${rockfall ? "clear the way to" : "reveal"} the final chest`, tone: "info" };
   }
   return { text: `${found} of ${total} found: keep sweeping until the ring turns gold, then hold Dig`, tone: "info" };
}
