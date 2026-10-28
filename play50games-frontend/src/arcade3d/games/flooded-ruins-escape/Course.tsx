"use client";

// The drowned temple, drawn from the rules (nothing here decides gameplay). Ledges are m2RuinPlatform
// fitted so the deck sits on the collider top; chamber floors and tall walls are stone boxes with a
// world-space flagstone texture (three tones, worn edges, moss in the grout) and a moss cap (one
// instanced draw call each); the walls between the camera and the hero fade to faint stone; cracked brick (m2RuinBrickLedge)
// vanishes once Riko breaks it; ghost panels are see-through violet; floating crates (m2FlyingCrate)
// ride their chamber's water (supportTop). The water (each chamber's and the storm tide under
// everything) is Water.tsx. Stone
// levers (m2StoneLever) tilt their handle with the position; bubble spouts (m2RuinWaterSpout) send a
// bubble column up; steam jets hiss while live; whirlpools turn on the water; cave bats (m2CaveBat)
// roost and swoop; orbs, secrets, checkpoint lamps, the exit flood gate (m2RuinFloodGateV2I), the Tide
// Bell (level 5) and Umbra Roller (m2ShadowArmadillo, level 5) from bossPose.
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BoxGeometry, Color, DoubleSide, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Object3D, RepeatWrapping, Vector3, type CanvasTexture, type Group, type Mesh } from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import { useCanvasTexture, type InstanceSpot } from "@/arcade3d/core/render";
import type { AABB } from "@/arcade3d/core/collision";
import { rayBoxDistance } from "@/arcade3d/menu2/camera/orbitCollision";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useJuice, createJuiceEmitter, type JuiceEmitter } from "@/arcade3d/menu2/juice";
import { ASSETS, BAT_SCALE, BOSS_SCALE, GLB_SIZE, ORB_SIZE } from "./assets";
import { COLORS, glowTexture, isStormLevel } from "./look";
import Water from "./Water";
import { BillboardField, type Billboard } from "./World";
import {
   BOSS_R,
   NONE,
   batPos,
   jetLive,
   supportTop,
   zoneLevel,
   type Course as CourseData,
   type RuinRun,
   type Support,
} from "./rules";

/** The visual clock (ms of rules time), written by Scene every frame. */
export interface VisualClock {
   ms: number;
}

const BLOCK_SY = 1.15;
const SCALE = new Vector3();
const DUMMY = new Object3D();
const V = { x: 0, y: 0, z: 0 };

const deckY = (top: number) => top - GLB_SIZE.platform.top * BLOCK_SY;
const visMs = (clock: VisualClock) => Math.max(0, clock.ms);

/** A block is a thin ledge (drawn with the platform GLB) or a tall mass of stone (a box). */
function isLedge(s: Support): boolean {
   return (s.kind === "ledge" || s.kind === "checkpoint" || s.kind === "start" || s.kind === "goal") && s.top - s.bottom <= 2.2;
}

interface Split {
   ledges: InstanceSpot[];
   stone: number[];
   moss: number[];
   cracked: number[];
   ghosts: number[];
   crates: number[];
   /** cut-away blocks (a roof over a swim, a wall in front of the camera): drawn faint, they still collide */
   faint: number[];
}

function splitBlocks(course: CourseData): Split {
   const out: Split = { ledges: [], stone: [], moss: [], cracked: [], ghosts: [], crates: [], faint: [] };
   course.supports.forEach((s, i) => {
      if (s.float !== NONE) return void out.crates.push(i);
      if (s.hidden) return void out.faint.push(i);
      if (s.ghost) return void out.ghosts.push(i);
      if (s.crack) return void out.cracked.push(i);
      if (isLedge(s)) {
         out.ledges.push({ x: s.cx, y: deckY(s.top), z: s.cz, rotY: (i % 2) * Math.PI, sx: (s.hw * 2) / GLB_SIZE.platform.x, sy: BLOCK_SY, sz: (s.hd * 2) / GLB_SIZE.platform.z });
         // the ledge's body under the deck, down to its bottom
         out.stone.push(i);
         return;
      }
      out.stone.push(i);
      if (s.kind === "wall") out.moss.push(i);
   });
   return out;
}

const UNIT_BOX = new BoxGeometry(1, 1, 1);

