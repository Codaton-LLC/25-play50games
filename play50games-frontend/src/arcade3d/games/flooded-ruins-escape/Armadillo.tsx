"use client";

// The Menu 2 hero's stand-in (CLAUDE.md decision 5, redesigned 2026-10-25): an original armadillo /
// pangolin-style hero after the user's approved concept (B01-armadillo-hero, not committed): Riko red
// overlapping plates from the crown down the back to a plated tail, glowing seams between them, red
// shoulder and knee pads with glowing edges, an open helmet with a clear brim visor and headphones,
// tan skin, a charcoal suit and a leather belt (no eye mask, nothing TMNT-like). It stands in the asset
// slot ASSETS.hero (assets.ts): the fallback while m2HeroRiko.glb is missing or broken. The curled
// ball of plates is ArmadilloBall, drawn for the GLB and the stand-in alike.
//
// Rigged the simplest way: one group per joint (hips, legs, shoulders, arms, head, tail) turned by a pose
// the Scene writes every frame, plus a ball of plates the hero rolls into (bounce pads, falls, the intro
// drop). Every joint's parts are baked once into merged, vertex-coloured meshes (one per material), so
// the whole hero costs about 20 draw calls, not one per shape.
//
// Size: 1.45 m tall (ARMADILLO.height), feet on y = 0, facing +z (like a Rodin character).
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import {
   BoxGeometry,
   BufferAttribute,
   BufferGeometry,
   CapsuleGeometry,
   Color,
   CylinderGeometry,
   DoubleSide,
   Euler,
   Matrix4,
   MeshStandardMaterial,
   Quaternion,
   RepeatWrapping,
   SphereGeometry,
   TorusGeometry,
   Vector3,
   type Group,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useCanvasTexture } from "@/arcade3d/core/render/useCanvasTexture";

export const ARMADILLO = {
   height: 1.45,
   hipY: 0.56,
   shoulderY: 1.03,
   headY: 1.26,
   ballRadius: 0.5,
} as const;

/** What the Scene writes every frame (Hero.tsx). */
export interface ArmadilloPose {
   /** 0 standing .. 1 full run */
   run: number;
   /** the stride phase (rad) */
   phase: number;
   /** 0 .. 1: legs and arms tucked (a jump) */
   tuck: number;
   /** 0 .. 1: curled up into the ball of plates */
   roll: number;
   /** the ball's spin (rad) */
   spin: number;
   /** idle breathing time (s) */
   time: number;
   /** 0 .. 1: arms up (the win) */
   cheer: number;
}

export function createArmadilloPose(): ArmadilloPose {
   return { run: 0, phase: 0, tuck: 0, roll: 0, spin: 0, time: 0, cheer: 0 };
}

/** Riko's colours: the plates are the hero colour (a recolour makes Nami, Kiro, Zuno, Vexa). */
export const HERO_COLORS = {
   plate: "#ef4444",
   plateDark: "#b42323",
   glow: "#ff7a3c",
   suit: "#2b2f3a",
   skin: "#c8834a",
   skinLight: "#e8b884",
   leather: "#7a4a2a",
   metal: "#a7afb8",
   boot: "#1f232c",
   visor: "#9be7ff",
   eye: "#ffffff",
   pupil: "#1b1b24",
} as const;

type Vec3 = readonly [number, number, number];
/** One shape baked into a joint's mesh: geometry, position, scale, rotation (xyz), colour, uv tiling + u shift. */
interface Part {
   geo: BufferGeometry;
   at: Vec3;
   scale?: number | Vec3;
   rot?: Vec3;
   color?: string;
   uv?: readonly [number, number, number?];
}

const M = new Matrix4();
const Q = new Quaternion();
const E = new Euler();
const P = new Vector3();
const S = new Vector3();
const C = new Color();

/** Bakes parts into one indexed geometry with a colour attribute (built once per mount, never per frame). */
function bake(parts: Part[]): BufferGeometry {
   const list = parts.map(({ geo, at, scale = 1, rot = [0, 0, 0], color = "#ffffff", uv }) => {
      const g = geo.clone();
      const s = typeof scale === "number" ? [scale, scale, scale] : scale;
      M.compose(P.set(at[0], at[1], at[2]), Q.setFromEuler(E.set(rot[0], rot[1], rot[2])), S.set(s[0], s[1], s[2]));
      g.applyMatrix4(M);
      C.set(color);
      const n = g.getAttribute("position").count;
      const colors = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
         colors[i * 3] = C.r;
         colors[i * 3 + 1] = C.g;
         colors[i * 3 + 2] = C.b;
      }
      g.setAttribute("color", new BufferAttribute(colors, 3));
      const uvs = g.getAttribute("uv");
      if (uv && uvs) {
         for (let i = 0; i < uvs.count; i++) uvs.setXY(i, uvs.getX(i) * uv[0] + (uv[2] ?? 0), uvs.getY(i) * uv[1]);
      }
      return g;
   });
   const merged = mergeGeometries(list);
   list.forEach((g) => g.dispose());
   if (!merged) throw new Error("armadillo: parts did not merge");
   return merged;
}

