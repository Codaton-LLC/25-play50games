import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MODEL_MANIFEST, hasModel } from "./modelManifest";
import { SHARED_ASSETS } from "./sharedAssets";

const PUBLIC = fileURLToPath(new URL("../../../public", import.meta.url));

/** Every .glb under public/models/3d, as the url the game loads it from. */
function glbsOnDisk(): string[] {
   const root = path.join(PUBLIC, "models", "3d");
   const found: string[] = [];
   const walk = (dir: string) => {
      let entries: string[];
      try {
         entries = readdirSync(dir);
      } catch {
         return; // no models yet
      }
      for (const name of entries) {
         const full = path.join(dir, name);
         if (statSync(full).isDirectory()) walk(full);
         else if (name.toLowerCase().endsWith(".glb")) found.push("/" + path.relative(PUBLIC, full).split(path.sep).join("/"));
      }
   };
   walk(root);
   return found.sort();
}

describe("model manifest", () => {
   it("lists exactly the GLBs in public/models/3d (assets PRs add both together)", () => {
      expect([...MODEL_MANIFEST].sort()).toEqual(glbsOnDisk());
   });

   it("has well-formed, unique urls", () => {
      expect(new Set(MODEL_MANIFEST).size).toBe(MODEL_MANIFEST.length);
      for (const url of MODEL_MANIFEST) expect(url).toMatch(/^\/models\/3d\/[a-z0-9-]+\/[A-Za-z0-9-]+\.glb$/);
   });

   it("hasModel answers from the list only", () => {
      for (const url of MODEL_MANIFEST) expect(hasModel(url)).toBe(true);
      for (const asset of Object.values(SHARED_ASSETS)) expect(hasModel(asset.url)).toBe(MODEL_MANIFEST.includes(asset.url));
      expect(hasModel("/models/3d/shared/does-not-exist.glb")).toBe(false);
      expect(hasModel("")).toBe(false);
   });
});
