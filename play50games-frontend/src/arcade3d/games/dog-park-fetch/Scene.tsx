"use client";

// One useRunFrame steps rules.ts. Visuals read the run and animate with useGameTime.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { BoxGeometry, CylinderGeometry, MeshStandardMaterial, SphereGeometry, Vector3, type Group } from "three";
import { InstancedModel, Model } from "@/arcade3d/core/assets";
import CameraRig from "@/arcade3d/core/CameraRig";
import { playSfx } from "@/arcade3d/core/audio";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInput } from "@/arcade3d/core/input";
import { useLevel } from "@/arcade3d/core/level";
import { randomSeed } from "@/arcade3d/core/math";
import { bank, hop as hopOffset, type BodyOffset } from "@/arcade3d/core/motion";
import { TargetMarkers, type MarkerTarget } from "@/arcade3d/core/hud/TargetMarkers";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { ASSETS } from "./assets";
import type { DogLevel } from "./levels";
import { BENCH_R, FOUNTAIN_R, LEAP_S, MAX_SPEED, TREE_R, blanketOf, createRun, leapHeight, propsOf, step, toyXZ, type Run } from "./rules";
import { COLORS, DAMPING, FOLLOW, FOV, LOOK_AHEAD, blanketSpot, fenceSpots, lawnBox, lookAtFor, propSpots, sandSpots, stripeSpots, viewFor } from "./looks";
import { BallPrimitive, DogFigure, FrisbeePrimitive, MowerPrimitive, OwnerFigure, StickPrimitive } from "./Primitives";

const BODY: BodyOffset = { y: 0, roll: 0, yaw: 0, squash: 1 };
const TOY = { x: 0, z: 0 };
const MARK = new Vector3();
const TOY_HEIGHT = 0.12;
const OWNER_HOP_S = 0.45;
const BENCH_SIZE = { sx: 1.8, sy: 0.5, sz: 0.8 };

/** Spots at the feet (y = 0), for the GLB draws. */
function feet(spots: readonly InstanceSpot[]): InstanceSpot[] {
   return spots.map((s) => ({ x: s.x, y: 0, z: s.z }));
}