const SCALES_ACROSS = 8;

/** One row of overlapping scale plates (light grey: the vertex colour tints it). */
function drawScales(ctx: CanvasRenderingContext2D, w: number, h: number) {
   ctx.fillStyle = "#8d8d8d";
   ctx.fillRect(0, 0, w, h);
   const sw = w / SCALES_ACROSS;
   const grad = ctx.createLinearGradient(0, 0, 0, h);
   grad.addColorStop(0, "#b9b9b9");
   grad.addColorStop(0.45, "#ffffff");
   grad.addColorStop(0.85, "#d6d6d6");
   grad.addColorStop(1, "#8a8a8a");
   ctx.fillStyle = grad;
   ctx.strokeStyle = "#5b5b5b";
   ctx.lineWidth = 3;
   for (let k = 0; k < SCALES_ACROSS; k++) {
      const x0 = k * sw;
      ctx.beginPath();
      ctx.moveTo(x0 + 2, 0);
      ctx.lineTo(x0 + 2, h * 0.5);
      ctx.quadraticCurveTo(x0 + sw / 2, h * 1.12, x0 + sw - 2, h * 0.5);
      ctx.lineTo(x0 + sw - 2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
   }
}

/** The glowing seams around the same plates (the emissive map). */
function drawSeams(ctx: CanvasRenderingContext2D, w: number, h: number) {
   ctx.fillStyle = "#000000";
   ctx.fillRect(0, 0, w, h);
   const sw = w / SCALES_ACROSS;
   ctx.strokeStyle = "#ffffff";
   ctx.lineWidth = 2.5;
   for (let k = 0; k < SCALES_ACROSS; k++) {
      const x0 = k * sw;
      ctx.beginPath();
      ctx.moveTo(x0 + 2, h * 0.5);
      ctx.quadraticCurveTo(x0 + sw / 2, h * 1.12, x0 + sw - 2, h * 0.5);
      ctx.stroke();
   }
}

function useLooks() {
   const scales = useCanvasTexture(512, 128, drawScales);
   const seams = useCanvasTexture(512, 128, drawSeams);
   const looks = useMemo(() => {
      for (const t of [scales, seams]) {
         t.wrapS = RepeatWrapping;
         t.wrapT = RepeatWrapping;
         t.needsUpdate = true;
      }
      return {
         // every opaque, untextured part (suit, skin, belt, pads...) in one vertex-coloured material
         body: new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.08 }),
         // the plates: the scale texture tinted by the vertex colour, the seams glowing
         shell: new MeshStandardMaterial({
            vertexColors: true,
            map: scales,
            emissiveMap: seams,
            emissive: new Color(HERO_COLORS.glow),
            emissiveIntensity: 1.1,
            roughness: 0.36,
            metalness: 0.15,
         }),
         glow: new MeshStandardMaterial({ color: HERO_COLORS.glow, emissive: new Color(HERO_COLORS.glow), emissiveIntensity: 1.8, roughness: 0.4 }),
         ballGlow: new MeshStandardMaterial({ color: HERO_COLORS.glow, emissive: new Color(HERO_COLORS.glow), emissiveIntensity: 1.8, roughness: 0.4 }),
         visor: new MeshStandardMaterial({ color: HERO_COLORS.visor, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.3, side: DoubleSide, depthWrite: false }),
      };
   }, [scales, seams]);
   useEffect(() => () => Object.values(looks).forEach((m) => m.dispose()), [looks]);
   return looks;
}

const H = HERO_COLORS;

