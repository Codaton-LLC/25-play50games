// Models shared by several games (public/models/3d/shared/<id>.glb). Plain data, no three.js.
// Mirrors src/arcade3d/assets/shared.spec.json. Owned by Claude: games reuse these entries
// (spread them to change scale/rotation) but never edit this file.
import type { ModelAsset } from "./types";

export type SharedAssetId = "runner" | "robot" | "battery" | "crate" | "tinCan" | "banana" | "desk" | "chair";

/** Budgets after `optimize` (platform-plan §4). */
export const CHARACTER_BUDGET = { tris: 20000, bytes: 1_500_000 } as const;
export const PROP_BUDGET = { tris: 5000, bytes: 300_000 } as const;

const shared = (id: SharedAssetId) => `/models/3d/shared/${id}.glb`;

export const SHARED_ASSETS: Record<SharedAssetId, ModelAsset> = {
   runner: {
      id: "runner",
      url: shared("runner"),
      rigged: true,
      fallback: "capsule",
      fallbackColor: "#f97316",
      budget: { ...CHARACTER_BUDGET },
   },
   robot: {
      id: "robot",
      url: shared("robot"),
      fallback: "capsule",
      fallbackColor: "#2dd4bf",
      budget: { ...CHARACTER_BUDGET },
   },
   battery: {
      id: "battery",
      url: shared("battery"),
      fallback: "cylinder",
      fallbackColor: "#4ade80",
      budget: { ...PROP_BUDGET },
   },
   crate: {
      id: "crate",
      url: shared("crate"),
      fallback: "box",
      fallbackColor: "#b45309",
      budget: { ...PROP_BUDGET },
   },
   tinCan: {
      id: "tinCan",
      url: shared("tinCan"),
      fallback: "cylinder",
      fallbackColor: "#94a3b8",
      budget: { ...PROP_BUDGET },
   },
   banana: {
      id: "banana",
      url: shared("banana"),
      fallback: "capsule",
      fallbackColor: "#facc15",
      budget: { ...PROP_BUDGET },
   },
   desk: {
      id: "desk",
      url: shared("desk"),
      fallback: "box",
      fallbackColor: "#a16207",
      budget: { ...PROP_BUDGET },
   },
   chair: {
      id: "chair",
      url: shared("chair"),
      fallback: "box",
      fallbackColor: "#475569",
      budget: { ...PROP_BUDGET },
   },
};
