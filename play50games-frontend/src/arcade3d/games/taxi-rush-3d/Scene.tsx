"use client";

// One useRunFrame steps rules.ts. Visuals read the run and animate with useGameTime.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Euler, Group, Matrix4, Mesh, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import { playSfx, startLoop } from "@/arcade3d/core/audio";
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
import { useQuality } from "@/arcade3d/core/quality";
import { BlobShadow, DynamicInstanced, Instanced, type InstancePart, type InstanceSpot } from "@/arcade3d/core/render";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { ASSETS } from "./assets";
import type { TaxiLevel } from "./levels";
import { COLORS, DAMPING, FOLLOW, FOV, LOOK_AHEAD, cityBox, fogFor, lookAtFor, skyFor, viewFor } from "./looks";
import { RiderPrimitive, TaxiPrimitive } from "./Primitives";
import {
   BLOCK,
   PITCH,
   STREET,
   createRun,
   signalRed,
   step,
   streetX,
   streetZ,
   type Run,
} from "./rules";

const E = new Euler();
const Q = new Quaternion();
const V = new Vector3();
const S = new Vector3(1, 1, 1);
const AT = { x: 0, y: 0.8, z: 0 };
const OFF: BodyOffset = { y: 0, roll: 0, yaw: 0, squash: 1 };
const TINTS = [new Color(COLORS.carA), new Color(COLORS.carB), new Color(COLORS.carC)];
const RED = new Color(COLORS.bulbRed);
const GREEN = new Color(COLORS.bulbGreen);

function blockSpots(level: TaxiLevel, shop: boolean): InstanceSpot[] {
   const spots: InstanceSpot[] = [];
   for (let r = 0; r < level.blocksZ; r++) {
      for (let c = 0; c < level.blocksX; c++) {
         const corner = (c === 0 && r === 0) || (c === level.blocksX - 1 && r === level.blocksZ - 1);
         if (corner !== shop) continue;
         spots.push({
            x: STREET + c * PITCH + BLOCK / 2,
            y: 0,
            z: STREET + r * PITCH + BLOCK / 2,
         });
      }
   }
   return spots;
}

function scaled(spots: InstanceSpot[], sx: number, sy: number, sz: number, y: number): InstanceSpot[] {
   return spots.map((spot) => ({ x: spot.x, y, z: spot.z, sx, sy, sz }));
}

function sidewalkSpots(level: TaxiLevel): InstanceSpot[] {
   const spots: InstanceSpot[] = [];
   for (let r = 0; r < level.blocksZ; r++) {
      for (let c = 0; c < level.blocksX; c++) {
         spots.push({
            x: STREET + c * PITCH + BLOCK / 2,
            y: 0.045,
            z: STREET + r * PITCH + BLOCK / 2,
            sx: BLOCK - 0.15,
            sy: 0.09,
            sz: BLOCK - 0.15,
         });
      }
   }
   return spots;
}

function decorSpots(level: TaxiLevel, kind: "lamp" | "bench"): InstanceSpot[] {
   const spots: InstanceSpot[] = [];
   for (let r = 0; r < level.blocksZ; r++) {
      for (let c = 0; c < level.blocksX; c++) {
         const x0 = STREET + c * PITCH;
         const z0 = STREET + r * PITCH;
         if (kind === "lamp") spots.push({ x: x0 + 0.85, y: 0, z: z0 + 0.85, rotY: 0.4 });
         else spots.push({ x: x0 + BLOCK - 1.3, y: 0, z: z0 + 0.7, rotY: Math.PI / 2 });
      }
   }
   return spots;
}

function coneSpots(run: Run): InstanceSpot[] {
   const spots: InstanceSpot[] = [];
   for (let i = 0; i < run.stops.length; i++) {
      const stop = run.stops[i];
      const along = stop.axis === 0 ? 0 : 1;
      for (const end of [stop.span0 + 0.35, stop.span1 - 0.35]) {
         spots.push({
            x: stop.axis === 0 ? stop.coord : end,
            y: 0,
            z: stop.axis === 0 ? end : stop.coord,
            rotY: along,
         });
      }
   }
   return spots;
}

