"use client";

// The cave drawn from the rules every frame (no React state for the run): stone floors, ledges and the
// moving slab (m2CaveSlabPlatform, stretched to each box), crystal bridges (m2CrystalSlabBridge), rock
// walls of boulders (m2CaveBoulder) and the cave gates (m2CaveGate) that sink away when a room is
// solved; the crystal switches (m2CrystalSwitch) tinted per colour with their glyph over them (filled
// when lit, outlined while waiting; a hidden crystal stays dark until you are near); each room's beacon
// pillar (m2CrystalBeaconPillar) with its colour order in glyphs; the orbs, Vexa's ghost walls, Nyla's
// high crystal and the goal ring.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Matrix4, Quaternion, Vector3, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import { DynamicInstanced, Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, BEACON_SCALE, CRYSTAL_SCALE, GATE_STRETCH, GLB_SIZE, ORB_SIZE } from "./assets";
import type { Box, ColorId } from "./course";
import { COLORS, GLYPH_SIDES, GLYPH_TURN } from "./look";
import { boxOffset, boxSolid, type CaveRun } from "./rules";
import { SECRETS } from "./progression";

const UP = new Vector3(0, 1, 0);
const P = new Vector3();
const Q = new Quaternion();
const S = new Vector3();
const O = { x: 0, z: 0 };
const GEM = COLORS.gem.map((c) => new Color(c));
const GEM_TINT = COLORS.gem.map((c) => new Color(c).lerp(new Color("#ffffff"), 0.25));
const DARK = new Color("#3b3550");
const Z_AXIS = new Vector3(0, 0, 1);
/** each colour's glyph turn (a quarter-turned square is the diamond) */
const GLYPH_Q = ([0, 1, 2, 3] as ColorId[]).map((c) => new Quaternion().setFromAxisAngle(Z_AXIS, GLYPH_TURN[c]));

/** Stretches a GLB of raw size `g` over box b (feet at its bottom). */
function boxSpot(b: Box, g: { x: number; y: number; z: number }): InstanceSpot {
   return { x: (b.minX + b.maxX) / 2, y: b.bottom, z: (b.minZ + b.maxZ) / 2, sx: (b.maxX - b.minX) / g.x, sy: (b.top - b.bottom) / g.y, sz: (b.maxZ - b.minZ) / g.z };
}

function Stone({ run }: { run: CaveRun }) {
   const c = run.course;
   const gates = useMemo(() => new Set(c.rooms.map((r) => r.gate)), [c]);
   const { floors, bridges, rocks, steps } = useMemo(() => {
      const floors: InstanceSpot[] = [];
      const bridges: InstanceSpot[] = [];
      const rocks: InstanceSpot[] = [];
      const steps: InstanceSpot[] = [];
      for (const b of c.boxes) {
         if (b.rail) continue;
         if (b.kind === "floor" || b.kind === "ledge" || b.kind === "pillar" || b.kind === "goal") floors.push(boxSpot(b, GLB_SIZE.slab));
         else if (b.kind === "bridge") {
            // the bridge GLB runs along x: turn it a quarter to run along z
            const w = b.maxX - b.minX;
            const l = b.maxZ - b.minZ;
            bridges.push({ x: (b.minX + b.maxX) / 2, y: b.top - GLB_SIZE.bridge.y * 0.9, z: (b.minZ + b.maxZ) / 2, rotY: Math.PI / 2, sx: l / GLB_SIZE.bridge.x, sy: 0.9, sz: w / GLB_SIZE.bridge.z });
         } else if (b.kind === "boulder") steps.push({ x: (b.minX + b.maxX) / 2, y: b.bottom, z: (b.minZ + b.maxZ) / 2, sx: (b.maxX - b.minX) / GLB_SIZE.boulder.x, sy: (b.top - b.bottom) / GLB_SIZE.boulder.y, sz: (b.maxZ - b.minZ) / GLB_SIZE.boulder.z });
         else if (b.kind === "wall" && !gates.has(b.id)) {
            // a wall is a row of boulders, a little over the box so it reads as rock
            const n = Math.max(1, Math.round((b.maxX - b.minX) / 1.6));
            for (let k = 0; k < n; k++) {
               const x = b.minX + ((k + 0.5) * (b.maxX - b.minX)) / n;
               const h = b.top - 0 + 0.4 + ((k * 37) % 5) * 0.15;
               rocks.push({ x, y: 0, z: (b.minZ + b.maxZ) / 2, rotY: k * 1.7, sx: 2 / GLB_SIZE.boulder.x, sy: h / GLB_SIZE.boulder.y, sz: 1.3 / GLB_SIZE.boulder.z });
            }
         }
      }
      return { floors, bridges, rocks, steps };
   }, [c, gates]);
   return (
      <>
         <InstancedModel
            asset={ASSETS.slab}
            spots={floors}
            fallback={
               <Instanced spots={floors}>
                  <boxGeometry args={[GLB_SIZE.slab.x, GLB_SIZE.slab.y, GLB_SIZE.slab.z]} />
                  <meshStandardMaterial color={COLORS.stoneTop} roughness={0.9} />
               </Instanced>
            }
         />
         <InstancedModel
            asset={ASSETS.bridge}
            spots={bridges}
            fallback={
               <Instanced spots={bridges}>
                  <boxGeometry args={[GLB_SIZE.bridge.x, GLB_SIZE.bridge.y, GLB_SIZE.bridge.z]} />
                  <meshStandardMaterial color="#a5b4fc" roughness={0.4} />
               </Instanced>
            }
         />
         <InstancedModel
            asset={ASSETS.boulder}
            spots={rocks.concat(steps)}
            fallback={
               <Instanced spots={rocks.concat(steps)}>
                  <dodecahedronGeometry args={[0.9, 0]} />
                  <meshStandardMaterial color={COLORS.wall} roughness={0.95} flatShading />
               </Instanced>
            }
         />
      </>
   );
}

