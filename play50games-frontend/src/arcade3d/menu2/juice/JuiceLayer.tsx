"use client";

// Menu 2 juice: particles, floating popups, the camera kick and shake, and hit-stop, for a game's
// Scene. The game wraps its scene in <JuiceLayer> (inside the shell, so the run's game time and
// FxLayer are there) and calls useJuice() anywhere under it:
//
//    <JuiceLayer>
//       <World /> <Hero /> <Simulation />
//    </JuiceLayer>
//
//    const juice = useJuice();
//    juice.burst("pickup", orb, 14);                       // a pop of glints
//    juice.burst("dust", feet, 10);                        // a landing
//    juice.stream("trail", hero, 60, trailEmitter, { color });   // every frame while dashing
//    juice.popup(orb, "-0.4 s", { color: "#ffe08a" });
//    juice.kick(0, -1, 0, 3);  juice.shake(0.3);  juice.hitStop(80);
//
// Cheap by design: every particle of every kind is drawn by TWO instanced meshes (one additive
// "glow", one see-through "soft" for the dust) and every popup's every glyph by ONE more (a glyph
// atlas), so the whole layer costs at most 3 draw calls, and 0 while nothing is alive. Nothing
// allocates per frame or per burst (a colour string is parsed once).
//
// Time: the layer's visual clock is the run's pause-safe game time (useGameTime) slowed by
// hit-stop. useJuice().visualDt() is that frame's visual dt; the hero animator, the particles, the
// popups and the camera kick run on it. The rules never do: they keep useRunFrame's dt, so hit-stop
// cannot change a run's time or score.
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
   AdditiveBlending,
   CanvasTexture,
   Color,
   DynamicDrawUsage,
   InstancedBufferAttribute,
   InstancedBufferGeometry,
   InstancedMesh,
   Matrix4,
   Mesh,
   NoColorSpace,
   NormalBlending,
   PlaneGeometry,
   Quaternion,
   SRGBColorSpace,
   ShaderMaterial,
   Vector3,
} from "three";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import type { Vec3Like } from "@/arcade3d/core/collision";
import { JUICE_STYLES, createJuicePool, emitCount, emitJuice, juiceSize, parseColor, stepJuice, type EmitOptions, type JuiceKind, type JuicePool } from "./particles";
import {
   ATLAS_COLS,
   ATLAS_ROWS,
   GLYPH_ASPECT,
   GLYPH_COUNT,
   GLYPH_FIRST,
   POPUP_GLYPHS,
   createPopupPool,
   emitPopup,
   glyphCell,
   popupLook,
   stepPopups,
   type PopupPool,
} from "./popups";
import { createCameraKick, cameraKickActive, kickCamera, shakeCamera, stepCameraKick, type CameraKick } from "./cameraKick";
import { createHitStop, hitStop, stepHitStop, type HitStop } from "./hitStop";

/** Particles of the additive look alive at once (pickups, trails, checkpoints, hits, auras). */
export const GLOW_CAPACITY = 384;
/** Particles of the soft look (landing dust). */
export const SOFT_CAPACITY = 96;
/** The most draw calls the layer ever adds: the glow mesh, the soft mesh and the popup glyphs. */
export const JUICE_DRAW_CALLS = 3;

export interface PopupOptions {
   /** CSS hex colour (default a warm white) */
   color?: string;
   /** on-screen height as a fraction of half the canvas height (default 0.06) */
   size?: number;
}

/** A steady emitter's carry (juice.stream): make one per stream with createJuiceEmitter(). */
export interface JuiceEmitter {
   left: number;
}

export function createJuiceEmitter(): JuiceEmitter {
   return { left: 0 };
}

