// Small rendering helpers every game needs. Owned by Claude.
export { BlobShadow, type BlobShadowProps } from "./BlobShadow";
export { DynamicInstanced, preparePoolMesh, releaseInstanceBuffers, type DynamicInstancedProps } from "./DynamicInstanced";
export {
   createInstanceTint,
   piecesOf,
   writeDynamicInstances,
   type InstancePart,
   type InstanceTarget,
   type InstanceTint,
   type InstanceUpdate,
} from "./dynamicInstances";
export { Instanced, type InstancedProps } from "./Instanced";
export { TrajectoryDots, dotOpacity, shownDots, type TrajectoryDotsProps } from "./TrajectoryDots";
export { useCanvasTexture, type CanvasDraw } from "./useCanvasTexture";
export { spotMatrix, useInstanceMatrices, type InstanceSpot } from "./useInstanceMatrices";
