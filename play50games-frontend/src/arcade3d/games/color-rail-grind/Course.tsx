"use client";

// The line, drawn from the rules (rules.ts / network.ts): the rails (m2RailSegmentV2 beams near the hero,
// stretched along each piece and turned along a branch's curve; plain code beams farther off), the
// support pillars (m2SupportPillar), the switches (the junction frog m2RailJunction on the rail, the lever
// box m2RailSwitch beside it, a glowing ring while it is lit, an arrow showing where it points), the
// buffer stops of the dead ends (m2RailJunctionV2), the grind rings (m2GrindRing stood up over the rail),
// the orbs (gold baubles), Zuno's coin trails in the snowbanks (glints until his magnet pulls them out),
// Riko's wooden barrier, Vexa's ghost door, Kiro's icicle tunnels (timber frames with m2Icicle hanging),
// Zuno's loop, Nami's high rails, the toy trains (m2ToyTrainWagon), the station arch at the finish, and on
// level 5 the Clockwork Express (m2ClockworkTrainBoss), its arena switches and buffer spurs, the launch
// ramps (m2RailLaunchRamp), the rings and its dropped wagons.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
   AdditiveBlending,
   BoxGeometry,
   Color,
   ConeGeometry,
   DoubleSide,
   IcosahedronGeometry,
   InstancedMesh,
   Material,
   MeshBasicMaterial,
   MeshStandardMaterial,
   Object3D,
   SphereGeometry,
   TorusGeometry,
   type BufferGeometry,
   type Matrix4,
} from "three";
import { DynamicInstancedModel } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useQuality } from "@/arcade3d/core/quality";
import { ASSETS, EXPRESS_SCALE, GLB_SIZE, RAIL_LIFT, RAIL_PIECE_M, RING_SCALE, WAGON_SCALE } from "./assets";
import { BRANCH, BRANCH_OUT, END, HAZ, HIGH_Y, LANES, NONE, laneX, railX, type Piece } from "./network";
import { LOOKS } from "./look";
import { SECRETS } from "./progression";
import { SWITCHED, arenaLane, bossAlive, bossVulnerable, litArenaSwitch, litSwitch, type RailRun } from "./rules";

const DUMMY = new Object3D();
const WHITE = new Color("#ffffff");

/** Props farther ahead than this are not drawn (the fog hides them). */
export const AHEAD = 140;
/** GLB rail beams within this of the hero; code beams beyond. */
const NEAR_RAIL = 70;
const RAIL_SLOTS = 70;
const FAR_SLOTS = 90;
const PILLAR_STEP = 12;

function place(x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, rx = 0, rz = 0): Object3D {
   DUMMY.position.set(x, y, z);
   DUMMY.rotation.set(rx, ry, rz);
   DUMMY.scale.set(sx, sy, sz);
   DUMMY.updateMatrix();
   return DUMMY;
}

function Pool({ geometry, material, count, update, tinted = false }: { geometry: BufferGeometry; material: Material; count: number; update: (i: number, color: Color) => Object3D | false; tinted?: boolean }) {
   const ref = useRef<InstancedMesh>(null);
   const color = useMemo(() => new Color(), []);
   useEffect(() => {
      const m = ref.current;
      if (!m || !tinted) return;
      for (let i = 0; i < count; i++) m.setColorAt(i, WHITE);
   }, [count, tinted]);
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      let n = 0;
      for (let i = 0; i < count; i++) {
         color.copy(WHITE);
         const o = update(i, color);
         if (o === false) continue;
         m.setMatrixAt(n, o.matrix);
         if (tinted) m.setColorAt(n, color);
         n++;
      }
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (tinted && m.instanceColor) m.instanceColor.needsUpdate = true;
   });
   return <instancedMesh ref={ref} args={[geometry, material, Math.max(1, count)]} frustumCulled={false} />;
}

/** One rail beam's span: the piece, its from-z, its length, its height. */
interface Span {
   p: Piece;
   z: number;
   len: number;
}

