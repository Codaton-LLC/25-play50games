// Shared by tools/thumbs/capture.mjs and tools/perf: the arcade slugs and each game's input script.
// Plain Node, no dependencies.
//
// Slugs come from play50games-frontend/src/arcade3d/types.ts (ARCADE_SLUGS), so a new game needs no
// change here. Input scripts, in this order:
//   1. tools/thumbs/inputs/<slug>.mjs   default export (or `steps`): the step array; owned by the game's owner
//   2. tools/thumbs/inputs.mjs          INPUT_SCRIPTS[slug] (the original ten)
//   3. GENERIC_SCRIPT                   idle, a few arrow presses and taps (any control scheme does something)
// Step shapes: see the top of inputs.mjs.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { INPUT_SCRIPTS } from "./inputs.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TYPES_TS = path.resolve(HERE, "../../play50games-frontend/src/arcade3d/types.ts");

/** Every slug in ARCADE_SLUGS, in registry order. */
export function arcadeSlugs() {
   const source = readFileSync(TYPES_TS, "utf8");
   const block = source.match(/export const ARCADE_SLUGS = \[([\s\S]*?)\] as const;/);
   if (!block) throw new Error(`ARCADE_SLUGS not found in ${TYPES_TS}`);
   const slugs = [...block[1].matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]);
   if (slugs.length === 0) throw new Error(`ARCADE_SLUGS is empty in ${TYPES_TS}`);
   return slugs;
}

/** Used when a game has no script of its own: waits, presses the arrows and Space, taps the middle. */
export const GENERIC_SCRIPT = [
   { wait: 600 },
   { hold: "ArrowUp", ms: 400 },
   { tap: "Space" },
   { click: [0.5, 0.5] },
   { hold: "ArrowRight", ms: 300 },
   { wait: 300 },
];

/** Does the game have a script of its own (inputs/<slug>.mjs or inputs.mjs)? */
export function hasOwnScript(slug) {
   return existsSync(path.join(HERE, "inputs", `${slug}.mjs`)) || Object.hasOwn(INPUT_SCRIPTS, slug);
}

/** The input script of one game ({ source } says which of the three it came from). */
export async function loadInputScript(slug) {
   const file = path.join(HERE, "inputs", `${slug}.mjs`);
   if (existsSync(file)) {
      const mod = await import(pathToFileURL(file).href);
      const steps = mod.default ?? mod.steps;
      if (!Array.isArray(steps)) throw new Error(`${path.relative(process.cwd(), file)}: export the step array as default`);
      return { steps, source: `inputs/${slug}.mjs` };
   }
   if (Object.hasOwn(INPUT_SCRIPTS, slug)) return { steps: INPUT_SCRIPTS[slug], source: "inputs.mjs" };
   return { steps: GENERIC_SCRIPT, source: "generic" };
}
