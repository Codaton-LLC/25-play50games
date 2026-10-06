// Clones of a loaded GLB's meshes for instancing. The loader cache is never disposed.
// Creation sits in the effect (bakedEffect), not a useMemo the cleanup would free and then reuse:
// React strict mode runs that cleanup and then the effect again on the same state.
import type { Material, BufferGeometry, Object3D } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import type { ModelAsset } from "@/arcade3d/core/types";

export interface BakedPart {
   geo: BufferGeometry;
   mat: Material;
}

export function bakeModelParts(scene: Object3D, asset: Pick<ModelAsset, "scale" | "stretch" | "rotationY" | "yOffset">): BakedPart[] {
   return modelParts(scene, asset).map((part) => {
      const geo = part.geometry.clone();
      geo.applyMatrix4(part.matrix);
      const src = Array.isArray(part.material) ? part.material[0] : part.material;
      return { geo, mat: src.clone() };
   });
}

export function releaseBakedParts(parts: readonly BakedPart[]): void {
   for (const part of parts) {
      part.geo.dispose();
      part.mat.dispose();
   }
}

/** The mount effect: publish the clones, and free those clones on cleanup. */
export function bakedEffect(
   scene: Object3D,
   asset: Pick<ModelAsset, "scale" | "stretch" | "rotationY" | "yOffset">,
   publish: (parts: BakedPart[] | null) => void,
): () => void {
   const parts = bakeModelParts(scene, asset);
   publish(parts);
   return () => {
      releaseBakedParts(parts);
      publish(null);
   };
}