function dashSpots(level: TaxiLevel): InstanceSpot[] {
   const spots: InstanceSpot[] = [];
   for (let i = 0; i <= level.blocksX; i++) {
      for (let r = 0; r < level.blocksZ; r++) {
         spots.push({ x: streetX(i), y: 0.03, z: STREET + r * PITCH + BLOCK / 2, sx: 0.14, sy: 0.02, sz: 1.5 });
      }
   }
   for (let j = 0; j <= level.blocksZ; j++) {
      for (let c = 0; c < level.blocksX; c++) {
         spots.push({ x: STREET + c * PITCH + BLOCK / 2, y: 0.03, z: streetZ(j), sx: 1.5, sy: 0.02, sz: 0.14 });
      }
   }
   return spots;
}

function lightSpots(run: Run): InstanceSpot[] {
   return run.lights.map((light) => {
      const sx = light.i < run.level.blocksX ? 1 : -1;
      const sz = light.j < run.level.blocksZ ? 1 : -1;
      return { x: streetX(light.i) + sx * 3.2, y: 0, z: streetZ(light.j) + sz * 3.2, rotY: sx < 0 ? Math.PI : 0 };
   });
}

function LevelScene() {
   const { id, config } = useLevel<TaxiLevel>();
   const view = useFittedView(viewFor(id));
   const input = useInput();
   const fx = useFx();
   const time = useGameTime();
   const quality = useQuality();
   const run = useMemo<Run>(() => createRun(randomSeed(), config), [config]);
   const aim = useRef({ x: run.x, y: 0.8, z: run.z + LOOK_AHEAD }).current;
   const cab = useRef<Group>(null);
   const rider = useRef<Group>(null);
   const pad = useRef<Mesh>(null);
   const engine = useRef<ReturnType<typeof startLoop> | null>(null);
   const bounds = useMemo(() => cityBox(config), [config]);
   const look = useMemo(() => lookAtFor(config), [config]);
   const sky = useMemo(() => skyFor(config), [config]);
   const size = useMemo(() => ({ x: run.width, z: run.depth }), [run]);
   const houses = useMemo(() => blockSpots(config, false), [config]);
   const shops = useMemo(() => blockSpots(config, true), [config]);
   const houseBody = useMemo(() => scaled(houses, 12.2, 7.4, 12.2, 3.7), [houses]);
   const houseRoof = useMemo(() => scaled(houses, 12.6, 0.45, 12.6, 7.5), [houses]);
   const shopBody = useMemo(() => scaled(shops, 12.2, 5.2, 12.2, 2.6), [shops]);
   const shopRoof = useMemo(() => scaled(shops, 12.8, 0.35, 12.8, 5.3), [shops]);
   const walks = useMemo(() => sidewalkSpots(config), [config]);
   const dashes = useMemo(() => dashSpots(config), [config]);
   const cones = useMemo(() => coneSpots(run), [run]);
   const lamps = useMemo(() => decorSpots(config, "lamp").slice(0, Math.max(2, Math.round(config.blocksX * config.blocksZ * quality.decor))), [config, quality.decor]);
   const benches = useMemo(() => decorSpots(config, "bench").slice(0, Math.max(1, Math.round(config.blocksX * config.blocksZ * quality.decor * 0.6))), [config, quality.decor]);
   const stops = useMemo(() => {
      const spots: InstanceSpot[] = [];
      const cap = Math.max(1, Math.round(4 * quality.decor));
      for (let i = 0; i < Math.min(cap, run.pads.length); i += 2) {
         const spot = run.pads[i];
         spots.push({ x: spot.x + 2.6, y: 0, z: spot.z, rotY: Math.PI / 2 });
      }
      return spots;
   }, [run, quality.decor]);
   const lights = useMemo(() => lightSpots(run), [run]);
   const lightBoxes = useMemo(() => lights.map((spot) => ({ ...spot, y: 1.2, sx: 0.22, sy: 2.4, sz: 0.22 })), [lights]);
   const markers = useMemo(() => [run.marker], [run]);

   const bulbParts = useMemo<InstancePart[]>(() => {
      const geometry = new SphereGeometry(0.15, 12, 10);
      const material = new MeshStandardMaterial({ color: "#ffffff", emissive: "#ffffff", emissiveIntensity: 0.95, roughness: 0.32 });
      return [{ geometry, material }];
   }, []);
   useEffect(() => () => {
      const part = bulbParts[0];
      part.geometry.dispose();
      const material = part.material;
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else material.dispose();
   }, [bulbParts]);

   useEffect(() => {
      fx.warm("sparkle", "puff", "confetti", "score");
   }, [fx]);

   useEffect(() => {
      engine.current = startLoop("engine", { volume: 0.02, pitch: 0.7 });
      return () => {
         engine.current?.stop();
         engine.current = null;
      };
   }, []);

   useRunFrame((_state, dt) => {
      const store = useArcadeStore.getState();
      const ev = step(run, { moveX: input.current.moveX, moveY: input.current.moveY }, dt, store.timeLeftMs ?? 0);
      if (ev.score) store.addScore(ev.score);
      store.setStat("rides", run.dropoffs);
      store.setStat("fare", Math.round(Math.max(0, run.patience) * 100));
      const dir = run.speed < -0.2 ? -1 : 1;
      aim.x = run.x + Math.sin(run.yaw) * dir * LOOK_AHEAD;
      aim.z = run.z + Math.cos(run.yaw) * dir * LOOK_AHEAD;
      aim.y = 0.7;
      aim.x = Math.min(bounds.max.x, Math.max(bounds.min.x, aim.x));
      aim.z = Math.min(bounds.max.z, Math.max(bounds.min.z, aim.z));
      if (ev.pickup) {
         AT.x = run.riderX;
         AT.y = 1;
         AT.z = run.riderZ;
         fx.burst("sparkle", AT, 8);
         playSfx("click");
      }
      if (ev.drop) {
         AT.x = run.x;
         AT.y = 1.1;
         AT.z = run.z;
         fx.burst("sparkle", AT, 14);
         fx.score(AT, ev.close ? (ev.calm ? "+200" : "+160") : (ev.calm ? "+140" : "+100"));
         playSfx("chime");
      }
      if (ev.hit || ev.red) {
         AT.x = run.x;
         AT.y = 0.7;
         AT.z = run.z;
         fx.burst("puff", AT, 8);
         fx.shake(ev.hit ? 0.28 : 0.16);
         playSfx("hit");
      }
      if (ev.miss) playSfx("buzz");
      for (let n = 0; n < ev.lives; n++) store.loseLife();
      if (ev.won) {
         playSfx("win");
         fx.burst("confetti", { x: run.x, y: 1.4, z: run.z }, 18);
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
         person.position.set(run.riderX, OFF.y, run.riderZ);
         person.scale.set(1, OFF.squash, 1);
      }
      const ring = pad.current;
      if (ring) {
         const show = !run.marker.hidden && run.phase !== 2;
         ring.visible = show;
         if (show) {
            const pulse = 1 + Math.sin(time.now * 4) * 0.06;
            ring.position.set(run.marker.x, 0.06, run.marker.z);
            ring.scale.set(pulse, 1, pulse);
         }
      }
      const speed = Math.abs(run.speed);
      const handle = engine.current;
      if (handle) handle.set({ volume: 0.04 + Math.min(0.22, speed / 9 * 0.2), pitch: 0.62 + Math.min(0.7, speed / 9) });
   }, FRAME_PRIORITY.visuals);

   const placeCar = (index: number, matrix: Matrix4, color: Color) => {
      const car = run.cars[index];
      if (!car) return false;
      const yaw = car.axis === 0 ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
      E.set(0, yaw, 0);
      Q.setFromEuler(E);
      V.set(car.x, 0, car.z);
      matrix.compose(V, Q, S);
      color.copy(TINTS[index % TINTS.length]);
   };
   const placeBulb = (index: number, matrix: Matrix4, color: Color) => {
      const light = run.lights[index];
      if (!light) return false;
      const sx = light.i < config.blocksX ? 1 : -1;
      const sz = light.j < config.blocksZ ? 1 : -1;
      V.set(streetX(light.i) + sx * 2.75, 2.35, streetZ(light.j) + sz * 2.75);
      Q.identity();
      matrix.compose(V, Q, S);
      color.copy(signalRed(index, run.time, true) ? RED : GREEN);
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
         <SkyDome top={sky.top} bottom={sky.bottom} />
         <mesh rotation-x={-Math.PI / 2} position={[size.x / 2, 0, size.z / 2]}>
            <planeGeometry args={[size.x + 8, size.z + 8]} />
            <meshStandardMaterial color={COLORS.road} roughness={0.9} />
         </mesh>
         <Instanced spots={walks} name="sidewalks">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.sidewalk} roughness={0.86} />
         </Instanced>
         <Instanced spots={dashes} name="dashes">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.roadLine} roughness={0.5} />
         </Instanced>
         {houses.length > 0 && (
            <InstancedModel
               asset={ASSETS.townhouseBlock}
               spots={houses}
               fallback={
                  <>
                     <Instanced spots={houseBody} name="house-body">
                        <boxGeometry args={[1, 1, 1]} />
                        <meshStandardMaterial color={COLORS.building} roughness={0.78} />
                     </Instanced>
                     <Instanced spots={houseRoof} name="house-roof">
                        <boxGeometry args={[1, 1, 1]} />
                        <meshStandardMaterial color={COLORS.buildingTrim} roughness={0.62} />
                     </Instanced>
                  </>
               }
            />
         )}
         {shops.length > 0 && (
            <InstancedModel
               asset={ASSETS.cornerShop}
               spots={shops}
               fallback={
                  <>
                     <Instanced spots={shopBody} name="shop-body">
                        <boxGeometry args={[1, 1, 1]} />
                        <meshStandardMaterial color={COLORS.shop} roughness={0.7} />
                     </Instanced>
                     <Instanced spots={shopRoof} name="shop-awning">
                        <boxGeometry args={[1, 1, 1]} />
                        <meshStandardMaterial color={COLORS.shopAwning} roughness={0.55} />
                     </Instanced>
                  </>
               }
            />
         )}
         <InstancedModel asset={ASSETS.lamp} spots={lamps} fallback={null} />
         <InstancedModel asset={ASSETS.bench} spots={benches} fallback={null} />
         {stops.length > 0 && <InstancedModel asset={ASSETS.busStop} spots={stops} fallback={null} />}
         <InstancedModel
            asset={ASSETS.trafficCone}
            spots={cones}
            fallback={
               <Instanced spots={cones} name="cones">
                  <cylinderGeometry args={[0.05, 0.2, 0.42, 7]} />
                  <meshStandardMaterial color={COLORS.cone} roughness={0.55} />
               </Instanced>
            }
         />
         <InstancedModel
            asset={ASSETS.trafficLight}
            spots={lights}
            fallback={
               <Instanced spots={lightBoxes} name="light-poles">
                  <boxGeometry args={[1, 1, 1]} />
                  <meshStandardMaterial color={COLORS.pole} roughness={0.45} metalness={0.18} />
               </Instanced>
            }
         />
         <DynamicInstancedModel
            asset={ASSETS.car}
            count={Math.max(1, config.traffic)}
            update={placeCar}
            tinted
            name="traffic"
         />
         <DynamicInstanced count={Math.max(1, config.lights)} update={placeBulb} parts={bulbParts} tinted name="bulbs" />
         <mesh ref={pad} rotation-x={-Math.PI / 2} position={[run.marker.x, 0.06, run.marker.z]}>
            <ringGeometry args={[1.15, 1.7, 28]} />
            <meshStandardMaterial color={COLORS.pad} emissive={COLORS.pad} emissiveIntensity={0.55} roughness={0.4} />
         </mesh>
         <group ref={cab}>
            <Model asset={ASSETS.taxiCab} fallback={<TaxiPrimitive />} />
            <BlobShadow radius={1.35} opacity={0.28} />
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
