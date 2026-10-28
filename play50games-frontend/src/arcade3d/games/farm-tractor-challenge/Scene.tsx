"use client";

// One useRunFrame steps rules.ts. Visuals read the run and animate with useGameTime.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { CylinderGeometry, MeshStandardMaterial, Quaternion, RingGeometry, Vector3, type Matrix4 } from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import CameraRig from "@/arcade3d/core/CameraRig";
import { useCameraViews } from "@/arcade3d/core/camera/CameraViews";
import { playSfx } from "@/arcade3d/core/audio";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { tossAt, useActionPop, useFx, type TossFrame } from "@/arcade3d/core/fx";
import { TargetBeacon } from "@/arcade3d/core/hud";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInput } from "@/arcade3d/core/input";
import { useLevel } from "@/arcade3d/core/level";
import { randomSeed } from "@/arcade3d/core/math";
import { DynamicInstanced, Instanced, type InstancePart } from "@/arcade3d/core/render";
import { HumanoidModel, cheerPose, sitPose, useHumanoidPose } from "@/arcade3d/core/rig";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { ASSETS, GATE_SCALE, SEAT_Y, SEAT_Z, TRAILER_BED } from "./assets";
import type { FarmLevel } from "./levels";
import {
   COLORS,
   DAMPING,
   FOLLOW,
   FOV,
   LOOK_AHEAD,
   decorAt,
   fenceDraw,
   fenceGlbSpots,
   aimBounds,
   groundSpan,
   lookAtFor,
   viewFor,
} from "./looks";
import { BarnFrame, FarmerFigure, GatePostPrimitive, ScarecrowPrimitive, SiloPrimitive, TractorPrimitive, TrailerPrimitive, TroughPrimitive } from "./Primitives";
import { BAY_RING, GUIDE, bumpAtBale, farmHint, hintCode, nextGoal, type FarmGoal } from "./guide";
import { BALE_R, MAX_BALES, TRAILER_BEHIND, createRun, forwardOf, hitchPoint, step, type Run } from "./rules";

const Q = new Quaternion();
const V = new Vector3();
const S = new Vector3();
const UP = new Vector3(0, 1, 0);
const AT = { x: 0, y: 0.8, z: 0 };
/** The gate leaf stands beside its post, along the fence, so the opening stays 2 x GATE_HALF wide. */
const GATE_LEAF_OUT = 0.95 * GATE_SCALE + 0.15;
/** The trailer's drawn yaw eases toward the tractor's heading at this rate (1/s). */
const TRAILER_TURN = 3;
/** A load's height on the trailer bed (metres). */
const CARGO_ON_BED_HEIGHT = 0.72;
/** Height of the tractor's rear hitch pin (metres). */
const HITCH_Y = 0.42;
/** A hitched load swings onto the bed, and a delivered one into the barn, over this long (s). */
const LOAD_FLIGHT_S = 0.45;
const FLY: TossFrame = { x: 0, y: 0, z: 0, scale: 1 };
const FROM = { x: 0, y: 0, z: 0 };
const TO = { x: 0, y: 0, z: 0 };

function wrapAngle(a: number): number {
   return a > Math.PI ? a - Math.PI * 2 : a < -Math.PI ? a + Math.PI * 2 : a;
}

function disposeParts(parts: InstancePart[]) {
   for (const part of parts) {
      part.geometry.dispose();
      const material = part.material;
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else material.dispose();
   }
}