/** The moving slab: placed every frame. */
function Slabs({ run }: { run: CaveRun }) {
   const slabs = useMemo(() => run.course.boxes.filter((b) => b.rail), [run]);
   const refs = useRef<(Group | null)[]>([]);
   useFrame(() => {
      slabs.forEach((b, i) => {
         const g = refs.current[i];
         if (!g) return;
         boxOffset(run, b, O);
         g.position.set((b.minX + b.maxX) / 2 + O.x, b.bottom, (b.minZ + b.maxZ) / 2 + O.z);
      });
   });
   return (
      <>
         {slabs.map((b, i) => (
            <group
               key={b.id}
               ref={(g) => {
                  refs.current[i] = g;
               }}
            >
               <Model asset={ASSETS.slab} scale={[(b.maxX - b.minX) / GLB_SIZE.slab.x, (b.top - b.bottom) / GLB_SIZE.slab.y, (b.maxZ - b.minZ) / GLB_SIZE.slab.z]} />
               <mesh position={[0, b.top - b.bottom + 0.03, 0]} rotation-x={-Math.PI / 2}>
                  <ringGeometry args={[0.9, 1.05, 32]} />
                  <meshBasicMaterial color="#a5f3fc" transparent opacity={0.7} toneMapped={false} />
               </mesh>
            </group>
         ))}
      </>
   );
}

/** The gates: closed, or sinking away once their room is solved. */
function Gates({ run }: { run: CaveRun }) {
   const time = useGameTime();
   const openAt = useRef<number[]>([]);
   const gates = run.course.rooms.map((r) => run.course.boxes[r.gate]);
   return (
      <DynamicInstancedModel
         asset={ASSETS.gate}
         count={gates.length}
         name="gates"
         update={(i, m: Matrix4) => {
            const b = gates[i];
            const open = !boxSolid(run, b);
            if (open && openAt.current[i] === undefined) openAt.current[i] = time.now;
            const sink = open ? Math.min(1, (time.now - (openAt.current[i] ?? time.now)) / 0.8) : 0;
            if (sink >= 1) return false;
            P.set((b.minX + b.maxX) / 2, -sink * 4.2, (b.minZ + b.maxZ) / 2);
            Q.identity();
            S.set(GATE_STRETCH[0], GATE_STRETCH[1], GATE_STRETCH[2]);
            m.compose(P, Q, S);
         }}
      />
   );
}

function gemShown(run: CaveRun, i: number): { lit: boolean; near: boolean } {
   const s = run.course.switches[i];
   const h = run.hero;
   const near = !s.hidden || Math.hypot(h.x - s.x, h.z - s.z) < 5.5;
   const solved = s.room >= 0 && run.solved[s.room] === 1;
   return { lit: run.lit[i] === 1 || (solved && !s.decoy), near };
}

