"use client";

// The Rift Serpent (level 5; visuals only: rules.ts owns the fight). Its head is m2PortalWyrmBoss, its
// body a chain of m2VoidCrystal segments (one instanced pool) that follow the head's own trail. It swims
// round the centre island, dives into pair A's frame and comes out of whichever exit you opened (a bonk
// on a beacon spike makes it recoil), coils round the centre in phase 2 with its glowing back crystal
// over the middle, lies tied in a knot in phase 3, and its tail sweeps the centre island between windows
// (a red warning arc first). The hit flash and the defeat shrink come from the shared boss state.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { DynamicInstancedModel, Model } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, GLB_SIZE, WYRM_HEAD_LEN, WYRM_SEG } from "./assets";
import { L5_CENTRE, exitPose, type ExitPose } from "./course";
import { COLORS } from "./look";
import { WYRM, SWEEP_R0, SWEEP_R1 } from "./progression";
import { KNOT_HEAD, sweepAngle, type PortalRun } from "./rules";

const SEGMENTS = 16;
const TRAIL = 400;
const POSE: ExitPose = { x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0, ax: 0, az: 0, yaw: 0 };

interface Trail {
   x: Float32Array;
   y: Float32Array;
   z: Float32Array;
   head: number;
   n: number;
}

function push(t: Trail, x: number, y: number, z: number): void {
   const last = (t.head + TRAIL - 1) % TRAIL;
   if (t.n > 0 && Math.hypot(x - t.x[last], y - t.y[last], z - t.z[last]) < 0.12) return;
   t.x[t.head] = x;
   t.y[t.head] = y;
   t.z[t.head] = z;
   t.head = (t.head + 1) % TRAIL;
   t.n = Math.min(TRAIL, t.n + 1);
}

/** The point `dist` metres back along the trail from its newest point. */
function back(t: Trail, dist: number, out: Vector3): Vector3 {
   let i = (t.head + TRAIL - 1) % TRAIL;
   out.set(t.x[i], t.y[i], t.z[i]);
   let left = dist;
   for (let k = 1; k < t.n; k++) {
      const j = (i + TRAIL - 1) % TRAIL;
      const d = Math.hypot(t.x[j] - t.x[i], t.y[j] - t.y[i], t.z[j] - t.z[i]);
      if (d >= left) {
         const f = left / Math.max(1e-6, d);
         out.set(t.x[i] + (t.x[j] - t.x[i]) * f, t.y[i] + (t.y[j] - t.y[i]) * f, t.z[i] + (t.z[j] - t.z[i]) * f);
         return out;
      }
      left -= d;
      i = j;
      out.set(t.x[i], t.y[i], t.z[i]);
   }
   return out;
}

