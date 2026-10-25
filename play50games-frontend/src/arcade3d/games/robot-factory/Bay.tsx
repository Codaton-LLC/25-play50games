"use client";

// The assembly bay: brushed-metal floor, platform with hazard stripes, bevelled belt housings,
// industrial gantry, cradle, scrap bin, exit blast door, and factory surroundings (Decor).
// Every emissive strip and status light in one instanced mesh; moving claw, sweeper and door.
// Visuals only: they read the run. Built once; zero per-frame allocations.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import {
   BoxGeometry,
   BufferAttribute,
   Color,
   CylinderGeometry,
   Matrix4,
   Quaternion,
   RepeatWrapping,
   Vector3,
   type BufferGeometry,
   type Group,
   type InstancedMesh,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Model } from "@/arcade3d/core/assets";
import { SkyDome } from "@/arcade3d/core/env";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { Conveyor } from "@/arcade3d/core/kit";
import { useQuality } from "@/arcade3d/core/quality";
import { useCanvasTexture } from "@/arcade3d/core/render";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { ASSETS, DOOR } from "./assets";
import { Decor } from "./Decor";
import { CRADLE_TOP, clawAt, type Look } from "./look";
import { COLORS, FLOOR_PLANE } from "./looks";
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

const roundedBox = (w: number, h: number, d: number, x: number, y: number, z: number, color: string, r = 0.02, yaw = 0) => {
   const radius = Math.min(Math.min(w, h, d) * 0.25, r);
   const g = new RoundedBoxGeometry(w, h, d, 2, radius);
   if (yaw) g.rotateY(yaw);
   return tone(g.translate(x, y, z), color);
};

const cyl = (r: number, h: number, x: number, y: number, z: number, color: string, top = r) =>
   tone(new CylinderGeometry(top, r, h, 24).translate(x, y, z), color);