/** The crystal switches, tinted per colour (a hidden one dark until you are near), and their glyphs. */
function Crystals({ run }: { run: CaveRun }) {
   const sw = run.course.switches;
   const time = useGameTime();
   const glyph = (sides: number, filled: boolean) => (i: number, m: Matrix4, color?: Color) => {
      const s = sw[i];
      if (GLYPH_SIDES[s.color] !== sides) return false;
      const { lit, near } = gemShown(run, i);
      if (!near || lit !== filled) return false;
      P.set(s.x, s.base + 2.1 + Math.sin(time.now * 2 + i) * 0.06, s.z);
      Q.copy(GLYPH_Q[s.color]);
      const sc = s.color === 2 ? 0.8 : 1;
      S.set(sc, s.color === 2 ? 1.25 : 1, 1);
      m.compose(P, Q, S);
      color?.copy(GEM[s.color]);
   };
   const fills = useMemo(() => ({ f3: glyph(3, true), f4: glyph(4, true), f32: glyph(32, true), o3: glyph(3, false), o4: glyph(4, false), o32: glyph(32, false) }), [run]); // eslint-disable-line react-hooks/exhaustive-deps
   const n = sw.length;
   return (
      <>
         <DynamicInstancedModel
            asset={ASSETS.crystal}
            count={n}
            name="crystals"
            update={(i, m: Matrix4, color?: Color) => {
               const s = sw[i];
               const { lit, near } = gemShown(run, i);
               P.set(s.x, s.base, s.z);
               Q.setFromAxisAngle(UP, time.now * (lit ? 1.2 : 0.3) + i);
               const k = CRYSTAL_SCALE * (lit ? 1.08 : 1);
               S.set(k, k, k);
               m.compose(P, Q, S);
               color?.copy(near ? (lit ? GEM_TINT[s.color] : GEM[s.color]) : DARK);
            }}
         />
         {/* lit crystals glow */}
         <DynamicInstanced
            count={n}
            name="crystal-glow"
            tinted
            update={(i, m: Matrix4, color?: Color) => {
               const s = sw[i];
               const { lit } = gemShown(run, i);
               if (!lit) return false;
               P.set(s.x, s.base + 0.9, s.z);
               Q.identity();
               const k = 1.1 + Math.sin(time.now * 4 + i) * 0.08;
               S.set(k, k, k);
               m.compose(P, Q, S);
               color?.copy(GEM[s.color]);
            }}
         >
            <sphereGeometry args={[1, 16, 12]} />
            <meshBasicMaterial transparent opacity={0.22} depthWrite={false} toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstanced count={n} update={fills.f3} name="g-f3" tinted>
            <circleGeometry args={[0.38, 3]} />
            <meshBasicMaterial side={2} toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstanced count={n} update={fills.f4} name="g-f4" tinted>
            <circleGeometry args={[0.34, 4]} />
            <meshBasicMaterial side={2} toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstanced count={n} update={fills.f32} name="g-f32" tinted>
            <circleGeometry args={[0.3, 32]} />
            <meshBasicMaterial side={2} toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstanced count={n} update={fills.o3} name="g-o3" tinted>
            <ringGeometry args={[0.28, 0.38, 3]} />
            <meshBasicMaterial side={2} toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstanced count={n} update={fills.o4} name="g-o4" tinted>
            <ringGeometry args={[0.25, 0.34, 4]} />
            <meshBasicMaterial side={2} toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstanced count={n} update={fills.o32} name="g-o32" tinted>
            <ringGeometry args={[0.22, 0.3, 32]} />
            <meshBasicMaterial side={2} toneMapped={false} />
         </DynamicInstanced>
      </>
   );
}

/** One room's beacon: the pillar and its colour order as glyphs over it (struck ones bright). */
function Beacon({ run, room }: { run: CaveRun; room: number }) {
   const r = run.course.rooms[room];
   const marks = useRef<(Mesh | null)[]>([]);
   const time = useGameTime();
   useFrame(() => {
      r.seq.forEach((_id, k) => {
         const m = marks.current[k];
         if (!m) return;
         const done = run.solved[room] === 1 || k < run.progress[room];
         const next = !done && k === run.progress[room];
         (m.material as MeshBasicMaterial).opacity = done ? 1 : next ? 0.6 + Math.sin(time.now * 6) * 0.3 : 0.35;
         m.scale.setScalar(next ? 1.15 : 1);
      });
   });
   const colors = r.seq.map((id) => run.course.switches[id].color as ColorId);
   const n = colors.length;
   return (
      <group position={[r.beacon.x, 0, r.beacon.z]}>
         <Model asset={ASSETS.beacon} scale={BEACON_SCALE} />
         {colors.map((col, k) => (
            <mesh
               key={k}
               ref={(m) => {
                  marks.current[k] = m;
               }}
               position={[0, 3.6 + (n - 1 - k) * 0.75, 0.3]}
               rotation-z={GLYPH_TURN[col]}
               scale-y={col === 2 ? 1.25 : 1}
            >
               <circleGeometry args={[0.3, GLYPH_SIDES[col]]} />
               <meshBasicMaterial color={COLORS.gem[col]} transparent opacity={0.35} side={2} toneMapped={false} />
            </mesh>
         ))}
      </group>
   );
}

