"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import {
   Color,
   BufferGeometry,
   Float32BufferAttribute,
   LineBasicMaterial,
   MeshBasicMaterial,
   Matrix4,
   Quaternion,
   Vector3,
   type Group,
   type LineSegments,
   type Mesh,
} from "three";
import { Model } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { bank, hover, type BodyOffset } from "@/arcade3d/core/motion";
import { Parcel } from "@/arcade3d/core/kit";
import { DynamicInstanced, BlobShadow } from "@/arcade3d/core/render";
import { ASSETS, BODY_OFFSET, ROTORS } from "./assets";
import { DRONE, PARCEL, WINCH, roofAt, type Run } from "./rules";
import { ROOFTOP_OVERLAY_Y } from "./visuals";
import { DronePrimitive, mergedBoxes } from "./Primitives";
import { COLORS } from "./looks";

const UP = new Vector3(0, 1, 0);
const ONE = new Vector3(1, 1, 1);
const VALID_COLOR = new Color(COLORS.padCompleted);
const NEUTRAL_COLOR = new Color(COLORS.padRing);
const PARCEL_OUTLINE_HALF = 0.3;
const EDGE_PAIRS = [0, 1, 1, 3, 3, 2, 2, 0, 4, 5, 5, 7, 7, 6, 6, 4, 0, 4, 1, 5, 2, 6, 3, 7];

