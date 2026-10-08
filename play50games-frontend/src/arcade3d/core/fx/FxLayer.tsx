"use client";

// Shared effects for every game: pooled particle bursts, floating score popups and camera shake.
// ShellStage wraps every run's Scene in <FxLayer> (inside the per-run GameTimeProvider), so games
// just call the hooks inside their Scene:
//
//    const fx = useFx();
//    useRunFrame(() => {
//       if (picked) {
//          fx.burst("sparkle", robot.position, 18);
//          fx.score(robot.position, "+100");
//          fx.shake(0.2);
//       }
//    });
//
// - Nothing is drawn (no mesh, no draw call) until a game first uses a kind: the first burst of a
//   kind mounts its pool, one InstancedMesh = one draw call for every particle of that kind. Call
//   fx.warm("sparkle", "score") once on mount to build them before play (no hitch on first use).
// - burst/score/shake never allocate (after a kind's first use); counts are scaled by
//   useQuality().particles. Positions are read at once (a Vector3, an Object3D's position, {x,y,z}).
// - Effects advance with the run's pause-safe clock (useGameTime): frozen while paused, gone on
//   the next run (the layer remounts with the Scene).
// - fx.shake(amount) (or useCameraShake()) moves the camera by a decaying offset after the camera
//   rigs ran and takes it off before the next frame's rigs, so it works with a static camera and
//   any CameraRig. Off when the player prefers reduced motion.
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
   AdditiveBlending,
   CanvasTexture,
   Color,
   DoubleSide,
   DynamicDrawUsage,
   InstancedMesh,
   Matrix4,
   NormalBlending,
   Quaternion,
   SRGBColorSpace,
   Sprite,
   SpriteMaterial,
   Vector3,
} from "three";
import { useGameTime } from "../gameTime";
import { FRAME_PRIORITY } from "../frameLoop";
import { scaledCount, useQuality } from "../quality";
import type { Vec3Like } from "../collision";
import {
   BURST_KINDS,
   BURST_STYLES,
   createParticlePool,
   emitBurst,
   particleScale,
   stepParticles,
   type BurstKind,
   type ParticlePool,
} from "./bursts";
import { addShake, createShake, stepShake, type ShakeState } from "./cameraShake";
import { createScoreSlots, emitScore, scoreLook, stepScores, type ScoreSlots } from "./floatingScores";

export interface ScoreOptions {
   /** CSS colour of the text (default a warm white) */
   color?: string;
   /** on-screen height as a fraction of half the canvas height (default 0.06 ≈ 3 % of the screen) */
   size?: number;
}

export interface FxApi {
   /** A burst of `count` particles (default 12, scaled by quality) of `kind` at `position`. */
   burst(kind: BurstKind, position: Vec3Like, count?: number): void;
   /** A floating text that rises and fades ("+200"). */
   score(position: Vec3Like, text: string, options?: ScoreOptions): void;
   /** A camera shake impulse, 0..1 (0.2 = a bump, 1 = an explosion). */
   shake(amount: number): void;
   /** Builds the pools of these kinds now ("score" = the popups), so their first use does not hitch. */
   warm(...kinds: Array<BurstKind | "score">): void;
}

const NOOP_FX: FxApi = { burst() {}, score() {}, shake() {}, warm() {} };

/** Undo the shake offset after the run clock and the game clock, before the game and the rigs. */
const SHAKE_UNDO_PRIORITY = FRAME_PRIORITY.gameTime + 0.01;
/** Apply it after every CameraRig (FRAME_PRIORITY.camera), before the poses and visuals. */
const SHAKE_APPLY_PRIORITY = FRAME_PRIORITY.camera + 0.05;

const DEFAULT_SCORE_COLOR = "#fff7d6";
const DEFAULT_SCORE_SIZE = 0.06;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

interface FxStore {
   pools: Partial<Record<BurstKind, ParticlePool>>;
   scores: ScoreSlots | null;
   shake: ShakeState;
   reducedMotion: boolean;
   particles: number;
}

const FxContext = createContext<FxApi | null>(null);

/** The run's effects (inside a GameShell Scene). Outside FxLayer every call does nothing. */
export function useFx(): FxApi {
   return useContext(FxContext) ?? NOOP_FX;
}

/** Shorthand for useFx().shake: `const shake = useCameraShake(); shake(0.3);` */
export function useCameraShake(): (amount: number) => void {
   return useFx().shake;
}

// ---------- bursts ----------

const GLOW_PROPS = { transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false } as const;

function BurstShape({ kind }: { kind: BurstKind }) {
   const style = BURST_STYLES[kind];
   switch (style.shape) {
      case "octa":
         return <octahedronGeometry args={[0.5, 0]} />;
      case "box":
         return <boxGeometry args={[1, 1, 1]} />;
      case "plane":
         return <planeGeometry args={[1, 1]} />;
      case "ico":
      default:
         return <icosahedronGeometry args={[0.5, 0]} />;
   }
}