function LevelScene() {
   const { id, config } = useLevel<DogLevel>();
   const view = useFittedView(viewFor(id));
   const input = useInput();
   const fx = useFx();
   const time = useGameTime();
   const [run] = useState<Run>(() => createRun(randomSeed(), config));
   const aim = useRef({ x: run.dog.x, y: 0.4, z: run.dog.z + LOOK_AHEAD }).current;
   const dogGroup = useRef<Group>(null);
   const dogBody = useRef<Group>(null);
   const owner = useRef<Group>(null);
   const toys = useRef<Record<string, Group | null>>({ ball: null, stick: null, frisbee: null });
   const mowerRefs = useRef<(Group | null)[]>([]);
   const gait = useRef({ phase: 0 });
   const ownerHopAt = useRef(-10);
   const lastYaw = useRef(run.dog.yaw);
   const bounds = useMemo(() => lawnBox(config), [config]);
   const look = useMemo(() => lookAtFor(config), [config]);
   const blanket = useMemo(() => blanketOf(config), [config]);
   const props = useMemo(() => propsOf(config), [config]);
   const fence = useMemo(() => fenceSpots(config), [config]);
   const fenceFeet = useMemo(() => feet(fence), [fence]);
   const stripes = useMemo(() => stripeSpots(config), [config]);
   const sand = useMemo(() => sandSpots(config), [config]);
   const pad = useMemo(() => [blanketSpot(config)], [config]);
   const fountain = useMemo(() => propSpots(props.filter((p) => p.r === FOUNTAIN_R)), [props]);
   const benches = useMemo(() => propSpots(props.filter((p) => p.r === BENCH_R)).map((s) => ({ ...s, ...BENCH_SIZE, y: BENCH_SIZE.sy / 2 })), [props]);
   const trees = useMemo(() => propSpots(props.filter((p) => p.r === TREE_R)), [props]);
   const fountainFeet = useMemo(() => feet(fountain), [fountain]);
   const benchFeet = useMemo(() => feet(benches), [benches]);
   const treeFeet = useMemo(() => feet(trees), [trees]);
   const targets = useMemo<MarkerTarget[]>(() => [{ x: 0, y: 0, z: 0, hidden: true }], []);

   // Unit geometry and flat materials, built once and disposed with the scene.
   const unitBox = useMemo(() => new BoxGeometry(1, 1, 1), []);
   const unitCylinder = useMemo(() => new CylinderGeometry(0.5, 0.5, 1, 24), []);
   const unitSphere = useMemo(() => new SphereGeometry(0.5, 14, 10), []);
   const trunkGeo = useMemo(() => new CylinderGeometry(0.12, 0.16, 1, 8), []);
   const fenceMat = useMemo(() => new MeshStandardMaterial({ color: COLORS.fence, roughness: 0.7 }), []);
   const stripeMat = useMemo(() => new MeshStandardMaterial({ color: COLORS.stripe, roughness: 0.95 }), []);
   const sandMat = useMemo(() => new MeshStandardMaterial({ color: COLORS.sand, roughness: 0.95 }), []);
   const padMat = useMemo(() => new MeshStandardMaterial({ color: COLORS.blanket, emissive: COLORS.blanketEdge, emissiveIntensity: 0.12, roughness: 0.8 }), []);
   const fountainMat = useMemo(() => new MeshStandardMaterial({ color: COLORS.fountain, roughness: 0.6 }), []);
   const benchMat = useMemo(() => new MeshStandardMaterial({ color: COLORS.bench, roughness: 0.7 }), []);
   const trunkMat = useMemo(() => new MeshStandardMaterial({ color: COLORS.trunk, roughness: 0.9 }), []);
   const canopyMat = useMemo(() => new MeshStandardMaterial({ color: COLORS.tree, roughness: 0.9 }), []);
   const disposables = useMemo(
      () => [unitBox, unitCylinder, unitSphere, trunkGeo, fenceMat, stripeMat, sandMat, padMat, fountainMat, benchMat, trunkMat, canopyMat],
      [unitBox, unitCylinder, unitSphere, trunkGeo, fenceMat, stripeMat, sandMat, padMat, fountainMat, benchMat, trunkMat, canopyMat],
   );
   useEffect(() => () => {
      for (const d of disposables) d.dispose();
   }, [disposables]);

   useEffect(() => {
      fx.warm("sparkle", "confetti", "puff", "score");
   }, [fx]);

   useRunFrame((_state, dt) => {
      const { moveX, moveY, jumpPressed } = input.current;
      const store = useArcadeStore.getState();
      const ev = step(run, { moveX, moveY, jumpPressed, yaw: view.yaw }, dt, store.timeLeftMs ?? 0);
      if (ev.score) store.addScore(ev.score);
      store.setStat("fetched", run.returned);
      aim.x = Math.min(bounds.max.x, Math.max(bounds.min.x, run.dog.x + Math.sin(run.dog.yaw) * LOOK_AHEAD));
      aim.z = Math.min(bounds.max.z, Math.max(bounds.min.z, run.dog.z + Math.cos(run.dog.yaw) * LOOK_AHEAD));
      gait.current.phase += (Math.hypot(run.dog.vx, run.dog.vz) / MAX_SPEED) * Math.PI * 2 * 1.6 * dt;
      if (ev.leap) playSfx("jump");
      if (ev.thrown >= 0) {
         ownerHopAt.current = run.time;
         playSfx("whoosh");
      }
      if (ev.landed && run.active) {
         toyXZ(run.active, TOY);
         MARK.set(TOY.x, 0.2, TOY.z);
         fx.burst("puff", MARK, 6);
         playSfx("thud");
      }
      if (ev.caught) {
         MARK.set(run.dog.x, 1.0, run.dog.z);
         fx.burst("sparkle", MARK, 12);
         fx.score(MARK, "+60");
         playSfx("chime");
      }
      if (ev.returned) {
         MARK.set(run.blanket.x, 0.8, run.blanket.z);
         fx.burst("confetti", MARK, 18);
         fx.score(MARK, `+${ev.score}`);
         playSfx("pickup");
      }
      if (ev.fetched) playSfx("click");
      if (ev.mowerHit) {
         fx.shake(0.3);
         playSfx("hit");
      }
      if (ev.won) {
         playSfx("win");
         store.end("win");
      }
      if (ev.lost) store.end("lose");
   });

   useFrame(() => {
      const dog = run.dog;
      const group = dogGroup.current;
      if (group) {
         const speed = Math.hypot(dog.vx, dog.vz);
         const turn = dog.yaw - lastYaw.current;
         lastYaw.current = dog.yaw;
         if (dog.leap > 0) hopOffset(Math.PI * (1 - dog.leap / LEAP_S), 0.12, BODY);
         else if (speed > 0.6) hopOffset(gait.current.phase, 0.05 * Math.min(1, speed / MAX_SPEED), BODY);
         else {
            BODY.y = 0;
            BODY.roll = 0;
         }
         group.position.set(dog.x, BODY.y + leapHeight(LEAP_S - dog.leap), dog.z);
         group.rotation.set(0, dog.yaw, bank(turn * speed * 6, 0.25));
      }
      const body = dogBody.current;
      if (body) body.visible = !(dog.mercy > 0 && Math.floor(time.now * 12) % 2 === 0);
      const own = owner.current;
      if (own) {
         const t = run.time - ownerHopAt.current;
         const lift = t >= 0 && t < OWNER_HOP_S ? hopOffset(Math.PI * (t / OWNER_HOP_S), 0.15, BODY).y : 0;
         own.position.set(run.blanket.x, lift, run.blanket.z + 0.9);
         own.rotation.set(0, Math.PI, 0);
      }
      const th = run.active;
      const carried = th?.state === "carried";
      for (const kind of ["ball", "stick", "frisbee"] as const) {
         const g = toys.current[kind];
         if (!g) continue;
         const show = !!th && th.kind === kind;
         g.visible = show;
         if (!show || !th) continue;
         if (carried) {
            // Carried in the muzzle: a point in front of the dog, at mouth height.
            g.position.set(dog.x + Math.sin(dog.yaw) * 0.42, 0.38, dog.z + Math.cos(dog.yaw) * 0.42);
         } else {
            const xz = toyXZ(th, TOY);
            const f = Math.min(1, th.t / th.flight);
            const h = th.state === "flying" ? 4 * th.apex * f * (1 - f) : 0;
            g.position.set(xz.x, TOY_HEIGHT + h, xz.z);
         }
         g.rotation.set(0, th.index * 0.7 + time.now * 2, 0);
      }
      for (let i = 0; i < run.mowers.length; i++) {
         const g = mowerRefs.current[i];
         const m = run.mowers[i];
         if (!g) continue;
         g.position.set(m.agent.x, 0, m.agent.z);
         g.rotation.set(0, m.agent.yaw, 0);
      }
      // One arrow: on the toy while it is out, on the blanket while it is carried.
      const marker = targets[0];
      marker.hidden = !th;
      if (th) {
         if (carried) {
            marker.x = run.blanket.x;
            marker.z = run.blanket.z;
            marker.y = 0.6;
         } else {
            const xz = toyXZ(th, TOY);
            marker.x = xz.x;
            marker.z = xz.z;
            marker.y = TOY_HEIGHT;
         }
      }
   }, FRAME_PRIORITY.visuals);

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
         <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]}>
            <planeGeometry args={[config.width + 4, config.depth + 4]} />
            <meshStandardMaterial color={COLORS.lawn} roughness={0.95} />
         </mesh>
         <Instanced spots={stripes} name="stripes">
            <primitive object={unitBox} attach="geometry" />
            <primitive object={stripeMat} attach="material" />
         </Instanced>
         {config.lighting === "sunset" && (
            <Instanced spots={sand} name="sand">
               <primitive object={unitBox} attach="geometry" />
               <primitive object={sandMat} attach="material" />
            </Instanced>
         )}
         <InstancedModel
            asset={ASSETS.fence}
            spots={fenceFeet}
            fallback={
               <Instanced spots={fence} name="fence">
                  <primitive object={unitBox} attach="geometry" />
                  <primitive object={fenceMat} attach="material" />
               </Instanced>
            }
         />
         <Instanced spots={pad} name="blanket">
            <primitive object={unitCylinder} attach="geometry" />
            <primitive object={padMat} attach="material" />
         </Instanced>
         {fountain.length > 0 && (
            <InstancedModel
               asset={ASSETS.fountain}
               spots={fountainFeet}
               fallback={
                  <Instanced spots={fountain} name="fountain">
                     <primitive object={unitCylinder} attach="geometry" />
                     <primitive object={fountainMat} attach="material" />
                  </Instanced>
               }
            />
         )}
         {benches.length > 0 && (
            <InstancedModel
               asset={ASSETS.bench}
               spots={benchFeet}
               fallback={
                  <Instanced spots={benches} name="benches">
                     <primitive object={unitBox} attach="geometry" />
                     <primitive object={benchMat} attach="material" />
                  </Instanced>
               }
            />
         )}
         {trees.length > 0 && (
            <InstancedModel
               asset={ASSETS.tree}
               spots={treeFeet}
               fallback={
                  <>
                     <Instanced spots={trees.map((s) => ({ ...s, sx: 0.3, sy: 1.6, sz: 0.3, y: 0.8 }))} name="trunks">
                        <primitive object={trunkGeo} attach="geometry" />
                        <primitive object={trunkMat} attach="material" />
                     </Instanced>
                     <Instanced spots={trees.map((s) => ({ ...s, sx: 1.6, sy: 1.6, sz: 1.6, y: 2.0 }))} name="canopies">
                        <primitive object={unitSphere} attach="geometry" />
                        <primitive object={canopyMat} attach="material" />
                     </Instanced>
                  </>
               }
            />
         )}
         <group ref={owner}>
            <Model asset={ASSETS.owner} fallback={<OwnerFigure />} />
         </group>
         <group ref={dogGroup}>
            <group ref={dogBody}>
               <Model asset={ASSETS.dog} tint={config.tint ?? undefined} fallback={<DogFigure />} />
            </group>
         </group>
         <group ref={(g) => { toys.current.ball = g; }}>
            <Model asset={ASSETS.ball} fallback={<BallPrimitive />} />
         </group>
         <group ref={(g) => { toys.current.stick = g; }}>
            <Model asset={ASSETS.stick} fallback={<StickPrimitive />} />
         </group>
         <group ref={(g) => { toys.current.frisbee = g; }}>
            <Model asset={ASSETS.frisbee} fallback={<FrisbeePrimitive />} />
         </group>
         {run.mowers.map((_, i) => (
            <group key={i} ref={(g) => { mowerRefs.current[i] = g; }}>
               <Model asset={ASSETS.mower} fallback={<MowerPrimitive />} />
            </group>
         ))}
         <TargetMarkers targets={targets} color={COLORS.target} />
      </>
   );
}

export default function Scene() {
   return <LevelScene />;
}