export interface JuiceApi {
   /** `count` particles (scaled by quality) of `kind` at `position`. */
   burst(kind: JuiceKind, position: Vec3Like, count?: number, options?: EmitOptions): void;
   /** A steady stream (call every frame): `rate` particles a second of visual time. */
   stream(kind: JuiceKind, position: Vec3Like, rate: number, emitter: JuiceEmitter, options?: EmitOptions): void;
   /** A floating text that pops, rises and fades. */
   popup(position: Vec3Like, text: string, options?: PopupOptions): void;
   /** Shoves the camera along (dx, dy, dz) by `amount` (spring speed, m/s); it springs back. */
   kick(dx: number, dy: number, dz: number, amount: number): void;
   /** A shake impulse 0..1. */
   shake(amount: number): void;
   /** A visual freeze of `ms` (at most 140): the visual clock dips, the rules do not. */
   hitStop(ms: number): void;
   /** This frame's visual dt (s): game time x hit-stop. 0 while paused. */
   visualDt(): number;
   /** The hit-stop's current time scale (1 = none). */
   timeScale(): number;
}

const NOOP: JuiceApi = {
   burst() {},
   stream() {},
   popup() {},
   kick() {},
   shake() {},
   hitStop() {},
   visualDt: () => 0,
   timeScale: () => 1,
};

const JuiceContext = createContext<JuiceApi | null>(null);

/** The layer's API; outside <JuiceLayer> every call does nothing (visualDt() is 0). */
export function useJuice(): JuiceApi {
   return useContext(JuiceContext) ?? NOOP;
}

/** True inside a <JuiceLayer> (the hero animator falls back to the game time outside one). */
export function useHasJuice(): boolean {
   return useContext(JuiceContext) !== null;
}

interface JuiceStore {
   glow: JuicePool;
   soft: JuicePool;
   popups: PopupPool;
   kick: CameraKick;
   stop: HitStop;
   vdt: number;
   particles: number;
   reducedMotion: boolean;
   advances: Float32Array | null;
}

/** After the game time, before the simulation: the frame's visual dt. */
const CLOCK_PRIORITY = FRAME_PRIORITY.gameTime + 0.02;
/** The kick is taken off before core FxLayer's shake undo (gameTime + 0.01) and put on after its apply (camera + 0.05): last on, first off. */
const KICK_UNDO_PRIORITY = FRAME_PRIORITY.gameTime + 0.005;
const KICK_APPLY_PRIORITY = FRAME_PRIORITY.camera + 0.06;
const DEFAULT_POPUP_COLOR = 0xfff7d6;

// ---------- particles ----------

const GLOW_AXIS = new Vector3(0.6, 0.8, 0).normalize();
const SOFT_AXIS = new Vector3(0, 1, 0);

