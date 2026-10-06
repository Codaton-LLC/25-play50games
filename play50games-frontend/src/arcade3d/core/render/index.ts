// Small rendering helpers every game needs. Owned by Claude.
export { BlobShadow, type BlobShadowProps } from "./BlobShadow";
export { DynamicInstanced, type DynamicInstancedProps } from "./DynamicInstanced";
export {
   piecesOf,
   writeDynamicInstances,
   type InstancePart,
   type InstanceTarget,
   type InstanceUpdate,
} from "./dynamicInstances";
export { Instanced, type InstancedProps } from "./Instanced";
export { useCanvasTexture, type CanvasDraw } from "./useCanvasTexture";
export { spotMatrix, useInstanceMatrices, type InstanceSpot } from "./useInstanceMatrices";