/** A small seeded random for the stone texture (drawn once, the same every run). */
function stoneRng(seed: number): () => number {
   let s = seed;
   return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/**
 * Temple paving (tiled in world space over every block face, 4 m a tile of the texture): offset rows
 * of flagstones in three tones (warm tan, pale sand, cool grey), dark grout, worn light edges and
 * chipped corners, speckle, and moss creeping out of the grout. Near white overall: the instance
 * colour tints it per block.
 */
function drawStone(g: CanvasRenderingContext2D, w: number, h: number): void {
   const rnd = stoneRng(9001);
   const tones = ["#e9dcc6", "#d6c6ab", "#c9c3b8"];
   g.fillStyle = "#5b4d3d";
   g.fillRect(0, 0, w, h);
   const rows = 4;
   const rh = h / rows;
   for (let r = 0; r < rows; r++) {
      const cols = r % 2 ? 3 : 4;
      const cw = w / cols;
      const shift = r % 2 ? cw * 0.5 : 0;
      for (let c = -1; c < cols; c++) {
         const x = c * cw + shift;
         const y = r * rh;
         const gap = 3 + rnd() * 2;
         const tone = tones[Math.floor(rnd() * tones.length)];
         g.fillStyle = tone;
         g.fillRect(x + gap, y + gap, cw - gap * 2, rh - gap * 2);
         // a soft shade across the slab
         const grad = g.createLinearGradient(x, y, x + cw, y + rh);
         grad.addColorStop(0, "rgba(255,250,240,0.10)");
         grad.addColorStop(1, `rgba(60,45,30,${0.08 + rnd() * 0.1})`);
         g.fillStyle = grad;
         g.fillRect(x + gap, y + gap, cw - gap * 2, rh - gap * 2);
         // worn edges: a light rim on the top/left, a dark lip on the bottom/right
         g.fillStyle = "rgba(255,248,232,0.28)";
         g.fillRect(x + gap, y + gap, cw - gap * 2, 3);
         g.fillRect(x + gap, y + gap, 3, rh - gap * 2);
         g.fillStyle = "rgba(50,38,26,0.25)";
         g.fillRect(x + gap, y + rh - gap - 3, cw - gap * 2, 3);
         g.fillRect(x + cw - gap - 3, y + gap, 3, rh - gap * 2);
         // chipped corners
         for (let k = 0; k < 2; k++) {
            const cx = rnd() < 0.5 ? x + gap : x + cw - gap;
            const cy = rnd() < 0.5 ? y + gap : y + rh - gap;
            const s = 5 + rnd() * 9;
            g.fillStyle = "#6b5a46";
            g.beginPath();
            g.moveTo(cx, cy);
            g.lineTo(cx + (cx > x + cw / 2 ? -s : s), cy);
            g.lineTo(cx, cy + (cy > y + rh / 2 ? -s : s));
            g.closePath();
            g.fill();
         }
         // a hairline crack now and then
         if (rnd() < 0.35) {
            g.strokeStyle = "rgba(70,56,40,0.5)";
            g.lineWidth = 1.2;
            g.beginPath();
            let px = x + gap + rnd() * (cw - gap * 2);
            let py = y + gap;
            g.moveTo(px, py);
            for (let i = 0; i < 5; i++) {
               px += (rnd() - 0.5) * 18;
               py += rh / 6;
               g.lineTo(px, py);
            }
            g.stroke();
         }
      }
   }
   // speckle
   for (let i = 0; i < 2600; i++) {
      const v = rnd();
      g.fillStyle = v < 0.5 ? `rgba(80,64,46,${0.05 + rnd() * 0.12})` : `rgba(255,250,238,${0.04 + rnd() * 0.1})`;
      g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
   }
   // moss: clumps along the grout lines and in a few corners
   const moss = (x: number, y: number, r: number) => {
      for (let i = 0; i < 9; i++) {
         const a = rnd() * Math.PI * 2;
         const d = rnd() * r;
         const rr = r * (0.25 + rnd() * 0.45);
         const grad = g.createRadialGradient(x + Math.cos(a) * d, y + Math.sin(a) * d, 0, x + Math.cos(a) * d, y + Math.sin(a) * d, rr);
         const tone = rnd() < 0.5 ? "93,122,69" : "63,107,74";
         grad.addColorStop(0, `rgba(${tone},0.85)`);
         grad.addColorStop(1, `rgba(${tone},0)`);
         g.fillStyle = grad;
         g.beginPath();
         g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, rr, 0, Math.PI * 2);
         g.fill();
      }
   };
   for (let i = 0; i < 9; i++) {
      const r = Math.floor(rnd() * rows);
      moss(rnd() * w, r * rh, 10 + rnd() * 16);
   }
   for (let i = 0; i < 4; i++) moss(rnd() * w, rnd() * h, 14 + rnd() * 10);
}