function ParticleMesh({ pool, glow, store }: { pool: JuicePool; glow: boolean; store: JuiceStore }) {
   const mesh = useMemo(() => {
      const m = new InstancedMesh(undefined, undefined, pool.capacity);
      m.frustumCulled = false;
      m.name = glow ? "juice-glow" : "juice-soft";
      return m;
   }, [pool, glow]);
   const scratch = useMemo(() => ({ m: new Matrix4(), p: new Vector3(), q: new Quaternion(), s: new Vector3(), c: new Color() }), []);
   useLayoutEffect(() => {
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.setColorAt(0, scratch.c.set(1, 1, 1));
      mesh.instanceColor?.setUsage(DynamicDrawUsage);
      mesh.count = 0;
      mesh.visible = false;
   }, [mesh, scratch]);
   useFrame(() => {
      stepJuice(pool, store.vdt);
      const n = pool.count;
      const axis = glow ? GLOW_AXIS : SOFT_AXIS;
      for (let i = 0; i < n; i++) {
         const size = juiceSize(pool.kind[i], pool.age[i] / pool.life[i]) * pool.scale[i];
         scratch.p.set(pool.px[i], pool.py[i], pool.pz[i]);
         scratch.q.setFromAxisAngle(axis, pool.angle[i]);
         scratch.s.set(size, size, size);
         scratch.m.compose(scratch.p, scratch.q, scratch.s);
         mesh.setMatrixAt(i, scratch.m);
         mesh.setColorAt(i, scratch.c.setRGB(pool.r[i], pool.g[i], pool.b[i], SRGBColorSpace));
      }
      mesh.count = n;
      // an empty pool costs no draw call
      mesh.visible = n > 0;
      if (n > 0) {
         mesh.instanceMatrix.needsUpdate = true;
         if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
   }, FRAME_PRIORITY.visuals);
   useEffect(
      () => () => {
         mesh.dispose();
      },
      [mesh]
   );
   return (
      <primitive object={mesh}>
         {glow ? <octahedronGeometry args={[0.5, 0]} /> : <icosahedronGeometry args={[0.5, 1]} />}
         {glow ? (
            <meshBasicMaterial transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
         ) : (
            <meshLambertMaterial transparent opacity={0.72} depthWrite={false} blending={NormalBlending} />
         )}
      </primitive>
   );
}

// ---------- popups: one atlas, one draw call ----------

const CELL_H = 64;
const CELL_W = Math.round(CELL_H * GLYPH_ASPECT);
const FONT = `800 ${Math.round(CELL_H * 0.72)}px system-ui, -apple-system, "Segoe UI", sans-serif`;

/** Draws printable ASCII into the atlas (white fill, dark outline) and measures each glyph's advance (in glyph heights). */
function buildAtlas(): { texture: CanvasTexture; advances: Float32Array } {
   const canvas = document.createElement("canvas");
   canvas.width = CELL_W * ATLAS_COLS;
   canvas.height = CELL_H * ATLAS_ROWS;
   const ctx = canvas.getContext("2d");
   const advances = new Float32Array(GLYPH_COUNT).fill(GLYPH_ASPECT);
   if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.lineWidth = 7;
      ctx.strokeStyle = "rgb(15, 23, 42)";
      ctx.fillStyle = "#ffffff";
      const cell = { col: 0, row: 0 };
      for (let g = 0; g < GLYPH_COUNT; g++) {
         const ch = String.fromCharCode(GLYPH_FIRST + g);
         glyphCell(g, cell);
         const x = cell.col * CELL_W + CELL_W / 2;
         const y = cell.row * CELL_H + CELL_H / 2 + 2;
         ctx.strokeText(ch, x, y);
         ctx.fillText(ch, x, y);
         const w = ctx.measureText(ch).width + 4;
         advances[g] = Math.max(0.28, Math.min(GLYPH_ASPECT, w / CELL_H));
      }
   }
   const texture = new CanvasTexture(canvas);
   // raw values: the shader writes them as they are, like the colours it is given
   texture.colorSpace = NoColorSpace;
   texture.needsUpdate = true;
   return { texture, advances };
}

const POPUP_VERTEX = /* glsl */ `
uniform float uAspect;
uniform vec2 uCells;
uniform float uGlyphAspect;
attribute vec3 iAnchor;
attribute vec4 iGlyph;
attribute vec4 iColor;
varying vec2 vUv;
varying vec4 vColor;
void main() {
   vec4 clip = projectionMatrix * modelViewMatrix * vec4(iAnchor, 1.0);
   float h = iGlyph.w;
   vec2 local = vec2((position.x * uGlyphAspect + iGlyph.x) * h, position.y * h);
   clip.xy += vec2(local.x / uAspect, local.y) * clip.w;
   // behind the camera: off screen
   if (clip.w <= 0.0) clip = vec4(2.0, 2.0, 2.0, 1.0);
   gl_Position = clip;
   vUv = vec2((iGlyph.y + uv.x) / uCells.x, 1.0 - (iGlyph.z + 1.0 - uv.y) / uCells.y);
   vColor = iColor;
}
`;

