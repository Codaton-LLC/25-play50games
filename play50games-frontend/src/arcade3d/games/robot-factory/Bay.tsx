"use client";

// The assembly bay: floor, platform, belt housings, gantry, cradle, bin and door frame merged into
// one vertex-coloured mesh; the two Conveyors; every emissive strip and status light in one
// instanced mesh (rim-lit belts, the grab-zone rails that turn green / coral, beacons, the cradle's
// progress LEDs); the moving claw, the sweeper and the exit door. Visuals only: they read the run.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { BoxGeometry, BufferAttribute, Color, CylinderGeometry, Matrix4, Quaternion, RepeatWrapping, Vector3, type BufferGeometry, type Group, type InstancedMesh } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Model } from "@/arcade3d/core/assets";
import { SkyDome } from "@/arcade3d/core/env";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { Conveyor } from "@/arcade3d/core/kit";
import { useQuality } from "@/arcade3d/core/quality";
import { useCanvasTexture } from "@/arcade3d/core/render";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { ASSETS, DOOR } from "./assets";
import { CRADLE_TOP, clawAt, type Look } from "./look";
import { COLORS } from "./palette";
import { THROUGH_DOOR } from "./poses";
import { BELT, CRADLE, FEEDER_BELT, MAIN_BELT, SCRAP_BIN, WALK, beltSpeed, blueprintSize, type Run } from "./rules";

/** The door stands across the walk at this x, turned to face the cradle. */
export const DOOR_X = 2.62;
const FEEDER_YAW = -Math.atan2(0.9, 1.4);
const GANTRY = { x0: -1.4, x1: 1.95, zBack: -0.8, zFront: 0.62, y: 1.92 } as const;

function tone(geometry: BufferGeometry, color: string): BufferGeometry {
   const flat = geometry.index ? geometry.toNonIndexed() : geometry;
   if (flat !== geometry) geometry.dispose();
   const c = new Color(color);
   const n = flat.getAttribute("position").count;
   const colors = new Float32Array(n * 3);
   for (let i = 0; i < n; i++) c.toArray(colors, i * 3);
   flat.setAttribute("color", new BufferAttribute(colors, 3));
   return flat;
}

const box = (w: number, h: number, d: number, x: number, y: number, z: number, color: string, yaw = 0) => {
   const g = new BoxGeometry(w, h, d);
   if (yaw) g.rotateY(yaw);
   return tone(g.translate(x, y, z), color);
};
const cyl = (r: number, h: number, x: number, y: number, z: number, color: string, top = r) => tone(new CylinderGeometry(top, r, h, 28).translate(x, y, z), color);