export function Course({ run, offsetX = 0 }: { run: RailRun; offsetX?: number }) {
   const c = run.course;
   const look = LOOKS[c.level];
   const time = useGameTime();
   const quality = useQuality();
   const near = (z: number) => z < run.hero.z + 35 && z > run.hero.z - AHEAD;

   const mats = useMemo(
      () => ({
         rail: new MeshStandardMaterial({ color: look.rail, roughness: 0.35, metalness: 0.7 }),
         frozen: new MeshStandardMaterial({ color: look.ice, roughness: 0.15, metalness: 0.3, emissive: look.ice, emissiveIntensity: 0.15 }),
         timber: new MeshStandardMaterial({ color: look.timber, roughness: 0.8 }),
         brass: new MeshStandardMaterial({ color: look.brass, roughness: 0.35, metalness: 0.8 }),
         lit: new MeshBasicMaterial({ color: "#facc15", transparent: true, opacity: 0.75, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
         arrow: new MeshBasicMaterial({ color: "#ffffff", toneMapped: false, transparent: true, opacity: 0.9 }),
         orb: new MeshStandardMaterial({ color: "#ffd257", emissive: "#f59e0b", emissiveIntensity: 0.8, roughness: 0.25, metalness: 0.6 }),
         bonus: new MeshStandardMaterial({ color: "#f9a8d4", emissive: "#ec4899", emissiveIntensity: 0.7, roughness: 0.25, metalness: 0.4 }),
         glint: new MeshBasicMaterial({ color: "#fde68a", transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
         ghost: new MeshBasicMaterial({ color: "#c4b5fd", transparent: true, opacity: 0.28, blending: AdditiveBlending, depthWrite: false, toneMapped: false, side: DoubleSide }),
         plank: new MeshStandardMaterial({ color: "#a0703f", roughness: 0.9, emissive: "#7c2d12", emissiveIntensity: 0.15 }),
         shard: new MeshStandardMaterial({ color: "#e9d5ff", emissive: "#a855f7", emissiveIntensity: 1.2, roughness: 0.2 }),
         loop: new MeshStandardMaterial({ color: "#facc15", roughness: 0.3, metalness: 0.8, emissive: "#a16207", emissiveIntensity: 0.3 }),
         sign: new MeshStandardMaterial({ color: "#7c2d12", roughness: 0.7 }),
         steam: new MeshBasicMaterial({ color: "#f1f5f9", transparent: true, opacity: 0.5, depthWrite: false }),
      }),
      [look],
   );
   useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
   const geos = useMemo(
      () => ({
         box: new BoxGeometry(1, 1, 1),
         orb: new SphereGeometry(0.32, 14, 10),
         cap: new BoxGeometry(0.16, 0.12, 0.16),
         ring: new TorusGeometry(0.9, 0.08, 6, 28),
         loop: new TorusGeometry(4, 0.16, 8, 48),
         glint: new IcosahedronGeometry(0.14, 0),
         arrow: new ConeGeometry(0.35, 0.8, 3),
         gem: new IcosahedronGeometry(0.35, 0),
      }),
      [],
   );
   useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);

   // ---- the rails: every piece near the view cut into beam spans ----
   const spans = useMemo(() => ({ near: [] as Span[], far: [] as Span[], frame: -1 }), []);
   const fillSpans = () => {
      if (spans.frame === run.simMs) return;
      spans.frame = run.simMs;
      spans.near.length = 0;
      spans.far.length = 0;
      const hz = run.hero.z;
      for (const p of c.pieces) {
         const from = Math.min(p.z0, hz + 35);
         const to = Math.max(p.z1, hz - AHEAD);
         if (from <= to) continue;
         const start = Math.ceil((from - p.z0) / RAIL_PIECE_M) * RAIL_PIECE_M + p.z0;
         for (let z = Math.min(from, start); z > to; z -= RAIL_PIECE_M) {
            const len = Math.min(RAIL_PIECE_M, z - Math.max(to, p.z1));
            if (len <= 0.05) continue;
            const list = hz - z < NEAR_RAIL ? spans.near : spans.far;
            if (list.length < (list === spans.near ? RAIL_SLOTS : FAR_SLOTS)) list.push({ p, z, len });
         }
      }
   };
   const railY = (p: Piece) => (p.tier === 1 ? HIGH_Y : 0);
   const beamPlace = (s: Span, sy: number, sx: number, glbX: number) => {
      const zm = s.z - s.len / 2;
      const x0 = railX(s.p, s.z);
      const x1 = railX(s.p, s.z - s.len);
      const ry = Math.atan2(x0 - x1, s.len);
      return place(offsetX + (x0 + x1) / 2, railY(s.p) - sy, zm, sx / glbX, 1, s.len / Math.cos(ry));
   };
   const railSx = 1;
   const railH = GLB_SIZE.rail.y;

   // ---- the switches ----
   const jNear = (j: number) => near(c.junctions[j].z);

   return (
      <group>
         {/* rails: the GLB beam near, a plain beam far */}
         <DynamicInstancedModel
            asset={ASSETS.rail}
            count={RAIL_SLOTS}
            update={(i, m: Matrix4) => {
               fillSpans();
               if (i >= spans.near.length) return false;
               const s = spans.near[i];
               const o = beamPlace(s, railH, railSx * GLB_SIZE.rail.x, GLB_SIZE.rail.x);
               DUMMY.rotation.set(0, Math.atan2(railX(s.p, s.z) - railX(s.p, s.z - s.len), s.len), 0);
               DUMMY.scale.set(1, 1, s.len / GLB_SIZE.rail.z);
               DUMMY.updateMatrix();
               m.copy(o.matrix);
            }}
         />
         <Pool
            geometry={geos.box}
            material={c.level === 3 ? mats.frozen : mats.rail}
            count={FAR_SLOTS}
            update={(i) => {
               fillSpans();
               if (i >= spans.far.length) return false;
               const s = spans.far[i];
               const o = beamPlace(s, 0.2, 0.3, 1);
               DUMMY.position.y = railY(s.p) - 0.2;
               DUMMY.rotation.set(0, Math.atan2(railX(s.p, s.z) - railX(s.p, s.z - s.len), s.len), 0);
               DUMMY.scale.set(0.3, 0.4, s.len);
               DUMMY.updateMatrix();
               return o;
            }}
         />
         {/* frost on level 3's frozen rails near the hero */}
         {c.level === 3 ? (
            <Pool
               geometry={geos.box}
               material={mats.frozen}
               count={RAIL_SLOTS}
               update={(i) => {
                  fillSpans();
                  if (i >= spans.near.length) return false;
                  const s = spans.near[i];
                  const zm = s.z - s.len / 2;
                  return place(offsetX + railX(s.p, zm), railY(s.p) + 0.01, zm, 0.42, 0.04, s.len);
               }}
            />
         ) : null}
         {/* support pillars under the rails */}
         <DynamicInstancedModel
            asset={ASSETS.pillar}
            count={quality.decor < 0.7 ? 24 : 40}
            update={(() => {
               const pts: number[] = [];
               return (i: number, m: Matrix4) => {
                  if (i === 0) {
                     pts.length = 0;
                     const hz = run.hero.z;
                     const base = Math.floor((hz + 20) / PILLAR_STEP) * PILLAR_STEP;
                     for (let k = 0; k < 9 && pts.length < 160; k++) {
                        const z = base - k * PILLAR_STEP;
                        for (let l = 0; l < LANES; l++) {
                           for (const tier of [0, 1]) {
                              for (const p of c.byLane[l * 2 + tier]) {
                                 if (p.z0 < z) break;
                                 if (z > p.z1) pts.push(railX(p, z), z, tier);
                              }
                           }
                        }
                     }
                  }
                  if (i * 3 >= pts.length) return false;
                  const tier = pts[i * 3 + 2];
                  const h = RAIL_LIFT + (tier ? HIGH_Y : 0) - 0.25;
                  const s = 0.3 / GLB_SIZE.pillar.x;
                  place(offsetX + pts[i * 3], -RAIL_LIFT, pts[i * 3 + 1], s, h / GLB_SIZE.pillar.y, s);
                  m.copy(DUMMY.matrix);
               };
            })()}
         />
         {/* the switches: the frog on the rail, the lever box beside it, the lit ring, the arrow */}
         <DynamicInstancedModel
            asset={ASSETS.frog}
            count={6}
            update={(() => {
               const ids: number[] = [];
               return (i: number, m: Matrix4) => {
                  if (i === 0) {
                     ids.length = 0;
                     for (let j = 0; j < c.junctions.length && ids.length < 6; j++) if (jNear(j)) ids.push(j);
                  }
                  if (i >= ids.length) return false;
                  const j = c.junctions[ids[i]];
                  const s = 1.2 / GLB_SIZE.frog.x;
                  place(offsetX + (laneX(j.lane) + laneX(j.to)) / 2, -0.25, j.z - 1, s, s, s * 1.4);
                  m.copy(DUMMY.matrix);
               };
            })()}
         />
         <DynamicInstancedModel
            asset={ASSETS.lever}
            count={6}
            update={(() => {
               const ids: number[] = [];
               return (i: number, m: Matrix4) => {
                  if (i === 0) {
                     ids.length = 0;
                     for (let j = 0; j < c.junctions.length && ids.length < 6; j++) if (jNear(j)) ids.push(j);
                  }
                  if (i >= ids.length) return false;
                  const j = c.junctions[ids[i]];
                  const side = Math.sign(j.to - j.lane) || 1;
                  const s = 1.1 / GLB_SIZE.lever.x;
                  // the lever box on the outer side of the branch, tilted when thrown
                  const thrown = run.board.thrown[j.index] === 1;
                  place(offsetX + laneX(j.to) + side * (BRANCH_OUT + 1.6), -0.1, j.z + 2, s, s, s, 0, 0, thrown ? side * 0.25 : 0);
                  m.copy(DUMMY.matrix);
               };
            })()}
         />
         <Pool
            geometry={geos.ring}
            material={mats.lit}
            count={2}
            update={(i) => {
               if (i === 0) {
                  const j = litSwitch(run);
                  if (j === NONE) return false;
                  const jd = c.junctions[j];
                  const k = 1.3 + 0.15 * Math.sin(time.now * 10);
                  return place(offsetX + laneX(jd.lane), 0.08, jd.z, k, k, k, 0, Math.PI / 2);
               }
               const s = litArenaSwitch(run);
               if (s === NONE) return false;
               const k = 1.5 + 0.15 * Math.sin(time.now * 10);
               return place(offsetX + laneX(3), 0.08, run.arenaZ[s], k, k, k, 0, Math.PI / 2);
            }}
         />
         <Pool
            geometry={geos.arrow}
            material={mats.arrow}
            count={6}
            tinted
            update={(() => {
               const ids: number[] = [];
               return (i: number, color: Color) => {
                  if (i === 0) {
                     ids.length = 0;
                     for (let j = 0; j < c.junctions.length && ids.length < 6; j++) if (jNear(j) && run.junctionResult[j] === SWITCHED.pending) ids.push(j);
                  }
                  if (i >= ids.length) return false;
                  const j = c.junctions[ids[i]];
                  const thrown = run.board.thrown[j.index] === 1;
                  const p = c.pieces[j.piece];
                  color.set(thrown ? (p.branch === BRANCH.dead ? "#ef4444" : "#4ade80") : "#ffffff");
                  // an arrow lying on the rail ahead of the switch, pointing where it sends you
                  const yaw = thrown ? Math.sign(j.to - j.lane) * -0.7 : 0;
                  return place(offsetX + laneX(j.lane), 0.15, j.z + 3, 1, 1, 1, yaw, -Math.PI / 2);
               };
            })()}
         />
         {/* buffer stops at the dead ends */}
         <DynamicInstancedModel
            asset={ASSETS.buffer}
            count={4}
            update={(() => {
               const ids: number[] = [];
               return (i: number, m: Matrix4) => {
                  if (i === 0) {
                     ids.length = 0;
                     for (const p of c.pieces) if (p.end === END.buffer && near(p.z1) && ids.length < 4) ids.push(p.index);
                  }
                  if (i >= ids.length) return false;
                  const p = c.pieces[ids[i]];
                  const s = 1.6 / GLB_SIZE.buffer.x;
                  place(offsetX + railX(p, p.z1 + 0.5), 0, p.z1 + 0.3, s, s * 2.4, s * 3);
                  m.copy(DUMMY.matrix);
               };
            })()}
         />
         {/* grind rings stood up over their rails */}
         <DynamicInstancedModel
            asset={ASSETS.ring}
            count={10}
            update={(() => {
               const ids: number[] = [];
               return (i: number, m: Matrix4) => {
                  if (i === 0) {
                     ids.length = 0;
                     for (let r = 0; r < c.rings.length && ids.length < 10; r++) if (!run.ringsHit[r] && near(c.rings[r].z)) ids.push(r);
                     // level 5's arena rings (phase 2)
                     for (let s = run.arenaSpawned - 1; s >= 0 && ids.length < 10; s--) if (run.arenaPhase[s] === 1 && !run.arenaTaken[s] && near(run.arenaZ[s])) ids.push(-1 - s);
                  }
                  if (i >= ids.length) return false;
                  const id = ids[i];
                  const lane = id >= 0 ? c.rings[id].lane : arenaLane(-1 - id);
                  const z = id >= 0 ? c.rings[id].z : run.arenaZ[-1 - id];
                  place(offsetX + laneX(lane), 1.3 + GLB_SIZE.ring.z * RING_SCALE * 0.5 - 1.2, z, RING_SCALE, RING_SCALE, RING_SCALE, time.now * 0.6, Math.PI / 2);
                  m.copy(DUMMY.matrix);
               };
            })()}
         />
         {/* orbs: gold baubles (main) and pink ones (bonus); Zuno's snow trails as glints until the magnet */}
         <Pool
            geometry={geos.orb}
            material={mats.orb}
            count={30}
            update={(() => {
               const ids: number[] = [];
               return (i: number) => {
                  if (i === 0) {
                     ids.length = 0;
                     for (let q = 0; q < c.orbs.length && ids.length < 30; q++) {
                        const o = c.orbs[q];
                        if (run.collected[q] || o.kind !== "main" || !near(o.z)) continue;
                        ids.push(q);
                     }
                  }
                  if (i >= ids.length) return false;
                  const o = c.orbs[ids[i]];
                  const x = o.piece !== NONE ? railX(c.pieces[o.piece], o.z) : o.x;
                  return place(offsetX + x, o.y + 0.1 * Math.sin(time.now * 3 + o.z), o.z, 1, 1, 1, time.now);
               };
            })()}
         />
         <Pool
            geometry={geos.orb}
            material={mats.bonus}
            count={24}
            update={(() => {
               const ids: number[] = [];
               return (i: number) => {
                  if (i === 0) {
                     ids.length = 0;
                     const magnet = run.simMs < run.hero.magnetUntil;
                     for (let q = 0; q < c.orbs.length && ids.length < 24; q++) {
                        const o = c.orbs[q];
                        if (run.collected[q] || o.kind !== "bonus" || !near(o.z)) continue;
                        if (o.hidden && !magnet) continue;
                        ids.push(q);
                     }
                  }
                  if (i >= ids.length) return false;
                  const o = c.orbs[ids[i]];
                  const h = run.hero;
                  let x = o.piece !== NONE ? railX(c.pieces[o.piece], o.z) : o.x;
                  let y = o.y;
                  if (o.hidden) {
                     const pull = Math.max(0, 1 - (h.z - o.z) / 8);
                     x += (h.x - x) * pull * 0.8;
                     y += (h.y + 0.8 - y) * pull * 0.8;
                  }
                  return place(offsetX + x, y + 0.1 * Math.sin(time.now * 3 + o.z), o.z, 0.85, 0.85, 0.85);
               };
            })()}
         />
         <Pool
            geometry={geos.glint}
            material={mats.glint}
            count={16}
            update={(() => {
               const ids: number[] = [];
               return (i: number) => {
                  if (i === 0) {
                     ids.length = 0;
                     if (run.simMs < run.hero.magnetUntil) return false;
                     for (let q = 0; q < c.orbs.length && ids.length < 16; q++) {
                        const o = c.orbs[q];
                        if (!o.hidden || run.collected[q] || !near(o.z)) continue;
                        ids.push(q);
                     }
                  }
                  if (i >= ids.length) return false;
                  const o = c.orbs[ids[i]];
                  const k = 0.6 + 0.4 * Math.sin(time.now * 5 + o.z);
                  return place(offsetX + o.x, -0.2, o.z, k, k, k);
               };
            })()}
         />
         {/* Riko's barrier: wooden planks across the spur's head; Vexa's ghost door: a violet shimmer */}
         <Pool
            geometry={geos.box}
            material={mats.plank}
            count={6}
            update={(i) => {
               const k = Math.floor(i / 3);
               const plank = i % 3;
               let n = 0;
               for (let q = 0; q < c.hazards.length; q++) {
                  const hz = c.hazards[q];
                  if (hz.kind !== HAZ.barrier || !near(hz.z0) || run.hazardHit[q]) continue;
                  if (n++ !== k) continue;
                  const p = c.pieces[hz.piece];
                  return place(offsetX + railX(p, hz.z0), 0.35 + plank * 0.55, hz.z0, 2.2, 0.32, 0.18, 0, 0, (plank - 1) * 0.12);
               }
               return false;
            }}
         />
         <Pool
            geometry={geos.box}
            material={mats.ghost}
            count={2}
            update={(i) => {
               let n = 0;
               for (let q = 0; q < c.hazards.length; q++) {
                  const hz = c.hazards[q];
                  if (hz.kind !== HAZ.ghost || !near(hz.z0) || run.hazardHit[q]) continue;
                  if (n++ !== i) continue;
                  const p = c.pieces[hz.piece];
                  const w = 1 + 0.05 * Math.sin(time.now * 4);
                  return place(offsetX + railX(p, hz.z0), 1.4, hz.z0, 2.4 * w, 2.8, 0.2);
               }
               return false;
            }}
         />
         {/* Kiro's icicle tunnels: timber frames along the lane, icicles hanging from them */}
         <Pool
            geometry={geos.box}
            material={mats.timber}
            count={36}
            update={(() => {
               const pts: number[] = [];
               return (i: number) => {
                  if (i === 0) {
                     pts.length = 0;
                     for (const hz of c.hazards) {
                        if (hz.kind !== HAZ.icicles) continue;
                        for (let z = hz.z0; z > hz.z1 && pts.length < 36; z -= 5) if (near(z)) pts.push(laneX(hz.lane), z);
                     }
                  }
                  const k = Math.floor(i / 3);
                  if (k * 2 >= pts.length) return false;
                  const x = pts[k * 2];
                  const z = pts[k * 2 + 1];
                  const part = i % 3;
                  if (part === 2) return place(offsetX + x, 3.1, z, 2.6, 0.25, 0.3);
                  return place(offsetX + x + (part ? 1.2 : -1.2), 1.45 - RAIL_LIFT / 2, z, 0.25, 3.1 + RAIL_LIFT, 0.25);
               };
            })()}
         />
         <DynamicInstancedModel
            asset={ASSETS.icicle}
            count={12}
            update={(() => {
               const pts: number[] = [];
               return (i: number, m: Matrix4) => {
                  if (i === 0) {
                     pts.length = 0;
                     for (const hz of c.hazards) {
                        if (hz.kind !== HAZ.icicles) continue;
                        for (let z = hz.z0 - 2.5; z > hz.z1 && pts.length < 24; z -= 5) if (near(z)) pts.push(laneX(hz.lane), z);
                     }
                  }
                  if (i * 2 >= pts.length) return false;
                  const s = 1.0 / GLB_SIZE.icicle.y;
                  // hanging from the frame's top beam, points down
                  place(offsetX + pts[i * 2], 3.0, pts[i * 2 + 1], s * 1.2, s, s, 0, Math.PI);
                  m.copy(DUMMY.matrix);
               };
            })()}
         />
         {/* Zuno's loop: a gold rail loop over its lane */}
         <Pool
            geometry={geos.loop}
            material={mats.loop}
            count={2}
            update={(i) => {
               if (i >= c.loops.length) return false;
               const lp = c.loops[i];
               const zm = (lp.z0 + lp.z1) / 2;
               if (!near(zm)) return false;
               return place(offsetX + laneX(lp.lane), 4, zm, 1, 1, 1, Math.PI / 2);
            }}
         />
         {/* secrets: a shard at the hidden spur and in the loop */}
         <Pool
            geometry={geos.gem}
            material={mats.shard}
            count={3}
            update={(i) => {
               if (i >= c.secrets.length || run.secrets.found[i]) return false;
               const s = c.secrets[i];
               if (!near(s.z)) return false;
               const spec = SECRETS[c.level][i];
               if (spec.id === "hidden" && run.hazardHit.length && !run.secrets.found[i] && run.hero.piece !== s.piece && run.hero.z > s.z + 60) return false;
               return place(offsetX + s.x, s.y + 0.2 * Math.sin(time.now * 2.5), s.z, 1, 1.5, 1, time.now * 2);
            }}
         />
         {/* level 4's toy trains: two wagons each */}
         <DynamicInstancedModel
            asset={ASSETS.wagon}
            count={Math.max(2, run.trains.length * 2 + 2)}
            update={(i, m) => {
               const k = Math.floor(i / 2);
               const t = k < run.trains.length ? run.trains[k] : k === run.trains.length ? run.wagon : null;
               if (!t || !near(t.z)) return false;
               const crashed = !t.live && run.simMs - t.crashMs < 1200;
               if (!t.live && !crashed) return false;
               if (k === run.trains.length && i % 2 === 1) return false;
               const tilt = crashed ? Math.min(1, (run.simMs - t.crashMs) / 400) * 0.6 : 0;
               place(offsetX + t.x, crashed ? -0.3 : 0, t.z + (i % 2 ? 2.4 : 0), WAGON_SCALE, WAGON_SCALE, WAGON_SCALE, 0, tilt, tilt * 0.5);
               m.copy(DUMMY.matrix);
            }}
         />
         {/* the station arch at the finish */}
         <Pool
            geometry={geos.box}
            material={mats.sign}
            count={3}
            update={(i) => {
               const z = run.finishGate;
               if (!near(z) || bossAlive(run)) return false;
               if (i < 2) return place(offsetX + (i ? 1 : -1) * (laneX(3) + 1.6), 1.5 - RAIL_LIFT / 2, z, 0.5, 4 + RAIL_LIFT, 0.5);
               return place(offsetX, 4.3, z, laneX(3) * 2 + 3.6, 0.9, 0.5);
            }}
         />
         {c.boss ? <ExpressArena run={run} offsetX={offsetX} mats={mats} geos={geos} near={near} /> : null}
      </group>
   );
}

/** Level 5: the Clockwork Express, its arena switches and buffer spurs, the launch ramps, its steam. */
function ExpressArena({
   run,
   offsetX,
   mats,
   geos,
   near,
}: {
   run: RailRun;
   offsetX: number;
   mats: Record<string, Material>;
   geos: Record<string, BufferGeometry>;
   near: (z: number) => boolean;
}) {
   const time = useGameTime();
   return (
      <>
         <DynamicInstancedModel
            asset={ASSETS.express}
            count={1}
            update={(_i, m) => {
               if (!run.bossOn) return false;
               const e = run.express;
               const b = run.boss!;
               let y = 0;
               let tilt = 0;
               const crashed = run.simMs - e.crashMs < 1500;
               if (crashed) tilt = Math.sin(Math.min(1, (run.simMs - e.crashMs) / 500) * Math.PI) * 0.25;
               if (!bossAlive(run)) y = -0.1;
               const flash = b.flashMs > 0 ? 1.04 : 1;
               place(offsetX + e.x, y, e.z, EXPRESS_SCALE * flash, EXPRESS_SCALE, EXPRESS_SCALE, Math.PI, 0, tilt);
               m.copy(DUMMY.matrix);
            }}
         />
         {/* its steam puffs (phase 3's attack) and its open glow */}
         <Pool
            geometry={geos.orb}
            material={mats.steam}
            count={6}
            update={(i) => {
               const b = run.boss;
               if (!b || !run.bossOn || b.phase !== 2 || (b.step !== "attack" && b.step !== "telegraph")) return false;
               const e = run.express;
               const k = (time.now * 2 + i / 6) % 1;
               const s = b.step === "attack" ? 2.2 + k * 2 : 0.8;
               return place(offsetX + e.x + Math.sin(i * 2.1) * 0.6, 3.6 + k * 2.5, e.z + 1.5 - k, s, s, s);
            }}
         />
         <Pool
            geometry={geos.ring}
            material={mats.lit}
            count={1}
            update={() => {
               if (!run.bossOn || !bossVulnerable(run)) return false;
               const e = run.express;
               const k = 1.6 + 0.15 * Math.sin(time.now * 8);
               return place(offsetX + e.x, 3.7, e.z, k, k, k, 0, Math.PI / 2);
            }}
         />
         {/* phase 1: its switches (a frog on lane 3) and the buffer spur beside each */}
         <DynamicInstancedModel
            asset={ASSETS.frog}
            count={3}
            update={(i, m) => {
               let n = 0;
               for (let s = 0; s < run.arenaSpawned; s++) {
                  if (run.arenaPhase[s] !== 0 || !near(run.arenaZ[s])) continue;
                  if (n++ !== i) continue;
                  const sc = 1.2 / GLB_SIZE.frog.x;
                  place(offsetX + laneX(3) + 0.8, -0.25, run.arenaZ[s] - 1, sc, sc, sc * 1.4, run.arenaThrown[s] ? -0.4 : 0);
                  m.copy(DUMMY.matrix);
                  return;
               }
               return false;
            }}
         />
         <DynamicInstancedModel
            asset={ASSETS.buffer}
            count={3}
            update={(i, m) => {
               let n = 0;
               for (let s = 0; s < run.arenaSpawned; s++) {
                  if (run.arenaPhase[s] !== 0 || !near(run.arenaZ[s])) continue;
                  if (n++ !== i) continue;
                  const sc = 1.6 / GLB_SIZE.buffer.x;
                  place(offsetX + laneX(3) + BRANCH_OUT + 0.6, 0, run.arenaZ[s] - 22, sc, sc * 2.4, sc * 3);
                  m.copy(DUMMY.matrix);
                  return;
               }
               return false;
            }}
         />
         <Pool
            geometry={geos.box}
            material={mats.rail}
            count={3}
            update={(i) => {
               let n = 0;
               for (let s = 0; s < run.arenaSpawned; s++) {
                  if (run.arenaPhase[s] !== 0 || !near(run.arenaZ[s])) continue;
                  if (n++ !== i) continue;
                  return place(offsetX + laneX(3) + BRANCH_OUT * 0.6, -0.2, run.arenaZ[s] - 11, 0.3, 0.4, 22.5, 0.13);
               }
               return false;
            }}
         />
         {/* phase 3: the launch ramps */}
         <DynamicInstancedModel
            asset={ASSETS.ramp}
            count={3}
            update={(i, m) => {
               let n = 0;
               for (let s = 0; s < run.arenaSpawned; s++) {
                  if (run.arenaPhase[s] !== 2 || run.arenaTaken[s] || !near(run.arenaZ[s])) continue;
                  if (n++ !== i) continue;
                  const sc = 1.6 / GLB_SIZE.ramp.x;
                  place(offsetX + laneX(arenaLane(s)), 0, run.arenaZ[s] + 1, sc, sc * 2, sc * 1.5, Math.PI);
                  m.copy(DUMMY.matrix);
                  return;
               }
               return false;
            }}
         />
      </>
   );
}