function buildBay(decor: boolean, sorter: boolean): BufferGeometry {
   const p: BufferGeometry[] = [
      // --- Work Platform with bevelled edges & safety border ---
      roundedBox(6.75, 0.05, 2.95, 0, 0.025, 0.05, COLORS.platformEdge, 0.025),
      roundedBox(6.55, 0.065, 2.75, 0, 0.032, 0.05, COLORS.platform, 0.02),

      // Safety perimeter hazard stripes along platform edge
      box(6.5, 0.01, 0.06, 0, 0.066, -1.3, COLORS.hazard),
      box(6.5, 0.01, 0.06, 0, 0.066, 1.4, COLORS.hazard),
      box(0.06, 0.01, 2.7, -3.25, 0.066, 0.05, COLORS.hazard),
      box(0.06, 0.01, 2.7, 3.25, 0.066, 0.05, COLORS.hazard),

      // --- Main Belt Housing with bevelled frame & industrial legs ---
      roundedBox(5.75, 0.16, 0.96, 0, 0.64, BELT.Z, COLORS.frame, 0.025),
      roundedBox(5.75, 0.05, 1.0, 0, 0.55, BELT.Z, COLORS.steelDark, 0.02),
      // Belt end drive rollers
      cyl(0.09, 0.88, -2.85, 0.68, BELT.Z, COLORS.steelMid),
      cyl(0.09, 0.88, 2.85, 0.68, BELT.Z, COLORS.steelMid),

      // --- Feeder Belt Housing along its angled path ---
      roundedBox(FEEDER_BELT.total + 0.1, 0.16, 0.8, -1.9, 0.64, -0.1, COLORS.frame, 0.025, FEEDER_YAW),
      roundedBox(FEEDER_BELT.total + 0.1, 0.05, 0.84, -1.9, 0.55, -0.1, COLORS.steelDark, 0.02, FEEDER_YAW),

      // --- Back Wall & Blueprint Board Bezel ---
      roundedBox(6.6, 2.1, 0.08, 0, 1.05, -1.16, COLORS.frame, 0.02),
      roundedBox(2.82, 1.04, 0.06, 0, 1.45, -1.0, COLORS.steelDark, 0.03),
      // Metallic mounting trim for blueprint board
      box(2.86, 0.03, 0.07, 0, 1.98, -1.0, COLORS.steel),
      box(2.86, 0.03, 0.07, 0, 0.92, -1.0, COLORS.steel),

      // --- Gantry Crane Structure ---
      // Heavy gantry support posts
      roundedBox(0.12, GANTRY.y, 0.12, GANTRY.x0, GANTRY.y / 2, GANTRY.zBack, COLORS.steelMid, 0.02),
      roundedBox(0.12, GANTRY.y, 0.12, GANTRY.x1, GANTRY.y / 2, GANTRY.zBack, COLORS.steelMid, 0.02),
      // Base floor anchor flanges
      cyl(0.14, 0.06, GANTRY.x0, 0.03, GANTRY.zBack, COLORS.frame),
      cyl(0.14, 0.06, GANTRY.x1, 0.03, GANTRY.zBack, COLORS.frame),
      // Overhead crane I-beam rails
      roundedBox(GANTRY.x1 - GANTRY.x0 + 0.1, 0.08, 0.08, (GANTRY.x0 + GANTRY.x1) / 2, GANTRY.y, GANTRY.zBack, COLORS.steel, 0.015),
      roundedBox(GANTRY.x1 - GANTRY.x0 + 0.1, 0.08, 0.08, (GANTRY.x0 + GANTRY.x1) / 2, GANTRY.y, GANTRY.zFront, COLORS.steel, 0.015),
      roundedBox(0.08, 0.08, GANTRY.zFront - GANTRY.zBack + 0.1, GANTRY.x0, GANTRY.y, (GANTRY.zBack + GANTRY.zFront) / 2, COLORS.steel, 0.015),
      roundedBox(0.08, 0.08, GANTRY.zFront - GANTRY.zBack + 0.1, GANTRY.x1, GANTRY.y, (GANTRY.zBack + GANTRY.zFront) / 2, COLORS.steel, 0.015),
      // Gantry end-stop bumpers
      box(0.1, 0.1, 0.04, GANTRY.x0, GANTRY.y, GANTRY.zFront + 0.06, COLORS.hazard),
      box(0.1, 0.1, 0.04, GANTRY.x1, GANTRY.y, GANTRY.zFront + 0.06, COLORS.hazard),

      // --- Assembly Cradle: Stepped Turnplate on Plinth ---
      cyl(0.44, 0.12, CRADLE.x, 0.06, CRADLE.z, COLORS.steelDark),
      cyl(0.38, 0.1, CRADLE.x, 0.17, CRADLE.z, COLORS.steelMid),
      cyl(0.35, 0.02, CRADLE.x, CRADLE_TOP - 0.01, CRADLE.z, COLORS.steel),
      // Cradle alignment guides
      box(0.03, 0.05, 0.1, CRADLE.x + 0.36, 0.18, CRADLE.z, COLORS.hazard),
      box(0.03, 0.05, 0.1, CRADLE.x - 0.36, 0.18, CRADLE.z, COLORS.hazard),

      // --- Exit Blast-Door Frame ---
      roundedBox(0.16, 2.05, 0.14, DOOR_X, 1.025, WALK.TO.z - DOOR.width / 2 - 0.08, COLORS.steelDark, 0.02),
      roundedBox(0.16, 2.05, 0.14, DOOR_X, 1.025, WALK.TO.z + DOOR.width / 2 + 0.08, COLORS.steelDark, 0.02),
      roundedBox(0.16, 0.14, DOOR.width + 0.3, DOOR_X, 1.98, WALK.TO.z, COLORS.steelDark, 0.02),
      // Door lintel hazard chevron bar
      box(0.17, 0.04, DOOR.width + 0.2, DOOR_X, 2.08, WALK.TO.z, COLORS.hazard),
   ];

   if (!sorter) {
      // --- Scrap Bin: Bevelled industrial hopper (levels 1-3) ---
      p.push(
         roundedBox(0.96, 0.04, 0.46, SCRAP_BIN.x, 0.06, 1.0, COLORS.bin, 0.015),
         roundedBox(0.96, 0.4, 0.04, SCRAP_BIN.x, 0.24, 1.2, COLORS.bin, 0.015),
         roundedBox(0.96, 0.3, 0.04, SCRAP_BIN.x, 0.19, 0.8, COLORS.bin, 0.015),
         roundedBox(0.04, 0.4, 0.46, SCRAP_BIN.x - 0.46, 0.24, 1.0, COLORS.bin, 0.015),
         roundedBox(0.04, 0.4, 0.46, SCRAP_BIN.x + 0.46, 0.24, 1.0, COLORS.bin, 0.015),
         // Heavy hazard chevron lip
         roundedBox(0.98, 0.045, 0.06, SCRAP_BIN.x, 0.44, 1.21, COLORS.hazard, 0.01),
         roundedBox(0.98, 0.04, 0.05, SCRAP_BIN.x, 0.34, 0.8, COLORS.steelDark, 0.01),
      );
   }

   // Belt support structural legs with foot pads
   for (const x of [-2.5, -1.25, 1.25, 2.5]) {
      p.push(
         roundedBox(0.09, 0.5, 0.09, x, 0.31, BELT.Z - 0.36, COLORS.steelDark, 0.015),
         roundedBox(0.09, 0.5, 0.09, x, 0.31, BELT.Z + 0.36, COLORS.steelDark, 0.015),
         cyl(0.08, 0.03, x, 0.04, BELT.Z - 0.36, COLORS.frame),
         cyl(0.08, 0.03, x, 0.04, BELT.Z + 0.36, COLORS.frame),
      );
   }

   if (decor) {
      // Architectural columns and industrial equipment cabinets flanking the bay
      for (const x of [-3.05, 3.05]) {
         p.push(roundedBox(0.32, 2.4, 0.32, x, 1.2, -1.05, COLORS.steelDark, 0.03));
         p.push(box(0.34, 0.04, 0.34, x, 2.42, -1.05, COLORS.steel));
      }
      for (const x of [-2.2, 2.2]) {
         p.push(roundedBox(0.92, 0.52, 0.52, x, 0.28, -0.85, COLORS.frame, 0.03));
         p.push(roundedBox(0.86, 0.46, 0.04, x, 0.28, -0.58, COLORS.steelDark, 0.02));
      }
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
   const add = (role: Light["role"], x: number, y: number, z: number, sx: number, sy: number, sz: number, yaw = 0, k = 0) =>
      L.push({ role, x, y, z, sx, sy, sz, yaw, k });

   // Glowing conveyor side rails (rim)
   add("rim", 0, 0.73, BELT.Z - 0.49, 5.75, 0.03, 0.025);
   add("rim", 0, 0.73, BELT.Z + 0.49, 5.75, 0.03, 0.025);

   // Feeder conveyor rails
   const fx = -1.9;
   const fz = -0.1;
   const nx = Math.sin(-FEEDER_YAW);
   const nz = Math.cos(-FEEDER_YAW);
   for (const side of [-1, 1]) {
      add("feeder", fx - side * nx * 0.41, 0.73, fz + side * nz * 0.41, FEEDER_BELT.total, 0.03, 0.025, FEEDER_YAW);
   }

   // Grab zone indicator rails (turn green on install, coral during lockout)
   add("zone", 0, 0.8, BELT.Z - 0.52, 1.8, 0.035, 0.035);
   add("zone", 0, 0.8, BELT.Z + 0.52, 1.8, 0.035, 0.035);
   for (const x of [-0.92, 0.92]) {
      for (const z of [BELT.Z - 0.52, BELT.Z + 0.52]) {
         add("zone", x, 0.88, z, 0.035, 0.2, 0.035);
      }
   }

   // Gantry warning beacons
   add("beacon", GANTRY.x0, GANTRY.y + 0.08, GANTRY.zBack, 0.1, 0.08, 0.1);
   add("beacon", GANTRY.x1, GANTRY.y + 0.08, GANTRY.zBack, 0.1, 0.08, 0.1);

   // Cradle build-progress arc LEDs
   for (let k = 0; k < 5; k++) {
      const a = Math.PI * (0.15 + 0.175 * k);
      add("led", CRADLE.x + Math.cos(a) * 0.4, 0.13, CRADLE.z + Math.sin(a) * 0.4, 0.06, 0.04, 0.06, 0, k);
   }

   // Scrap bin warning indicator
   add("warn", SCRAP_BIN.x, 0.47, 1.21, 0.9, 0.025, 0.025);

   // Exit door status beacons
   add("door", DOOR_X - 0.08, 1.0, WALK.TO.z - DOOR.width / 2 - 0.02, 0.03, 1.85, 0.03);
   add("door", DOOR_X - 0.08, 1.0, WALK.TO.z + DOOR.width / 2 + 0.02, 0.03, 1.85, 0.03);

   // Blueprint board bottom illumination strip
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
            <meshStandardMaterial vertexColors roughness={0.55} metalness={0.35} />
         </mesh>
         <Belts run={run} />
         <Lights run={run} look={look} />
         <Claw look={look} />
         <Sweeper look={look} />
         <ExitDoor run={run} />
         <Decor />
      </group>
   );
}

