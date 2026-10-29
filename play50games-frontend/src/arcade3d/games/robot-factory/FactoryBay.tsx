"use client";

// The level's own bay (factorySets.ts): screen faces over the four wall screens (seen on every
// screen size, phones included), the back-floor props, an accent light, and on Overdrive the turning
// red beacons and the sparks off the wall. Code-built, bevelled, two-tone; allocation-free per frame.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useCanvasTexture } from "@/arcade3d/core/render";
import type { LevelId } from "@/arcade3d/types";
import { COLORS, decorOf } from "./looks";
import { FACTORY_PROPS, FACTORY_THEMES, SPARK_SPOTS, type FactoryTheme, type PropSpot } from "./factorySets";

const PARTS = COLORS.parts;

function drawScreen(kind: FactoryTheme["screen"], ctx: CanvasRenderingContext2D, w: number, h: number): void {
   ctx.fillStyle = kind === "alarm" ? "#450a0a" : "#020617";
   ctx.fillRect(0, 0, w, h);
   if (kind === "shapes") {
      // the four part shapes, one per colour
      const cx = [40, 104, 168, 232];
      ctx.lineWidth = 6;
      cx.forEach((x, i) => {
         ctx.strokeStyle = PARTS[i];
         ctx.fillStyle = PARTS[i] + "55";
         ctx.beginPath();
         if (i === 0) ctx.rect(x - 22, 46, 44, 44);
         else if (i === 1) { ctx.moveTo(x, 42); ctx.lineTo(x + 25, 92); ctx.lineTo(x - 25, 92); ctx.closePath(); }
         else if (i === 2) ctx.arc(x, 68, 24, 0, Math.PI * 2);
         else { ctx.moveTo(x - 24, 68); ctx.lineTo(x, 44); ctx.lineTo(x + 24, 68); ctx.lineTo(x, 92); ctx.closePath(); }
         ctx.fill();
         ctx.stroke();
      });
   } else if (kind === "swatches") {
      PARTS.forEach((c, i) => {
         ctx.fillStyle = c;
         ctx.fillRect(20 + i * 62, 30, 50, 76);
      });
   } else if (kind === "bins") {
      // the sort chart: four bins with arrows into them
      PARTS.forEach((c, i) => {
         ctx.fillStyle = c;
         ctx.fillRect(22 + i * 62, 80, 48, 34);
         ctx.beginPath();
         ctx.moveTo(46 + i * 62, 70);
         ctx.lineTo(34 + i * 62, 50);
         ctx.lineTo(58 + i * 62, 50);
         ctx.closePath();
         ctx.fill();
      });
      ctx.fillStyle = "#34d399";
      ctx.font = "bold 26px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("SORT >>>", 136, 34);
   } else if (kind === "alarm") {
      ctx.fillStyle = "#ef4444";
      ctx.font = "bold 40px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("OVERDRIVE", 136, 70);
      ctx.fillStyle = "#fbbf24";
      for (let i = 0; i < 9; i++) ctx.fillRect(i * 32, 104, 16, 18);
   }
}

/** One face per wall screen (decorOf("screen")), drawn just in front of the screen's panel. */
function ScreenFaces({ kind }: { kind: FactoryTheme["screen"] }) {
   const tex = useCanvasTexture(272, 136, (ctx, w, h) => drawScreen(kind, ctx, w, h));
   const screens = decorOf("screen");
   return (
      <group name="level-screens">
         {screens.map((s, i) => (
            <mesh key={i} position={[s.x, s.y, s.z + 0.065]} rotation-y={s.rotY ?? 0} scale={[(s.sx ?? 1) / 1.3, (s.sy ?? 1) / 0.8, 1]}>
               <planeGeometry args={[1.18, 0.66]} />
               <meshStandardMaterial map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.9} toneMapped={false} />
            </mesh>
         ))}
      </group>
   );
}