/** The stand-in's baked meshes, per joint (exported for assets.test.ts). */
export function buildArmadilloShapes() {
   const ball = new SphereGeometry(1, 18, 12);
   const ballFine = new SphereGeometry(1, 24, 16);
   const leg = new CapsuleGeometry(0.088, 0.3, 6, 12);
   const limb = new CapsuleGeometry(0.075, 0.26, 6, 12);
   const torso = new CapsuleGeometry(0.25, 0.2, 8, 18);
   const belt = new TorusGeometry(0.255, 0.032, 8, 28);
   const box = new BoxGeometry(0.13, 0.08, 0.03);
   const earCup = new CylinderGeometry(0.065, 0.065, 0.05, 16);
   const rim = new TorusGeometry(0.236, 0.026, 8, 30);
   const cap = new SphereGeometry(0.235, 24, 10, 0, Math.PI * 2, 0, 1.05);
   const band = new TorusGeometry(1, 0.06, 6, 30);
   // three's sphere: phi = π/2 faces +z (the front), so 0.85π .. 2.15π wraps the back and a little past
   // the sides; theta runs down from the crown. Five overlapping bands, glowing lines between them.
   const back = (r: number, t0: number, t1: number) => new SphereGeometry(r, 28, 6, Math.PI * 0.85, Math.PI * 1.3, t0, t1 - t0);
   const bands = [0, 1, 2, 3, 4].map((i) => back(0.36 + i * 0.012, 0.35 + i * 0.36, 0.35 + (i + 1) * 0.36 + 0.06));
   const lines = [1, 2, 3, 4].map((i) => back(0.372 + i * 0.012, 0.35 + i * 0.36 - 0.012, 0.35 + i * 0.36 + 0.018));
   const shellAt: Vec3 = [0, 0.86, -0.02];
   const shellScale: Vec3 = [1.02, 1.12, 0.9];

   const torsoParts = {
      body: bake([
         { geo: torso, at: [0, 0.84, 0], color: H.suit },
         { geo: ball, at: [0, 0.82, 0.12], scale: [0.19, 0.24, 0.12], color: H.skinLight },
         { geo: belt, at: [0, 0.63, 0], rot: [Math.PI / 2, 0, 0], color: H.leather },
         { geo: box, at: [0, 0.63, 0.275], color: H.metal },
         { geo: ball, at: [0.2, 0.63, 0.19], scale: [0.035, 0.03, 0.02], color: H.plate },
         { geo: ball, at: [-0.2, 0.63, 0.19], scale: [0.035, 0.03, 0.02], color: H.plate },
         // harness straps over the chest
         { geo: box, at: [0.12, 0.92, 0.2], scale: [0.35, 4.2, 1], rot: [-0.25, 0, 0.12], color: H.leather },
         { geo: box, at: [-0.12, 0.92, 0.2], scale: [0.35, 4.2, 1], rot: [-0.25, 0, -0.12], color: H.leather },
      ]),
      shell: bake(bands.map((geo, i) => ({ geo, at: shellAt, scale: shellScale, color: i % 2 ? H.plateDark : H.plate, uv: [1, 1, i % 2 ? 1 / 16 : 0] as const }))),
      glow: bake(lines.map((geo) => ({ geo, at: shellAt, scale: shellScale }))),
   };

   const legParts = {
      body: bake([
         { geo: leg, at: [0, -0.24, 0], color: H.suit },
         { geo: ball, at: [0, -0.43, 0], scale: [0.1, 0.04, 0.1], color: H.leather },
         { geo: ball, at: [0, -0.5, 0.05], scale: [0.11, 0.07, 0.16], color: H.skin },
         { geo: ball, at: [0, -0.46, 0.02], scale: [0.105, 0.06, 0.12], color: H.boot },
         { geo: ball, at: [0, -0.23, 0.07], scale: [0.105, 0.1, 0.07], color: H.plate },
      ]),
      glow: bake([{ geo: ball, at: [0, -0.23, 0.072], scale: [0.108, 0.014, 0.072] }]),
   };

   const arm = (side: number) => ({
      body: bake([
         { geo: ball, at: [0.03 * side, 0.04, 0], scale: [0.16, 0.1, 0.15], color: H.plate },
         { geo: ball, at: [0.05 * side, -0.05, 0], scale: [0.13, 0.07, 0.13], color: H.plateDark },
         { geo: limb, at: [0, -0.2, 0], color: H.suit },
         { geo: ball, at: [0, -0.33, 0], scale: [0.085, 0.045, 0.085], color: H.leather },
         { geo: ball, at: [0, -0.42, 0.01], scale: 0.08, color: H.skin },
      ]),
      glow: bake([{ geo: ball, at: [0.03 * side, 0, 0], scale: [0.162, 0.016, 0.152] }]),
   });

   const headParts: Part[] = [
      { geo: ballFine, at: [0, 0, 0], scale: [0.22, 0.21, 0.22], color: H.skin },
      { geo: ball, at: [0, -0.06, 0.19], scale: [0.11, 0.09, 0.14], color: H.skinLight },
      { geo: ball, at: [0, -0.04, 0.32], scale: [0.035, 0.028, 0.025], color: H.pupil },
      { geo: rim, at: [0, 0.06, -0.01], rot: [Math.PI / 2 - 0.35, 0, 0], color: H.boot },
   ];
   const headGlow: Part[] = [];
   for (const side of [1, -1]) {
      headParts.push(
         { geo: ball, at: [0.085 * side, 0.03, 0.18], scale: 0.048, color: H.eye },
         { geo: ball, at: [0.09 * side, 0.032, 0.222], scale: 0.024, color: H.pupil },
         { geo: earCup, at: [0.215 * side, 0, -0.01], rot: [0, 0, Math.PI / 2], color: H.boot },
      );
      headGlow.push({ geo: earCup, at: [0.243 * side, 0, -0.01], rot: [0, 0, Math.PI / 2], scale: [0.75, 0.2, 0.75] });
   }
   const head = {
      body: bake(headParts),
      shell: bake([
         { geo: cap, at: [0, 0, 0], rot: [-0.35, 0, 0], color: H.plate, uv: [3, 3] },
         // plates from the crown down the back of the head to the shell
         ...[0, 1, 2].map(
            (i): Part => ({
               geo: ball,
               at: [0, 0.16 - i * 0.1, -0.12 - i * 0.06],
               rot: [0.5 + i * 0.35, 0, 0],
               scale: [0.17 - i * 0.015, 0.05, 0.12],
               color: i % 2 ? H.plateDark : H.plate,
               uv: [2, 2],
            }),
         ),
      ]),
      glow: bake(headGlow),
      // the clear visor: a brim over the forehead, down to the brows (the eyes stay visible under it)
      visor: new SphereGeometry(0.285, 24, 8, Math.PI / 2 - 1.15, 2.3, 0.62, 0.55),
   };

   // the tail: five overlapping segments curving down, red plates on top, leather underneath
   const tailBody: Part[] = [];
   const tailShell: Part[] = [];
   for (let i = 0; i < 5; i++) {
      // a thick tail: each segment overlaps the next by about half, curving down then out behind
      const y = -0.05 * i - 0.006 * i * i;
      const z = -0.06 - 0.085 * i;
      const rot: Vec3 = [0.35 + i * 0.08, 0, 0];
      tailBody.push({ geo: ball, at: [0, y - 0.025, z], rot, scale: [0.13 - i * 0.017, 0.09 - i * 0.011, 0.13 - i * 0.012], color: H.leather });
      tailShell.push({ geo: ball, at: [0, y + 0.015, z], rot, scale: [0.15 - i * 0.02, 0.1 - i * 0.012, 0.135 - i * 0.012], color: i % 2 ? H.plateDark : H.plate, uv: [2, 2] });
   }
   const tail = { body: bake(tailBody), shell: bake(tailShell) };

   const roll = {
      shell: bake([{ geo: ballFine, at: [0, 0, 0], scale: ARMADILLO.ballRadius, color: H.plate, uv: [3, 4] }]),
      body: bake([-1, 1].map((k): Part => ({ geo: band, at: [0, 0, 0], rot: [k * 0.6, Math.PI / 2, 0], scale: ARMADILLO.ballRadius * 0.96, color: H.plateDark }))),
      glow: bake([{ geo: band, at: [0, 0, 0], rot: [0, Math.PI / 2, 0], scale: ARMADILLO.ballRadius }]),
   };

   for (const g of [ball, ballFine, leg, limb, torso, belt, box, earCup, rim, cap, band, ...bands, ...lines]) g.dispose();
   return { torso: torsoParts, leg: legParts, armL: arm(1), armR: arm(-1), head, tail, roll };
}

