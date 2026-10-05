"use client";

// GLB models for 3D Arcade games, with a coloured primitive whenever the GLB is missing or broken.
// Owned by Claude. Usage inside a Scene:
//
//    <Model asset={SHARED_ASSETS.battery} position={[2, 0, -1]} />
//    <Model asset={ASSETS.robot} fallback={<RobotPrimitive />} />   // own stand-in until the GLB exists
//    <InstancedModel asset={ASSETS.crate} spots={CRATE_SPOTS} fallback={<CrateStandIns />} />
//
// - Only urls listed in core/modelManifest.ts are fetched; any other url renders its fallback at
//   once (no request, no suspense). Assets PRs add the GLB and its manifest line together.
// - Loads with useGLTF(url, false, true): meshopt on, no Draco (no decoder CDN).
// - Every <Model> renders its own clone (SkeletonUtils for rigged models), so one GLB can be
//   placed many times. Repeated static props use <InstancedModel> instead: one InstancedMesh per
//   GLB mesh for all spots (draw calls do not grow with the number of props), and the game's own
//   instanced primitive (<Instanced>, core/render) until the GLB exists.
// - Applies asset.scale / rotationY / yOffset to the GLB. The fallback primitive ignores them:
//   it is about 1 unit tall, standing on y = 0 at the group origin.
// - Never call useGLTF.preload at module top level; GameShell clears the cache on unmount.
import { Component, forwardRef, useMemo, useRef, type ErrorInfo, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import type { GroupProps } from "@react-three/fiber";
import {
   Matrix4,
   Quaternion,
   Vector3,
   type AnimationClip,
   type BufferGeometry,
   type Group,
   type InstancedMesh,
   type Material,
   type Mesh,
   type Object3D,
} from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { GameDefinition, ModelAsset } from "./types";
import { hasModel } from "./modelManifest";
import { useInstanceMatrices, type InstanceSpot } from "./render/useInstanceMatrices";

export { SHARED_ASSETS, CHARACTER_BUDGET, PROP_BUDGET, type SharedAssetId } from "./sharedAssets";
export { MODEL_MANIFEST, hasModel } from "./modelManifest";

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

type Gltf = { scene: Object3D; animations: AnimationClip[] };

function isThenable(value: unknown): value is PromiseLike<unknown> {
   return typeof value === "object" && value !== null && typeof (value as { then?: unknown }).then === "function";
}

/**
 * The loaded GLB, or null when it is not in the manifest (never fetched) or failed to load.
 * Suspends while loading. Calling useGLTF behind a condition is safe: R3F's useLoader is a
 * suspense cache (suspend-react) and uses no React hooks, so the hook order never changes.
 */
function loadGltf(url: string): Gltf | null {
   if (!hasModel(url)) return null;
   try {
      return useGLTF(url, false, true) as unknown as Gltf;
   } catch (thrown) {
      // a pending load suspends (thrown promise); a failed load falls back
      if (isThenable(thrown)) throw thrown;
      return null;
   }
}

/**
 * Loads a model (suspends while loading) and returns a private clone of it.
 * A missing, unlisted or broken GLB does not throw: `failed` is true and `scene` is null.
 */
export function useModel(asset: ModelAsset): ModelHandle {
   const gltf = loadGltf(asset.url);
   const source = gltf?.scene ?? null;
   const rigged = !!asset.rigged;
   const scene = useMemo(() => (source ? (rigged ? cloneSkinned(source) : source.clone(true)) : null), [source, rigged]);

   return { scene, animations: gltf?.animations ?? NO_CLIPS, failed: !gltf };
}

/**
 * Just "is this GLB missing or broken?", without cloning it: use it to choose between a
 * primitive (e.g. one InstancedMesh for every crate) and <Model>s. Suspends while loading.
 */
export function useModelFailed(asset: ModelAsset): boolean {
   return loadGltf(asset.url) === null;
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

function ModelContent({ asset, fallback }: { asset: ModelAsset; fallback: ReactNode }) {
   const { scene } = useModel(asset);
   if (!scene) return <>{fallback}</>;
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
   /** colour of the default fallback primitive (defaults to asset.fallbackColor) */
   fallbackColor?: string;
   /**
    * What to draw while the GLB is missing or broken, instead of the primitive `asset.fallback`
    * names: an element such as `<RobotPrimitive />`, not a component or a render function. It is
    * mounted only when needed, its hooks run in its own component, and refs inside it work.
    */
   fallback?: ReactNode;
   /** extra children inside the model's group (e.g. a hit-box helper) */
   children?: ReactNode;
}

/** Renders a GLB model, or its fallback when the GLB is missing. Suspends while a listed GLB loads. */
export const Model = forwardRef<Group, ModelProps>(function Model({ asset, fallbackColor, fallback, children, ...group }, ref) {
   const stand = fallback ?? <FallbackPrimitive asset={asset} color={fallbackColor} />;
   return (
      <group ref={ref} {...group}>
         <ModelErrorBoundary key={asset.url} fallback={stand}>
            <ModelContent asset={asset} fallback={stand} />
         </ModelErrorBoundary>
         {children}
      </group>
   );
});

// ---------- instanced props ----------

/** One mesh of a GLB, ready to instance: shared geometry and material, its transform in the model. */
export interface ModelPart {
   geometry: BufferGeometry;
   material: Material | Material[];
   /** asset scale / rotationY / yOffset times the mesh's transform relative to the GLB root */
   matrix: Matrix4;
}

const UP = new Vector3(0, 1, 0);

/**
 * The meshes of a loaded GLB scene with their transforms, placed exactly like <Model> places the
 * GLB (asset.scale, rotationY, yOffset). Skinned meshes are skipped (rigged models are not props).
 */
export function modelParts(scene: Object3D, asset: Pick<ModelAsset, "scale" | "rotationY" | "yOffset">): ModelPart[] {
   scene.updateMatrixWorld(true);
   const s = asset.scale ?? 1;
   const root = new Matrix4().compose(
      new Vector3(0, asset.yOffset ?? 0, 0),
      new Quaternion().setFromAxisAngle(UP, asset.rotationY ?? 0),
      new Vector3(s, s, s)
   );
   // <Model> replaces the GLB root's own transform with the asset's, so measure from the root
   const fromRoot = scene.matrixWorld.clone().invert();
   const parts: ModelPart[] = [];
   scene.traverse((object) => {
      const mesh = object as Mesh & { isSkinnedMesh?: boolean };
      if (!mesh.isMesh || mesh.isSkinnedMesh) return;
      const matrix = root.clone().multiply(fromRoot.clone().multiply(mesh.matrixWorld));
      parts.push({ geometry: mesh.geometry, material: mesh.material, matrix });
   });
   return parts;
}

function InstancedPart({ part, spots }: { part: ModelPart; spots: readonly InstanceSpot[] }) {
   const mesh = useRef<InstancedMesh>(null);
   useInstanceMatrices(mesh, spots, part.matrix);
   // dispose={null}: the geometry and material belong to the loader cache
   return <instancedMesh ref={mesh} args={[part.geometry, part.material, spots.length]} dispose={null} />;
}

const spotScale = (spot: InstanceSpot): [number, number, number] => {
   const s = spot.scale ?? 1;
   return [spot.sx ?? s, spot.sy ?? s, spot.sz ?? s];
};

function InstancedModelContent({ asset, spots, fallback }: InstancedModelProps) {
   const gltf = loadGltf(asset.url);
   const source = gltf?.scene ?? null;
   const rigged = !!asset.rigged;
   const { scale, rotationY, yOffset } = asset;
   const parts = useMemo(
      () => (source && !rigged ? modelParts(source, { scale, rotationY, yOffset }) : null),
      [source, rigged, scale, rotationY, yOffset]
   );
   if (!source || parts?.length === 0) return <>{fallback}</>;
   if (!parts) {
      // rigged: one clone per spot (a skinned mesh cannot share one InstancedMesh)
      return (
         <>
            {spots.map((spot, i) => (
               <Model key={i} asset={asset} fallback={null} position={[spot.x, spot.y, spot.z]} rotation-y={spot.rotY ?? 0} scale={spotScale(spot)} />
            ))}
         </>
      );
   }
   return (
      <>
         {parts.map((part, i) => (
            <InstancedPart key={i} part={part} spots={spots} />
         ))}
      </>
   );
}

export interface InstancedModelProps {
   asset: ModelAsset;
   /** where each copy's origin (the model's feet, like <Model position>) sits; keep it stable */
   spots: readonly InstanceSpot[];
   /**
    * What to draw while the GLB is missing or broken: an element, usually the game's own
    * <Instanced> primitive(s) from core/render. Mounted only when needed.
    */
   fallback: ReactNode;
}

/**
 * Many copies of a static prop. Once the GLB is listed in the manifest, every mesh of it becomes
 * one InstancedMesh for all `spots` (draw calls = meshes in the GLB, not meshes x props); until
 * then `fallback` is drawn. Suspends while a listed GLB loads.
 */
export function InstancedModel(props: InstancedModelProps) {
   return (
      <ModelErrorBoundary key={props.asset.url} fallback={props.fallback}>
         <InstancedModelContent {...props} />
      </ModelErrorBoundary>
   );
}

/** Every GLB url a game uses (GameShell clears them from the cache on unmount). */
export function assetUrls(definition: Pick<GameDefinition, "assets">): string[] {
   return Array.from(new Set(Object.values(definition.assets).map((asset) => asset.url)));
}

/** Drops loaded GLBs from the useGLTF cache (and with it the last reference to their data). */
export function clearModelCache(urls: string[]): void {
   for (const url of urls) {
      if (!hasModel(url)) continue; // never fetched
      try {
         useGLTF.clear(url);
      } catch {
         // never loaded
      }
   }
}
