"use client";

// GLB models for 3D Arcade games, with a coloured primitive whenever the GLB is missing or broken.
// Owned by Claude. Usage inside a Scene:
//
//    <Model asset={SHARED_ASSETS.battery} position={[2, 0, -1]} />
//    <Model asset={ASSETS.robot} fallback={<RobotPrimitive />} />   // own stand-in until the GLB exists
//    <InstancedModel asset={ASSETS.crate} spots={CRATE_SPOTS} fallback={<CrateStandIns />} />
//    <DynamicInstancedModel asset={ASSETS.car} count={32} update={placeCar} fallbackParts={carParts} />
//    <HumanoidModel asset={ASSETS.runner} pose={pose} fallback={<RunnerPrimitive />} />  // core/rig
//
// - A `humanoid` asset (a static T-pose character) is auto-rigged in code (core/rig): <Model>
//   draws it standing with its arms down, <HumanoidModel> (core/rig) animates it with poses.
// - Only urls listed in core/modelManifest.ts are fetched; any other url renders its fallback at
//   once (no request, no suspense). Assets PRs add the GLB and its manifest line together.
// - Loads with useGLTF(url, false, true): meshopt on, no Draco (no decoder CDN).
// - Every <Model> renders its own clone (SkeletonUtils for rigged models), so one GLB can be
//   placed many times. Repeated static props use <InstancedModel> instead: one InstancedMesh per
//   GLB mesh for all spots (draw calls do not grow with the number of props), and the game's own
//   instanced primitive (<Instanced>, core/render) until the GLB exists.
// - Pools of props that move every frame (coins, obstacles, vehicles) use <DynamicInstancedModel>:
//   the same one-InstancedMesh-per-GLB-mesh, with an update callback that places each copy every
//   frame, and the game's stand-in parts (or the asset's primitive) until the GLB exists.
// - Applies asset.scale / stretch / rotationY / yOffset to the GLB. The fallback primitive ignores them:
//   it is about 1 unit tall, standing on y = 0 at the group origin.
// - asset.material ("stone" | "bronze" | "gold" | "bone" | { color, ... }) draws the GLB with one
//   shared material per look (core/materials.ts), in <Model>, <InstancedModel>,
//   <DynamicInstancedModel> and <HumanoidModel>. <Model tint> / <HumanoidModel tint> multiply the
//   GLB's colours (one cached material per GLB material and tint). <DynamicInstancedModel> tints
//   per copy from its update(i, matrix, color).
// - Never call useGLTF.preload at module top level; GameShell clears the cache on unmount.
import { Component, forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import type { GroupProps } from "@react-three/fiber";
import {
   BoxGeometry,
   CapsuleGeometry,
   CylinderGeometry,
   Matrix4,
   MeshStandardMaterial,
   Quaternion,
   SphereGeometry,
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
import type { GameDefinition, ModelAsset, PrimitiveFallback } from "./types";
import { hasModel } from "./modelManifest";
import { useInstanceMatrices, type InstanceSpot } from "./render/useInstanceMatrices";
import { DynamicInstanced } from "./render/DynamicInstanced";
import type { InstancePart, InstanceUpdate } from "./render/dynamicInstances";
import { cloneHumanoid, disposeHumanoid, humanoidTemplate, type HumanoidRig } from "./rig/skinning";
import { MATERIAL_CACHE, applyLook, lookMaterials, overrideKey, type LookUse, type MaterialOverride } from "./materials";

export { SHARED_ASSETS, CHARACTER_BUDGET, PROP_BUDGET, type SharedAssetId } from "./sharedAssets";
export { MODEL_MANIFEST, hasModel } from "./modelManifest";
export type { InstancePart, InstanceUpdate } from "./render/dynamicInstances";
export { MATERIAL_PRESETS, type MaterialOverride, type MaterialPreset } from "./materials";

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
 * Core only (core/rig/HumanoidModel); games use useModel / <Model>.
 */
export function loadGltf(url: string): Gltf | null {
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

/**
 * Catches anything useModel did not (e.g. a GLB that breaks while rendering) and shows the fallback.
 * Core only (also core/rig/HumanoidModel).
 */
export class ModelErrorBoundary extends Component<BoundaryProps, { failed: boolean }> {
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

/** asset.scale times asset.stretch, per axis of the GLB */
export function assetScale(asset: Pick<ModelAsset, "scale" | "stretch">): [number, number, number] {
   const s = asset.scale ?? 1;
   const k = asset.stretch;
   return k ? [s * k[0], s * k[1], s * k[2]] : [s, s, s];
}

const retainLooks = (looks: LookUse) => looks.forEach((material, key) => MATERIAL_CACHE.retain(key, material));
const releaseLooks = (looks: LookUse) => looks.forEach((_material, key) => MATERIAL_CACHE.release(key));

/**
 * Gives a model's private clone (a <Model> scene, a humanoid rig) the asset's material override and
 * the tint while mounted, and keeps those looks alive in MATERIAL_CACHE. All of it happens in a
 * layout effect (before the first paint): the render never mutates the clone or the cache, and the
 * cleanup restores the GLB's own materials and releases the looks, so a StrictMode replay or an
 * abandoned render leaves nothing behind. Keyed by the override's value (overrideKey), so an inline
 * `material: { color }` object does not re-apply every render. Core only (also <HumanoidModel>).
 */
export function useCloneLook(root: Object3D | null, override: MaterialOverride | undefined, tint: string | undefined): void {
   const key = override ? overrideKey(override) : "";
   const latest = useRef(override);
   latest.current = override;
   useLayoutEffect(() => {
      if (!root || (!key && !tint)) return;
      const looks = applyLook(root, latest.current, tint);
      retainLooks(looks);
      return () => {
         applyLook(root, undefined, undefined); // the GLB's own materials again
         releaseLooks(looks);
      };
   }, [root, key, tint]);
}

/**
 * Instanced parts with the asset's material override (the GLB's own materials without one). The
 * looked parts are built and retained in a layout effect; until then (the first, unpainted render)
 * `ready` is false and the caller draws nothing.
 */
function useLookedParts<P extends { material: Material | Material[] }>(parts: P[] | null, override: MaterialOverride | undefined): { parts: P[] | null; ready: boolean } {
   const key = override ? overrideKey(override) : "";
   const latest = useRef(override);
   latest.current = override;
   const [looked, setLooked] = useState<{ from: P[]; key: string; parts: P[] } | null>(null);
   useLayoutEffect(() => {
      if (!parts || !key || !latest.current) return;
      const looks: LookUse = new Map();
      const override = latest.current;
      const out = parts.map((part) => ({ ...part, material: lookMaterials(part.material, override, undefined, looks) }));
      retainLooks(looks);
      setLooked({ from: parts, key, parts: out });
      return () => releaseLooks(looks);
   }, [parts, key]);
   if (!parts || !key) return { parts, ready: true };
   return looked && looked.from === parts && looked.key === key ? { parts: looked.parts, ready: true } : { parts, ready: false };
}

function ModelContent({ asset, tint, fallback }: { asset: ModelAsset; tint?: string; fallback: ReactNode }) {
   const { scene } = useModel(asset);
   useCloneLook(scene, asset.material, tint);
   if (!scene) return <>{fallback}</>;
   return (
      <primitive
         object={scene}
         scale={assetScale(asset)}
         rotation-y={asset.rotationY ?? 0}
         position-y={asset.yOffset ?? 0}
      />
   );
}

// ---------- auto-rigged humanoids (core/rig) ----------

/**
 * A humanoid asset's private skinned copy (core/rig: skeleton built in code, arms down), or null
 * when the GLB is missing, unlisted or broken. Suspends while loading. The skinned template is
 * built once per loaded GLB and explicit landmarks; every call site gets its own bones.
 * Core only (<Model>, <HumanoidModel>).
 */
export function useHumanoidRig(asset: ModelAsset): HumanoidRig | null {
   const gltf = loadGltf(asset.url);
   const source = gltf?.scene ?? null;
   const options = asset.humanoid;
   // humanoidTemplate is cached by scene and landmark values, so a new options object is cheap
   const template = useMemo(() => (source ? humanoidTemplate(source, options) : null), [source, options]);
   const rig = useMemo(() => (template ? cloneHumanoid(template) : null), [template]);
   // every run remounts the Scene and clones new bones: free this clone's bone textures with it
   useEffect(() => (rig ? () => disposeHumanoid(rig) : undefined), [rig]);
   return rig;
}

/** <Model> of a humanoid asset: the auto-rigged character standing with its arms down (no animation). */
function HumanoidStill({ asset, tint, fallback }: { asset: ModelAsset; tint?: string; fallback: ReactNode }) {
   const rig = useHumanoidRig(asset);
   useCloneLook(rig?.root ?? null, asset.material, tint);
   if (!rig) return <>{fallback}</>;
   return (
      <primitive
         object={rig.root}
         scale={assetScale(asset)}
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
   /**
    * Multiplies the GLB's colours by this colour (e.g. "#93c5fd"), on top of asset.material if set.
    * One cached material per GLB material and tint: many copies in one tint share it. The fallback
    * primitive is not tinted (it has its own colour).
    */
   tint?: string;
   /** extra children inside the model's group (e.g. a hit-box helper) */
   children?: ReactNode;
}

/**
 * Renders a GLB model, or its fallback when the GLB is missing. Suspends while a listed GLB loads.
 * A `humanoid` asset is auto-rigged and stands with its arms down (animate it with <HumanoidModel>).
 */
export const Model = forwardRef<Group, ModelProps>(function Model({ asset, fallbackColor, fallback, tint, children, ...group }, ref) {
   const stand = fallback ?? <FallbackPrimitive asset={asset} color={fallbackColor} />;
   return (
      <group ref={ref} {...group}>
         <ModelErrorBoundary key={asset.url} fallback={stand}>
            {asset.humanoid ? <HumanoidStill asset={asset} tint={tint} fallback={stand} /> : <ModelContent asset={asset} tint={tint} fallback={stand} />}
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
 * GLB (asset.scale, stretch, rotationY, yOffset). Skinned meshes are skipped (rigged models are not props).
 */
export function modelParts(scene: Object3D, asset: Pick<ModelAsset, "scale" | "stretch" | "rotationY" | "yOffset">): ModelPart[] {
   scene.updateMatrixWorld(true);
   const root = new Matrix4().compose(
      new Vector3(0, asset.yOffset ?? 0, 0),
      new Quaternion().setFromAxisAngle(UP, asset.rotationY ?? 0),
      new Vector3(...assetScale(asset))
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
   const { scale, stretch, rotationY, yOffset } = asset;
   const glbParts = useMemo(
      () => (source && !rigged ? modelParts(source, { scale, stretch, rotationY, yOffset }) : null),
      [source, rigged, scale, stretch, rotationY, yOffset]
   );
   const looked = useLookedParts(glbParts, asset.material);
   if (!looked.ready) return null;
   const parts = looked.parts;
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

// ---------- moving instanced props ----------

/** The asset's fallback primitive as one instanced part: the same shape, size and colour as <FallbackPrimitive>. */
function primitivePart(shape: PrimitiveFallback, color: string): InstancePart {
   let geometry: BufferGeometry;
   switch (shape) {
      case "capsule":
         geometry = new CapsuleGeometry(0.35, 0.6, 6, 12).translate(0, 0.65, 0);
         break;
      case "sphere":
         geometry = new SphereGeometry(0.5, 20, 14).translate(0, 0.5, 0);
         break;
      case "cylinder":
         geometry = new CylinderGeometry(0.4, 0.4, 1, 20).translate(0, 0.5, 0);
         break;
      case "box":
      default:
         geometry = new BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
   }
   return { geometry, material: new MeshStandardMaterial({ color, roughness: 0.55 }) };
}

/** The asset's primitive as instanced parts, disposed with the component. */
function usePrimitiveParts(asset: ModelAsset): InstancePart[] {
   const shape = asset.fallback;
   const color = asset.fallbackColor ?? DEFAULT_FALLBACK_COLOR;
   const parts = useMemo(() => [primitivePart(shape, color)], [shape, color]);
   useEffect(
      () => () => {
         for (const part of parts) {
            part.geometry.dispose();
            (part.material as Material).dispose();
         }
      },
      [parts]
   );
   return parts;
}

export interface DynamicInstancedModelProps {
   asset: ModelAsset;
   /** the most copies drawn at once (the pool size); keep it fixed */
   count: number;
   /**
    * Called every frame for each copy 0..count-1 (FRAME_PRIORITY.visuals: after useRunFrame and the
    * camera): write where copy `index` stands (its feet, like <Model position>) into `matrix`, which
    * arrives as the identity, and return false to hide it (an unused pool slot). The GLB's own
    * scale / rotationY / yOffset and mesh transforms are applied inside that placement.
    * Per-copy tint: the third argument `color` arrives white; set it (`color.copy(BAG_RED)`, a
    * prebuilt Color: no allocation) to multiply that copy's colours (GLB and stand-in parts alike).
    * Callers that take two arguments are unchanged (no colours are written).
    */
   update: InstanceUpdate;
   /**
    * Stand-in meshes while the GLB is missing or broken, placed by the same `update`: one
    * InstancedMesh per part, with several pieces (and piece colours) per copy. Keep the array
    * stable and dispose of it yourself. Without it, the asset's primitive (also placed by `update`).
    * There is no `fallback` element (unlike <Model> / <InstancedModel>): an element would be drawn
    * once, where it stands, instead of as a moving pool.
    */
   fallbackParts?: readonly InstancePart[];
   name?: string;
   /** set when `update` tints copies: the instance colours are allocated at mount (DynamicInstanced `tinted`) */
   tinted?: boolean;
}

function DynamicFallback({ asset, count, update, fallbackParts, name, tinted }: DynamicInstancedModelProps) {
   if (fallbackParts) return <DynamicInstanced count={count} update={update} parts={fallbackParts} name={name} tinted={tinted} />;
   return <PrimitiveInstances asset={asset} count={count} update={update} name={name} tinted={tinted} />;
}

function PrimitiveInstances({ asset, count, update, name, tinted }: Pick<DynamicInstancedModelProps, "asset" | "count" | "update" | "name" | "tinted">) {
   const parts = usePrimitiveParts(asset);
   return <DynamicInstanced count={count} update={update} parts={parts} name={name} tinted={tinted} />;
}

function DynamicInstancedModelContent(props: DynamicInstancedModelProps) {
   const { asset, count, update, name } = props;
   const gltf = loadGltf(asset.url);
   const source = gltf?.scene ?? null;
   const rigged = !!asset.rigged;
   const { scale, stretch, rotationY, yOffset } = asset;
   const glbParts = useMemo<InstancePart[] | null>(
      () =>
         source && !rigged
            ? modelParts(source, { scale, stretch, rotationY, yOffset }).map((part) => ({
                 geometry: part.geometry,
                 material: part.material,
                 locals: [part.matrix],
              }))
            : null,
      [source, rigged, scale, stretch, rotationY, yOffset]
   );
   const looked = useLookedParts(glbParts, asset.material);
   if (!looked.ready) return null;
   const parts = looked.parts;
   // rigged models are characters, not pooled props: they get the fallback too
   if (!parts || parts.length === 0) return <DynamicFallback {...props} />;
   return <DynamicInstanced count={count} update={update} parts={parts} name={name} tinted={props.tinted} />;
}

/**
 * A pool of copies of a prop that move every frame (coins, obstacles, vehicles). Once the GLB is
 * listed in the manifest, every mesh of it becomes one InstancedMesh for the whole pool (draw calls
 * = meshes in the GLB); until then, or when it fails to load or breaks while rendering,
 * `fallbackParts` or else the asset's primitive, placed by the same `update`. A GLB drop needs
 * no scene change. Suspends while a listed GLB loads.
 */
export function DynamicInstancedModel(props: DynamicInstancedModelProps) {
   return (
      <ModelErrorBoundary key={props.asset.url} fallback={<DynamicFallback {...props} />}>
         <DynamicInstancedModelContent {...props} />
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