function BurstMaterial({ kind }: { kind: BurstKind }) {
   const style = BURST_STYLES[kind];
   if (style.look === "glow") return <meshBasicMaterial {...GLOW_PROPS} opacity={style.opacity} />;
   if (style.look === "soft") {
      return <meshLambertMaterial transparent opacity={style.opacity} depthWrite={false} blending={NormalBlending} />;
   }
   return <meshLambertMaterial side={style.shape === "plane" ? DoubleSide : undefined} />;
}

function BurstMesh({ kind, pool }: { kind: BurstKind; pool: ParticlePool }) {
   const time = useGameTime();
   const ref = useRef<InstancedMesh>(null);
   const style = BURST_STYLES[kind];
   const scratch = useMemo(
      () => ({
         matrix: new Matrix4(),
         position: new Vector3(),
         quaternion: new Quaternion(),
         axis: new Vector3(),
         scale: new Vector3(),
         colors: style.colors.map((c) => new Color(c)),
      }),
      [style]
   );

   useLayoutEffect(() => {
      const mesh = ref.current;
      if (!mesh) return;
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      // creates the colour buffer once (setColorAt allocates it on first use)
      mesh.setColorAt(0, scratch.colors[0]);
      mesh.instanceColor?.setUsage(DynamicDrawUsage);
      mesh.count = 0;
      mesh.visible = false;
   }, [scratch]);

   useFrame(() => {
      const mesh = ref.current;
      if (!mesh) return;
      stepParticles(pool, style, time.delta);
      const n = pool.count;
      const [dx, dy, dz] = style.dims;
      for (let i = 0; i < n; i++) {
         const s = particleScale(style, pool.age[i] / pool.life[i]);
         scratch.position.set(pool.px[i], pool.py[i], pool.pz[i]);
         scratch.axis.set(pool.ax[i], pool.ay[i], pool.az[i]);
         scratch.quaternion.setFromAxisAngle(scratch.axis, pool.angle[i]);
         scratch.scale.set(dx * s, dy * s, dz * s);
         scratch.matrix.compose(scratch.position, scratch.quaternion, scratch.scale);
         mesh.setMatrixAt(i, scratch.matrix);
         mesh.setColorAt(i, scratch.colors[pool.color[i]]);
      }
      mesh.count = n;
      // an empty pool is not drawn at all (an InstancedMesh with 0 copies would still cost a call)
      mesh.visible = n > 0;
      if (n > 0) {
         mesh.instanceMatrix.needsUpdate = true;
         if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
   }, FRAME_PRIORITY.visuals);

   return (
      <instancedMesh ref={ref} args={[undefined, undefined, pool.capacity]} frustumCulled={false} name={`fx-${kind}`}>
         <BurstShape kind={kind} />
         <BurstMaterial kind={kind} />
      </instancedMesh>
   );
}

// ---------- floating scores ----------

const SCORE_CANVAS_W = 256;
const SCORE_CANVAS_H = 64;

function drawScore(canvas: HTMLCanvasElement, text: string, color: string): void {
   const ctx = canvas.getContext("2d");
   if (!ctx) return;
   ctx.clearRect(0, 0, SCORE_CANVAS_W, SCORE_CANVAS_H);
   let font = 44;
   ctx.font = `800 ${font}px system-ui, -apple-system, "Segoe UI", sans-serif`;
   const width = ctx.measureText(text).width;
   if (width > SCORE_CANVAS_W - 16) {
      font = Math.max(14, Math.floor((font * (SCORE_CANVAS_W - 16)) / width));
      ctx.font = `800 ${font}px system-ui, -apple-system, "Segoe UI", sans-serif`;
   }
   ctx.textAlign = "center";
   ctx.textBaseline = "middle";
   ctx.lineJoin = "round";
   ctx.lineWidth = 7;
   ctx.strokeStyle = "rgba(15, 23, 42, 0.85)";
   ctx.strokeText(text, SCORE_CANVAS_W / 2, SCORE_CANVAS_H / 2 + 2);
   ctx.fillStyle = color;
   ctx.fillText(text, SCORE_CANVAS_W / 2, SCORE_CANVAS_H / 2 + 2);
}

function FloatingScores({ pool }: { pool: ScoreSlots }) {
   const time = useGameTime();
   const group = useMemo(() => {
      const items = pool.slots.map(() => {
         const canvas = document.createElement("canvas");
         canvas.width = SCORE_CANVAS_W;
         canvas.height = SCORE_CANVAS_H;
         const texture = new CanvasTexture(canvas);
         texture.colorSpace = SRGBColorSpace;
         const material = new SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            sizeAttenuation: false,
            toneMapped: false,
         });
         const sprite = new Sprite(material);
         sprite.visible = false;
         sprite.renderOrder = 1000;
         sprite.frustumCulled = false;
         return { canvas, texture, material, sprite };
      });
      return { items, look: { rise: 0, opacity: 0, pop: 1 } };
   }, [pool]);

   useEffect(
      () => () => {
         for (const item of group.items) {
            item.texture.dispose();
            item.material.dispose();
         }
      },
      [group]
   );

   useFrame(() => {
      stepScores(pool, time.delta);
      const { items, look } = group;
      for (let i = 0; i < items.length; i++) {
         const slot = pool.slots[i];
         const item = items[i];
         if (!slot.active) {
            item.sprite.visible = false;
            continue;
         }
         if (slot.dirty) {
            drawScore(item.canvas, slot.text, slot.color);
            item.texture.needsUpdate = true;
            slot.dirty = false;
         }
         scoreLook(slot.age, look);
         item.sprite.visible = true;
         item.sprite.position.set(slot.x, slot.y + look.rise, slot.z);
         const h = slot.size * look.pop;
         item.sprite.scale.set((h * SCORE_CANVAS_W) / SCORE_CANVAS_H, h, 1);
         item.material.opacity = look.opacity;
      }
   }, FRAME_PRIORITY.visuals);

   return (
      <group name="fx-scores">
         {group.items.map((item, i) => (
            <primitive key={i} object={item.sprite} />
         ))}
      </group>
   );
}