/** World-space UVs for the stone map on instanced boxes (no stretching however a block is scaled). */
function useStoneMaterial(map: CanvasTexture): MeshStandardMaterial {
   const material = useMemo(() => {
      map.wrapS = map.wrapT = RepeatWrapping;
      const m = new MeshStandardMaterial({ color: "#ffffff", roughness: 0.9, metalness: 0.02, map });
      m.onBeforeCompile = (shader) => {
         shader.vertexShader = shader.vertexShader
            .replace("#include <common>", "#include <common>\nvarying vec3 vStonePos;\nvarying vec3 vStoneN;")
            .replace(
               "#include <begin_vertex>",
               `#include <begin_vertex>
               #ifdef USE_INSTANCING
                  vStonePos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
                  vStoneN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
               #else
                  vStonePos = (modelMatrix * vec4(transformed, 1.0)).xyz;
                  vStoneN = normalize(mat3(modelMatrix) * objectNormal);
               #endif`,
            );
         shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", "#include <common>\nvarying vec3 vStonePos;\nvarying vec3 vStoneN;")
            .replace(
               "#include <map_fragment>",
               `vec3 stoneN = abs(vStoneN);
               vec2 stoneUv = stoneN.y > 0.5 ? vStonePos.xz : (stoneN.x > stoneN.z ? vec2(vStonePos.z, vStonePos.y) : vStonePos.xy);
               vec4 sampledDiffuseColor = texture2D(map, stoneUv * 0.25);
               // the sides a shade darker than the tops (a third tone with the slabs' own two)
               float stain = stoneN.y > 0.5 ? 1.0 : 0.86;
               diffuseColor *= vec4(sampledDiffuseColor.rgb * stain, sampledDiffuseColor.a);`,
            );
      };
      m.customProgramCacheKey = () => "ruinStoneTriplanar";
      return m;
   }, [map]);
   useEffect(() => () => material.dispose(), [material]);
   return material;
}

/** How a block's box is drawn: from `bottom` up to its top (minus the ledge GLB's deck), or a thin cap on it. */
function blockBox(s: Support, cap: boolean): { top: number; bottom: number; pad: number } {
   const ledge = isLedge(s);
   return {
      top: cap ? s.top + 0.12 : ledge ? deckY(s.top) + 0.05 : s.top,
      bottom: cap ? s.top : s.bottom,
      pad: cap ? 0.06 : ledge ? -0.04 : 0,
   };
}

const FADE_MAX = 12;
const FADE_BOX: AABB = { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
const ZERO = new Matrix4().makeScale(0, 0, 0);

/**
 * Instanced boxes for blocks, tinted per block, with the stone texture. With `fade` the blocks
 * between the camera and the hero (or round the camera, when a tight trench brings it right up to a
 * wall) leave the solid draw and show as faint stone instead, so a wall never fills the screen.
 */
function StoneBoxes({ course, ids, color, shade, cap = false, map, fade }: { course: CourseData; ids: number[]; color: string; shade: string; cap?: boolean; map: CanvasTexture; fade?: RuinRun }) {
   const ref = useRef<InstancedMesh>(null);
   const ghost = useRef<InstancedMesh>(null);
   const material = useStoneMaterial(map);
   const ghostMat = useMemo(() => new MeshBasicMaterial({ color: "#cdbfa6", transparent: true, opacity: 0.2, depthWrite: false }), []);
   useEffect(() => () => ghostMat.dispose(), [ghostMat]);
   const matrices = useMemo(() => ids.map(() => new Matrix4()), [ids]);
   useEffect(() => {
      const m = ref.current;
      if (!m) return;
      const a = new Color(color);
      const b = new Color(shade);
      const c = new Color();
      ids.forEach((id, k) => {
         const s = course.supports[id];
         const { top, bottom, pad } = blockBox(s, cap);
         DUMMY.position.set(s.cx, (top + bottom) / 2, s.cz);
         DUMMY.scale.set(s.hw * 2 + pad, Math.max(0.05, top - bottom), s.hd * 2 + pad);
         DUMMY.rotation.set(0, 0, 0);
         DUMMY.updateMatrix();
         matrices[k].copy(DUMMY.matrix);
         m.setMatrixAt(k, DUMMY.matrix);
         c.copy(a).lerp(b, ((id * 37) % 10) / 14);
         m.setColorAt(k, c);
      });
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
   }, [course, ids, color, shade, cap, matrices]);
   const camera = useThree((s) => s.camera);
   const faded = useRef<number[]>([]);
   const next = useRef<number[]>([]);
   useFrame(() => {
      const m = ref.current;
      const gm = ghost.current;
      if (!fade || !m || !gm) return;
      const h = fade.hero;
      const cx = camera.position.x;
      const cy = camera.position.y;
      const cz = camera.position.z;
      // from the hero's chest to the camera
      const ox = h.x;
      const oy = h.y + 0.9;
      const oz = h.z;
      let dx = cx - ox;
      let dy = cy - oy;
      let dz = cz - oz;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len > 1e-6) {
         dx /= len;
         dy /= len;
         dz /= len;
      }
      const list = next.current;
      list.length = 0;
      for (let k = 0; k < ids.length && list.length < FADE_MAX; k++) {
         const s = course.supports[ids[k]];
         const { top, bottom } = blockBox(s, cap);
         // only blocks that rise past the hero's feet can hide it
         if (top < h.y + 0.4) continue;
         FADE_BOX.min.x = s.cx - s.hw;
         FADE_BOX.max.x = s.cx + s.hw;
         FADE_BOX.min.y = bottom;
         FADE_BOX.max.y = top;
         FADE_BOX.min.z = s.cz - s.hd;
         FADE_BOX.max.z = s.cz + s.hd;
         const near = cx > FADE_BOX.min.x - 0.25 && cx < FADE_BOX.max.x + 0.25 && cy > bottom - 0.25 && cy < top + 0.25 && cz > FADE_BOX.min.z - 0.25 && cz < FADE_BOX.max.z + 0.25;
         if (near || (len > 1e-6 && rayBoxDistance(ox, oy, oz, dx, dy, dz, len, FADE_BOX, 0) >= 0)) list.push(k);
      }
      const prev = faded.current;
      let same = prev.length === list.length;
      for (let i = 0; same && i < list.length; i++) same = prev[i] === list[i];
      if (same) return;
      for (const k of prev) m.setMatrixAt(k, matrices[k]);
      for (let i = 0; i < list.length; i++) {
         const k = list[i];
         m.setMatrixAt(k, ZERO);
         gm.setMatrixAt(i, matrices[k]);
      }
      m.instanceMatrix.needsUpdate = true;
      gm.count = list.length;
      gm.instanceMatrix.needsUpdate = true;
      gm.visible = list.length > 0;
      faded.current = list.slice();
   });
   if (ids.length === 0) return null;
   return (
      <>
         <instancedMesh ref={ref} args={[UNIT_BOX, material, ids.length]} />
         {fade ? <instancedMesh ref={ghost} args={[UNIT_BOX, ghostMat, FADE_MAX]} count={0} visible={false} frustumCulled={false} renderOrder={4} /> : null}
      </>
   );
}
/** Cracked brick: the brick GLB fitted to the block, gone once broken. */
function CrackedBricks({ run, ids }: { run: RuinRun; ids: number[] }) {
   const update = (i: number, m: Matrix4) => {
      const id = ids[i];
      if (run.broken[id]) return false;
      const s = run.course.supports[id];
      const h = s.top - s.bottom;
      m.makeScale((s.hw * 2) / GLB_SIZE.brickLedge.x, h / GLB_SIZE.brickLedge.y, (s.hd * 2) / GLB_SIZE.brickLedge.z);
      m.setPosition(s.cx, s.bottom, s.cz);
   };
   if (ids.length === 0) return null;
   return <DynamicInstancedModel asset={ASSETS.brickLedge} count={ids.length} update={update} name="cracked-brick" />;
}

