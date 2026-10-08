"use client";

// Everything that floats: the ships (one pool of the ship GLB for all 22, scaled per type), their
// pennants, the galleons' extra sails and the HP pips, the powder barrels, the chest and the decor
// flotsam. Ship placements are computed once per frame (before the pools draw) from the rules state;
// bobbing, rolling and sinking are looks only (the rules stay flat).
import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Euler, Matrix4, Quaternion, Vector3, type Group } from "three";
import { DynamicInstancedModel, Model } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { hover, type BodyOffset } from "@/arcade3d/core/motion";
import { pointAt } from "@/arcade3d/core/path";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { DynamicInstanced } from "@/arcade3d/core/render";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { ASSETS, SHIP_MAST_TOP } from "./assets";
import {
   ChestPrimitive,
   PENNANT,
   useBarrelParts,
   useCrateParts,
   useGalleonSailParts,
   usePennantParts,
   usePipParts,
   useShipParts,
} from "./Primitives";
import { BARREL_FLOATING, BARREL_FUSE, SHIP_ARRIVED, SHIP_COUNT, SHIP_SAILING, SHIP_SUNK, type RunState } from "./rules";

/** Looks the rules do not keep: when each ship began to sink (game time, -1 = afloat), extra drift after the run. */
export interface ShipLooks {
   sunkAt: Float64Array;
   drift: Float64Array;
}
export const createShipLooks = (): ShipLooks => ({ sunkAt: new Float64Array(SHIP_COUNT).fill(-1), drift: new Float64Array(SHIP_COUNT) });

const SINK_S = 1.6;
const PIPS = 3;

const P = new Vector3();
const S = new Vector3();
const Q = new Quaternion();
const E = new Euler(0, 0, 0, "YXZ");
const L = new Matrix4();
const BOB: BodyOffset = { y: 0, roll: 0, yaw: 0, squash: 1 };
const AT = { x: 0, y: 0, z: 0 };
const FLOT_E = new Euler();

/** Per-frame ship placements shared by the ship, pennant, sail and pip pools. */
interface Frame {
   shown: Uint8Array;
   matrix: Matrix4[];
   /** world position of each ship's waterline centre (for the pips) and its scale */
   x: Float32Array;
   y: Float32Array;
   z: Float32Array;
   k: Float32Array;
}

export function Ships({ run, looks }: { run: RunState; looks: ShipLooks }) {
   const time = useGameTime();
   const shipParts = useShipParts();
   const pennantParts = usePennantParts();
   const sailParts = useGalleonSailParts();
   const pipParts = usePipParts();
   const [frame] = useMemo<[Frame]>(
      () => [
         {
            shown: new Uint8Array(SHIP_COUNT),
            matrix: Array.from({ length: SHIP_COUNT }, () => new Matrix4()),
            x: new Float32Array(SHIP_COUNT),
            y: new Float32Array(SHIP_COUNT),
            z: new Float32Array(SHIP_COUNT),
            k: new Float32Array(SHIP_COUNT),
         },
      ],
      []
   );

   // after the simulation and the camera, before the pools draw (visuals, priority 0)
   useFrame(() => {
      const over = useArcadeStore.getState().phase === "over";
      for (let i = 0; i < SHIP_COUNT; i++) {
         const s = run.ships[i];
         frame.shown[i] = 0;
         if (s.state !== SHIP_SAILING && s.state !== SHIP_ARRIVED && s.state !== SHIP_SUNK) continue;
         let sink = 0;
         if (s.state === SHIP_SUNK) {
            if (looks.sunkAt[i] < 0) looks.sunkAt[i] = time.now;
            sink = (time.now - looks.sunkAt[i]) / SINK_S;
            if (sink >= 1) continue;
         } else if (over) looks.drift[i] += s.current * time.delta; // ships sail on through the result delay
         if (looks.drift[i] > 0) pointAt(s.rider.path, s.rider.s + looks.drift[i], AT);
         else {
            AT.x = s.rider.position.x;
            AT.z = s.rider.position.z;
         }
         hover(time.now + i * 1.37, 0.12, BOB);
         const k = s.spec.scale;
         const roll = BOB.roll * 0.6 + 0.05 * Math.sin(time.now * 1.1 + i) + sink * 0.44;
         const y = BOB.y - 2.5 * sink * sink;
         E.set(sink * 0.15, Math.atan2(s.hx, s.hz), roll);
         Q.setFromEuler(E);
         frame.matrix[i].compose(P.set(AT.x, y, AT.z), Q, S.set(k, k, k));
         frame.shown[i] = 1;
         frame.x[i] = AT.x;
         frame.y[i] = y;
         frame.z[i] = AT.z;
         frame.k[i] = k;
      }
   }, -0.1);

   const placeShip = (i: number, m: Matrix4) => {
      if (!frame.shown[i]) return false;
      m.copy(frame.matrix[i]);
   };
   const placePennant = (i: number, m: Matrix4, color: Color) => {
      if (!frame.shown[i]) return false;
      const s = run.ships[i];
      color.copy(PENNANT[s.type]);
      m.copy(frame.matrix[i]).multiply(L.makeRotationY(0.3 * Math.sin(time.now * 6 + i)).setPosition(0, SHIP_MAST_TOP + 0.05, 0.3));
   };
   const placeSails = (i: number, m: Matrix4) => {
      if (!frame.shown[i] || run.ships[i].type !== "galleon") return false;
      m.copy(frame.matrix[i]);
   };
   const placePip = (j: number, m: Matrix4) => {
      const i = Math.floor(j / PIPS);
      const n = j % PIPS;
      const s = run.ships[i];
      if (!frame.shown[i] || s.state !== SHIP_SAILING || n >= s.hp) return false;
      const lift = (SHIP_MAST_TOP + 1.1) * frame.k[i];
      m.makeTranslation(frame.x[i] + (n - (s.hp - 1) / 2) * 1.0, frame.y[i] + lift, frame.z[i]);
   };

   return (
      <group name="ships">
         <DynamicInstancedModel asset={ASSETS.ship} count={SHIP_COUNT} update={placeShip} fallbackParts={shipParts} name="ships" />
         <DynamicInstanced count={SHIP_COUNT} update={placePennant} parts={pennantParts} tinted name="pennants" />
         <DynamicInstanced count={SHIP_COUNT} update={placeSails} parts={sailParts} name="galleon-sails" />
         <DynamicInstanced count={SHIP_COUNT * PIPS} update={placePip} parts={pipParts} name="hp-pips" />
      </group>
   );
}