function Floor() {
   const draw = useMemo(
      () => (ctx: CanvasRenderingContext2D, w: number, h: number) => {
         // Brushed dark industrial steel background
         ctx.fillStyle = COLORS.floor;
         ctx.fillRect(0, 0, w, h);

         // Brushed metal horizontal grain
         ctx.fillStyle = COLORS.steelDark;
         for (let y = 0; y < h; y += 4) {
            ctx.globalAlpha = 0.08 + ((y * 19) % 7) * 0.02;
            ctx.fillRect(0, y, w, 2);
         }
         ctx.globalAlpha = 1;

         // Modular factory floor grid panels
         ctx.strokeStyle = COLORS.floorGrid;
         ctx.lineWidth = 4;
         ctx.strokeRect(2, 2, w - 4, h - 4);

         // Inner panel plate
         ctx.strokeStyle = COLORS.platform;
         ctx.lineWidth = 2;
         ctx.strokeRect(10, 10, w - 20, h - 20);

         // Corner rivets
         ctx.fillStyle = COLORS.steelMid;
         const r = 3;
         const corners = [
            [18, 18],
            [w - 18, 18],
            [18, h - 18],
            [w - 18, h - 18],
         ];
         for (const [cx, cy] of corners) {
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
         }
      },
      []
   );
   const map = useCanvasTexture(256, 256, draw);
   useEffect(() => {
      map.wrapS = map.wrapT = RepeatWrapping;
      map.repeat.set(24, 18);
      map.needsUpdate = true;
   }, [map]);

   return (
      <mesh
         rotation-x={-Math.PI / 2}
         position={[FLOOR_PLANE.x, -0.005, FLOOR_PLANE.z]}
         name="floor"
      >
         <planeGeometry args={[FLOOR_PLANE.width, FLOOR_PLANE.depth]} />
         <meshStandardMaterial map={map} roughness={0.52} metalness={0.48} />
      </mesh>
   );
}

