import type { ModelAsset } from "@/arcade3d/core/types";

const PROP_BUDGET = { tris: 5000, bytes: 300000 };

export const ASSETS = {
   // Claude's folded-wing GLB: 0.99 x 1.90 x 1.74 m, feet on y=0, facing +z.
   // The manifest owns availability; an unlisted URL goes straight to our primitive.
   pigeon: {
      id: "pigeon", url: "/models/3d/pigeon-crossing/pigeon.glb",
      scale: 0.658, stretch: [0.86, 1, 1], rotationY: Math.PI, rigged: false,
      fallback: "sphere", fallbackColor: "#8192a9", budget: { tris: 20000, bytes: 1500000 },
   },
   car: { id: "car", url: "/models/3d/pigeon-crossing/car.glb", fallback: "box", fallbackColor: "#f47967", budget: PROP_BUDGET },
   taxi: { id: "taxi", url: "/models/3d/pigeon-crossing/taxi.glb", fallback: "box", fallbackColor: "#ffd15b", budget: PROP_BUDGET },
   van: { id: "van", url: "/models/3d/pigeon-crossing/van.glb", fallback: "box", fallbackColor: "#e9edf3", budget: PROP_BUDGET },
} satisfies Record<string, ModelAsset>;
