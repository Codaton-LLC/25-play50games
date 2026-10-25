import type { ModelAsset } from "@/arcade3d/core/types";
import { REUSED_ASSETS, SHARED_ASSETS, CHEF_LANDMARKS } from "@/arcade3d/core/sharedAssets";
export { CHEF_LANDMARKS };
const prop = (id: string, scale: number): ModelAsset => ({ id, url: `/models/3d/pizza-kitchen-3d/${id}.glb`, scale, fallback: "box", budget: { tris: 20000, bytes: 200000 } });
export const ASSETS = {
   chef: { ...REUSED_ASSETS.chef, scale: 0.975, humanoid: { landmarks: CHEF_LANDMARKS } },
   bin: REUSED_ASSETS.bin, crate: SHARED_ASSETS.crate,
   pizzaBase: prop("pizzaBase", 0.48), sauceBowl: prop("sauceBowl", 0.38), cheeseBowl: prop("cheeseBowl", 0.38),
   mushroom: prop("mushroomBowlR", 0.38), olive: prop("oliveBowl", 0.38), pepperoni: prop("pepperoni", 0.12),
   tomato: prop("tomato", 0.12), onion: prop("onion", 0.12), oven: prop("pizzaOven", 0.74),
   counter: prop("prepCounterR", 0.8), peel: prop("pizzaPeelClean", 0.5), box: prop("pizzaBoxClosed", 0.5),
} satisfies Record<string, ModelAsset>;
