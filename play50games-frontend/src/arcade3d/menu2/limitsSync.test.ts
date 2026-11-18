import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ARCADE_GAMES } from "../registry";

// Every Menu 2 meta.ts reads its level limits (and the level fields it shows) from games/<slug>/limits.ts:
// plain literals with no imports, so the registry, which every /3d page loads, does not bundle the
// games' rules and level data. rules.ts / levels.ts stay the source; this test keeps the copies equal.
const GAMES = path.resolve(__dirname, "../games");
const MENU2 = ARCADE_GAMES.filter((g) => g.order > 50).map((g) => g.slug);
const IDS = [1, 2, 3, 4, 5] as const;

type Mod = Record<string, unknown>;
const load = (slug: string, file: string) => import(/* @vite-ignore */ path.join(GAMES, slug, file)) as Promise<Mod>;

describe("Menu 2 limits.ts", () => {
   it("covers the 50 Menu 2 games", () => {
      expect(MENU2).toHaveLength(50);
      for (const slug of MENU2) expect(fs.existsSync(path.join(GAMES, slug, "limits.ts")), slug).toBe(true);
   });

   for (const slug of MENU2) {
      it(`${slug}: limits.ts has no imports and meta.ts reads nothing from ./rules or ./levels`, () => {
         const limits = fs.readFileSync(path.join(GAMES, slug, "limits.ts"), "utf8");
         expect(limits).not.toMatch(/^\s*import\s/m);
         expect(limits).not.toMatch(/\brequire\(/);
         const meta = fs.readFileSync(path.join(GAMES, slug, "meta.ts"), "utf8");
         expect(meta).not.toMatch(/from\s+"\.\/(rules|levels)"/);
      });

      it(`${slug}: limits.ts equals what rules.ts / levels.ts derive`, async () => {
         const limits = await load(slug, "limits.ts");
         const rules = await load(slug, "rules.ts");
         const levels = fs.existsSync(path.join(GAMES, slug, "levels.ts")) ? await load(slug, "levels.ts") : {};
         expect(Object.keys(limits).length).toBeGreaterThan(0);
         for (const [name, copy] of Object.entries(limits)) {
            if (name === "LEVELS") {
               const source = levels.LEVELS as Record<number, Record<string, unknown>>;
               const table = copy as Record<number, Record<string, unknown>>;
               for (const id of IDS) for (const field of Object.keys(table[id])) expect(table[id][field], `${slug} LEVELS[${id}].${field}`).toEqual(source[id][field]);
            } else if (typeof copy === "function") {
               const source = rules[name] as (id: number) => unknown;
               for (const id of IDS) expect((copy as (id: number) => unknown)(id), `${slug} ${name}(${id})`).toEqual(source(id));
            } else {
               expect(copy, `${slug} ${name}`).toEqual(rules[name]);
            }
         }
      });
   }
});
