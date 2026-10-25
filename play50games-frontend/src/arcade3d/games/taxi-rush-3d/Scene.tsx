"use client";

// One useRunFrame steps rules.ts. Visuals read the run and animate with useGameTime.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Euler, Matrix4, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3, type Group, type Mesh } from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import { playSfx, startLoop, type LoopHandle } from "@/arcade3d/core/audio";
import CameraRig from "@/arcade3d/core/CameraRig";
import { SkyDome } from "@/arcade3d/core/env";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { TargetMarkers } from "@/arcade3d/core/hud";
import { useInput } from "@/arcade3d/core/input";
import { useLevel } from "@/arcade3d/core/level";
import { randomSeed } from "@/arcade3d/core/math";
import { hop, type BodyOffset } from "@/arcade3d/core/motion";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { BlobShadow, DynamicInstanced, Instanced, type InstancePart } from "@/arcade3d/core/render";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS, FIT } from "./assets";
import type { TaxiLevel } from "./levels";
import { COLORS, DAMPING, FOV, LOOK_AHEAD, citySpots, cityBox, coneSpots, lightPoles, lookAtFor, skyFor, viewFor } from "./looks";
import { PartsInstanced, RiderPrimitive, TaxiPrimitive, useCityParts } from "./Primitives";
import { CALM_POINTS, CLOSE_POINTS, DROP_POINTS, HALF_STREET, PAD_R, createRun, signalRed, step, type Run } from "./rules";

const E = new Euler();
const Q = new Quaternion();
const V = new Vector3();
const S = new Vector3(1, 1, 1);
const AT = { x: 0, y: 0.8, z: 0 };
const OFF: BodyOffset = { y: 0, roll: 0, yaw: 0, squash: 1 };
const TINTS = [new Color(COLORS.carA), new Color(COLORS.carB), new Color(COLORS.carC)];
const RED = new Color(COLORS.bulbRed);
const GREEN = new Color(COLORS.bulbGreen);

