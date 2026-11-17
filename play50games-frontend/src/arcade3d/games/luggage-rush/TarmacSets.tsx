"use client";

// Each level's airport (README "Levels"): a departures board on the north wall's transom (in view
// on every screen), and outside the north window the level's apron: two airliners at their gates
// (Two Destinations), four (Four Destinations), four under blinking night lights with a tug convoy
// (Rush Hour), five widebodies, a control tower and a row of flags (International Hub). Level 1 is
// today's hall. Everything outside stands beyond the window (z <= -5), behind the play area.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { InstancedModel } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useCanvasTexture } from "@/arcade3d/core/render";
import type { LevelId } from "@/arcade3d/types";
import { ASSETS } from "./assets";
import { FLIGHTS } from "./rules";

/** Parked airliners (x, z, turn, size: 1 = the bay's 3.2 m plane). */
export const GATE_PLANES: Record<LevelId, ReadonlyArray<{ x: number; y: number; z: number; rotY: number; scale: number }>> = {
   1: [],
   2: [
      { x: 2, y: 0, z: -11, rotY: 0, scale: 2.4 },
      { x: 13, y: 0, z: -11, rotY: 0, scale: 2.4 },
   ],
   3: [-3, 4, 11, 18].map((x) => ({ x, y: 0, z: -12, rotY: 0, scale: 2.1 })),
   4: [-3, 4, 11, 18].map((x, i) => ({ x, y: 0, z: -12 - (i % 2) * 2, rotY: 0.15 * (i % 2 ? 1 : -1), scale: 2.1 })),
   5: [-6, 1.5, 9, 16.5, 24].map((x) => ({ x, y: 0, z: -14, rotY: 0, scale: 3 })),
};

const DEST: Record<LevelId, string[]> = {
   1: [],
   2: ["LONDON", "PARIS"],
   3: ["LONDON", "PARIS", "ROME", "OSLO"],
   4: ["LONDON  DELAYED", "PARIS  BOARDING", "ROME  LAST CALL", "OSLO  BOARDING"],
   5: ["NEW YORK", "TOKYO", "DUBAI", "SYDNEY"],
};

/** The departures board over the north window: one line per flight, in the flight's colour. */
function DeparturesBoard({ levelId }: { levelId: LevelId }) {
   const tex = useCanvasTexture(1024, 160, (ctx) => {
      ctx.fillStyle = "#0b1220";
      ctx.fillRect(0, 0, 1024, 160);
      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 40px monospace";
      ctx.textAlign = "left";
      ctx.fillText(levelId === 5 ? "INTERNATIONAL DEPARTURES" : "DEPARTURES", 20, 46);
      const lines = DEST[levelId];
      lines.forEach((d, i) => {
         const col = i % 2;
         const row = Math.floor(i / 2);
         const x = 20 + col * 500;
         const y = 96 + row * 44;
         ctx.fillStyle = FLIGHTS[i % FLIGHTS.length].color;
         ctx.fillRect(x, y - 26, 26, 26);
         ctx.fillStyle = "#f8fafc";
         ctx.font = "bold 32px monospace";
         ctx.fillText(d, x + 40, y);
      });
   });
   return (
      <mesh position={[7, 5.15, -2.33]} name="departures-board">
         <planeGeometry args={[7.2, 1.12]} />
         <meshStandardMaterial map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.85} toneMapped={false} />
      </mesh>
   );
}

const BAND: Record<LevelId, string> = {
   1: "",
   2: "GATE A  LONDON          GATE B  PARIS",
   3: "GATES A-D   LONDON  PARIS  ROME  OSLO",
   4: "RUSH HOUR   ALL GATES BOARDING   KEEP BAGS MOVING",
   5: "INTERNATIONAL HUB   NEW YORK  TOKYO  DUBAI  SYDNEY",
};

/** A gate band along the west wall's hall face, under the old signs: in view on every screen. */
function WallBand({ levelId }: { levelId: LevelId }) {
   const tex = useCanvasTexture(2048, 96, (ctx) => {
      ctx.fillStyle = levelId === 4 ? "#7f1d1d" : levelId === 5 ? "#1e1b4b" : "#0f172a";
      ctx.fillRect(0, 0, 2048, 96);
      FLIGHTS.forEach((f, i) => {
         ctx.fillStyle = f.color;
         ctx.fillRect(12 + i * 26, 30, 18, 36);
      });
      ctx.fillStyle = levelId === 4 ? "#fde68a" : "#f8fafc";
      ctx.font = "bold 58px sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText(BAND[levelId], 140, 50);
   });
   return (
      <mesh position={[-1.71, 2.45, 7.5]} rotation-y={Math.PI / 2} name="gate-band">
         <planeGeometry args={[13, 0.6]} />
         <meshStandardMaterial map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.7} toneMapped={false} />
      </mesh>
   );
}