/** Ghost panels: see-through violet stone (Vexa phases through them); also the faint cut-away blocks (grey, steady). */
function GhostPanels({ course, ids, color = "#c4b5fd", pulse = true }: { course: CourseData; ids: number[]; color?: string; pulse?: boolean }) {
   const time = useGameTime();
   const mats = useRef<(MeshBasicMaterial | null)[]>([]);
   useFrame(() => {
      for (let i = 0; i < mats.current.length; i++) {
         const m = mats.current[i];
         if (m) m.opacity = pulse ? 0.32 + 0.12 * Math.sin(time.now * 2.4 + i) : 0.16;
      }
   });
   return (
      <>
         {ids.map((id, k) => {
            const s = course.supports[id];
            return (
               <mesh key={id} position={[s.cx, (s.top + s.bottom) / 2, s.cz]} renderOrder={4}>
                  <boxGeometry args={[s.hw * 2, s.top - s.bottom, s.hd * 2]} />
                  <meshBasicMaterial ref={(m) => { mats.current[k] = m; }} color={color} transparent opacity={0.35} depthWrite={false} />
               </mesh>
            );
         })}
      </>
   );
}

/** Floating crates on their chamber's water. */
function Crates({ run, ids, clock }: { run: RuinRun; ids: number[]; clock: VisualClock }) {
   const update = (i: number, m: Matrix4) => {
      const s = run.course.supports[ids[i]];
      const top = supportTop(run.course, run.water, s, visMs(clock));
      m.makeScale((s.hw * 2) / GLB_SIZE.crate.x, 0.9 / GLB_SIZE.crate.y, (s.hd * 2) / GLB_SIZE.crate.z);
      m.setPosition(s.cx, top - 0.9, s.cz);
   };
   if (ids.length === 0) return null;
   return <DynamicInstancedModel asset={ASSETS.crate} count={ids.length} update={update} name="crates" />;
}