function Prop({ spot }: { spot: PropSpot }) {
   const tone = spot.tone >= 0 ? PARTS[spot.tone] : COLORS.steel;
   const base = <mesh position={[0, 0.05, 0]}><boxGeometry args={[spot.hw * 2, 0.1, spot.hd * 2]} /><meshStandardMaterial color={COLORS.steelDark} roughness={0.7} /></mesh>;
   const body = (() => {
      const h = spot.h - 0.1;
      switch (spot.kind) {
         case "shapeCube":
            return <mesh position={[0, 0.1 + h / 2, 0]}><boxGeometry args={[h * 0.9, h, h * 0.9]} /><meshStandardMaterial color={tone} roughness={0.45} /></mesh>;
         case "shapeCone":
            return <mesh position={[0, 0.1 + h / 2, 0]}><coneGeometry args={[spot.hw * 0.9, h, 24]} /><meshStandardMaterial color={tone} roughness={0.45} /></mesh>;
         case "shapeBall":
            return <mesh position={[0, 0.1 + h / 2, 0]}><sphereGeometry args={[h / 2, 24, 16]} /><meshStandardMaterial color={tone} roughness={0.35} /></mesh>;
         case "shapeTube":
            return <mesh position={[0, 0.1 + h / 2, 0]}><cylinderGeometry args={[spot.hw * 0.8, spot.hw * 0.8, h, 24]} /><meshStandardMaterial color={tone} roughness={0.45} /></mesh>;
         case "drum":
            return (
               <group position={[0, 0.1, 0]}>
                  <mesh position={[0, h / 2, 0]}><cylinderGeometry args={[spot.hw * 0.95, spot.hw * 0.95, h, 20]} /><meshStandardMaterial color={tone} roughness={0.5} metalness={0.3} /></mesh>
                  {[0.2, 0.8].map((k) => (
                     <mesh key={k} position={[0, h * k, 0]}><torusGeometry args={[spot.hw * 0.96, 0.025, 8, 20]} /><meshStandardMaterial color={COLORS.steelDark} /></mesh>
                  ))}
               </group>
            );
         case "rack":
            // two shelves of four coloured bins, the sort the screens chart
            return (
               <group position={[0, 0.1, 0]}>
                  {[0.35, 0.85].map((y) => (
                     <mesh key={y} position={[0, y, 0]}><boxGeometry args={[spot.hw * 2, 0.05, spot.hd * 2]} /><meshStandardMaterial color={COLORS.steel} metalness={0.4} roughness={0.5} /></mesh>
                  ))}
                  {[-1, 1].map((sx) => (
                     <mesh key={sx} position={[sx * (spot.hw - 0.04), h / 2, 0]}><boxGeometry args={[0.06, h, spot.hd * 2]} /><meshStandardMaterial color={COLORS.steelDark} /></mesh>
                  ))}
                  {[0.4, 0.9].flatMap((y) => PARTS.map((c, i) => (
                     <mesh key={`${y}${i}`} position={[-spot.hw + 0.27 + i * ((spot.hw * 2 - 0.54) / 3), y + 0.13, 0]}><boxGeometry args={[0.36, 0.24, spot.hd * 1.5]} /><meshStandardMaterial color={c} roughness={0.6} /></mesh>
                  )))}
               </group>
            );
         case "beacon":
            return <Beacon h={h} />;
      }
   })();
   return (
      <group position={[spot.x, 0, spot.z]} name={`prop-${spot.kind}`}>
         {base}
         {body}
      </group>
   );
}

/** A red warning beacon on a post: a lit dome and a turning light fin. */
function Beacon({ h }: { h: number }) {
   const fin = useRef<Group>(null);
   const time = useGameTime();
   useFrame(() => {
      if (fin.current) fin.current.rotation.y = time.now * 4;
   });
   return (
      <group position={[0, 0.1, 0]}>
         <mesh position={[0, (h - 0.2) / 2, 0]}><cylinderGeometry args={[0.04, 0.05, h - 0.2, 10]} /><meshStandardMaterial color={COLORS.steelDark} /></mesh>
         <mesh position={[0, h - 0.12, 0]}><sphereGeometry args={[0.12, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshBasicMaterial color="#ef4444" toneMapped={false} /></mesh>
         <group ref={fin} position={[0, h - 0.08, 0]}>
            <mesh position={[0.18, 0, 0]}><boxGeometry args={[0.3, 0.05, 0.02]} /><meshBasicMaterial color="#fca5a5" transparent opacity={0.7} toneMapped={false} /></mesh>
         </group>
      </group>
   );
}

/** Overdrive: sparks off the back wall now and then, and the red light pulsing. */
function Alarm() {
   const fx = useFx();
   const time = useGameTime();
   const next = useRef(0);
   const light = useRef<{ intensity: number } | null>(null);
   const at = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   useFrame(() => {
      if (light.current) light.current.intensity = 3 + 2.5 * Math.max(0, Math.sin(time.now * 5));
      if (time.now >= next.current) {
         const s = SPARK_SPOTS[Math.floor(time.now * 7) % SPARK_SPOTS.length];
         at.x = s.x; at.y = s.y; at.z = s.z;
         fx.burst("sparkle", at, 8);
         next.current = time.now + 1.4;
      }
   });
   return <pointLight ref={light as never} position={[0, 3.4, -1.6]} color="#ef4444" intensity={4} distance={10} decay={1.5} />;
}

export function FactorySets({ levelId }: { levelId: LevelId }) {
   const theme = FACTORY_THEMES[levelId];
   return (
      <group name={`factory-set-${levelId}`}>
         {theme.screen !== "telemetry" && <ScreenFaces kind={theme.screen} />}
         {FACTORY_PROPS[levelId].map((p, i) => <Prop key={i} spot={p} />)}
         {theme.accent && !theme.alarm && <pointLight position={[0, 3.3, -1.4]} color={theme.accent} intensity={3} distance={9} decay={1.5} />}
         {theme.alarm && <Alarm />}
      </group>
   );
}