// ---------- shake ----------

function ShakeDriver({ store }: { store: FxStore }) {
   const camera = useThree((state) => state.camera);
   const time = useGameTime();
   const applied = useMemo(
      () => ({ offset: new Vector3(), axis: new Vector3(), shaken: new Vector3(), on: false }),
      []
   );

   const undo = () => {
      if (!applied.on) return;
      // something placed the camera absolutely since the shake (CameraRig on a resize, a game's
      // own .set()): that position is already clean, so the offset is dropped, not subtracted
      if (camera.position.equals(applied.shaken)) camera.position.sub(applied.offset);
      applied.offset.set(0, 0, 0);
      applied.on = false;
   };

   // the camera is left unshaken when the run's layer goes (Retry, Exit), before the next frame renders
   useLayoutEffect(() => undo, [camera]); // eslint-disable-line react-hooks/exhaustive-deps

   useFrame(undo, SHAKE_UNDO_PRIORITY);

   useFrame(() => {
      const shake = store.shake;
      if (shake.trauma <= 0) return;
      stepShake(shake, time.delta);
      if (shake.x === 0 && shake.y === 0) return;
      // along the camera's own right / up (its world matrix from the last render is close enough)
      applied.offset.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(shake.x);
      applied.axis.setFromMatrixColumn(camera.matrixWorld, 1).multiplyScalar(shake.y);
      applied.offset.add(applied.axis);
      camera.position.add(applied.offset);
      applied.shaken.copy(camera.position);
      applied.on = true;
   }, SHAKE_APPLY_PRIORITY);

   return null;
}

// ---------- the layer ----------

/** Rendered by ShellStage around every run's Scene. Games never render it. */
export function FxLayer({ children }: { children?: ReactNode }) {
   const quality = useQuality();
   const [store] = useState<FxStore>(() => ({
      pools: {},
      scores: null,
      shake: createShake(),
      reducedMotion: false,
      particles: 1,
   }));
   store.particles = quality.particles;
   const [kinds, setKinds] = useState<readonly BurstKind[]>([]);
   const [scoresOn, setScoresOn] = useState(false);

   useEffect(() => {
      if (typeof window === "undefined" || !window.matchMedia) return;
      const query = window.matchMedia(REDUCED_MOTION_QUERY);
      const read = () => {
         store.reducedMotion = query.matches;
      };
      read();
      query.addEventListener?.("change", read);
      return () => query.removeEventListener?.("change", read);
   }, [store]);

   const api = useMemo<FxApi>(() => {
      const poolOf = (kind: BurstKind): ParticlePool => {
         let pool = store.pools[kind];
         if (!pool) {
            pool = createParticlePool(BURST_STYLES[kind].capacity, 0x9e3779b9 ^ BURST_KINDS.indexOf(kind));
            store.pools[kind] = pool;
            // mounts the kind's mesh on the next commit (once per kind and run)
            setKinds((list) => (list.includes(kind) ? list : [...list, kind]));
         }
         return pool;
      };
      const scoresPool = (): ScoreSlots => {
         if (!store.scores) {
            store.scores = createScoreSlots();
            setScoresOn(true);
         }
         return store.scores;
      };
      return {
         burst(kind, position, count = 12) {
            const style = BURST_STYLES[kind];
            if (!style) return;
            emitBurst(poolOf(kind), style, position.x, position.y, position.z, scaledCount(count, store.particles));
         },
         score(position, text, options) {
            emitScore(
               scoresPool(),
               position.x,
               position.y,
               position.z,
               text,
               options?.color ?? DEFAULT_SCORE_COLOR,
               options?.size ?? DEFAULT_SCORE_SIZE
            );
         },
         shake(amount) {
            addShake(store.shake, amount, store.reducedMotion);
         },
         warm(...list) {
            for (const kind of list) {
               if (kind === "score") scoresPool();
               else if (BURST_STYLES[kind]) poolOf(kind);
            }
         },
      };
   }, [store]);

   return (
      <FxContext.Provider value={api}>
         {children}
         {kinds.map((kind) => (
            <BurstMesh key={kind} kind={kind} pool={store.pools[kind] as ParticlePool} />
         ))}
         {scoresOn && store.scores && <FloatingScores pool={store.scores} />}
         <ShakeDriver store={store} />
      </FxContext.Provider>
   );
}