function buildBay(decor: boolean, sorter: boolean): BufferGeometry {
   const p: BufferGeometry[] = [
      // work platform with a lighter edge
      box(6.7, 0.05, 2.9, 0, 0.025, 0.05, COLORS.platformEdge),
      box(6.5, 0.06, 2.7, 0, 0.03, 0.05, COLORS.platform),
      // main belt housing and legs
      box(5.75, 0.16, 0.96, 0, 0.64, BELT.Z, COLORS.frame),
      box(5.75, 0.04, 1.0, 0, 0.55, BELT.Z, COLORS.steelDark),
      // feeder housing, along its belt
      box(FEEDER_BELT.total + 0.1, 0.16, 0.8, -1.9, 0.64, -0.1, COLORS.frame, FEEDER_YAW),
      // the back wall behind the blueprint board, and the board's bezel
      box(6.6, 2.1, 0.08, 0, 1.05, -1.16, COLORS.frame),
      box(2.78, 1.0, 0.06, 0, 1.45, -1.0, COLORS.steelDark),
      // gantry: two posts at the back, rails front and back, end beams
      box(0.1, GANTRY.y, 0.1, GANTRY.x0, GANTRY.y / 2, GANTRY.zBack, COLORS.steelMid),
      box(0.1, GANTRY.y, 0.1, GANTRY.x1, GANTRY.y / 2, GANTRY.zBack, COLORS.steelMid),
      box(GANTRY.x1 - GANTRY.x0, 0.07, 0.07, (GANTRY.x0 + GANTRY.x1) / 2, GANTRY.y, GANTRY.zBack, COLORS.steel),
      box(GANTRY.x1 - GANTRY.x0, 0.07, 0.07, (GANTRY.x0 + GANTRY.x1) / 2, GANTRY.y, GANTRY.zFront, COLORS.steel),
      box(0.07, 0.07, GANTRY.zFront - GANTRY.zBack, GANTRY.x0, GANTRY.y, (GANTRY.zBack + GANTRY.zFront) / 2, COLORS.steel),
      box(0.07, 0.07, GANTRY.zFront - GANTRY.zBack, GANTRY.x1, GANTRY.y, (GANTRY.zBack + GANTRY.zFront) / 2, COLORS.steel),
      // the assembly cradle: a turntable on a plinth
      cyl(0.42, 0.12, CRADLE.x, 0.06, CRADLE.z, COLORS.steelDark),
      cyl(0.36, 0.1, CRADLE.x, 0.17, CRADLE.z, COLORS.steelMid),
      cyl(0.34, 0.02, CRADLE.x, CRADLE_TOP - 0.01, CRADLE.z, COLORS.steel),
      // the exit door's frame
      box(0.14, 2.0, 0.12, DOOR_X, 1.0, WALK.TO.z - DOOR.width / 2 - 0.07, COLORS.steelDark),
      box(0.14, 2.0, 0.12, DOOR_X, 1.0, WALK.TO.z + DOOR.width / 2 + 0.07, COLORS.steelDark),
      box(0.14, 0.12, DOOR.width + 0.26, DOOR_X, 1.96, WALK.TO.z, COLORS.steelDark),
   ];
   if (!sorter) {
      // the scrap bin: an open box in front of the claw. The sorter levels put their four bins here
      // instead (SortBins), so the scrap bin would stand in front of bins 2 and 3 and hide their plates.
      p.push(
         box(0.94, 0.04, 0.44, SCRAP_BIN.x, 0.06, 1.0, COLORS.bin),
         box(0.94, 0.4, 0.04, SCRAP_BIN.x, 0.24, 1.2, COLORS.bin),
         box(0.94, 0.3, 0.04, SCRAP_BIN.x, 0.19, 0.8, COLORS.bin),
         box(0.04, 0.4, 0.44, SCRAP_BIN.x - 0.45, 0.24, 1.0, COLORS.bin),
         box(0.04, 0.4, 0.44, SCRAP_BIN.x + 0.45, 0.24, 1.0, COLORS.bin),
         box(0.96, 0.04, 0.05, SCRAP_BIN.x, 0.44, 1.21, COLORS.hazard),
      );
   }
   for (const x of [-2.5, -1.25, 1.25, 2.5]) {
      p.push(box(0.08, 0.5, 0.08, x, 0.31, BELT.Z - 0.36, COLORS.steelDark));
      p.push(box(0.08, 0.5, 0.08, x, 0.31, BELT.Z + 0.36, COLORS.steelDark));
   }
   if (decor) {
      for (const x of [-3.05, 3.05]) p.push(box(0.3, 2.4, 0.3, x, 1.2, -1.05, COLORS.steelDark));
      for (const x of [-2.2, 2.2]) p.push(box(0.9, 0.5, 0.5, x, 0.28, -0.85, COLORS.frame));
   }
   const merged = mergeGeometries(p, false)!;
   for (const g of p) g.dispose();
   return merged;
}

/** Glowing strips and lamps, one instanced mesh. role: rim, feeder, zone, beacon, cradle LED k, warn, door, board. */
interface Light {
   x: number;
   y: number;
   z: number;
   sx: number;
   sy: number;
   sz: number;
   yaw: number;
   role: "rim" | "feeder" | "zone" | "beacon" | "led" | "warn" | "door" | "board";
   k: number;
}