function disposeAll(v: unknown) {
   if (v instanceof BufferGeometry) v.dispose();
   else if (v && typeof v === "object") Object.values(v).forEach(disposeAll);
}

function useShapes() {
   const shapes = useMemo(buildArmadilloShapes, []);
   useEffect(() => () => disposeAll(shapes), [shapes]);
   return shapes;
}

export function ArmadilloStandIn({ pose }: { pose: MutableRefObject<ArmadilloPose> }) {
   const m = useLooks();
   const g = useShapes();
   const body = useRef<Group>(null);
   const legL = useRef<Group>(null);
   const legR = useRef<Group>(null);
   const armL = useRef<Group>(null);
   const armR = useRef<Group>(null);
   const head = useRef<Group>(null);
   const tail = useRef<Group>(null);

   useFrame(() => {
      const p = pose.current;
      const swing = Math.sin(p.phase) * 0.85 * p.run;
      const tuck = p.tuck;
      if (legL.current) legL.current.rotation.x = swing - tuck * 0.9;
      if (legR.current) legR.current.rotation.x = -swing - tuck * 0.9;
      const armSwing = Math.sin(p.phase) * 0.7 * p.run;
      // arms: hang, swing against the legs, lift a little in a jump, up in a cheer
      if (armL.current) {
         armL.current.rotation.x = -armSwing - tuck * 0.5 - p.cheer * 2.6;
         armL.current.rotation.z = 0.12 + tuck * 0.5 + p.cheer * 0.3;
      }
      if (armR.current) {
         armR.current.rotation.x = armSwing - tuck * 0.5 - p.cheer * 2.6;
         armR.current.rotation.z = -0.12 - tuck * 0.5 - p.cheer * 0.3;
      }
      if (head.current) {
         head.current.rotation.x = 0.05 * Math.sin(p.time * 2) * (1 - p.run) - p.run * 0.12;
         head.current.position.y = ARMADILLO.headY + Math.sin(p.time * 2.4) * 0.006;
      }
      if (tail.current) tail.current.rotation.y = Math.sin(p.phase * 0.5 + p.time) * 0.25 * (0.3 + p.run);
      // the curl: the body shrinks; ArmadilloBall (Hero.tsx) grows in its place
      const r = p.roll;
      if (body.current) {
         body.current.scale.setScalar(Math.max(0.001, 1 - r));
         body.current.position.y = ARMADILLO.ballRadius * r;
         body.current.visible = r < 0.98;
      }
   });

   return (
      <group>
         <group ref={body}>
            <group ref={legL} position={[0.15, ARMADILLO.hipY, 0]}>
               <mesh geometry={g.leg.body} material={m.body} />
               <mesh geometry={g.leg.glow} material={m.glow} />
            </group>
            <group ref={legR} position={[-0.15, ARMADILLO.hipY, 0]}>
               <mesh geometry={g.leg.body} material={m.body} />
               <mesh geometry={g.leg.glow} material={m.glow} />
            </group>
            <mesh geometry={g.torso.body} material={m.body} />
            <mesh geometry={g.torso.shell} material={m.shell} />
            <mesh geometry={g.torso.glow} material={m.glow} />
            <group ref={armL} position={[0.32, ARMADILLO.shoulderY, 0]}>
               <mesh geometry={g.armL.body} material={m.body} />
               <mesh geometry={g.armL.glow} material={m.glow} />
            </group>
            <group ref={armR} position={[-0.32, ARMADILLO.shoulderY, 0]}>
               <mesh geometry={g.armR.body} material={m.body} />
               <mesh geometry={g.armR.glow} material={m.glow} />
            </group>
            <group ref={head} position={[0, ARMADILLO.headY, 0.03]}>
               <mesh geometry={g.head.body} material={m.body} />
               <mesh geometry={g.head.shell} material={m.shell} />
               <mesh geometry={g.head.glow} material={m.glow} />
               <mesh geometry={g.head.visor} material={m.visor} position={[0, 0, 0.02]} rotation-x={-0.12} />
            </group>
            <group ref={tail} position={[0, 0.56, -0.26]}>
               <mesh geometry={g.tail.body} material={m.body} />
               <mesh geometry={g.tail.shell} material={m.shell} />
            </group>
         </group>
      </group>
   );
}

/** The ball of plates the hero curls into. One for the GLB and the stand-in (Hero draws it). */
export function ArmadilloBall({ pose }: { pose: MutableRefObject<ArmadilloPose> }) {
   const m = useLooks();
   const g = useShapes();
   const ball = useRef<Group>(null);

   useFrame(() => {
      const p = pose.current;
      const r = p.roll;
      const node = ball.current;
      if (!node) return;
      node.scale.setScalar(Math.max(0.001, r));
      node.visible = r > 0.02;
      node.rotation.x = p.spin;
      m.ballGlow.emissiveIntensity = 1.4 + Math.sin(p.time * 10) * 0.5;
   });

   return (
      <group ref={ball} position={[0, ARMADILLO.ballRadius, 0]}>
         <mesh geometry={g.roll.shell} material={m.shell} />
         <mesh geometry={g.roll.body} material={m.body} />
         <mesh geometry={g.roll.glow} material={m.ballGlow} />
      </group>
   );
}