/** Stone levers: the GLB, and a handle that tilts from back (0) to forward (last) with the position. */
function Levers({ run }: { run: RuinRun }) {
   const levers = run.course.levers;
   const handles = useRef<(Group | null)[]>([]);
   const time = useGameTime();
   const tilt = useRef<number[]>(levers.map(() => 0));
   const spots = useMemo<InstanceSpot[]>(() => levers.map((l, i) => ({ x: l.x, y: l.y, z: l.z, scale: 0.9 / GLB_SIZE.lever.y, rotY: (i % 2) * 0.5 - 0.25 })), [levers]);
   useFrame(() => {
      for (let i = 0; i < levers.length; i++) {
         const g = handles.current[i];
         if (!g) continue;
         const l = levers[i];
         const goal = l.positions > 1 ? run.levers.pos[i] / (l.positions - 1) : 0;
         tilt.current[i] += (goal - tilt.current[i]) * Math.min(1, time.delta * 10);
         g.rotation.x = -0.7 + tilt.current[i] * 1.4;
      }
   });
   return (
      <>
         <InstancedModel asset={ASSETS.lever} spots={spots} fallback={null} />
         {levers.map((l, i) => (
            <group key={i} position={[l.x, l.y + 0.5, l.z]}>
               <group ref={(g) => { handles.current[i] = g; }}>
                  <mesh position={[0, 0.45, 0]}>
                     <cylinderGeometry args={[0.05, 0.06, 0.9, 6]} />
                     <meshStandardMaterial color="#6b5a48" roughness={0.8} />
                  </mesh>
                  <mesh position={[0, 0.92, 0]}>
                     <sphereGeometry args={[0.12, 10, 8]} />
                     <meshStandardMaterial color={l.kind === "pressure" ? "#f87171" : l.kind === "gate" ? "#fbbf24" : "#5eead4"} emissive={l.kind === "pressure" ? "#b91c1c" : l.kind === "gate" ? "#b45309" : "#0f766e"} emissiveIntensity={0.7} />
                  </mesh>
               </group>
            </group>
         ))}
      </>
   );
}

/** Bubble spouts: the GLB at the column's foot, a see-through column and rising bubbles (juice). */
function Spouts({ run }: { run: RuinRun }) {
   const spouts = run.course.spouts;
   const juice = useJuice();
   const emitters = useMemo<JuiceEmitter[]>(() => spouts.map(() => createJuiceEmitter()), [spouts]);
   const spots = useMemo<InstanceSpot[]>(() => spouts.map((s) => ({ x: s.x, y: s.y0, z: s.z, scale: (s.r * 1.6) / GLB_SIZE.spout.x })), [spouts]);
   useFrame(() => {
      for (let i = 0; i < spouts.length; i++) {
         const s = spouts[i];
         V.x = s.x;
         V.y = s.y0 + 0.3;
         V.z = s.z;
         juice.stream("aura", V, 10, emitters[i], { color: "#e0f7ff", vy: 1.4 });
      }
   });
   if (spouts.length === 0) return null;
   return (
      <>
         <InstancedModel asset={ASSETS.spout} spots={spots} fallback={null} />
         {spouts.map((s, i) => (
            <mesh key={i} position={[s.x, (s.y0 + s.y1) / 2, s.z]} renderOrder={4}>
               <cylinderGeometry args={[s.r, s.r, s.y1 - s.y0, 14, 1, true]} />
               <meshBasicMaterial color="#bae6fd" transparent opacity={0.16} depthWrite={false} side={DoubleSide} />
            </mesh>
         ))}
      </>
   );
}

/** Steam jets: a vent ring always, the white column while live. */
function Jets({ run, clock }: { run: RuinRun; clock: VisualClock }) {
   const jets = run.course.jets;
   const cols = useRef<(Mesh | null)[]>([]);
   const time = useGameTime();
   useFrame(() => {
      const ms = visMs(clock);
      for (let i = 0; i < jets.length; i++) {
         const c = cols.current[i];
         if (!c) continue;
         const live = jetLive(jets[i], ms);
         c.visible = live;
         if (live) c.scale.set(1 + 0.08 * Math.sin(time.now * 30 + i), 1, 1 + 0.08 * Math.cos(time.now * 27 + i));
      }
   });
   if (jets.length === 0) return null;
   return (
      <>
         {jets.map((j, i) => (
            <group key={i} position={[j.x, j.y, j.z]}>
               <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
                  <ringGeometry args={[j.r * 0.5, j.r * 0.8, 20]} />
                  <meshBasicMaterial color="#fca5a5" transparent opacity={0.7} toneMapped={false} />
               </mesh>
               <mesh ref={(m) => { cols.current[i] = m; }} position={[0, j.h / 2, 0]} visible={false} renderOrder={5}>
                  <cylinderGeometry args={[j.r * 0.7, j.r, j.h, 14, 1, true]} />
                  <meshBasicMaterial color="#f8fafc" transparent opacity={0.5} depthWrite={false} side={DoubleSide} />
               </mesh>
            </group>
         ))}
      </>
   );
}

