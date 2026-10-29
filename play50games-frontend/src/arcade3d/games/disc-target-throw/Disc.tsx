"use client";

// The disc and everything that reads its flight: the shared code-built TrainingDisc (menu2/props) in
// the hero's hand, spinning out and back; a trail ribbon in the hero's colour that lingers 1 s (the
// card: a post-throw path trail, so the banks are learned); the aim preview while Throw is held (the
// first segment only, up to the first stone it would bank off: decision 7, aim help without timing
// help); and the catch ring on the throw spot, shown 0.8 s before the disc lands back there.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Matrix4, Quaternion, Vector3, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { DynamicInstanced } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { TrainingDisc } from "@/arcade3d/menu2/props/TrainingDisc";
import { heroAccent } from "@/arcade3d/menu2/heroAnim";
import { COLORS } from "./look";
import { CATCH, CONTACT, DISC, flyMs, launchDisc, type Disc as DiscState, type DiscRun } from "./rules";

/** What the Scene shares about the aim each frame (the camera's heading and the stick's hook). */
export interface AimView {
   active: boolean;
   heading: number;
   hook: number;
}

export function createAimView(): AimView {
   return { active: false, heading: Math.PI, hook: 0 };
}

const TRAIL = 40;
const DOTS = 22;
const UP = new Vector3(0, 1, 0);
const X_AXIS = new Vector3(1, 0, 0);
const Q = new Quaternion();
const Q2 = new Quaternion();
const Z_AXIS = new Vector3(0, 0, 1);
const P = new Vector3();
const S = new Vector3();

/** The aim preview's points: the disc's own flight up to its first contact (at most DOTS, every 0.35 m). */
export function previewPoints(run: DiscRun, aim: AimView, scratch: DiscState, out: Float32Array): number {
   const h = run.hero;
   launchDisc(scratch, h.x, h.z, aim.heading, aim.hook, h.lobArmed, h.phaseArmed);
   let n = 0;
   let next = 0;
   for (let k = 0; k < 1600 && n < DOTS; k++) {
      const c = flyMs(run.course, scratch, null, false);
      if (c !== CONTACT.none) {
         out[n * 3] = scratch.x;
         out[n * 3 + 1] = scratch.y;
         out[n * 3 + 2] = scratch.z;
         return n + 1;
      }
      if (scratch.travelled >= next) {
         out[n * 3] = scratch.x;
         out[n * 3 + 1] = scratch.y;
         out[n * 3 + 2] = scratch.z;
         n += 1;
         next += 0.35;
      }
      if (scratch.travelled >= DISC.range) break;
   }
   return n;
}

export function DiscView({ run, aim }: { run: DiscRun; aim: AimView }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const ring = useRef<Mesh>(null);
   const ringMat = useRef<MeshBasicMaterial>(null);
   const accent = useMemo(() => new Color(heroAccent(run.heroId)), [run.heroId]);
   const trail = useMemo(() => ({ pts: new Float32Array(TRAIL * 3), ages: new Float64Array(TRAIL).fill(-9), head: 0, last: -1 }), []);
   const preview = useMemo(() => ({ pts: new Float32Array(DOTS * 3), n: 0, disc: { ...run.disc } }), [run]);

   useFrame(() => {
      const g = root.current;
      const d = run.disc;
      const h = run.hero;
      const now = time.now;
      if (g) {
         if (d.mode === "hand") {
            // in the right hand at chest height, face up
            const f = h.facing;
            g.position.set(h.x + Math.sin(f - 1.1) * 0.45, 0.95, h.z + Math.cos(f - 1.1) * 0.45);
            g.quaternion.setFromAxisAngle(X_AXIS, -Math.PI / 2 + (aim.active ? 0.25 : 0));
            g.scale.setScalar(1.4);
         } else {
            g.position.set(d.x, d.mode === "ground" ? 0.06 : d.y, d.z);
            Q.setFromAxisAngle(X_AXIS, -Math.PI / 2 + (d.mode === "ground" ? 0 : 0.18 * Math.sin(now * 3)));
            Q2.setFromAxisAngle(Z_AXIS, d.mode === "ground" ? 0 : d.spin * 6);
            g.quaternion.copy(Q).multiply(Q2);
            g.scale.setScalar(1.6);
         }
      }
      // the trail: one point every 40 ms of flight
      if ((d.mode === "out" || d.mode === "back") && now - trail.last > 0.04) {
         trail.last = now;
         const i = trail.head;
         trail.pts[i * 3] = d.x;
         trail.pts[i * 3 + 1] = d.y;
         trail.pts[i * 3 + 2] = d.z;
         trail.ages[i] = now;
         trail.head = (i + 1) % TRAIL;
      }
      // the aim preview
      preview.n = aim.active && d.mode === "hand" ? previewPoints(run, aim, preview.disc, preview.pts) : 0;
      // the catch ring: 0.8 s before the disc is back on the throw spot
      const r = ring.current;
      if (r) {
         const left = d.mode === "back" ? (DISC.returnMs - d.backMs) / 1000 : 9;
         r.visible = left <= 0.8;
         if (r.visible) {
            r.position.set(d.fromX, 0.04, d.fromZ);
            const s = 1 + left * 0.8;
            r.scale.setScalar(s);
            const near = Math.hypot(h.x - d.fromX, h.z - d.fromZ) <= CATCH.clean;
            if (ringMat.current) ringMat.current.color.set(near ? "#86efac" : COLORS.catchRing);
         }
      }
   });

   return (
      <>
         <group ref={root}>
            <TrainingDisc glow={0.4} />
         </group>
         <DynamicInstanced
            count={TRAIL}
            tinted
            name="disc-trail"
            update={(i, m: Matrix4, color?: Color) => {
               const age = time.now - trail.ages[i];
               if (age > 1) return false;
               const k = 1 - age;
               P.set(trail.pts[i * 3], trail.pts[i * 3 + 1], trail.pts[i * 3 + 2]);
               Q.identity();
               S.setScalar(0.06 + 0.1 * k);
               m.compose(P, Q, S);
               if (color) color.copy(accent).multiplyScalar(0.6 + 0.6 * k);
            }}
         >
            <sphereGeometry args={[1, 8, 6]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.7} depthWrite={false} toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstanced
            count={DOTS}
            name="aim-preview"
            update={(i, m: Matrix4) => {
               if (i >= preview.n) return false;
               P.set(preview.pts[i * 3], preview.pts[i * 3 + 1], preview.pts[i * 3 + 2]);
               Q.setFromAxisAngle(UP, 0);
               S.setScalar(i === preview.n - 1 ? 0.14 : 0.07);
               m.compose(P, Q, S);
            }}
         >
            <sphereGeometry args={[1, 8, 6]} />
            <meshBasicMaterial color="#fffbe6" transparent opacity={0.85} depthWrite={false} toneMapped={false} />
         </DynamicInstanced>
         <mesh ref={ring} rotation-x={-Math.PI / 2} visible={false} renderOrder={3}>
            <ringGeometry args={[CATCH.clean - 0.12, CATCH.clean, 36]} />
            <meshBasicMaterial ref={ringMat} color={COLORS.catchRing} transparent opacity={0.9} depthWrite={false} toneMapped={false} />
         </mesh>
      </>
   );
}