function Belts({ run }: { run: Run }) {
   const robots = useArcadeStore((state) => state.stats.robots ?? 0);
   const speed = beltSpeed(robots, run.level);
   return (
      <group name="belts">
         <Conveyor
            path={MAIN_BELT}
            width={BELT.WIDTH}
            speed={speed}
            color={COLORS.belt}
            stripe={COLORS.beltStripe}
            frameColor={COLORS.beltFrame}
         />
         <Conveyor
            path={FEEDER_BELT}
            width={BELT.FEEDER_WIDTH}
            speed={speed}
            color={COLORS.belt}
            stripe={COLORS.beltStripe}
            frameColor={COLORS.beltFrame}
         />
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
         const hide = l.role === "warn" && run.level.sorter ? 0 : 1;
         inst.setMatrixAt(
            i,
            s.m.compose(s.p.set(l.x, l.y, l.z), s.q, s.sc.set(l.sx * hide, l.sy * hide, l.sz * hide))
         );
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
         } else if (l.role === "beacon") {
            c.copy(locked ? s.bad : s.warn).multiplyScalar(0.6 + 0.4 * Math.max(0, Math.sin(now * 5 + l.x)));
         } else if (l.role === "led") {
            c.copy(l.k < size ? (l.k < look.landed ? s.good : s.dim) : s.off);
         } else if (l.role === "warn") {
            c.copy(s.warn).multiplyScalar(look.sweep < 0.4 ? 1.4 : 0.8);
         } else {
            c.copy(run.walkT < WALK.DURATION + THROUGH_DOOR + 0.3 ? s.good : s.rim);
         }
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
      // Central suspension piston shaft
      tone(new CylinderGeometry(0.035, 0.035, 0.9, 12).translate(0, 0.95, 0), COLORS.steel),
      // Heavy robotic wrist collar
      tone(new CylinderGeometry(0.16, 0.18, 0.16, 22).translate(0, 0.42, 0), COLORS.steelMid),
      // Glowing cyan status ring
      tone(new CylinderGeometry(0.185, 0.185, 0.035, 22).translate(0, 0.33, 0), COLORS.rim),
      // Lower actuator knuckle hub
      tone(new CylinderGeometry(0.08, 0.11, 0.1, 18).translate(0, 0.28, 0), COLORS.steelDark),
      // Hazard yellow caution ring
      tone(new CylinderGeometry(0.165, 0.165, 0.02, 22).translate(0, 0.46, 0), COLORS.hazard),
   ];
   // Articulated robotic gripper fingers with bevelled pads
   for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      const g = new RoundedBoxGeometry(0.055, 0.24, 0.075, 1, 0.012)
         .translate(0, -0.12, 0)
         .rotateX(-0.35)
         .rotateY(a)
         .translate(Math.sin(a) * 0.1, 0.26, Math.cos(a) * 0.1);
      parts.push(tone(g, COLORS.steel));
      // Gripper contact pad
      const pad = new BoxGeometry(0.04, 0.12, 0.02)
         .translate(0, -0.12, -0.04)
         .rotateX(-0.35)
         .rotateY(a)
         .translate(Math.sin(a) * 0.1, 0.26, Math.cos(a) * 0.1);
      parts.push(tone(pad, COLORS.steelDark));
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
               <meshStandardMaterial color={COLORS.steel} roughness={0.38} metalness={0.5} />
            </mesh>
         </group>
         <group ref={trolley}>
            <mesh>
               <boxGeometry args={[0.26, 0.12, 0.26]} />
               <meshStandardMaterial color={COLORS.steelMid} roughness={0.42} metalness={0.45} />
            </mesh>
         </group>
         <group ref={head}>
            <mesh geometry={geometry}>
               <meshStandardMaterial vertexColors roughness={0.35} metalness={0.48} />
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
            <boxGeometry args={[0.62, 0.16, 0.06]} />
            <meshStandardMaterial color={COLORS.hazard} roughness={0.45} metalness={0.3} />
         </mesh>
         <mesh position={[0, 0.02, -0.25]}>
            <boxGeometry args={[0.07, 0.07, 0.5]} />
            <meshStandardMaterial color={COLORS.steelMid} roughness={0.45} metalness={0.45} />
         </mesh>
      </group>
   );
}

function DoorPrimitive() {
   return (
      <group>
         <mesh position={[0, DOOR.height / 2, 0]}>
            <boxGeometry args={[DOOR.width, DOOR.height, DOOR.depth]} />
            <meshStandardMaterial color={COLORS.steelMid} roughness={0.45} metalness={0.4} />
         </mesh>
         <mesh position={[0, DOOR.height * 0.62, DOOR.depth / 2 + 0.005]}>
            <planeGeometry args={[DOOR.width * 0.6, 0.22]} />
            <meshBasicMaterial color={COLORS.rim} toneMapped={false} />
         </mesh>
         <mesh position={[0, DOOR.height * 0.15, DOOR.depth / 2 + 0.005]}>
            <planeGeometry args={[DOOR.width * 0.8, 0.08]} />
            <meshBasicMaterial color={COLORS.hazard} toneMapped={false} />
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
