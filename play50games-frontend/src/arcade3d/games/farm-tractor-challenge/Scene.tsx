"use client";

// One useRunFrame steps rules.ts. Visuals read the run and animate with useGameTime.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CylinderGeometry, MeshStandardMaterial, Quaternion, RingGeometry, Vector3, type Matrix4 } from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import CameraRig from "@/arcade3d/core/CameraRig";
import { playSfx } from "@/arcade3d/core/audio";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInput } from "@/arcade3d/core/input";
import { useLevel } from "@/arcade3d/core/level";
import { randomSeed } from "@/arcade3d/core/math";
import { DynamicInstanced, Instanced, type InstancePart } from "@/arcade3d/core/render";
import { BONE, HumanoidModel, armsDownPose, cheerPose, levelFoot, setBoneEuler, useHumanoidPose, type HumanoidPose } from "@/arcade3d/core/rig";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { ASSETS } from "./assets";
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
   fieldBox,
   groundSpan,
   lookAtFor,
   viewFor,
} from "./looks";
import { BarnFrame, FarmerFigure, GatePostPrimitive, ScarecrowPrimitive, SiloPrimitive, TractorPrimitive, TrailerPrimitive, TroughPrimitive } from "./Primitives";
import { BALE_R, MAX_BALES, createRun, forwardOf, slotWorld, step, type Run } from "./rules";

const Q = new Quaternion();
const V = new Vector3();
const S = new Vector3();
const UP = new Vector3(0, 1, 0);
const AT = { x: 0, y: 0.8, z: 0 };

function sitPose(out: HumanoidPose): HumanoidPose {
   armsDownPose(out);
   out.ground = 0;
   out.lift = 0;
   setBoneEuler(out.q, BONE.upperLegL, -1.2, 0.05, 0.14);
   setBoneEuler(out.q, BONE.upperLegR, -1.2, -0.05, -0.14);
   setBoneEuler(out.q, BONE.lowerLegL, 1.3, 0, 0);
   setBoneEuler(out.q, BONE.lowerLegR, 1.3, 0, 0);
   setBoneEuler(out.q, BONE.upperArmL, -0.95, 0.1, 0.4);
   setBoneEuler(out.q, BONE.upperArmR, -0.95, -0.1, -0.4);
   setBoneEuler(out.q, BONE.lowerArmL, 0, 1.05, 0);
   setBoneEuler(out.q, BONE.lowerArmR, 0, -1.05, 0);
   setBoneEuler(out.q, BONE.spine, 0.08, 0, 0);
   levelFoot(out, 1, 0.35);
   levelFoot(out, -1, 0.35);
   return out;
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
   const aim = useRef({ x: run.tractor.x, y: 0.8, z: run.tractor.z + LOOK_AHEAD }).current;
   const body = useRef<import("three").Group>(null);
   const trailer = useRef<import("three").Group>(null);
   const bounds = useMemo(() => fieldBox(config), [config]);
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

   const pose = useHumanoidPose((p) => {
      if (run.over === "win") cheerPose(time.now, p);
      else sitPose(p);
   });

   useEffect(() => {
      fx.warm("sparks", "puff", "score");
   }, [fx]);

   useRunFrame((_state, dt) => {
      const { moveX, moveY } = input.current;
      const store = useArcadeStore.getState();
      const ev = step(run, { moveX, moveY, yaw: view.yaw }, dt, store.timeLeftMs ?? 0);
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
      }
      if (ev.lifeLost) store.loseLife();
      if (ev.won) {
         playSfx("win");
         store.end("win");
      }
   });

   useFrame(() => {
      const group = body.current;
      if (group) {
         group.position.set(run.tractor.x, 0, run.tractor.z);
         group.rotation.y = -run.tractor.yaw;
      }
      const bed = trailer.current;
      if (bed) {
         bed.position.set(run.trailerX.x, 0, run.trailerZ.x);
         bed.rotation.y = -run.tractor.yaw;
      }
   }, FRAME_PRIORITY.visuals);

   const placeCargo = (index: number, matrix: Matrix4) => {
      const bale = run.bales[index];
      if (!bale || bale.state === "delivered") return false;
      let x = bale.x;
      let z = bale.z;
      let yaw = 0;
      if (bale.state === "hitched") {
         const at = slotWorld(run.trailerX.x, run.trailerZ.x, run.tractor.yaw, bale.slot);
         x = at.x;
         z = at.z;
         yaw = -run.tractor.yaw;
      }
      V.set(x, 0, z);
      Q.setFromAxisAngle(UP, yaw);
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
            <Model key={index} asset={ASSETS.gate} position={[post.x, 0, post.z]} fallback={<GatePostPrimitive />} />
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
         <Model asset={ASSETS.barn} position={[decor.barn.x, 0, decor.barn.z]} fallback={<BarnFrame />} />
         <Model asset={ASSETS.silo} position={[decor.silo.x, 0, decor.silo.z]} fallback={<SiloPrimitive />} />
         <Model asset={ASSETS.trough} position={[decor.trough.x, 0, decor.trough.z]} fallback={<TroughPrimitive />} />
         <Model asset={ASSETS.scarecrow} position={[decor.scarecrow.x, 0, decor.scarecrow.z]} fallback={<ScarecrowPrimitive />} />
         <Model asset={ASSETS.barnCrate} position={[decor.crate.x, 0, decor.crate.z]} />
         <group ref={trailer}>
            <Model asset={ASSETS.trailer} fallback={<TrailerPrimitive />} />
         </group>
         <group ref={body}>
            <Model asset={ASSETS.tractor} fallback={<TractorPrimitive />} />
            <group position={[0, 0.78, -0.08]}>
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