/** Whirlpools: a turning spiral on the chamber's water (shown while it has water). */
function Whirls({ run, clock }: { run: RuinRun; clock: VisualClock }) {
   const whirls = run.course.whirls;
   const refs = useRef<(Mesh | null)[]>([]);
   const time = useGameTime();
   useFrame(() => {
      const ms = visMs(clock);
      for (let i = 0; i < whirls.length; i++) {
         const m = refs.current[i];
         if (!m) continue;
         const w = whirls[i];
         const y = zoneLevel(run.water, w.zone, ms);
         m.visible = y > run.course.zones[w.zone].floor + 0.3;
         m.position.set(w.x, y + 0.04, w.z);
         m.rotation.z = -time.now * 2.2;
      }
   });
   if (whirls.length === 0) return null;
   return (
      <>
         {whirls.map((w, i) => (
            <mesh key={i} ref={(m) => { refs.current[i] = m; }} rotation-x={-Math.PI / 2} renderOrder={5}>
               <ringGeometry args={[w.core, w.r, 32, 1, 0, Math.PI * 1.6]} />
               <meshBasicMaterial color="#e0f2fe" transparent opacity={0.45} depthWrite={false} side={DoubleSide} />
            </mesh>
         ))}
      </>
   );
}

/** Cave bats: roosting (still, wings folded) or swooping (flapping) while their chamber is dry. */
function Bats({ run, clock }: { run: RuinRun; clock: VisualClock }) {
   const bats = run.course.bats;
   const time = useGameTime();
   const update = (i: number, m: Matrix4) => {
      const active = batPos(run.water, bats[i], visMs(clock), V);
      const flap = active ? 0.55 + 0.45 * Math.abs(Math.sin(time.now * 14 + i)) : 0.35;
      m.makeRotationY(active ? time.now * 2 + i : i);
      m.scale(SCALE.set(BAT_SCALE * flap, BAT_SCALE, BAT_SCALE));
      m.setPosition(V.x, V.y - (active ? 0.4 : 0.9), V.z);
   };
   if (bats.length === 0) return null;
   return <DynamicInstancedModel asset={ASSETS.bat} count={bats.length} update={update} name="bats" />;
}

function CheckpointLamps({ course, run }: { course: CourseData; run: RuinRun }) {
   const lamps = course.checkpoints.slice(1);
   const bulbs = useRef<(MeshStandardMaterial | null)[]>([]);
   const lit = useMemo(() => new Color(COLORS.beaconLit), []);
   const idle = useMemo(() => new Color(COLORS.beaconIdle), []);
   useFrame(() => {
      for (let k = 0; k < lamps.length; k++) {
         const m = bulbs.current[k];
         if (!m) continue;
         const on = run.checkpoint >= k + 1;
         m.color.copy(on ? lit : idle);
         m.emissive.copy(on ? lit : idle);
      }
   });
   return (
      <>
         {lamps.map((index, k) => {
            const s = course.supports[index];
            return (
               <group key={index} position={[s.cx - s.hw + 0.45, s.top, s.cz + s.hd - 0.45]}>
                  <mesh position={[0, 0.7, 0]}>
                     <cylinderGeometry args={[0.05, 0.07, 1.4, 6]} />
                     <meshStandardMaterial color="#334155" />
                  </mesh>
                  <mesh position={[0, 1.5, 0]}>
                     <sphereGeometry args={[0.16, 10, 8]} />
                     <meshStandardMaterial ref={(m) => { bulbs.current[k] = m; }} color={COLORS.beaconIdle} emissive={COLORS.beaconIdle} emissiveIntensity={0.8} />
                  </mesh>
               </group>
            );
         })}
      </>
   );
}

/** The exit: the flood gate (v2) at the far edge of the goal ledge, a ring on the deck, and on level 5 the Tide Bell. */
function ExitGate({ run, won }: { run: RuinRun; won: MutableRefObject<boolean> }) {
   const course = run.course;
   const goal = course.supports[course.goal];
   const width = Math.min(goal.hw * 2, 4.2);
   const gateScale = width / GLB_SIZE.floodGate.x;
   const bell = useRef<Group>(null);
   const time = useGameTime();
   const rungAt = useRef(-1);
   useFrame(() => {
      const b = bell.current;
      if (!b) return;
      if (won.current && rungAt.current < 0) rungAt.current = time.now;
      const t = rungAt.current < 0 ? 0 : time.now - rungAt.current;
      b.rotation.z = rungAt.current < 0 ? 0 : Math.sin(t * 9) * 0.5 * Math.exp(-t * 0.8);
   });
   return (
      <group position={[goal.cx, goal.top + 0.04, goal.cz]}>
         <mesh rotation-x={-Math.PI / 2}>
            <ringGeometry args={[1.0, 1.3, 28]} />
            <meshBasicMaterial color="#d6fff4" toneMapped={false} />
         </mesh>
         <group position={[0, 0, -goal.hd + GLB_SIZE.floodGate.z * gateScale * 0.5]}>
            <Model asset={ASSETS.floodGate} scale={gateScale} fallback={null} />
         </group>
         {course.boss ? (
            <group position={[0, GLB_SIZE.floodGate.y * gateScale + 0.9, -goal.hd + 0.4]}>
               <group ref={bell}>
                  <mesh position={[0, -0.45, 0]}>
                     <cylinderGeometry args={[0.18, 0.5, 0.75, 18, 1, true]} />
                     <meshStandardMaterial color="#facc15" metalness={0.7} roughness={0.3} emissive="#a16207" emissiveIntensity={0.35} side={DoubleSide} />
                  </mesh>
                  <mesh position={[0, -0.85, 0]}>
                     <sphereGeometry args={[0.1, 8, 6]} />
                     <meshStandardMaterial color="#78350f" />
                  </mesh>
               </group>
            </group>
         ) : null}
      </group>
   );
}