export default function Drone({ run, reduced }: { run: Run; reduced: boolean }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const body = useRef<Group>(null);
   const silhouette = useRef<Mesh>(null);
   const parcel = useRef<Group>(null);
   const lines = useRef<LineSegments>(null);
   const cross = useRef<Group>(null);
   const parcelShadow = useRef<Group>(null);
   const droneShadow = useRef<Group>(null);

   const [scratch] = useState(() => ({
      q: new Quaternion(),
      v: new Vector3(),
      m: new Matrix4(),
      bob: { y: 0, roll: 0, yaw: 0, squash: 1 } as BodyOffset,
      endAt: -1,
   }));

   const lineGeometry = useMemo(() => {
      const g = new BufferGeometry();
      g.setAttribute("position", new Float32BufferAttribute(new Float32Array(78), 3));
      return g;
   }, []);

   const silhouetteGeometry = useMemo(
      () =>
         mergedBoxes([
            [0, 0.23, -0.06, 0.44, 0.18, 0.36, COLORS.droneBody],
            ...ROTORS.map((p) => [p.x, p.y, p.z, 0.26, 0.03, 0.26, COLORS.droneBlue] as const),
         ]),
      []
   );

   const crossGeometry = useMemo(
      () =>
         mergedBoxes(
            [-0.32, -0.1, 0.1, 0.32].flatMap((k) => [
               [k, 0, 0, 0.14, 0.025, 0.055, "#ffffff"] as const,
               [0, 0, k, 0.055, 0.025, 0.14, "#ffffff"] as const,
            ])
         ),
      []
   );

   const silhouetteMaterial = useMemo(
      () =>
         new MeshBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.52,
            depthTest: false,
            depthWrite: false,
         }),
      []
   );

   const lineMaterial = useMemo(
      () => new LineBasicMaterial({ color: COLORS.cable, depthTest: false, depthWrite: false }),
      []
   );

   useEffect(
      () => () => {
         lineGeometry.dispose();
         silhouetteGeometry.dispose();
         crossGeometry.dispose();
         silhouetteMaterial.dispose();
         lineMaterial.dispose();
      },
      [lineGeometry, silhouetteGeometry, crossGeometry, silhouetteMaterial, lineMaterial]
   );

   useFrame(() => {
      const d = run.drone;
      if (!root.current || !body.current || !silhouette.current) return;

      if (run.reason && scratch.endAt < 0) scratch.endAt = time.now;
      const endTime = scratch.endAt < 0 ? 0 : Math.min(1.2, time.now - scratch.endAt);
      const descend = run.reason === "lose" ? endTime * 1.1 : 0;

      root.current.position.set(d.x, d.y - descend, d.z);
      root.current.rotation.y = d.heading;
      hover(time.now, reduced ? 0 : DRONE.bob, scratch.bob);

      // Bank about the measured hook: cable visual and logical anchors remain identical
      body.current.rotation.z = reduced
         ? 0
         : bank(run.scratch.acc.x / (DRONE.accel * (run.attached ? WINCH.forcing : 1)), DRONE.bank) + scratch.bob.roll;

      silhouette.current.position.copy(root.current.position);
      silhouette.current.quaternion.copy(root.current.quaternion).multiply(body.current.quaternion);

      // Grounding drone blob shadow below the drone on roofs / streets
      if (droneShadow.current) {
         const groundY = roofAt(run.city, d.x, d.z);
         droneShadow.current.position.set(d.x, groundY + ROOFTOP_OVERLAY_Y, d.z);
         const heightAbove = Math.max(0.5, d.y - groundY);
         const shadowScale = Math.max(0.6, 1.2 - heightAbove * 0.08);
         droneShadow.current.scale.set(shadowScale, 1, shadowScale);
      }

      // Parcel positioning
      if (parcel.current) {
         parcel.current.visible = run.attached || run.falling;
         parcel.current.position.set(run.parcel.x, run.parcel.y - PARCEL.half, run.parcel.z);
      }

      // Cable and outline rendering
      const positions = lineGeometry.getAttribute("position") as Float32BufferAttribute;
      const values = positions.array as Float32Array;
      if (run.attached || run.falling) {
         values[0] = d.x;
         values[1] = d.y;
         values[2] = d.z;
         values[3] = run.attached ? run.parcel.x : d.x;
         values[4] = run.attached ? run.parcel.y + PARCEL.half : d.y;
         values[5] = run.attached ? run.parcel.z : d.z;
         for (let k = 0; k < EDGE_PAIRS.length; k++) {
            const corner = EDGE_PAIRS[k];
            const offset = 6 + k * 3;
            values[offset] = run.parcel.x + (corner & 1 ? PARCEL_OUTLINE_HALF : -PARCEL_OUTLINE_HALF);
            values[offset + 1] = run.parcel.y + (corner & 2 ? PARCEL_OUTLINE_HALF : -PARCEL_OUTLINE_HALF);
            values[offset + 2] = run.parcel.z + (corner & 4 ? PARCEL_OUTLINE_HALF : -PARCEL_OUTLINE_HALF);
         }
         positions.needsUpdate = true;
      }
      if (lines.current) lines.current.visible = run.attached || run.falling;

      // Drop prediction landing cross and checkmark
      if (cross.current) {
         cross.current.visible = run.attached && !run.reason;
         cross.current.position.set(run.preview.x, run.preview.y + ROOFTOP_OVERLAY_Y, run.preview.z);
         cross.current.scale.setScalar(run.preview.valid ? 1.2 : 1);
         const material = (cross.current.children[0] as Mesh).material as MeshBasicMaterial;
         material.color.copy(run.preview.valid ? VALID_COLOR : NEUTRAL_COLOR);
         cross.current.children[1].visible = run.preview.valid;
         cross.current.children[2].visible = run.preview.valid;
      }

      // Parcel vertical ground blob shadow
      if (parcelShadow.current) {
         parcelShadow.current.visible = run.attached || run.falling;
         parcelShadow.current.position.set(
            run.parcel.x,
            Math.max(0, run.preview.y) + ROOFTOP_OVERLAY_Y,
            run.parcel.z
         );
      }
   });

   return (
      <group name="delivery-drone">
         <group ref={root}>
            <group ref={body}>
               {/* Drone 3D model with deliberate quadcopter fallback */}
               <group position={BODY_OFFSET}>
                  <Model
                     asset={ASSETS.drone}
                     fallback={
                        <group position={[-BODY_OFFSET[0], 0, -BODY_OFFSET[2]]}>
                           <DronePrimitive />
                        </group>
                     }
                  />
               </group>

               {/* Aerodynamic spinning quadcopter rotors */}
               <DynamicInstanced
                  count={4}
                  update={(i, m) => {
                     const r = ROTORS[i];
                     const angle = run.reason === "lose" ? 0 : time.now * 65 + i * (Math.PI / 2);
                     scratch.q.setFromAxisAngle(UP, angle);
                     scratch.v.set(r.x, r.y + 0.015, r.z);
                     m.compose(scratch.v, scratch.q, ONE);
                  }}
               >
                  <boxGeometry args={[0.26, 0.007, 0.045]} />
                  <meshBasicMaterial color={COLORS.rotorBlade} transparent opacity={0.65} />
               </DynamicInstanced>
            </group>
         </group>

         {/* Attached / falling parcel */}
         <group ref={parcel} visible={false}>
            <Model asset={ASSETS.parcel} fallback={<Parcel size={[0.4, 0.4, 0.4]} />} />
         </group>

         {/* High-contrast visibility overlay pass */}
         <mesh
            ref={silhouette}
            geometry={silhouetteGeometry}
            material={silhouetteMaterial}
            renderOrder={100}
            dispose={null}
         />
         <lineSegments
            ref={lines}
            geometry={lineGeometry}
            material={lineMaterial}
            frustumCulled={false}
            renderOrder={101}
            dispose={null}
         />

         {/* Predictive landing cross & green checkmark */}
         <group ref={cross} visible={false}>
            <mesh>
               <primitive object={crossGeometry} attach="geometry" />
               <meshBasicMaterial color={COLORS.padRing} depthTest={false} depthWrite={false} />
            </mesh>
            <mesh position={[0.4, 0.02, 0]} rotation={[0, 0, 0.7]}>
               <boxGeometry args={[0.09, 0.22, 0.09]} />
               <meshBasicMaterial color={COLORS.padCompleted} depthTest={false} />
            </mesh>
            <mesh position={[0.55, 0.1, 0]} rotation={[0, 0, -0.5]}>
               <boxGeometry args={[0.1, 0.5, 0.1]} />
               <meshBasicMaterial color={COLORS.padCompleted} depthTest={false} />
            </mesh>
         </group>

         {/* Soft ground blob shadows for parcel and drone */}
         <group ref={parcelShadow}>
            <BlobShadow radius={0.25} y={0} opacity={0.35} />
         </group>
         <group ref={droneShadow}>
            <BlobShadow radius={0.45} y={0} opacity={0.25} />
         </group>
      </group>
   );
}