export default function Wyrm({ run }: { run: PortalRun }) {
   const time = useGameTime();
   const head = useRef<Group>(null);
   const back3 = useRef<Mesh>(null);
   const warn = useRef<Group>(null);
   const warnMat = useRef<MeshBasicMaterial>(null);
   const trail = useMemo<Trail>(() => ({ x: new Float32Array(TRAIL), y: new Float32Array(TRAIL), z: new Float32Array(TRAIL), head: 0, n: 0 }), []);
   const pos = useMemo(() => new Vector3(0, 3, -11), []);
   const target = useMemo(() => new Vector3(), []);
   const tmp = useMemo(() => new Vector3(), []);
   const seg = useMemo(() => Array.from({ length: SEGMENTS }, () => new Vector3()), []);
   const c = run.course;
   const hs = WYRM_HEAD_LEN / GLB_SIZE.wyrmHead.z;
   const ss = WYRM_SEG / GLB_SIZE.crystal.z;
   useFrame(() => {
      const b = run.boss;
      const g = head.current;
      if (!b || !g) return;
      const now = time.now;
      const since = (run.simMs - run.wyrmAt) / 1000;
      const mode = run.wyrm;
      const ent = c.pairs[0].entry;
      if (mode === "dive") {
         const k = Math.min(1, since / 0.9);
         target.set(ent.x + (1 - k) * 4, 1.1 + (1 - k) * 2, ent.z);
      } else if (mode === "emerge" && run.wyrmAnchor >= 0) {
         exitPose(c, c.anchors[run.wyrmAnchor], run.simMs, POSE);
         const bonk = c.anchors[run.wyrmAnchor].beacon >= 0;
         const reach = bonk ? Math.min(4.2, since * 9) : Math.min(9, since * 9);
         const shake = bonk && since * 9 > 4.2 ? Math.sin(now * 40) * 0.25 * Math.max(0, 1 - (since - 0.5)) : 0;
         target.set(POSE.x + POSE.dx * reach + shake, POSE.y + 0.4, POSE.z + POSE.dz * reach);
      } else if (mode === "knot") {
         target.set(KNOT_HEAD.x, KNOT_HEAD.y - 0.4, KNOT_HEAD.z);
      } else if (mode === "coil") {
         const a = now * 0.5;
         target.set(Math.sin(a) * 5.6, 0.9 + Math.sin(now * 2) * 0.2, Math.cos(a) * 5.6);
      } else {
         // circling the centre, rising and falling
         const a = now * 0.32;
         target.set(Math.sin(a) * 12, 3 + Math.sin(now * 0.9) * 1.5, Math.cos(a) * 12);
      }
      const jump = mode === "emerge" && since < 0.05;
      if (jump) pos.copy(target);
      else pos.lerp(target, Math.min(1, time.delta * 4));
      push(trail, pos.x, pos.y, pos.z);
      // the head looks along its travel
      back(trail, 0.8, tmp);
      const yaw = Math.atan2(pos.x - tmp.x, pos.z - tmp.z);
      g.position.copy(pos);
      g.rotation.y = Number.isFinite(yaw) ? yaw : 0;
      const dying = b.defeatMs >= 0 ? Math.max(0, 1 - b.defeatMs / WYRM.defeatMs) : 1;
      const flash = b.flashMs > 0 ? 1.15 : 1;
      g.scale.setScalar(hs * dying * flash);
      g.visible = mode !== "gone" || dying > 0.01;
      for (let i = 0; i < SEGMENTS; i++) {
         if (mode === "knot") {
            // a figure of eight round the head
            const t = (i / SEGMENTS) * Math.PI * 2;
            seg[i].set(KNOT_HEAD.x + Math.sin(t) * 2.4, 0.7 + Math.sin(t * 2) * 0.4, KNOT_HEAD.z + Math.sin(t * 2) * 1.4 + 1.6);
         } else back(trail, 1.6 + i * WYRM_SEG * 0.9, seg[i]);
      }
      // the back crystal over the middle (phase 2), and the tail sweep's warning arc
      const bk = back3.current;
      if (bk) {
         bk.visible = b.phase === 1 && b.defeatMs < 0;
         bk.rotation.y = now;
         bk.position.y = 1 + Math.sin(now * 3) * 0.1;
      }
      const w = warn.current;
      const wm = warnMat.current;
      if (w && wm) {
         const telegraph = b.step === "telegraph";
         const attack = b.step === "attack";
         w.visible = telegraph || attack;
         const sw = sweepAngle(run);
         w.rotation.y = attack && Number.isFinite(sw) ? sw : now * 2;
         wm.opacity = attack ? 0.75 : 0.25 + 0.25 * Math.abs(Math.sin(now * 10));
      }
   });
   if (!c.cfg.boss) return null;
   return (
      <>
         <group ref={head}>
            <Model asset={ASSETS.wyrmHead} />
         </group>
         <DynamicInstancedModel
            asset={ASSETS.crystal}
            count={SEGMENTS}
            update={(i, m) => {
               const b = run.boss;
               if (!b || (run.wyrm === "gone" && b.defeatMs > WYRM.defeatMs)) return false;
               const p = seg[i];
               const k = 1 - (i / SEGMENTS) * 0.45;
               const dying = b.defeatMs >= 0 ? Math.max(0.01, 1 - b.defeatMs / WYRM.defeatMs) : 1;
               m.makeRotationY(i * 0.7);
               m.scale(tmp.set(ss * k * dying, ss * k * dying, ss * k * dying));
               m.setPosition(p.x, p.y - 0.5, p.z);
            }}
         />
         <mesh ref={back3} position={[L5_CENTRE.x, 1, L5_CENTRE.z]}>
            <octahedronGeometry args={[0.9]} />
            <meshStandardMaterial color={COLORS.wyrmGlow} emissive={COLORS.wyrmGlow} emissiveIntensity={1.2} transparent opacity={0.85} />
         </mesh>
         <group ref={warn} position={[L5_CENTRE.x, 0.08, L5_CENTRE.z]}>
            {/* the tail's band: a flat wedge from SWEEP_R0 to SWEEP_R1 round the group's +z */}
            <mesh rotation-x={-Math.PI / 2}>
               <ringGeometry args={[SWEEP_R0, SWEEP_R1, 24, 1, -Math.PI / 2 - 0.3, 0.6]} />
               <meshBasicMaterial ref={warnMat} color={COLORS.laser} transparent opacity={0.4} depthWrite={false} toneMapped={false} side={2} />
            </mesh>
         </group>
      </>
   );
}