function LevelScene() {
   const { id, config } = useLevel<FarmLevel>();
   const view = useFittedView(viewFor(id));
   const input = useInput();
   const fx = useFx();
   const time = useGameTime();
   const run = useMemo<Run>(() => createRun(randomSeed(), config), [config]);
   const cameraSolids = useMemo(() => [
      ...run.treeBoxes,
      ...run.segs.map((s) => ({
         min: { x: Math.min(s.ax, s.bx) - 0.09, y: 0, z: Math.min(s.az, s.bz) - 0.09 },
         max: { x: Math.max(s.ax, s.bx) + 0.09, y: 1.05, z: Math.max(s.az, s.bz) + 0.09 },
      })),
      ...run.posts.map((p) => ({
         min: { x: p.x - 0.42, y: 0, z: p.z - 0.42 },
         max: { x: p.x + 0.42, y: 1.8, z: p.z + 0.42 },
      })),
   ], [run]);
   // Keep the fitted follow camera as classic; top stays below the mud farm's fog start (22 m).
   const cam = useCameraViews({
      slug: "farm-tractor-challenge",
      subject: "vehicle",
      steering: "vehicle",
      defaultYaw: view.yaw,
      views: ["default", "front", "top", "free"],
      framing: { top: { distance: 18 } },
      target: (o) => {
         const t = run.tractor;
         o.x = t.x;
         o.y = 1.1;
         o.z = t.z;
         o.heading = t.yaw;
         o.vx = Math.sin(t.yaw) * t.speed;
         o.vz = Math.cos(t.yaw) * t.speed;
      },
      solids: (out) => {
         const count = Math.min(out.length, cameraSolids.length);
         for (let i = 0; i < count; i++) {
            Object.assign(out[i].min, cameraSolids[i].min);
            Object.assign(out[i].max, cameraSolids[i].max);
         }
         return count;
      },
   });
   const aim = useRef({ x: run.tractor.x, y: 0.8, z: run.tractor.z + LOOK_AHEAD }).current;
   const body = useRef<import("three").Group>(null);
   const trailer = useRef<import("three").Group>(null);
   const drawbar = useRef<import("three").Group>(null);
   const pin = useRef<import("three").Mesh>(null);
   /**
    * The trailer as drawn: its yaw eases toward the tractor's heading and it hangs TRAILER_BEHIND
    * behind the hitch along that yaw, so the hitch bar is rigid. Once the yaw has caught up (straight
    * driving, parking) that is the rules' spring point, which the slots and the bay check use.
    */
   const towed = useRef({ yaw: run.tractor.yaw, x: run.trailerX.x, z: run.trailerZ.x }).current;
   const bounds = useMemo(() => aimBounds(config), [config]);
   const look = useMemo(() => lookAtFor(config), [config]);
   const decor = useMemo(() => decorAt(config), [config]);
   const span = groundSpan(config);
   const fence = fenceDraw(id);
   const glbPosts = useMemo(() => fenceGlbSpots(id), [id]);
   const mudSpots = useMemo(() => run.mud.map((rect) => ({
      x: (rect.x0 + rect.x1) / 2,
      y: 0.035,
      z: (rect.z0 + rect.z1) / 2,
      sx: rect.x1 - rect.x0,
      sy: 0.05,
      sz: rect.z1 - rect.z0,
   })), [run]);
   const treeGlb = useMemo(() => run.trees.map((tree) => ({ x: tree.x, y: 0, z: tree.z })), [run]);
   const treeTrunks = useMemo(() => run.trees.map((tree) => ({ x: tree.x, y: 0.7, z: tree.z, sx: 0.45, sy: 1.4, sz: 0.45 })), [run]);
   const treeCrowns = useMemo(() => run.trees.map((tree) => ({ x: tree.x, y: 2.15, z: tree.z, sx: 1.5, sy: 2.2, sz: 1.5 })), [run]);
   const halfD = config.depth / 2;
   const bayZ = (run.gateZ + halfD) / 2;

   const cargoParts = useMemo<InstancePart[]>(() => {
      if (config.cargo === "crate") {
         const box = new CylinderGeometry(0.5, 0.52, 1, 4);
         box.translate(0, 0.5, 0);
         const lid = new CylinderGeometry(0.54, 0.54, 0.12, 4);
         lid.translate(0, 0.92, 0);
         return [
            { geometry: box, material: new MeshStandardMaterial({ color: COLORS.crate, roughness: 0.62 }) },
            { geometry: lid, material: new MeshStandardMaterial({ color: COLORS.crateLid, roughness: 0.55 }) },
         ];
      }
      const bodyGeo = new CylinderGeometry(0.5, 0.5, 1, 12);
      bodyGeo.translate(0, 0.5, 0);
      const band = new CylinderGeometry(0.54, 0.54, 0.14, 12);
      band.translate(0, 0.5, 0);
      return [
         { geometry: bodyGeo, material: new MeshStandardMaterial({ color: COLORS.hay, roughness: 0.78 }) },
         { geometry: band, material: new MeshStandardMaterial({ color: COLORS.hayBand, roughness: 0.6 }) },
      ];
   }, [config.cargo]);
   const ringParts = useMemo<InstancePart[]>(() => {
      const geometry = new RingGeometry(0.78, 1, 22);
      geometry.rotateX(-Math.PI / 2);
      return [{
         geometry,
         material: new MeshStandardMaterial({ color: COLORS.ring, emissive: COLORS.ring, emissiveIntensity: 0.35, roughness: 0.4 }),
      }];
   }, []);
   useEffect(() => () => {
      disposeParts(cargoParts);
      disposeParts(ringParts);
   }, [cargoParts, ringParts]);

   // clarity (visual only): the beacon on the next bale / the bay, the hint line, load flights, fail pops
   const pop = useActionPop();
   const goal = useRef<FarmGoal>({ bale: -1, x: 0, z: 0 }).current;
   const beacon = useRef({ x: 0, y: 0, z: 0, hidden: true }).current;
   const guide = useRef({ code: -1, bay: false }).current;
   const [toBay, setToBay] = useState(false);
   const flights = useMemo(() => ({
      hitchAt: new Array<number>(MAX_BALES).fill(-1),
      deliverAt: new Array<number>(MAX_BALES).fill(-1),
      bedX: new Float32Array(MAX_BALES),
      bedZ: new Float32Array(MAX_BALES),
   }), []);
   useEffect(() => {
      // the first bale is up from the countdown on
      nextGoal(run, goal);
      beacon.x = goal.x;
      beacon.y = 1;
      beacon.z = goal.z;
      beacon.hidden = false;
      GUIDE.set(farmHint(run, hintCode(run, goal)));
      return () => GUIDE.reset();
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [run]);

   const pose = useHumanoidPose((p) => {
      if (run.over === "win") cheerPose(time.now, p);
      else sitPose(1, p);
   });

   useEffect(() => {
      fx.warm("sparks", "puff", "score");
   }, [fx]);

   useRunFrame((_state, dt) => {
      const { moveX, moveY } = input.current;
      const store = useArcadeStore.getState();
      const ev = step(run, { moveX, moveY, yaw: cam.yaw() }, dt, store.timeLeftMs ?? 0);
      if (ev.score) store.addScore(ev.score);
      let loaded = 0;
      for (const bale of run.bales) if (bale.trip === run.trip && bale.state === "hitched") loaded += 1;
      store.setStat("trips", run.parked);
      store.setStat("loaded", loaded);
      store.setStat("load", config.balesPerTrip);
      const f = forwardOf(run.tractor.yaw);
      aim.x = run.tractor.x + f.x * LOOK_AHEAD;
      aim.z = run.tractor.z + f.z * LOOK_AHEAD;
      aim.y = 0.8;
      aim.x = Math.min(bounds.max.x, Math.max(bounds.min.x, aim.x));
      aim.z = Math.min(bounds.max.z, Math.max(bounds.min.z, aim.z));
      if (ev.hitch >= 0) {
         const bale = run.bales[ev.hitch];
         AT.x = bale.x;
         AT.y = 0.9;
         AT.z = bale.z;
         fx.burst("sparks", AT, 8);
         playSfx("pickup");
      }
      if (ev.trip) {
         AT.x = run.tractor.x;
         AT.y = 1.4;
         AT.z = run.tractor.z;
         fx.burst("sparks", AT, 14);
         fx.score(AT, `+${ev.score}`);
         playSfx("pickup");
      }
      if (ev.bump) {
         AT.x = run.tractor.x;
         AT.y = 0.7;
         AT.z = run.tractor.z;
         fx.burst("puff", AT, 8);
         fx.shake(0.22);
         playSfx("hit");
         AT.y = 2.6;
         pop.fail(AT, bumpAtBale(run) ? "Too fast for the bale! -1 life" : "Bump! -1 life", { shake: 0 });
      }
      // the next bale or the bay: beacon + hint (rebuilt only on a change)
      nextGoal(run, goal);
      beacon.x = goal.x;
      beacon.y = goal.bale >= 0 ? 1 : 0.1;
      beacon.z = goal.z;
      beacon.hidden = run.over !== null;
      if ((goal.bale < 0) !== guide.bay) setToBay((guide.bay = goal.bale < 0));
      const code = hintCode(run, goal);
      if (code !== guide.code) {
         guide.code = code;
         GUIDE.set(farmHint(run, code));
      }
      if (ev.lifeLost) store.loseLife();
      if (ev.won) {
         playSfx("win");
         store.end("win");
      }
   });

   useFrame((_state, delta) => {
      // the models face +z, and the tractor drives along (sin yaw, cos yaw): rotation.y is the yaw itself
      const group = body.current;
      if (group) {
         group.position.set(run.tractor.x, 0, run.tractor.z);
         group.rotation.y = run.tractor.yaw;
      }
      towed.yaw = wrapAngle(towed.yaw + wrapAngle(run.tractor.yaw - towed.yaw) * (1 - Math.exp(-TRAILER_TURN * Math.min(delta, 0.1))));
      const hitch = hitchPoint(run.tractor);
      towed.x = hitch.x - Math.sin(towed.yaw) * TRAILER_BEHIND;
      towed.z = hitch.z - Math.cos(towed.yaw) * TRAILER_BEHIND;
      const bed = trailer.current;
      if (bed) {
         bed.position.set(towed.x, 0, towed.z);
         bed.rotation.y = towed.yaw;
      }
      // the hitch bar runs from the trailer's drawbar eye to the pin behind the tractor
      if (pin.current) pin.current.position.set(hitch.x, HITCH_Y, hitch.z);
      const bar = drawbar.current;
      if (bar) {
         const eyeX = towed.x + Math.sin(towed.yaw) * TRAILER_BED.tongueZ;
         const eyeZ = towed.z + Math.cos(towed.yaw) * TRAILER_BED.tongueZ;
         bar.position.set(eyeX, TRAILER_BED.tongueY, eyeZ);
         V.set(hitch.x, HITCH_Y, hitch.z);
         bar.lookAt(V);
         bar.scale.set(1, 1, Math.max(0.01, V.distanceTo(bar.position)));
      }
   }, FRAME_PRIORITY.visuals);

   const placeCargo = (index: number, matrix: Matrix4) => {
      const bale = run.bales[index];
      if (!bale) return false;
      if (bale.state === "field") {
         flights.hitchAt[index] = -1;
         flights.deliverAt[index] = -1;
      }
      if (bale.state === "delivered") {
         // a delivered load is lifted off the bed into the barn, then gone
         if (flights.deliverAt[index] < 0) flights.deliverAt[index] = time.now;
         const k = (time.now - flights.deliverAt[index]) / LOAD_FLIGHT_S;
         if (k >= 1 || flights.hitchAt[index] < 0) return false;
         FROM.x = flights.bedX[index];
         FROM.y = TRAILER_BED.y;
         FROM.z = flights.bedZ[index];
         TO.x = decor.barn.x;
         TO.y = 1;
         TO.z = decor.barn.z;
         tossAt(FROM, TO, k, 1.4, 1, 0.3, FLY);
         V.set(FLY.x, FLY.y, FLY.z);
         Q.setFromAxisAngle(UP, towed.yaw + k * 2);
         S.set(1.1 * FLY.scale, 0.72 * FLY.scale, 1.1 * FLY.scale);
         matrix.compose(V, Q, S);
         return;
      }
      if (bale.state === "hitched") {
         // on the drawn trailer's bed: one load in the middle, two front and back
         const two = config.balesPerTrip > 1;
         const along = TRAILER_BED.z + (two ? (bale.slot === 0 ? 1 : -1) * TRAILER_BED.length / 4 : 0);
         V.set(towed.x + Math.sin(towed.yaw) * along, TRAILER_BED.y, towed.z + Math.cos(towed.yaw) * along);
         Q.setFromAxisAngle(UP, towed.yaw);
         S.set(TRAILER_BED.width * 0.9, CARGO_ON_BED_HEIGHT, two ? TRAILER_BED.length * 0.46 : Math.min(1.2, TRAILER_BED.length * 0.6));
         flights.bedX[index] = V.x;
         flights.bedZ[index] = V.z;
         // just hitched: the load swings from the field onto the bed instead of jumping there
         if (flights.hitchAt[index] < 0) flights.hitchAt[index] = time.now;
         const k = (time.now - flights.hitchAt[index]) / LOAD_FLIGHT_S;
         if (k < 1) {
            FROM.x = bale.x;
            FROM.y = 0;
            FROM.z = bale.z;
            TO.x = V.x;
            TO.y = V.y;
            TO.z = V.z;
            tossAt(FROM, TO, k, 1.2, 1, 1, FLY);
            V.set(FLY.x, FLY.y, FLY.z);
            const e = 1 - (1 - k) * (1 - k);
            S.set(1.4 + (S.x - 1.4) * e, 0.82 + (S.y - 0.82) * e, 1.4 + (S.z - 1.4) * e);
         }
         matrix.compose(V, Q, S);
         return;
      }
      V.set(bale.x, 0, bale.z);
      Q.identity();
      S.set(1.4, 0.82, 1.4);
      matrix.compose(V, Q, S);
   };
   const placeRing = (index: number, matrix: Matrix4) => {
      const bale = run.bales[index];
      if (!bale || bale.state !== "field" || bale.trip !== run.trip) return false;
      V.set(bale.x, 0.05, bale.z);
      Q.identity();
      const s = BALE_R + 0.5;
      S.set(s, 1, s);
      matrix.compose(V, Q, S);
   };

   return (
      <>
         <CameraRig
            camera={{ position: view.offset, fov: FOV, lookAt: look }}
            follow={aim}
            followFraction={FOLLOW}
            bounds={bounds}
            offset={view.offset}
            shift={view.shift}
            damping={DAMPING}
         />
         <mesh rotation-x={-Math.PI / 2} position={[0, -0.03, 0]} receiveShadow={false}>
            <planeGeometry args={[span, span]} />
            <meshStandardMaterial color={COLORS.grass} roughness={0.92} />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
            <planeGeometry args={[config.width, config.depth]} />
            <meshStandardMaterial color={COLORS.soil} roughness={0.9} />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, bayZ]}>
            <planeGeometry args={[config.width - 1.2, halfD - run.gateZ]} />
            <meshStandardMaterial color={COLORS.soilDark} roughness={0.88} />
         </mesh>
         {mudSpots.length > 0 && (
            <Instanced spots={mudSpots} name="mud">
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial color={COLORS.mud} roughness={0.95} />
            </Instanced>
         )}
         <InstancedModel
            asset={ASSETS.fence}
            spots={glbPosts}
            fallback={<FenceFallback posts={fence.posts} rails={fence.rails} />}
         />
         {run.posts.map((post, index) => (
            <Model key={index} asset={ASSETS.gate} position={[post.x + Math.sign(post.x) * GATE_LEAF_OUT, 0, post.z + 0.2]} fallback={<GatePostPrimitive />} />
         ))}
         {treeGlb.length > 0 && (
            <InstancedModel
               asset={ASSETS.tree}
               spots={treeGlb}
               fallback={
                  <>
                     <Instanced spots={treeTrunks} name="tree-trunks">
                        <cylinderGeometry args={[0.5, 0.55, 1, 8]} />
                        <meshStandardMaterial color={COLORS.trunk} roughness={0.8} />
                     </Instanced>
                     <Instanced spots={treeCrowns} name="tree-crowns">
                        <sphereGeometry args={[0.5, 10, 8]} />
                        <meshStandardMaterial color={COLORS.leaf} roughness={0.7} />
                     </Instanced>
                  </>
               }
            />
         )}
         <DynamicInstancedModel asset={config.cargo === "crate" ? ASSETS.appleCrate : ASSETS.hay} count={MAX_BALES} update={placeCargo} fallbackParts={cargoParts} name="cargo" />
         <DynamicInstanced count={MAX_BALES} update={placeRing} parts={ringParts} name="rings" />
         <TargetBeacon
            target={beacon}
            variant={toBay ? "drop-here" : "pick"}
            color={toBay ? "#4ade80" : COLORS.ring}
            radius={toBay ? BAY_RING : BALE_R + 0.6}
            height={toBay ? 2 : 1.1}
            label={toBay ? "PARK" : null}
         />
         <Model asset={ASSETS.barn} position={[decor.barn.x, 0, decor.barn.z]} fallback={<BarnFrame />} />
         <Model asset={ASSETS.silo} position={[decor.silo.x, 0, decor.silo.z]} fallback={<SiloPrimitive />} />
         <Model asset={ASSETS.trough} position={[decor.trough.x, 0, decor.trough.z]} fallback={<TroughPrimitive />} />
         <Model asset={ASSETS.scarecrow} position={[decor.scarecrow.x, 0, decor.scarecrow.z]} fallback={<ScarecrowPrimitive />} />
         <Model asset={ASSETS.barnCrate} position={[decor.crate.x, 0, decor.crate.z]} />
         <group ref={trailer}>
            <Model asset={ASSETS.trailer} fallback={<TrailerPrimitive />} />
         </group>
         <group ref={drawbar}>
            <mesh position={[0, 0, 0.5]}>
               <boxGeometry args={[0.09, 0.08, 1]} />
               <meshStandardMaterial color={COLORS.hitch} metalness={0.5} roughness={0.4} />
            </mesh>
         </group>
         <mesh ref={pin}>
            <sphereGeometry args={[0.09, 12, 10]} />
            <meshStandardMaterial color={COLORS.hitch} metalness={0.5} roughness={0.4} />
         </mesh>
         <group ref={body}>
            <Model asset={ASSETS.tractor} fallback={<TractorPrimitive />} />
            <group position={[0, SEAT_Y, SEAT_Z]}>
               <HumanoidModel asset={ASSETS.farmer} pose={pose} applyLift={false} fallback={<FarmerFigure />} />
            </group>
         </group>
      </>
   );
}

function FenceFallback({ posts, rails }: { posts: ReturnType<typeof fenceDraw>["posts"]; rails: ReturnType<typeof fenceDraw>["rails"] }) {
   return (
      <>
         <Instanced spots={posts} name="fence-posts">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.fencePost} roughness={0.72} />
         </Instanced>
         <Instanced spots={rails} name="fence-rails">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.fence} roughness={0.66} />
         </Instanced>
      </>
   );
}

export default function Scene() {
   return <LevelScene />;
}
