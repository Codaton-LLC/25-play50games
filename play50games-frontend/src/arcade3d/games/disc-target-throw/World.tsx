"use client";

// The ruin courtyard: a sandstone flagstone floor, carved walls with a jade inlay and a moss trim, the
// stone bank columns (m2StoneColumn), the palisade (m2PalisadeWall), Vexa's ghost walls, the training
// pavilion out past the north wall, the jungle round the yard (grey until targets break: World 3's
// colour comes back as you clear), the canal and its raft on level 4, the thorn zone, torches on the
// evening levels and a sky dome per level. Static props are instanced; the jungle's colour is one
// material lerped by the cleared fraction.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CanvasTexture, Color, RepeatWrapping, SRGBColorSpace, type Mesh, type MeshStandardMaterial } from "three";
import { InstancedModel, Model } from "@/arcade3d/core/assets";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { SkyDome } from "@/arcade3d/core/env";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, COLUMN_H, GLB_SIZE, PAVILION_SCALE, columnScale } from "./assets";
import { WALL_H, YARD, type Course } from "./course";
import { COLORS, levelLook } from "./look";
import { thornsBursting, type DiscRun } from "./rules";

function flagstoneTexture(): CanvasTexture | null {
   if (typeof document === "undefined") return null;
   const c = document.createElement("canvas");
   c.width = 256;
   c.height = 256;
   const g = c.getContext("2d");
   if (!g) return null;
   g.fillStyle = COLORS.grout;
   g.fillRect(0, 0, 256, 256);
   const n = 4;
   const s = 256 / n;
   for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
         const v = Math.imul(i * 7 + j * 13 + 5, 2654435761) >>> 0;
         const shade = 185 + (v % 28);
         g.fillStyle = `rgb(${shade + 18}, ${shade + 4}, ${shade - 40})`;
         const off = (i % 2) * (s / 2);
         g.fillRect(((j * s + off) % 256) + 3, i * s + 3, s - 6, s - 6);
      }
   }
   for (let k = 0; k < 500; k++) {
      const v = Math.imul(k + 3, 2246822519) >>> 0;
      g.fillStyle = v % 4 === 0 ? "rgba(70,110,60,0.22)" : "rgba(60,40,20,0.08)";
      g.fillRect(v % 256, (v >>> 9) % 256, 2, 2);
   }
   const t = new CanvasTexture(c);
   t.wrapS = RepeatWrapping;
   t.wrapT = RepeatWrapping;
   t.repeat.set(11, 11);
   t.colorSpace = SRGBColorSpace;
   return t;
}

function Floor() {
   const tex = useMemo(flagstoneTexture, []);
   useEffect(() => () => tex?.dispose(), [tex]);
   const w = YARD.maxX - YARD.minX;
   const d = YARD.maxZ - YARD.minZ;
   return (
      <group>
         {/* the jungle floor out to the horizon */}
         <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, -5]}>
            <circleGeometry args={[110, 40]} />
            <meshStandardMaterial color="#5f7a52" roughness={1} />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[(YARD.minX + YARD.maxX) / 2, 0.005, (YARD.minZ + YARD.maxZ) / 2]} receiveShadow>
            <planeGeometry args={[w, d]} />
            <meshStandardMaterial map={tex ?? undefined} color={tex ? "#ffffff" : COLORS.flag} roughness={0.92} />
         </mesh>
      </group>
   );
}

/** The walls: the perimeter boxes as carved sandstone with a jade inlay band and a moss cap. */
function Walls({ course }: { course: Course }) {
   const { stone, inlay, cap } = useMemo(() => {
      const stone: InstanceSpot[] = [];
      const inlay: InstanceSpot[] = [];
      const cap: InstanceSpot[] = [];
      for (const b of course.boxes) {
         if (b.kind !== "stone") continue;
         const cx = (b.minX + b.maxX) / 2;
         const cz = (b.minZ + b.maxZ) / 2;
         const sx = b.maxX - b.minX;
         const sz = b.maxZ - b.minZ;
         stone.push({ x: cx, y: b.h / 2, z: cz, sx, sy: b.h, sz });
         inlay.push({ x: cx, y: Math.min(1.15, b.h * 0.55), z: cz, sx: sx + 0.06, sy: 0.18, sz: sz + 0.06 });
         cap.push({ x: cx, y: b.h + 0.08, z: cz, sx: sx + 0.18, sy: 0.16, sz: sz + 0.18 });
      }
      return { stone, inlay, cap };
   }, [course]);
   return (
      <group name="walls">
         <Instanced spots={stone}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.sand} roughness={0.9} />
         </Instanced>
         <Instanced spots={inlay}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.jade} emissive={COLORS.jade} emissiveIntensity={0.25} roughness={0.5} />
         </Instanced>
         <Instanced spots={cap}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.sandDark} roughness={0.95} />
         </Instanced>
      </group>
   );
}