/** The run's secrets: a shard (light blue crystal) or a sticker (pink card), gone once found; a sunken one shows only after its chamber flooded and drained. */
function Secrets({ run }: { run: RuinRun }) {
   const spots = run.course.secrets;
   const refs = useRef<(Group | null)[]>([]);
   const time = useGameTime();
   useFrame(() => {
      for (let i = 0; i < spots.length; i++) {
         const g = refs.current[i];
         if (!g) continue;
         const s = spots[i];
         g.visible = !run.secrets.found[i] && (s.sunken === NONE || run.water.cycle[s.sunken] === 2);
         g.position.y = s.y + Math.sin(time.now * 2 + i) * 0.1;
         g.rotation.y = time.now * 1.5 + i;
      }
   });
   return (
      <>
         {spots.map((s, i) => (
            <group key={s.id} ref={(g) => { refs.current[i] = g; }} position={[s.x, s.y, s.z]}>
               {s.id.startsWith("ghost") ? (
                  <mesh>
                     <boxGeometry args={[0.42, 0.42, 0.05]} />
                     <meshStandardMaterial color="#f9a8d4" emissive="#db2777" emissiveIntensity={0.5} />
                  </mesh>
               ) : (
                  <mesh>
                     <octahedronGeometry args={[0.28]} />
                     <meshStandardMaterial color="#bae6fd" emissive="#38bdf8" emissiveIntensity={0.8} transparent opacity={0.9} />
                  </mesh>
               )}
            </group>
         ))}
      </>
   );
}

/** Umbra Roller (level 5) from bossPose: rolls (spinning) down the spiral and up the switchbacks, floats, sits in the drain, spins up the geyser, shrinks away when beaten. */
function Boss({ run }: { run: RuinRun }) {
   const arena = run.course.boss;
   const root = useRef<Group>(null);
   const spin = useRef<Group>(null);
   const geyser = useRef<Mesh>(null);
   const slab = useRef<Group>(null);
   const time = useGameTime();
   const state = useRef({ roll: 0, beatenAt: -1, last: { x: 0, z: 0 }, yaw: 0 });
   useFrame(() => {
      const g = root.current;
      const sp = spin.current;
      if (!g || !sp || !arena) return;
      const p = run.bossPose;
      const st = state.current;
      const dt = time.delta;
      const dx = p.x - st.last.x;
      const dz = p.z - st.last.z;
      const moved = Math.sqrt(dx * dx + dz * dz);
      if (moved > 1e-4 && moved < 2) st.yaw = Math.atan2(dx, dz);
      st.last.x = p.x;
      st.last.z = p.z;
      const rolling = p.mode === "roll" || p.mode === "chase";
      if (rolling) st.roll += (moved / BOSS_R) * (moved < 2 ? 1 : 0);
      if (p.mode === "geyser") st.roll += dt * 9;
      let y = p.y;
      let s = 1;
      if (p.mode === "float") y += Math.sin(time.now * 2.5) * 0.12;
      if (p.mode === "telegraph") {
         g.position.x = p.x + Math.sin(time.now * 40) * 0.06;
      } else g.position.x = p.x;
      if (p.mode === "beaten") {
         if (st.beatenAt < 0) st.beatenAt = time.now;
         s = Math.max(0, 1 - (time.now - st.beatenAt) / 1.6);
      }
      g.visible = s > 0.001;
      g.position.y = y;
      g.position.z = p.z;
      g.rotation.y = st.yaw;
      g.scale.setScalar(Math.max(0.001, s));
      // the GLB curls about its middle: spin about x round the ball's centre while rolling
      sp.rotation.x = rolling || p.mode === "geyser" ? st.roll : 0;
      const gy = geyser.current;
      if (gy) {
         gy.visible = p.mode === "geyser";
         if (gy.visible) {
            const h = Math.max(0.5, arena.geyserTop - arena.drain[1] + BOSS_R);
            gy.position.set(arena.drain[0], arena.drain[1] + h / 2, arena.drain[2]);
            gy.scale.set(1 + 0.06 * Math.sin(time.now * 25), h, 1 + 0.06 * Math.cos(time.now * 22));
         }
      }
      // the floodgate drops onto the gate once the boss is beaten (or while it sits there in the last phase)
      const sl = slab.current;
      if (sl) {
         const end = arena.chasePath[arena.chasePath.length - 1];
         const drop = p.mode === "beaten" ? Math.min(1, (time.now - st.beatenAt) / 0.35) : 0;
         sl.position.set(end[0], end[1] + 4.2 - 4.2 * drop, end[2]);
      }
   });
   if (!arena) return null;
   const end = arena.chasePath[arena.chasePath.length - 1];
   return (
      <>
         <group ref={root}>
            <group position={[0, BOSS_R, 0]}>
               <group ref={spin}>
                  <group position={[0, -GLB_SIZE.boss.y * BOSS_SCALE * 0.5, 0]}>
                     <Model asset={ASSETS.boss} scale={BOSS_SCALE} fallback={null} />
                  </group>
               </group>
            </group>
            <pointLight position={[0, BOSS_R * 2, 0]} intensity={4} distance={7} color="#a78bfa" />
         </group>
         <mesh ref={geyser} visible={false} renderOrder={5}>
            <cylinderGeometry args={[0.9, 1.2, 1, 16, 1, true]} />
            <meshBasicMaterial color="#e0f7ff" transparent opacity={0.45} depthWrite={false} side={DoubleSide} />
         </mesh>
         <group ref={slab} position={[end[0], end[1] + 4.2, end[2]]}>
            <Model asset={ASSETS.floodGate} scale={3.6 / GLB_SIZE.floodGate.x} fallback={null} />
         </group>
      </>
   );
}

