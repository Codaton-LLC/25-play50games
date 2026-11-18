// Menu 2 "Color Roll Heroes" code-built props: cheap geometric set pieces (Hyper3D made them wrong).
// Each exports its component, a pure size const (metres) and pure geometry builders tested without a canvas.
export { ArchCorridor, ARCH_CORRIDOR_SIZE, buildCorridorArchGeometry, buildCorridorFloorGeometry, corridorArchOffsets } from "./ArchCorridor";
export type { ArchCorridorProps } from "./ArchCorridor";
export { ArchWall, ARCH_WALL_SIZE, buildArchStoneGeometry, buildArchTrimGeometry } from "./ArchWall";
export type { ArchWallProps } from "./ArchWall";
export { CheckpointPad, CHECKPOINT_PAD_SIZE, buildCheckpointStoneGeometry, buildCheckpointGlowGeometry } from "./CheckpointPad";
export type { CheckpointPadProps } from "./CheckpointPad";
export { GrapplePost, GRAPPLE_POST_SIZE, buildGrapplePostGeometry, buildGrappleRingGeometry } from "./GrapplePost";
export type { GrapplePostProps } from "./GrapplePost";
// Domino 0.5x1.0x0.15 m, Flipper 1.6 m, SweeperBar 3 m on a 0.6 m hub, RailJunction 4 m Y-split, SpikeBlock 1 m
export * from "./Domino";
export * from "./Flipper";
export * from "./SweeperBar";
export * from "./RailJunction";
export * from "./SpikeBlock";
export * from "./TrainingDisc";
export * from "./GreatGong";
export * from "./MirrorGate";