/** A painted floor sign east of the belts (flat, so it hides nothing): the level's gate count or theme. */
function FloorMark({ levelId }: { levelId: LevelId }) {
   const tex = useCanvasTexture(512, 512, (ctx) => {
      ctx.clearRect(0, 0, 512, 512);
      ctx.globalAlpha = 0.75;
      const ring = levelId === 4 ? "#ef4444" : levelId === 5 ? "#a78bfa" : "#38bdf8";
      ctx.strokeStyle = ring;
      ctx.lineWidth = 26;
      ctx.beginPath();
      ctx.arc(256, 256, 220, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = ring;
      ctx.font = "bold 150px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(levelId === 2 ? "2" : levelId === 3 ? "4" : levelId === 4 ? "RUSH" : "HUB", 256, 270);
   });
   return (
      <mesh position={[9.9, 0.02, 7]} rotation-x={-Math.PI / 2} name="floor-mark">
         <planeGeometry args={[3, 3]} />
         <meshStandardMaterial map={tex} transparent depthWrite={false} roughness={0.8} />
      </mesh>
   );
}

/** Rush Hour: red and white apron beacons blinking along the stands. */
function Beacons() {
   const group = useRef<Group>(null);
   const time = useGameTime();
   const spots = useMemo(() => [-6, 0, 6, 12, 18, 24].map((x, i) => ({ x, red: i % 2 === 0 })), []);
   useFrame(() => {
      const g = group.current;
      if (!g) return;
      const on = Math.floor(time.now * 2) % 2 === 0;
      g.children.forEach((c, i) => {
         c.visible = spots[i].red ? on : !on;
      });
   });
   return (
      <group ref={group} name="apron-beacons">
         {spots.map((s) => (
            <mesh key={s.x} position={[s.x, 0.6, -8]}>
               <sphereGeometry args={[0.18, 10, 8]} />
               <meshBasicMaterial color={s.red ? "#ef4444" : "#f8fafc"} toneMapped={false} />
            </mesh>
         ))}
      </group>
   );
}

/** International Hub: the control tower and a row of flags on the apron edge. */
function Hub() {
   const flags = ["#dc2626", "#2563eb", "#16a34a", "#f59e0b", "#7c3aed", "#0891b2"];
   return (
      <group name="hub">
         <group position={[30, 0, -18]} name="control-tower">
            <mesh position={[0, 6, 0]}><cylinderGeometry args={[0.9, 1.3, 12, 16]} /><meshStandardMaterial color="#e2e8f0" roughness={0.7} /></mesh>
            <mesh position={[0, 12.8, 0]}><cylinderGeometry args={[2.2, 1.6, 1.6, 12]} /><meshStandardMaterial color="#38bdf8" roughness={0.2} metalness={0.4} emissive="#0ea5e9" emissiveIntensity={0.5} /></mesh>
            <mesh position={[0, 13.9, 0]}><cylinderGeometry args={[2.4, 2.4, 0.4, 12]} /><meshStandardMaterial color="#334155" /></mesh>
         </group>
         {flags.map((c, i) => (
            <group key={c} position={[-4 + i * 4, 0, -6.5]}>
               <mesh position={[0, 1.6, 0]}><cylinderGeometry args={[0.04, 0.05, 3.2, 8]} /><meshStandardMaterial color="#cbd5e1" metalness={0.5} /></mesh>
               <mesh position={[0.45, 2.85, 0]}><boxGeometry args={[0.9, 0.55, 0.02]} /><meshStandardMaterial color={c} roughness={0.8} /></mesh>
            </group>
         ))}
      </group>
   );
}

export function TarmacSets({ levelId }: { levelId: LevelId }) {
   const planes = GATE_PLANES[levelId];
   return (
      <group name={`tarmac-set-${levelId}`}>
         {levelId > 1 && <DeparturesBoard levelId={levelId} />}
         {levelId > 1 && <WallBand levelId={levelId} />}
         {levelId > 1 && <FloorMark levelId={levelId} />}
         {planes.length > 0 && <InstancedModel asset={ASSETS.plane} spots={planes} fallback={null} />}
         {levelId === 4 && <Beacons />}
         {levelId === 5 && <Hub />}
      </group>
   );
}