const POPUP_FRAGMENT = /* glsl */ `
uniform sampler2D uAtlas;
varying vec2 vUv;
varying vec4 vColor;
void main() {
   vec4 t = texture2D(uAtlas, vUv);
   float a = t.a * vColor.a;
   if (a < 0.02) discard;
   gl_FragColor = vec4(t.rgb * vColor.rgb, a);
}
`;

function PopupMesh({ store }: { store: JuiceStore }) {
   const size = useThree((s) => s.size);
   const built = useMemo(() => {
      const atlas = buildAtlas();
      store.advances = atlas.advances;
      const base = new PlaneGeometry(1, 1);
      const geometry = new InstancedBufferGeometry();
      geometry.index = base.index;
      geometry.setAttribute("position", base.getAttribute("position"));
      geometry.setAttribute("uv", base.getAttribute("uv"));
      const anchor = new InstancedBufferAttribute(new Float32Array(POPUP_GLYPHS * 3), 3);
      const glyph = new InstancedBufferAttribute(new Float32Array(POPUP_GLYPHS * 4), 4);
      const color = new InstancedBufferAttribute(new Float32Array(POPUP_GLYPHS * 4), 4);
      for (const a of [anchor, glyph, color]) a.setUsage(DynamicDrawUsage);
      geometry.setAttribute("iAnchor", anchor);
      geometry.setAttribute("iGlyph", glyph);
      geometry.setAttribute("iColor", color);
      geometry.instanceCount = 0;
      const material = new ShaderMaterial({
         uniforms: {
            uAtlas: { value: atlas.texture },
            uAspect: { value: 1 },
            uCells: { value: [ATLAS_COLS, ATLAS_ROWS] },
            uGlyphAspect: { value: GLYPH_ASPECT },
         },
         vertexShader: POPUP_VERTEX,
         fragmentShader: POPUP_FRAGMENT,
         transparent: true,
         depthTest: false,
         depthWrite: false,
      });
      const mesh = new Mesh(geometry, material);
      mesh.frustumCulled = false;
      mesh.renderOrder = 1000;
      mesh.visible = false;
      mesh.name = "juice-popups";
      return { mesh, geometry, material, texture: atlas.texture, base, anchor, glyph, color, look: { rise: 0, opacity: 0, pop: 1 }, cell: { col: 0, row: 0 } };
   }, [store]);
   useEffect(() => {
      built.material.uniforms.uAspect.value = size.width / Math.max(1, size.height);
   }, [built, size]);
   useEffect(
      () => () => {
         built.geometry.dispose();
         built.base.dispose();
         built.material.dispose();
         built.texture.dispose();
      },
      [built]
   );
   useFrame(() => {
      const pool = store.popups;
      stepPopups(pool, store.vdt);
      const { anchor, glyph, color, look, cell } = built;
      let n = 0;
      for (const slot of pool.slots) {
         if (!slot.active) continue;
         popupLook(slot.age, look);
         const h = slot.size * look.pop;
         for (let i = 0; i < slot.length && n < POPUP_GLYPHS; i++) {
            glyphCell(slot.glyphs[i], cell);
            anchor.setXYZ(n, slot.x, slot.y + look.rise, slot.z);
            glyph.setXYZW(n, slot.offsets[i], cell.col, cell.row, h);
            color.setXYZW(n, slot.r, slot.g, slot.b, look.opacity);
            n++;
         }
      }
      built.geometry.instanceCount = n;
      built.mesh.visible = n > 0;
      if (n > 0) {
         anchor.needsUpdate = true;
         glyph.needsUpdate = true;
         color.needsUpdate = true;
      }
   }, FRAME_PRIORITY.visuals);
   return <primitive object={built.mesh} />;
}

// ---------- the camera kick ----------