export function Course({ run, clock, won }: { run: RuinRun; clock: VisualClock; won: MutableRefObject<boolean> }) {
   const course = run.course;
   const split = useMemo(() => splitBlocks(course), [course]);
   const time = useGameTime();
   const orbs = course.orbs;

   const orbUpdate = (i: number, m: Matrix4) => {
      const o = orbs[i];
      // the pool is sized once per mount: a run on another course (fewer orbs) must not read past it
      if (!o || run.collected[i]) return false;
      // a buried orb sits half sunk in its floor (only Zuno's magnet pulls it out of a drained floor)
      const buried = o.buried !== NONE;
      m.makeRotationY(time.now * (buried ? 0.8 : 2.4) + i);
      m.scale(SCALE.set(buried ? 0.75 : 1, buried ? 0.75 : 1, buried ? 0.75 : 1));
      m.setPosition(o.x, o.y + (buried ? -0.2 : Math.sin(time.now * 2 + i * 0.7) * 0.1), o.z);
   };

   const stone = useCanvasTexture(512, 512, drawStone);
   const glow = useMemo(() => glowTexture(), []);
   useEffect(() => () => glow.dispose(), [glow]);
   const halos = useMemo<Billboard[]>(() => orbs.map((o) => ({ x: o.x, y: o.y, z: o.z, size: ORB_SIZE * 2.2, r: o.bonus ? 0.6 : 1, g: o.bonus ? 0.9 : 0.86, b: o.bonus ? 1 : 0.42 })), [orbs]);
   const hideCollected = (data: Float32Array) => {
      let changed = false;
      for (let i = 0; i < orbs.length; i++) {
         const size = run.collected[i] ? 0 : ORB_SIZE * (orbs[i].buried !== NONE ? 1.2 : 2.1 + Math.sin(time.now * 3 + i) * 0.2);
         if (data[i * 4 + 3] !== size) {
            data[i * 4 + 3] = size;
            changed = true;
         }
      }
      return changed;
   };

   return (
      <>
         <InstancedModel asset={ASSETS.platform} spots={split.ledges} fallback={null} />
         <StoneBoxes course={course} ids={split.stone} color={COLORS.stoneLight} shade={COLORS.stoneShade} map={stone} fade={run} />
         <StoneBoxes course={course} ids={split.moss} color={COLORS.mossLight} shade={COLORS.moss} map={stone} cap />
         <CrackedBricks run={run} ids={split.cracked} />
         <GhostPanels course={course} ids={split.ghosts} />
         <GhostPanels course={course} ids={split.faint} color="#94a3b8" pulse={false} />
         <Crates run={run} ids={split.crates} clock={clock} />
         <Water run={run} clock={clock} storm={isStormLevel(run.level)} />
         <Levers run={run} />
         <Spouts run={run} />
         <Jets run={run} clock={clock} />
         <Whirls run={run} clock={clock} />
         <Bats run={run} clock={clock} />
         {orbs.length > 0 ? <DynamicInstancedModel asset={ASSETS.coin} count={orbs.length} update={orbUpdate} name="coins" /> : null}
         <CheckpointLamps course={course} run={run} />
         <ExitGate run={run} won={won} />
         <Secrets run={run} />
         <Boss run={run} />
         <BillboardField spots={halos} map={glow} additive aspect={1} opacity={0.85} live={hideCollected} renderOrder={5} />
      </>
   );
}