function LevelScene() {
   const { id, config } = useLevel<TaxiLevel>();
   const view = useFittedView(viewFor(id));
   const input = useInput();
   const fx = useFx();
   const time = useGameTime();
   const quality = useQuality();
   const run = useMemo<Run>(() => createRun(randomSeed(), config), [config]);
   const aim = useRef({ x: run.x, y: 0.7, z: run.z + LOOK_AHEAD }).current;
   const cab = useRef<Group>(null);
   const rider = useRef<Group>(null);
   const pad = useRef<Mesh>(null);
   const engine = useRef<LoopHandle | null>(null);
   const synced = useRef({ rides: -1, fare: -1 }).current;
   const bounds = useMemo(() => cityBox(config), [config]);
   const look = useMemo(() => lookAtFor(config), [config]);
   const sky = useMemo(() => skyFor(config), [config]);
   const city = useMemo(() => citySpots(id), [id]);
   const trees = useMemo(() => city.trees.slice(0, scaledCount(city.trees.length, quality.decor)), [city, quality.decor]);
   const lamps = useMemo(() => city.lamps.slice(0, scaledCount(city.lamps.length, quality.decor)), [city, quality.decor]);
   const poles = useMemo(() => lightPoles(run), [run]);
   const cones = useMemo(() => coneSpots(run), [run]);
   const markers = useMemo(() => [run.marker], [run]);
   const parts = useCityParts();

   const bulbParts = useMemo<InstancePart[]>(() => [{ geometry: new SphereGeometry(0.15, 12, 10), material: new MeshStandardMaterial({ color: "#ffffff", emissive: "#ffffff", emissiveIntensity: 0.9, roughness: 0.3 }) }], []);
   useEffect(
      () => () => {
         bulbParts[0].geometry.dispose();
         (bulbParts[0].material as MeshStandardMaterial).dispose();
      },
      [bulbParts]
   );

   useEffect(() => {
      fx.warm("sparkle", "puff", "confetti", "score");
   }, [fx]);

   useEffect(() => {
      engine.current = startLoop("engine", { volume: 0.04, pitch: 0.7 });
      return () => {
         engine.current?.stop();
         engine.current = null;
      };
   }, []);

   useRunFrame((_state, dt) => {
      const store = useArcadeStore.getState();
      const ev = step(run, { moveX: input.current.moveX, moveY: input.current.moveY }, dt, store.timeLeftMs ?? 0);
      if (ev.score) store.addScore(ev.score);
      const fare = Math.round(Math.max(0, run.patience) * 100);
      if (synced.rides !== run.dropoffs) store.setStat("rides", (synced.rides = run.dropoffs));
      if (synced.fare !== fare) store.setStat("fare", (synced.fare = fare));
      const dir = run.speed < -0.2 ? -1 : 1;
      aim.x = Math.min(bounds.max.x, Math.max(bounds.min.x, run.x + Math.sin(run.yaw) * dir * LOOK_AHEAD));
      aim.z = Math.min(bounds.max.z, Math.max(bounds.min.z, run.z + Math.cos(run.yaw) * dir * LOOK_AHEAD));
      if (ev.pickup) {
         AT.x = run.riderX;
         AT.y = 1;
         AT.z = run.riderZ;
         fx.burst("sparkle", AT, 10);
         playSfx("click");
      }
      if (ev.drop) {
         AT.x = run.x;
         AT.y = 1.4;
         AT.z = run.z;
         fx.burst("sparkle", AT, 16);
         fx.score(AT, `+${DROP_POINTS + (ev.close ? CLOSE_POINTS : 0) + (ev.calm ? CALM_POINTS : 0)}`, { color: COLORS.pad });
         playSfx(ev.close ? "combo" : "chime");
      }
      if (ev.hit || ev.red) {
         AT.x = run.x;
         AT.y = 0.7;
         AT.z = run.z;
         fx.burst("puff", AT, 10);
         fx.shake(ev.hit ? 0.3 : 0.18);
         playSfx(ev.red ? "alarm" : "hit");
      }
      if (ev.miss) playSfx("buzz");
      for (let n = 0; n < ev.lives; n++) store.loseLife();
      if (ev.won) {
         playSfx("win");
         fx.burst("confetti", { x: run.x, y: 1.6, z: run.z }, 24);
         store.end("win");
      }
   });

   useFrame(() => {
      const group = cab.current;
      if (group) {
         group.position.set(run.x, 0, run.z);
         group.rotation.y = run.yaw;
      }
      const person = rider.current;
      if (person) {
         const hopping = run.hop > 0 && run.hop < Math.PI;
         person.visible = run.phase === 0 || hopping;
         if (hopping) hop(run.hop, 0.32, OFF);
         else {
            OFF.y = 0;
            OFF.squash = 1;
         }
         // the rider waits on the pavement beside the pad, facing the street
         person.position.set(run.riderX + HALF_STREET + 0.2, 0.12 + OFF.y, run.riderZ);
         person.rotation.y = -Math.PI / 2;
         person.scale.set(1, OFF.squash, 1);
      }
      const ring = pad.current;
      if (ring) {
         const show = !run.marker.hidden && run.phase !== 2;
         ring.visible = show;
         if (show) {
            const pulse = 1 + Math.sin(time.now * 4) * 0.05;
            ring.position.set(run.marker.x, 0.04, run.marker.z);
            ring.scale.set(pulse, pulse, 1);
         }
      }
      const speed = Math.abs(run.speed);
      engine.current?.set({ volume: 0.05 + Math.min(0.2, (speed / 9) * 0.2), pitch: 0.62 + Math.min(0.7, speed / 9) });
   }, FRAME_PRIORITY.visuals);

   const placeCar = (index: number, matrix: Matrix4, color: Color) => {
      const car = run.cars[index];
      if (!car) return false;
      const yaw = car.axis === 0 ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : car.dir > 0 ? 0 : Math.PI;
      E.set(0, yaw, 0);
      Q.setFromEuler(E);
      V.set(car.x, 0, car.z);
      S.set(1, 1, 1);
      matrix.compose(V, Q, S);
      color.copy(TINTS[index % TINTS.length]);
   };
   // one bulb per pole: the even pole shows the north-south signal, the odd one the east-west signal
   const placeBulb = (index: number, matrix: Matrix4, color: Color) => {
      const pole = poles[index];
      if (!pole) return false;
      const light = Math.floor(index / 2);
      const ns = index % 2 === 0;
      V.set(pole.x, FIT.lightHeight - 0.25, pole.z);
      Q.identity();
      S.set(1, 1, 1);
      matrix.compose(V, Q, S);
      color.copy(signalRed(light, run.time, ns) ? RED : GREEN);
   };

   return (
      <>
         <CameraRig camera={{ position: view.offset, fov: FOV, lookAt: look }} follow={aim} bounds={bounds} offset={view.offset} shift={view.shift} damping={DAMPING} />
         <SkyDome top={sky.top} bottom={sky.bottom} />
         {/* asphalt to the fog, pavements, courtyards, dashes */}
         <mesh rotation-x={-Math.PI / 2} position={[run.width / 2, -0.01, run.depth / 2]}>
            <circleGeometry args={[220, 48]} />
            <meshStandardMaterial color={COLORS.road} roughness={0.92} />
         </mesh>
         <Instanced spots={city.slabs} name="pavements">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.sidewalk} roughness={0.86} />
         </Instanced>
         <Instanced spots={city.courts} name="courtyards">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.court} roughness={0.9} />
         </Instanced>
         <Instanced spots={city.dashes} name="dashes">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.roadLine} roughness={0.5} />
         </Instanced>
         <InstancedModel asset={ASSETS.townhouseBlock} spots={city.houses} fallback={<PartsInstanced spots={city.houses} parts={parts.house} name="house" />} />
         <InstancedModel asset={ASSETS.cornerShop} spots={city.shops} fallback={<PartsInstanced spots={city.shops} parts={parts.shop} name="shop" />} />
         <InstancedModel asset={ASSETS.busStop} spots={city.busStops} fallback={<PartsInstanced spots={city.busStops} parts={parts.bus} name="bus" />} />
         <InstancedModel asset={ASSETS.lamp} spots={lamps} fallback={<PartsInstanced spots={lamps} parts={parts.lamp} name="lamp" />} />
         <InstancedModel asset={ASSETS.tree} spots={trees} fallback={<PartsInstanced spots={trees} parts={parts.tree} name="tree" />} />
         {cones.length > 0 && <InstancedModel asset={ASSETS.trafficCone} spots={cones} fallback={<PartsInstanced spots={cones} parts={parts.cone} name="cone" />} />}
         {poles.length > 0 && (
            <>
               <InstancedModel asset={ASSETS.trafficLight} spots={poles} fallback={<PartsInstanced spots={poles} parts={parts.light} name="light" />} />
               <DynamicInstanced count={poles.length} update={placeBulb} parts={bulbParts} tinted name="bulbs" />
            </>
         )}
         <DynamicInstancedModel asset={ASSETS.car} count={Math.max(1, config.traffic)} update={placeCar} tinted name="traffic" />
         <mesh ref={pad} rotation-x={-Math.PI / 2} position={[run.marker.x, 0.04, run.marker.z]}>
            <ringGeometry args={[PAD_R - 0.35, PAD_R, 40]} />
            <meshBasicMaterial color={COLORS.pad} transparent opacity={0.9} />
         </mesh>
         <group ref={cab}>
            <Model asset={ASSETS.taxiCab} fallback={<TaxiPrimitive />} />
            <BlobShadow radius={1.35} opacity={0.3} />
         </group>
         <group ref={rider}>
            <Model asset={ASSETS.travellerNpc} fallback={<RiderPrimitive />} />
         </group>
         <TargetMarkers targets={markers} color={COLORS.pad} />
      </>
   );
}

export default function Scene() {
   return <LevelScene />;
}
