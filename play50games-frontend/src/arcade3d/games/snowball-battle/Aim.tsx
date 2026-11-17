"use client";

// Where the throw goes. Desktop: a reticle on the ground under the mouse, and the lob's arc from the
// hand to the highlighted rival (green) or, with no rival in the cone, to the reticle (grey: a click
// there pops "No target in range"). Every device: the highlighted rival (rules `run.highlight`: the
// mouse aim on desktop, the facing on touch / keyboard) gets the core TargetBeacon. Reads the run;
// changes nothing.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Object3D, type InstancedMesh, type Mesh, type MeshBasicMaterial } from "three";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { TargetBeacon, type BeaconTarget } from "@/arcade3d/core/hud/TargetBeacon";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { aimArc } from "./feedback";
import { FOLLOW_Y } from "./camera";
import type { Run } from "./rules";

/** The mouse aim on the ground (written by the Scene each run frame). */
export interface AimPoint {
   x: number;
   z: number;
   /** the mouse has moved and its ray meets the ground */
   on: boolean;
}

export const AIM_COLORS = { locked: "#16a34a", free: "#475569", beacon: "#22c55e" } as const;
const ARC_DOTS = 14;
const LOCKED = new Color(AIM_COLORS.locked);
const FREE = new Color(AIM_COLORS.free);

export default function Aim({ run, aim }: { run: Run; aim: AimPoint }) {
   const reticle = useRef<Mesh>(null);
   const dots = useRef<InstancedMesh>(null);
   const dotMat = useRef<MeshBasicMaterial>(null);
   const ringMat = useRef<MeshBasicMaterial>(null);
   const dummy = useMemo(() => new Object3D(), []);
   const arc = useMemo(() => new Float32Array(ARC_DOTS * 3), []);
   const beacon = useRef<BeaconTarget>({ x: 0, y: FOLLOW_Y + 0.4, z: 0, hidden: true }).current;

   useFrame(() => {
      const phase = useArcadeStore.getState().phase;
      const live = (phase === "playing" || phase === "countdown" || phase === "paused") && !run.endReason;
      const player = run.kids[0];
      const target = live && run.highlight > 0 ? run.kids[run.highlight] : null;
      beacon.hidden = !target;
      if (target) {
         beacon.x = target.x;
         beacon.z = target.z;
      }
      const r = reticle.current;
      const d = dots.current;
      if (!r || !d) return;
      const desktop = !run.coarse && aim.on && live;
      r.visible = desktop;
      if (desktop) {
         r.position.set(aim.x, 0.05, aim.z);
         ringMat.current?.color.copy(target ? LOCKED : FREE);
      }
      const arcOn = desktop && player.ammo > 0 && !run.scooping;
      d.visible = arcOn;
      if (!arcOn) return;
      const tx = target ? target.x : aim.x;
      const tz = target ? target.z : aim.z;
      aimArc(player.x, player.z, tx, target ? 0.62 : 0.08, tz, run.level, ARC_DOTS, arc);
      for (let i = 0; i < ARC_DOTS; i++) {
         // skip the first dot (inside the hand) and grow towards the end, so the arc reads as a path
         const s = i === 0 ? 0 : 0.05 + 0.03 * (i / (ARC_DOTS - 1));
         dummy.position.set(arc[i * 3], arc[i * 3 + 1], arc[i * 3 + 2]);
         dummy.scale.setScalar(s);
         dummy.updateMatrix();
         d.setMatrixAt(i, dummy.matrix);
      }
      d.instanceMatrix.needsUpdate = true;
      const mat = dotMat.current;
      if (mat) {
         mat.color.copy(target ? LOCKED : FREE);
         mat.opacity = target ? 0.95 : 0.55;
      }
   }, FRAME_PRIORITY.visuals);

   return (
      <>
         <mesh ref={reticle} rotation-x={-Math.PI / 2} visible={false} renderOrder={3}>
            <ringGeometry args={[0.32, 0.44, 32]} />
            <meshBasicMaterial ref={ringMat} color={AIM_COLORS.free} transparent opacity={0.9} depthWrite={false} toneMapped={false} />
         </mesh>
         <instancedMesh ref={dots} args={[undefined, undefined, ARC_DOTS]} frustumCulled={false} visible={false} renderOrder={3}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshBasicMaterial ref={dotMat} color={AIM_COLORS.free} transparent opacity={0.6} depthWrite={false} toneMapped={false} />
         </instancedMesh>
         <TargetBeacon target={beacon} variant="pick" color={AIM_COLORS.beacon} radius={0.6} height={0.3} />
      </>
   );
}