function buildLights(): Light[] {
   const L: Light[] = [];
   const add = (role: Light["role"], x: number, y: number, z: number, sx: number, sy: number, sz: number, yaw = 0, k = 0) => L.push({ role, x, y, z, sx, sy, sz, yaw, k });
   add("rim", 0, 0.73, BELT.Z - 0.49, 5.75, 0.03, 0.025);
   add("rim", 0, 0.73, BELT.Z + 0.49, 5.75, 0.03, 0.025);
   const fx = -1.9;
   const fz = -0.1;
   const nx = Math.sin(-FEEDER_YAW);
   const nz = Math.cos(-FEEDER_YAW);
   for (const side of [-1, 1]) add("feeder", fx - side * nx * 0.41, 0.73, fz + side * nz * 0.41, FEEDER_BELT.total, 0.03, 0.025, FEEDER_YAW);
   add("zone", 0, 0.8, BELT.Z - 0.52, 1.8, 0.035, 0.035);
   add("zone", 0, 0.8, BELT.Z + 0.52, 1.8, 0.035, 0.035);
   for (const x of [-0.92, 0.92]) for (const z of [BELT.Z - 0.52, BELT.Z + 0.52]) add("zone", x, 0.88, z, 0.035, 0.2, 0.035);
   add("beacon", GANTRY.x0, GANTRY.y + 0.08, GANTRY.zBack, 0.1, 0.08, 0.1);
   add("beacon", GANTRY.x1, GANTRY.y + 0.08, GANTRY.zBack, 0.1, 0.08, 0.1);
   for (let k = 0; k < 5; k++) {
      const a = Math.PI * (0.15 + 0.175 * k);
      add("led", CRADLE.x + Math.cos(a) * 0.4, 0.13, CRADLE.z + Math.sin(a) * 0.4, 0.06, 0.04, 0.06, 0, k);
   }
   add("warn", SCRAP_BIN.x, 0.47, 1.21, 0.9, 0.025, 0.025);
   add("door", DOOR_X - 0.08, 1.0, WALK.TO.z - DOOR.width / 2 - 0.02, 0.03, 1.85, 0.03);
   add("door", DOOR_X - 0.08, 1.0, WALK.TO.z + DOOR.width / 2 + 0.02, 0.03, 1.85, 0.03);
   add("board", 0, 0.98, -0.965, 2.6, 0.025, 0.02);
   return L;
}

const LIGHTS = buildLights();

export function Bay({ run, look }: { run: Run; look: Look }) {
   const quality = useQuality();
   const decor = quality.tier !== "low";
   const sorter = run.level.sorter;
   const bay = useMemo(() => buildBay(decor, sorter), [decor, sorter]);
   useEffect(() => () => bay.dispose(), [bay]);
   return (
      <group name="bay">
         <SkyDome top={COLORS.skyTop} bottom={COLORS.skyBottom} />
         <Floor />
         <mesh geometry={bay} name="bay-static">
            <meshStandardMaterial vertexColors roughness={0.62} metalness={0.25} />
         </mesh>
         <Belts run={run} />
         <Lights run={run} look={look} />
         <Claw look={look} />
         <Sweeper look={look} />
         <ExitDoor run={run} />
      </group>
   );
}

function Floor() {
   const draw = useMemo(
      () => (ctx: CanvasRenderingContext2D, w: number, h: number) => {
         ctx.fillStyle = COLORS.floor;
         ctx.fillRect(0, 0, w, h);
         ctx.strokeStyle = COLORS.floorGrid;
         ctx.lineWidth = 3;
         ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
      },
      []
   );
   const map = useCanvasTexture(64, 64, draw);
   useEffect(() => {
      map.wrapS = map.wrapT = RepeatWrapping;
      map.repeat.set(16, 12);
      map.needsUpdate = true;
   }, [map]);
   return (
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} name="floor">
         <planeGeometry args={[16, 12]} />
         <meshStandardMaterial map={map} roughness={0.92} />
      </mesh>
   );
}

function Belts({ run }: { run: Run }) {
   // the Conveyors read their speed from props: re-render only when the robot count (a HUD stat) changes
   const robots = useArcadeStore((state) => state.stats.robots ?? 0);
   const speed = beltSpeed(robots, run.level);
   return (
      <group name="belts">
         <Conveyor path={MAIN_BELT} width={BELT.WIDTH} speed={speed} color={COLORS.belt} stripe={COLORS.beltStripe} frameColor={COLORS.beltFrame} />
         <Conveyor path={FEEDER_BELT} width={BELT.FEEDER_WIDTH} speed={speed} color={COLORS.belt} stripe={COLORS.beltStripe} frameColor={COLORS.beltFrame} />
      </group>
   );
}