function Orbs({ run }: { run: CaveRun }) {
   const orbs = run.course.orbs;
   const time = useGameTime();
   return (
      <DynamicInstancedModel
         asset={ASSETS.orb}
         count={orbs.length}
         name="orbs"
         update={(i, m: Matrix4) => {
            if (run.taken[i]) return false;
            const o = orbs[i];
            P.set(o.x, o.y - ORB_SIZE / 2 + Math.sin(time.now * 2 + i) * 0.08, o.z);
            Q.setFromAxisAngle(UP, time.now * 1.5 + i);
            const s = ORB_SIZE / GLB_SIZE.orb.y;
            S.set(s, s, s);
            m.compose(P, Q, S);
         }}
      />
   );
}

function Secrets({ run }: { run: CaveRun }) {
   const c = run.course;
   const time = useGameTime();
   const walls = useRef<(Mesh | null)[]>([]);
   const gems = useRef<(Mesh | null)[]>([]);
   const high = useRef<Mesh>(null);
   const idx = (id: string) => SECRETS[run.level].findIndex((s) => s.id === id);
   useFrame(() => {
      const phasing = run.simMs <= run.hero.phaseUntil;
      walls.current.forEach((w) => {
         if (!w) return;
         const mat = w.material as { opacity: number };
         mat.opacity += ((phasing ? 0.15 : 0.45) - mat.opacity) * 0.15;
      });
      gems.current.forEach((g, i) => {
         if (!g) return;
         g.visible = !run.secrets.found[idx("ghost")];
         g.rotation.y = time.now * 2 + i;
      });
      if (high.current) {
         high.current.visible = !run.secrets.found[idx("high")];
         high.current.rotation.y = time.now * 1.8;
      }
   });
   return (
      <>
         {c.ghostWalls.map((w, i) => (
            <group key={w.id}>
               <mesh
                  ref={(m) => {
                     walls.current[i] = m;
                  }}
                  position={[w.x, w.y, w.z]}
               >
                  <boxGeometry args={[w.normal === "x" ? 0.12 : 2, 2.4, w.normal === "x" ? 2 : 0.12]} />
                  <meshStandardMaterial color={COLORS.ghost} emissive={COLORS.ghost} emissiveIntensity={0.6} transparent opacity={0.45} depthWrite={false} />
               </mesh>
               <mesh
                  ref={(m) => {
                     gems.current[i] = m;
                  }}
                  position={[w.crystal.x, w.crystal.y, w.crystal.z]}
               >
                  <octahedronGeometry args={[0.32, 0]} />
                  <meshStandardMaterial color={COLORS.ghost} emissive="#a78bfa" emissiveIntensity={1.4} toneMapped={false} />
               </mesh>
            </group>
         ))}
         <mesh ref={high} position={[c.high.x, c.high.y, c.high.z]}>
            <torusKnotGeometry args={[0.22, 0.07, 48, 8]} />
            <meshStandardMaterial color={COLORS.high} emissive="#60a5fa" emissiveIntensity={1.2} toneMapped={false} />
         </mesh>
      </>
   );
}

function Goal({ run }: { run: CaveRun }) {
   const ref = useRef<Mesh>(null);
   const time = useGameTime();
   const b = run.course.goal >= 0 ? run.course.boxes[run.course.goal] : null;
   useFrame(() => {
      if (ref.current) ref.current.rotation.z = time.now * 0.8;
   });
   if (!b) return null;
   return (
      <mesh ref={ref} position={[(b.minX + b.maxX) / 2, b.top + 0.05, (b.minZ + b.maxZ) / 2]} rotation-x={-Math.PI / 2}>
         <ringGeometry args={[1.6, 2.1, 6]} />
         <meshBasicMaterial color="#fde68a" transparent opacity={0.8} toneMapped={false} />
      </mesh>
   );
}

export function Cave({ run }: { run: CaveRun }) {
   return (
      <group>
         <Stone run={run} />
         <Slabs run={run} />
         <Gates run={run} />
         <Crystals run={run} />
         {run.course.rooms.map((r) => (
            <Beacon key={r.id} run={run} room={r.id} />
         ))}
         <Orbs run={run} />
         <Secrets run={run} />
         <Goal run={run} />
      </group>
   );
}