// ---------- barrels, the chest, flotsam ----------

export function Floaters({ run }: { run: RunState }) {
   const time = useGameTime();
   const barrelParts = useBarrelParts();
   const crateParts = useCrateParts();
   const chest = useRef<Group>(null);
   const { decor } = useQuality();
   // the decor count is fixed at mount (a pool's count never changes)
   const [flotsam] = useState(() => scaledCount(FLOTSAM.length, decor));

   const placeBarrel = (i: number, m: Matrix4) => {
      const b = run.barrels[i];
      if (b.state !== BARREL_FLOATING && b.state !== BARREL_FUSE) return false;
      hover(time.now + i * 2.1, 0.08, BOB);
      const fuse = b.state === BARREL_FUSE ? 1 + 0.25 * Math.abs(Math.sin(time.now * 40)) : 1;
      E.set(BOB.roll, time.now * 0.3 + i, BOB.roll * 0.5);
      m.compose(P.set(b.x, BOB.y, b.z), Q.setFromEuler(E), S.set(fuse, fuse, fuse));
   };
   const placeCrate = (i: number, m: Matrix4) => {
      const f = FLOTSAM[i];
      hover(time.now + i * 3.3, 0.1, BOB);
      FLOT_E.set(BOB.roll, f.yaw + 0.1 * Math.sin(time.now * 0.4 + i), BOB.roll * 0.7);
      m.compose(P.set(f.x, BOB.y - 0.15, f.z), Q.setFromEuler(FLOT_E), S.set(1, 1, 1));
   };

   useFrame(() => {
      const g = chest.current;
      if (!g) return;
      const c = run.chest;
      g.visible = c.state === 1;
      if (!g.visible) return;
      hover(time.now, 0.1, BOB);
      g.position.set(c.x, BOB.y, c.z);
      g.rotation.set(BOB.roll, Math.PI / 2 + 0.2 * Math.sin(time.now * 0.7), BOB.roll * 0.5);
   });

   return (
      <group name="floaters">
         <DynamicInstancedModel asset={ASSETS.barrel} count={run.barrels.length} update={placeBarrel} fallbackParts={barrelParts} name="barrels" />
         {flotsam > 0 && <DynamicInstancedModel asset={ASSETS.crate} count={flotsam} update={placeCrate} fallbackParts={crateParts} name="flotsam" />}
         <group ref={chest} visible={false}>
            <Model asset={ASSETS.chest} fallback={<ChestPrimitive />} />
         </group>
      </group>
   );
}

/** Decor crates bobbing in the shallows in front of the fort (never in a lane). */
const FLOTSAM = [
   { x: -10, z: -10, yaw: 0.4 },
   { x: 8, z: -13, yaw: 1.9 },
   { x: 13, z: -8, yaw: 3.1 },
] as const;