function Lights({ run, look }: { run: Run; look: Look }) {
   const mesh = useRef<InstancedMesh>(null);
   const time = useGameTime();
   const [s] = useState(() => ({
      m: new Matrix4(),
      q: new Quaternion(),
      p: new Vector3(),
      sc: new Vector3(),
      up: new Vector3(0, 1, 0),
      c: new Color(),
      rim: new Color(COLORS.rim),
      dim: new Color(COLORS.rimDim),
      good: new Color(COLORS.good),
      bad: new Color(COLORS.bad),
      warn: new Color(COLORS.warn),
      gold: new Color(COLORS.gold),
      off: new Color(COLORS.steelDark),
   }));
   useEffect(() => {
      const inst = mesh.current;
      if (!inst) return;
      LIGHTS.forEach((l, i) => {
         s.q.setFromAxisAngle(s.up, l.yaw);
         // the scrap bin's warning strip goes with the bin (not on the sorter levels)
         const hide = l.role === "warn" && run.level.sorter ? 0 : 1;
         inst.setMatrixAt(i, s.m.compose(s.p.set(l.x, l.y, l.z), s.q, s.sc.set(l.sx * hide, l.sy * hide, l.sz * hide)));
         inst.setColorAt(i, s.rim);
      });
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
   }, [s, run.level.sorter]);
   useFrame(() => {
      const inst = mesh.current;
      if (!inst) return;
      const now = time.now;
      const pulse = 0.85 + 0.15 * Math.sin(now * 3);
      const locked = run.lockout > 0;
      const size = blueprintSize(run.robot);
      for (let i = 0; i < LIGHTS.length; i++) {
         const l = LIGHTS[i];
         const c = s.c;
         if (l.role === "rim" || l.role === "board") c.copy(s.rim).multiplyScalar(pulse);
         else if (l.role === "feeder") c.copy(run.t >= run.level.feederT ? s.rim : s.dim);
         else if (l.role === "zone") {
            if (locked) c.copy(s.bad).multiplyScalar(0.75 + 0.25 * Math.sin(now * 18));
            else if (look.good < 0.35) c.lerpColors(s.good, s.rim, look.good / 0.35);
            else c.copy(s.rim);
         } else if (l.role === "beacon") c.copy(locked ? s.bad : s.warn).multiplyScalar(0.6 + 0.4 * Math.max(0, Math.sin(now * 5 + l.x)));
         else if (l.role === "led") c.copy(l.k < size ? (l.k < look.landed ? s.good : s.dim) : s.off);
         else if (l.role === "warn") c.copy(s.warn).multiplyScalar(look.sweep < 0.4 ? 1.4 : 0.8);
         else c.copy(run.walkT < WALK.DURATION + THROUGH_DOOR + 0.3 ? s.good : s.rim);
         inst.setColorAt(i, c);
      }
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
   });
   return (
      <instancedMesh ref={mesh} args={[undefined, undefined, LIGHTS.length]} name="bay-lights" frustumCulled={false}>
         <boxGeometry args={[1, 1, 1]} />
         <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
   );
}

function buildClawHead(): BufferGeometry {
   const parts = [
      tone(new CylinderGeometry(0.03, 0.03, 0.9, 10).translate(0, 0.95, 0), COLORS.steel),
      tone(new CylinderGeometry(0.15, 0.17, 0.16, 20).translate(0, 0.42, 0), COLORS.steelMid),
      tone(new CylinderGeometry(0.175, 0.175, 0.035, 20).translate(0, 0.33, 0), COLORS.rim),
      tone(new CylinderGeometry(0.07, 0.1, 0.1, 16).translate(0, 0.28, 0), COLORS.steelDark),
   ];
   for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      const g = new BoxGeometry(0.05, 0.24, 0.07).translate(0, -0.12, 0).rotateX(-0.35).rotateY(a).translate(Math.sin(a) * 0.1, 0.26, Math.cos(a) * 0.1);
      parts.push(tone(g, COLORS.steel));
   }
   const merged = mergeGeometries(parts, false)!;
   for (const g of parts) g.dispose();
   return merged;
}

