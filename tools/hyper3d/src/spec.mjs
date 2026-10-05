import { readFile } from "node:fs/promises";
import path from "node:path";
import Ajv from "ajv";
import { API } from "./config.mjs";

const schema = JSON.parse(await readFile(new URL("../assets.schema.json", import.meta.url), "utf8"));
const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);

export function identifier(value, slug = false) {
   const pattern = slug ? /^[a-z0-9]+(?:-[a-z0-9]+)*$/ : /^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$/;
   if (!pattern.test(value ?? "") || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(value)) {
      throw new Error("Unsafe or missing identifier");
   }
   return value;
}

export function parseSpec(input) {
   const spec = structuredClone(input);
   if (!validate(spec)) {
      throw new Error(`Invalid assets spec: ${validate.errors.map(e => `${e.instancePath} ${e.message}`).join("; ")}`);
   }
   identifier(spec.slug, true);
   const ids = new Set();
   for (const asset of spec.assets) {
      identifier(asset.id);
      identifier(asset.target, true);
      if (ids.has(asset.id)) { throw new Error(`Duplicate asset id: ${asset.id}`); }
      ids.add(asset.id);
      if (asset.target !== "shared" && asset.target !== spec.slug) {
         throw new Error(`Invalid target for ${asset.id}: must be shared or spec slug`);
      }
      const character = asset.kind === "character";
      asset.tier ??= character ? "Gen-2.5-Medium" : "Gen-2.5-Low";
      asset.qualityOverride ??= character ? 18000 : 2500;
   }
   return spec;
}

export async function loadSpec(repo, slug, file) {
   identifier(slug, true);
   const source = file ? path.resolve(repo, file) : path.join(repo, "play50games-frontend/src/arcade3d", slug === "shared" ? "assets/shared.spec.json" : `games/${slug}/assets.spec.json`);
   const spec = parseSpec(JSON.parse(await readFile(source, "utf8")));
   if (spec.slug !== slug) { throw new Error("Spec slug does not match command slug"); }
   return spec;
}

export function selectAssets(spec, id) {
   if (!id) { return spec.assets; }
   const found = spec.assets.filter(asset => asset.id === identifier(id));
   if (!found.length) { throw new Error(`Unknown asset id: ${id}`); }
   return found;
}

export function estimate(assets, perGeneration = API.creditEstimate) {
   return assets.reduce((sum, asset) => sum + asset.attempts * perGeneration, 0);
}