function KickDriver({ store }: { store: JuiceStore }) {
   const camera = useThree((s) => s.camera);
   const applied = useMemo(() => ({ offset: new Vector3(), axis: new Vector3(), shaken: new Vector3(), on: false }), []);
   const undo = () => {
      if (!applied.on) return;
      // placed absolutely since (a rig on resize, a game's .set()): that position is clean already
      if (camera.position.equals(applied.shaken)) camera.position.sub(applied.offset);
      applied.offset.set(0, 0, 0);
      applied.on = false;
   };
   useLayoutEffect(() => undo, [camera]); // eslint-disable-line react-hooks/exhaustive-deps
   useFrame(undo, KICK_UNDO_PRIORITY);
   useFrame(() => {
      const k = store.kick;
      if (!cameraKickActive(k)) return;
      stepCameraKick(k, store.vdt);
      applied.offset.set(k.offset.x, k.offset.y, k.offset.z);
      applied.axis.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(k.shakeRight);
      applied.offset.add(applied.axis);
      applied.axis.setFromMatrixColumn(camera.matrixWorld, 1).multiplyScalar(k.shakeUp);
      applied.offset.add(applied.axis);
      camera.position.add(applied.offset);
      applied.shaken.copy(camera.position);
      applied.on = true;
   }, KICK_APPLY_PRIORITY);
   return null;
}

/** The visual clock: game time x hit-stop, once per frame before anything reads it. */
function JuiceClock({ store }: { store: JuiceStore }) {
   const time = useGameTime();
   useFrame(() => {
      store.vdt = stepHitStop(store.stop, time.delta);
   }, CLOCK_PRIORITY);
   return null;
}

// ---------- the layer ----------

export function JuiceLayer({ children }: { children?: ReactNode }) {
   const quality = useQuality();
   const [store] = useState<JuiceStore>(() => ({
      glow: createJuicePool(GLOW_CAPACITY, 0x9e3779b9),
      soft: createJuicePool(SOFT_CAPACITY, 0x85ebca6b),
      popups: createPopupPool(),
      kick: createCameraKick(),
      stop: createHitStop(),
      vdt: 0,
      particles: 1,
      reducedMotion: false,
      advances: null,
   }));
   store.particles = quality.particles;

   useEffect(() => {
      if (typeof window === "undefined" || !window.matchMedia) return;
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      const read = () => {
         store.reducedMotion = query.matches;
         store.stop.reducedMotion = query.matches;
      };
      read();
      query.addEventListener?.("change", read);
      return () => query.removeEventListener?.("change", read);
   }, [store]);

   const api = useMemo<JuiceApi>(() => {
      const poolOf = (kind: JuiceKind) => (JUICE_STYLES[kind].look === "soft" ? store.soft : store.glow);
      return {
         burst(kind, p, count = 12, options) {
            emitJuice(poolOf(kind), kind, p.x, p.y, p.z, scaledCount(count, store.particles), options);
         },
         stream(kind, p, rate, emitter, options) {
            const n = emitCount(emitter, rate * store.particles, store.vdt);
            if (n > 0) emitJuice(poolOf(kind), kind, p.x, p.y, p.z, n, options);
         },
         popup(p, text, options) {
            const rgb = options?.color ? parseColor(options.color) : DEFAULT_POPUP_COLOR;
            emitPopup(store.popups, p.x, p.y, p.z, text, rgb, options?.size ?? 0.06, store.advances ?? undefined);
         },
         kick(dx, dy, dz, amount) {
            kickCamera(store.kick, dx, dy, dz, amount, store.reducedMotion);
         },
         shake(amount) {
            shakeCamera(store.kick, amount, store.reducedMotion);
         },
         hitStop(ms) {
            hitStop(store.stop, ms);
         },
         visualDt: () => store.vdt,
         timeScale: () => store.stop.scale,
      };
   }, [store]);

   return (
      <JuiceContext.Provider value={api}>
         <JuiceClock store={store} />
         {children}
         <ParticleMesh pool={store.glow} glow store={store} />
         <ParticleMesh pool={store.soft} glow={false} store={store} />
         <PopupMesh store={store} />
         <KickDriver store={store} />
      </JuiceContext.Provider>
   );
}