/** The palisade (wood: stops the disc) and Vexa's ghost walls (translucent violet stone). */
function Barriers({ course }: { course: Course }) {
   const { logs, ghosts } = useMemo(() => {
      const logs: InstanceSpot[] = [];
      const ghosts: InstanceSpot[] = [];
      for (const b of course.boxes) {
         const sx = b.maxX - b.minX;
         const sz = b.maxZ - b.minZ;
         if (b.kind === "wood") {
            const along = sx >= sz;
            const len = along ? sx : sz;
            const n = Math.max(1, Math.round(len / 1.9));
            for (let k = 0; k < n; k++) {
               const t = (k + 0.5) / n;
               logs.push({
                  x: along ? b.minX + sx * t : (b.minX + b.maxX) / 2,
                  y: 0,
                  z: along ? (b.minZ + b.maxZ) / 2 : b.minZ + sz * t,
                  rotY: along ? 0 : Math.PI / 2,
                  sx: len / n / GLB_SIZE.palisade.x,
                  sy: b.h / GLB_SIZE.palisade.y,
                  sz: (along ? sz : sx) / GLB_SIZE.palisade.z,
               });
            }
         } else if (b.kind === "ghost") ghosts.push({ x: (b.minX + b.maxX) / 2, y: b.h / 2, z: (b.minZ + b.maxZ) / 2, sx, sy: b.h, sz });
      }
      return { logs, ghosts };
   }, [course]);
   return (
      <group name="barriers">
         {logs.length > 0 && (
            <InstancedModel
               asset={ASSETS.palisade}
               spots={logs}
               fallback={
                  <Instanced spots={logs.map((s) => ({ ...s, y: (s.sy ?? 1) * GLB_SIZE.palisade.y * 0.5, sx: (s.sx ?? 1) * GLB_SIZE.palisade.x, sy: (s.sy ?? 1) * GLB_SIZE.palisade.y, sz: (s.sz ?? 1) * GLB_SIZE.palisade.z }))}>
                     <boxGeometry args={[1, 1, 1]} />
                     <meshStandardMaterial color={COLORS.wood} roughness={0.9} />
                  </Instanced>
               }
            />
         )}
         {ghosts.length > 0 && (
            <Instanced spots={ghosts}>
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial color={COLORS.ghost} emissive={COLORS.ghost} emissiveIntensity={0.35} transparent opacity={0.42} depthWrite={false} roughness={0.4} />
            </Instanced>
         )}
      </group>
   );
}

function Columns({ course }: { course: Course }) {
   const spots = useMemo<InstanceSpot[]>(() => course.columns.map((c, i) => {
      const [sx, sy, sz] = columnScale(c.r);
      return { x: c.x, y: 0, z: c.z, rotY: i * 1.3, sx, sy, sz };
   }), [course]);
   const fallback = useMemo(() => course.columns.map((c) => ({ x: c.x, y: COLUMN_H / 2, z: c.z, sx: 2 * c.r, sy: COLUMN_H, sz: 2 * c.r })), [course]);
   return (
      <InstancedModel
         asset={ASSETS.column}
         spots={spots}
         fallback={
            <Instanced spots={fallback}>
               <cylinderGeometry args={[0.5, 0.55, 1, 12]} />
               <meshStandardMaterial color={COLORS.sand} roughness={0.85} />
            </Instanced>
         }
      />
   );
}

/** Trees round the courtyard (outside the walls): grey until the targets break, then green again. */
function Jungle({ run }: { run: DiscRun }) {
   const look = levelLook(run.level);
   const grey = useMemo(() => new Color(look.leafGrey), [look.leafGrey]);
   const green = useMemo(() => new Color(look.leafGreen), [look.leafGreen]);
   const mat = useRef<MeshStandardMaterial>(null);
   const { trunks, crowns } = useMemo(() => {
      const trunks: InstanceSpot[] = [];
      const crowns: InstanceSpot[] = [];
      let k = 0;
      const add = (x: number, z: number) => {
         const v = Math.imul(k++ + 17, 2654435761) >>> 0;
         const s = 0.8 + (v % 50) / 100;
         trunks.push({ x, y: 1.6 * s, z, sx: 0.35 * s, sy: 3.2 * s, sz: 0.35 * s });
         crowns.push({ x, y: 4.2 * s, z, sx: 2.2 * s, sy: 2.6 * s, sz: 2.2 * s, rotY: v % 7 });
         crowns.push({ x: x + 0.6 * s, y: 3.3 * s, z: z - 0.4 * s, sx: 1.6 * s, sy: 1.8 * s, sz: 1.6 * s });
      };
      for (let x = -16; x <= 16; x += 4) {
         add(x + ((k * 37) % 3) - 1, YARD.minZ - 4 - (k % 3) * 2);
         add(x + ((k * 29) % 3) - 1, YARD.minZ - 11 - (k % 2) * 3);
      }
      for (let z = -14; z <= 10; z += 4) {
         add(YARD.minX - 4 - (k % 3), z);
         add(YARD.maxX + 4 + (k % 3), z);
         add(YARD.minX - 10 - (k % 2) * 2, z + 2);
         add(YARD.maxX + 10 + (k % 2) * 2, z + 2);
      }
      return { trunks, crowns };
   }, []);
   useFrame(() => {
      const m = mat.current;
      if (!m) return;
      const c = run.course;
      const total = c.boss ? 9 : Math.max(1, c.required);
      const done = c.boss ? 9 - (run.boss?.hp ?? 9) : run.required;
      m.color.copy(grey).lerp(green, Math.min(1, done / total));
   });
   return (
      <group name="jungle">
         <Instanced spots={trunks}>
            <cylinderGeometry args={[0.4, 0.55, 1, 7]} />
            <meshStandardMaterial color="#5a4632" roughness={1} />
         </Instanced>
         <Instanced spots={crowns}>
            <icosahedronGeometry args={[0.5, 1]} />
            <meshStandardMaterial ref={mat} color={look.leafGrey} roughness={0.95} flatShading />
         </Instanced>
      </group>
   );
}

