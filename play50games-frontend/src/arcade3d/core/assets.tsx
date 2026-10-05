"use client";

// GLB models for 3D Arcade games, with a coloured primitive whenever the GLB is missing or broken.
// Owned by Claude. Usage inside a Scene:
//
//    <Model asset={SHARED_ASSETS.battery} position={[2, 0, -1]} />
//
// - Loads with useGLTF(url, false, true): meshopt on, no Draco (no decoder CDN).
// - Every <Model> renders its own clone (SkeletonUtils for rigged models), so one GLB can be
//   placed many times. For dozens of copies prefer instancing to stay under 150 draw calls.
// - Applies asset.scale / rotationY / yOffset to the GLB. The fallback primitive ignores them:
//   it is about 1 unit tall, standing on y = 0 at the group origin.
// - Never call useGLTF.preload at module top level; GameShell clears the cache on unmount.
import { Component, forwardRef, useMemo, type ErrorInfo, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import type { GroupProps } from "@react-three/fiber";
import type { AnimationClip, Group, Object3D } from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { GameDefinition, ModelAsset } from "./types";

export { SHARED_ASSETS, CHARACTER_BUDGET, PROP_BUDGET, type SharedAssetId } from "./sharedAssets";

const DEFAULT_FALLBACK_COLOR = "#7dd3fc";
const NO_CLIPS: AnimationClip[] = [];

export interface ModelHandle {
   /** this instance's clone of the GLB scene; null when the GLB failed to load */
   scene: Object3D | null;
   /** animation clips of the GLB (use with drei useAnimations) */
   animations: AnimationClip[];
   /** true when the GLB is missing or broken: render a fallback instead */
   failed: boolean;
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
   return typeof value === "object" && value !== null && typeof (value as { then?: unknown }).then === "function";
}

/**
 * Loads a model (suspends while loading) and returns a private clone of it.
 * A missing or broken GLB does not throw: `failed` is true and `scene` is null.
 */
export function useModel(asset: ModelAsset): ModelHandle {
   let gltf: { scene: Object3D; animations: AnimationClip[] } | null = null;
   try {
      gltf = useGLTF(asset.url, false, true);
   } catch (thrown) {
      // a pending load suspends (thrown promise); a failed load falls back
      if (isThenable(thrown)) throw thrown;
      gltf = null;
   }

   const source = gltf?.scene ?? null;
   const rigged = !!asset.rigged;
   const scene = useMemo(() => (source ? (rigged ? cloneSkinned(source) : source.clone(true)) : null), [source, rigged]);

   return { scene, animations: gltf?.animations ?? NO_CLIPS, failed: !gltf };
}

/** The coloured stand-in for a model: about 1 unit tall, standing on y = 0. */
export function FallbackPrimitive({ asset, color }: { asset: ModelAsset; color?: string }) {
   const fill = color ?? asset.fallbackColor ?? DEFAULT_FALLBACK_COLOR;
   switch (asset.fallback) {
      case "capsule":
         return (
            <mesh position-y={0.65}>
               <capsuleGeometry args={[0.35, 0.6, 6, 12]} />
               <meshStandardMaterial color={fill} roughness={0.55} />
            </mesh>
         );
      case "sphere":
         return (
            <mesh position-y={0.5}>
               <sphereGeometry args={[0.5, 20, 14]} />
               <meshStandardMaterial color={fill} roughness={0.55} />
            </mesh>
         );
      case "cylinder":
         return (
            <mesh position-y={0.5}>
               <cylinderGeometry args={[0.4, 0.4, 1, 20]} />
               <meshStandardMaterial color={fill} roughness={0.55} />
            </mesh>
         );
      case "box":
      default:
         return (
            <mesh position-y={0.5}>
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial color={fill} roughness={0.55} />
            </mesh>
         );
   }
}

interface BoundaryProps {
   fallback: ReactNode;
   children: ReactNode;
}

/** Catches anything useModel did not (e.g. a GLB that breaks while rendering) and shows the fallback. */
class ModelErrorBoundary extends Component<BoundaryProps, { failed: boolean }> {
   state = { failed: false };

   static getDerivedStateFromError() {
      return { failed: true };
   }

   componentDidCatch(error: Error, info: ErrorInfo) {
      if (process.env.NODE_ENV !== "production") console.warn("[arcade] model fell back to a primitive", error, info);
   }

   render() {
      return this.state.failed ? this.props.fallback : this.props.children;
   }
}

function ModelContent({ asset, color }: { asset: ModelAsset; color?: string }) {
   const { scene } = useModel(asset);
   if (!scene) return <FallbackPrimitive asset={asset} color={color} />;
   return (
      <primitive
         object={scene}
         scale={asset.scale ?? 1}
         rotation-y={asset.rotationY ?? 0}
         position-y={asset.yOffset ?? 0}
      />
   );
}

export interface ModelProps extends Omit<GroupProps, "children"> {
   asset: ModelAsset;
   /** colour of the fallback primitive (defaults to asset.fallbackColor) */
   fallbackColor?: string;
   /** extra children inside the model's group (e.g. a hit-box helper) */
   children?: ReactNode;
}

/** Renders a GLB model, or its fallback primitive when the GLB is missing. Suspends while loading. */
export const Model = forwardRef<Group, ModelProps>(function Model({ asset, fallbackColor, children, ...group }, ref) {
   return (
      <group ref={ref} {...group}>
         <ModelErrorBoundary key={asset.url} fallback={<FallbackPrimitive asset={asset} color={fallbackColor} />}>
            <ModelContent asset={asset} color={fallbackColor} />
         </ModelErrorBoundary>
         {children}
      </group>
   );
});

/** Every GLB url a game uses (GameShell clears them from the cache on unmount). */
export function assetUrls(definition: Pick<GameDefinition, "assets">): string[] {
   return Array.from(new Set(Object.values(definition.assets).map((asset) => asset.url)));
}

/** Drops loaded GLBs from the useGLTF cache (and with it the last reference to their data). */
export function clearModelCache(urls: string[]): void {
   for (const url of urls) {
      try {
         useGLTF.clear(url);
      } catch {
         // never loaded
      }
   }
}
