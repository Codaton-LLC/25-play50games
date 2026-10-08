"use client";

// The suitcase pool (one tinted mesh) plus a billboard tag per flight and a gold VIP rim.
import { useCallback, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Color, Euler, Matrix4, Quaternion, Vector3 } from "three";
import { DynamicInstancedModel } from "@/arcade3d/core/assets";
import { DynamicInstanced } from "@/arcade3d/core/render";
import { ASSETS } from "./assets";
import { FLIGHTS, POOL, TAG_M, VIP_RIM, type RunState } from "./rules";

const ALONG = new Quaternion().setFromEuler(new Euler(Math.PI / 2, 0, 0));
const ACROSS = new Quaternion().setFromEuler(new Euler(Math.PI / 2, Math.PI / 2, 0, "YXZ"));

export function Bags({ run }: { run: RunState }) {
   const camera = useThree((state) => state.camera);
   const [scratch] = useState(() => ({
      m: new Matrix4(),
      q: new Quaternion(),
      p: new Vector3(),
      s: new Vector3(1, 1, 1),
      tag: new Vector3(TAG_M, TAG_M, 1),
      rim: new Vector3(TAG_M * 1.28, TAG_M * 1.28, 1),
      spin: new Quaternion(),
      colors: FLIGHTS.map((flight) => new Color(flight.color)),
      gold: new Color(VIP_RIM),
   }));

   const place = useCallback(
      (index: number, matrix: Matrix4, color: Color): boolean | void => {
         const bag = run.bags[index];
         if (!bag.alive && !(bag.tumble > 0)) return false;
         const { p, q, spin } = scratch;
         const chute = bag.segment === 2 || bag.segment === 3 || bag.segment === 5 || bag.segment === 7;
         q.copy(chute ? ACROSS : ALONG);
         if (bag.tumble > 0) {
            spin.setFromAxisAngle(p.set(1, 0.2, 0.4).normalize(), bag.tumble * 14);
            q.multiply(spin);
         }
         p.set(bag.x, bag.y + 0.14, bag.z);
         matrix.compose(p, q, scratch.s);
         color.copy(scratch.colors[bag.flight] ?? scratch.colors[0]);
      },
      [run, scratch]
   );

   const tag = useCallback(
      (flight: number) => (index: number, matrix: Matrix4): boolean | void => {
         const bag = run.bags[index];
         if (!bag.alive || bag.flight !== flight) return false;
         const { p, q } = scratch;
         q.copy(camera.quaternion);
         p.set(bag.x, bag.y + 0.62, bag.z);
         matrix.compose(p, q, scratch.tag);
      },
      [camera, run, scratch]
   );

   const rim = useCallback(
      (index: number, matrix: Matrix4): boolean | void => {
         const bag = run.bags[index];
         if (!bag.alive || !bag.vip) return false;
         const { p, q } = scratch;
         q.copy(camera.quaternion);
         p.set(bag.x, bag.y + 0.62, bag.z);
         matrix.compose(p, q, scratch.rim);
      },
      [camera, run, scratch]
   );

   return (
      <group name="bags">
         <DynamicInstancedModel asset={ASSETS.suitcase} count={POOL} update={place} tinted name="suitcases" />
         <DynamicInstanced count={POOL} update={rim} name="vip-rim">
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial color={VIP_RIM} />
         </DynamicInstanced>
         {FLIGHTS.map((flight, i) => (
            <DynamicInstanced key={flight.symbol} count={POOL} update={tag(i)} name={`tag-${flight.symbol}`}>
               <planeGeometry args={[1, 1]} />
               <meshBasicMaterial color={flight.color} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
            </DynamicInstanced>
         ))}
      </group>
   );
}