/** The canal across the south of the yard (level 4): the raft drifts along it. */
function Canal() {
   return (
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 3]}>
         <planeGeometry args={[YARD.maxX - YARD.minX, 4.4]} />
         <meshStandardMaterial color={COLORS.water} roughness={0.2} metalness={0.15} transparent opacity={0.92} />
      </mesh>
   );
}

/** Kiro's thorn zone: a ring of dark thorns that flares orange while it bursts. */
function Thorns({ run }: { run: DiscRun }) {
   const th = run.course.thorns;
   const time = useGameTime();
   const disc = useRef<Mesh>(null);
   const spikes = useMemo<InstanceSpot[]>(() => {
      if (!th) return [];
      const out: InstanceSpot[] = [];
      for (let i = 0; i < 14; i++) {
         const a = (i / 14) * Math.PI * 2;
         out.push({ x: th.x + Math.cos(a) * th.r * 0.85, y: 0.25, z: th.z + Math.sin(a) * th.r * 0.85, rotY: a, sx: 0.18, sy: 0.5, sz: 0.18 });
      }
      return out;
   }, [th]);
   useFrame(() => {
      const m = disc.current;
      if (!m || !th) return;
      const hot = thornsBursting(run.course, run.simMs);
      const warn = !hot && run.simMs % th.periodMs > th.periodMs - 700;
      const mat = m.material as MeshStandardMaterial;
      mat.emissiveIntensity = hot ? 1.4 : warn ? 0.4 + 0.3 * Math.sin(time.now * 30) : 0.05;
      m.scale.setScalar(hot ? 1.05 : 1);
   });
   if (!th) return null;
   return (
      <group name="thorns">
         <mesh ref={disc} rotation-x={-Math.PI / 2} position={[th.x, 0.03, th.z]}>
            <circleGeometry args={[th.r, 32]} />
            <meshStandardMaterial color={COLORS.thorn} emissive={COLORS.thornHot} emissiveIntensity={0.05} transparent opacity={0.85} depthWrite={false} />
         </mesh>
         <Instanced spots={spikes}>
            <coneGeometry args={[0.5, 1, 5]} />
            <meshStandardMaterial color="#3f1d0e" roughness={0.8} />
         </Instanced>
      </group>
   );
}

/** Torches on the wall tops (evening and the storm). */
function Torches() {
   const spots = useMemo<InstanceSpot[]>(() => {
      const out: InstanceSpot[] = [];
      for (let x = -9; x <= 9; x += 6) out.push({ x, y: WALL_H + 0.45, z: YARD.minZ - 0.5 });
      for (let z = -12; z <= 3; z += 5) {
         out.push({ x: YARD.minX - 0.5, y: WALL_H + 0.45, z });
         out.push({ x: YARD.maxX + 0.5, y: WALL_H + 0.45, z });
      }
      return out;
   }, []);
   return (
      <group name="torches">
         <Instanced spots={spots.map((s) => ({ ...s, y: WALL_H + 0.2, sx: 0.12, sy: 0.5, sz: 0.12 }))}>
            <cylinderGeometry args={[0.5, 0.5, 1, 6]} />
            <meshStandardMaterial color="#3b2a1a" />
         </Instanced>
         <Instanced spots={spots.map((s) => ({ ...s, scale: 0.22 }))}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshBasicMaterial color="#ffb347" toneMapped={false} />
         </Instanced>
      </group>
   );
}

export default function World({ run }: { run: DiscRun }) {
   const c = run.course;
   const look = levelLook(run.level);
   const sky = run.level === 4 ? { top: "#0b1630", bottom: "#3b4f78" } : run.level === 3 ? { top: "#5b8fd0", bottom: "#ffcf8f" } : run.level === 5 ? { top: "#3f4955", bottom: "#a3aab0" } : { top: "#79b8e6", bottom: "#e4efe6" };
   return (
      <group name="courtyard">
         <SkyDome top={sky.top} bottom={sky.bottom} />
         <Floor />
         <Walls course={c} />
         <Barriers course={c} />
         <Columns course={c} />
         <Jungle run={run} />
         <Thorns run={run} />
         {c.raft ? <Canal /> : null}
         {look.torches ? <Torches /> : null}
         <Model asset={ASSETS.pavilion} position={[0, 0, YARD.minZ - 8]} scale={PAVILION_SCALE} />
      </group>
   );
}