function Claw({ look }: { look: Look }) {
   const time = useGameTime();
   const head = useRef<Group>(null);
   const bridge = useRef<Group>(null);
   const trolley = useRef<Group>(null);
   const geometry = useMemo(buildClawHead, []);
   useEffect(() => () => geometry.dispose(), [geometry]);
   const [p] = useState(() => ({ x: 0, y: 0, z: 0 }));
   useFrame(() => {
      clawAt(look, time.now, p);
      if (head.current) head.current.position.set(p.x, p.y, p.z);
      if (bridge.current) bridge.current.position.x = p.x;
      if (trolley.current) trolley.current.position.set(p.x, GANTRY.y - 0.08, p.z);
   });
   return (
      <group name="claw">
         <group ref={bridge}>
            <mesh position={[0, GANTRY.y + 0.05, (GANTRY.zBack + GANTRY.zFront) / 2]}>
               <boxGeometry args={[0.12, 0.08, GANTRY.zFront - GANTRY.zBack + 0.1]} />
               <meshStandardMaterial color={COLORS.steel} roughness={0.4} metalness={0.5} />
            </mesh>
         </group>
         <group ref={trolley}>
            <mesh>
               <boxGeometry args={[0.24, 0.12, 0.24]} />
               <meshStandardMaterial color={COLORS.steelMid} roughness={0.45} metalness={0.4} />
            </mesh>
         </group>
         <group ref={head}>
            <mesh geometry={geometry}>
               <meshStandardMaterial vertexColors roughness={0.38} metalness={0.45} />
            </mesh>
         </group>
      </group>
   );
}

function Sweeper({ look }: { look: Look }) {
   const ref = useRef<Group>(null);
   useFrame(() => {
      const g = ref.current;
      if (!g) return;
      const k = Math.min(1, look.sweep / 0.32);
      g.position.z = -0.25 + 0.72 * Math.sin(k * Math.PI);
   });
   return (
      <group ref={ref} position={[0, 0.9, -0.25]} name="sweeper">
         <mesh>
            <boxGeometry args={[0.6, 0.16, 0.06]} />
            <meshStandardMaterial color={COLORS.hazard} roughness={0.5} metalness={0.2} />
         </mesh>
         <mesh position={[0, 0.02, -0.25]}>
            <boxGeometry args={[0.06, 0.06, 0.5]} />
            <meshStandardMaterial color={COLORS.steelMid} roughness={0.5} metalness={0.4} />
         </mesh>
      </group>
   );
}

function DoorPrimitive() {
   return (
      <group>
         <mesh position={[0, DOOR.height / 2, 0]}>
            <boxGeometry args={[DOOR.width, DOOR.height, DOOR.depth]} />
            <meshStandardMaterial color={COLORS.steelMid} roughness={0.5} metalness={0.35} />
         </mesh>
         <mesh position={[0, DOOR.height * 0.62, DOOR.depth / 2 + 0.005]}>
            <planeGeometry args={[DOOR.width * 0.6, 0.22]} />
            <meshBasicMaterial color={COLORS.rim} toneMapped={false} />
         </mesh>
      </group>
   );
}

/** The exit door lifts while a finished robot walks through it. */
function ExitDoor({ run }: { run: Run }) {
   const ref = useRef<Group>(null);
   const lift = useRef(0);
   const time = useGameTime();
   useFrame(() => {
      const g = ref.current;
      if (!g) return;
      const open = run.walkT > 0.2 && run.walkT < WALK.DURATION + THROUGH_DOOR + 0.15 ? 1 : 0;
      lift.current += (open - lift.current) * (1 - Math.exp(-14 * time.delta));
      g.position.y = lift.current * 1.7;
   });
   return (
      <group position={[DOOR_X, 0, WALK.TO.z]} rotation-y={-Math.PI / 2}>
         <group ref={ref}>
            <Model asset={ASSETS.door} fallback={<DoorPrimitive />} />
         </group>
      </group>
   );
}
