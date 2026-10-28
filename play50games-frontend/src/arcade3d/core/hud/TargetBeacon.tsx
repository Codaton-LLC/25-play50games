"use client";

// An in-world marker over the CURRENT target: a bobbing down arrow and a soft pulsing ring on the
// ground, in the game's accent colour, for the on-screen case TargetMarkers leaves out (its arrows only
// point at targets off screen). Render it inside the Scene, one per current target:
//
//    const next = useRef({ x: 0, y: 0.8, z: 0, hidden: true }).current;  // mutated by the game
//    <TargetBeacon target={next} variant="pick" color={COLORS.accent} label="1" />
//    <TargetBeacon target={bay} variant="drop-here" radius={2.2} />
//    <TargetBeacon target={vent} variant="danger" />
//
// - `target` ({ x, y, z, hidden? }) is read every frame (move it in place); y is the item's height
//   (the arrow tip sits `height` m above it), the ring lies at `ground`.
// - Variants: "pick" (arrow + ring pulsing out), "drop-here" (arrow + disc + ring pulsing in: land
//   here), "danger" (red disc + fast ring, no arrow: keep away). Colours default per variant.
// - Readable from every camera view (core/camera): the arrow is a cone (the same from any yaw), drawn
//   over walls (no depth test) with a dark rim, and grows with the camera distance so it never gets
//   smaller than BEACON_MIN_PX on screen (more on touch screens).
// - Cheap: geometries are shared by every beacon, materials by colour; nothing is allocated per frame.
//   Reduced motion: no bob, no pulse, a steady ring. Shown only while the run can be seen.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
   BackSide,
   CanvasTexture,
   CircleGeometry,
   ConeGeometry,
   CylinderGeometry,
   MeshBasicMaterial,
   PerspectiveCamera,
   RingGeometry,
   SRGBColorSpace,
   SpriteMaterial,
   Vector3,
   type BufferGeometry,
   type Group,
   type Mesh,
} from "three";
import { FRAME_PRIORITY } from "../frameLoop";
import { useGameTime } from "../gameTime";
import { useCoarsePointer } from "../TouchControls";
import { useArcadeStore } from "../useArcadeStore";
import { BEACON_MIN_PX, BEACON_STYLES, beaconLabel, beaconMotion, beaconScale, type BeaconMotion, type BeaconVariant } from "./beacon";
import { useReducedMotion } from "./useReducedMotion";

export interface BeaconTarget {
   x: number;
   y: number;
   z: number;
   /** draw nothing (no current target) */
   hidden?: boolean;
}

export interface TargetBeaconProps {
   target: BeaconTarget | null;
   variant?: BeaconVariant;
   /** CSS colour (default per variant) */
   color?: string;
   /** ring radius, m (default 0.7) */
   radius?: number;
   /** arrow tip height above target.y, m (default 0.9) */
   height?: number;
   /** ring height, m (default 0.03) */
   ground?: number;
   /** a short text over the arrow: a number, a name */
   label?: string | number | null;
   /** no ground ring (a target in the air) */
   noRing?: boolean;
}

// ---------- shared geometry (every beacon) ----------

let shared: { cone: BufferGeometry; rim: BufferGeometry; stem: BufferGeometry; ring: BufferGeometry; disc: BufferGeometry } | null = null;

function geometries() {
   if (shared) return shared;
   // the arrow points down with its tip at the group origin: cone 0.36 m, stem 0.26 m (BEACON_ARROW_SIZE)
   const cone = new ConeGeometry(0.2, 0.36, 14).rotateX(Math.PI).translate(0, 0.18, 0);
   const rim = new ConeGeometry(0.25, 0.46, 14).rotateX(Math.PI).translate(0, 0.19, 0);
   const stem = new CylinderGeometry(0.07, 0.07, 0.28, 10).translate(0, 0.36 + 0.13, 0);
   const ring = new RingGeometry(0.8, 1, 48).rotateX(-Math.PI / 2);
   const disc = new CircleGeometry(0.8, 40).rotateX(-Math.PI / 2);
   shared = { cone, rim, stem, ring, disc };
   return shared;
}

// ---------- shared materials (per colour and role) ----------

type Role = "arrow" | "rim" | "ring" | "pulse" | "disc";
const materials = new Map<string, MeshBasicMaterial>();

function materialFor(role: Role, color: string, variant: BeaconVariant): MeshBasicMaterial {
   const key = `${role}|${color}|${variant}`;
   let m = materials.get(key);
   if (m) return m;
   const overlay = role === "arrow" || role === "rim";
   m = new MeshBasicMaterial({
      color: role === "rim" ? "#0b1020" : color,
      transparent: true,
      opacity: role === "rim" ? 0.55 : role === "disc" ? 0.22 : role === "arrow" ? 0.96 : 0.8,
      depthWrite: false,
      depthTest: !overlay,
      toneMapped: false,
      side: role === "rim" ? BackSide : undefined,
      polygonOffset: !overlay,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
   });
   materials.set(key, m);
   return m;
}

/** A pill with the label, drawn once per label text (disposed when it changes). */
function labelTexture(text: string, color: string): CanvasTexture | null {
   if (!text || typeof document === "undefined") return null;
   const canvas = document.createElement("canvas");
   canvas.width = 256;
   canvas.height = 112;
   const ctx = canvas.getContext("2d");
   if (!ctx) return null;
   ctx.fillStyle = "rgba(11,16,32,0.86)";
   ctx.strokeStyle = color;
   ctx.lineWidth = 8;
   ctx.beginPath();
   ctx.roundRect?.(8, 8, 240, 96, 44);
   ctx.fill();
   ctx.stroke();
   ctx.fillStyle = "#ffffff";
   ctx.font = `800 ${text.length > 6 ? 40 : 58}px system-ui, sans-serif`;
   ctx.textAlign = "center";
   ctx.textBaseline = "middle";
   ctx.fillText(text, 128, 60);
   const map = new CanvasTexture(canvas);
   map.colorSpace = SRGBColorSpace;
   return map;
}

const V = new Vector3();

export function TargetBeacon({ target, variant = "pick", color, radius = 0.7, height = 0.9, ground = 0.03, label = null, noRing = false }: TargetBeaconProps) {
   const style = BEACON_STYLES[variant];
   const tint = color ?? style.color;
   const g = geometries();
   const mats = useMemo(
      () => ({
         arrow: materialFor("arrow", tint, variant),
         rim: materialFor("rim", tint, variant),
         ring: materialFor("ring", tint, variant),
         pulse: materialFor("pulse", tint, variant),
         disc: materialFor("disc", tint, variant),
      }),
      [tint, variant]
   );
   const text = beaconLabel(label);
   const labelMat = useMemo(() => {
      const map = labelTexture(text, tint);
      return map ? new SpriteMaterial({ map, depthTest: false, depthWrite: false, transparent: true, toneMapped: false }) : null;
   }, [text, tint]);
   useEffect(
      () => () => {
         labelMat?.map?.dispose();
         labelMat?.dispose();
      },
      [labelMat]
   );

   const time = useGameTime();
   const camera = useThree((s) => s.camera);
   const viewport = useThree((s) => s.size.height);
   const coarse = useCoarsePointer();
   const reduced = useReducedMotion();
   const root = useRef<Group>(null);
   const arrow = useRef<Group>(null);
   const ring = useRef<Group>(null);
   const pulse = useRef<Mesh>(null);
   const motion = useRef<BeaconMotion>({ bob: 0, pulse: 1, pulseOpacity: 0, ringOpacity: 1 }).current;
   const live = useRef({ target, radius, height, ground, reduced, coarse, viewport });
   live.current = { target, radius, height, ground, reduced, coarse, viewport };

   useFrame(() => {
      const r = root.current;
      if (!r) return;
      const { target: t, radius: rad, height: h, ground: gy, reduced: still, coarse: touch, viewport: vh } = live.current;
      const phase = useArcadeStore.getState().phase;
      const on = !!t && !t.hidden && (phase === "countdown" || phase === "playing" || phase === "paused");
      if (r.visible !== on) r.visible = on;
      if (!on || !t) return;
      beaconMotion(time.now, variant, still, motion);
      V.set(t.x, t.y + h, t.z);
      const fov = camera instanceof PerspectiveCamera ? camera.fov : 0;
      const s = beaconScale(camera.position.distanceTo(V), fov, vh, touch ? BEACON_MIN_PX.coarse : BEACON_MIN_PX.fine);
      const a = arrow.current;
      if (a) {
         a.position.set(t.x, t.y + h + Math.max(0, motion.bob) * s, t.z);
         a.scale.setScalar(s);
      }
      const ringGroup = ring.current;
      if (ringGroup) {
         ringGroup.position.set(t.x, gy, t.z);
         ringGroup.scale.setScalar(rad * (1 + (s - 1) * 0.3));
      }
      if (pulse.current) pulse.current.scale.setScalar(motion.pulse);
      mats.pulse.opacity = motion.pulseOpacity;
      mats.ring.opacity = motion.ringOpacity;
   }, FRAME_PRIORITY.visuals);

   return (
      <group ref={root} visible={false}>
         {!noRing && (
            <group ref={ring}>
               <mesh geometry={g.ring} material={mats.ring} renderOrder={2} />
               <mesh ref={pulse} geometry={g.ring} material={mats.pulse} renderOrder={2} />
               {style.disc && <mesh geometry={g.disc} material={mats.disc} renderOrder={1} />}
            </group>
         )}
         {style.arrow && (
            <group ref={arrow}>
               <mesh geometry={g.rim} material={mats.rim} renderOrder={20} />
               <mesh geometry={g.cone} material={mats.arrow} renderOrder={21} />
               <mesh geometry={g.stem} material={mats.arrow} renderOrder={21} />
               {labelMat && <sprite material={labelMat} position={[0, 0.95, 0]} scale={[0.8, 0.35, 1]} renderOrder={22} />}
            </group>
         )}
         {!style.arrow && labelMat && (
            <group ref={arrow}>
               <sprite material={labelMat} position={[0, 0.2, 0]} scale={[0.8, 0.35, 1]} renderOrder={22} />
            </group>
         )}
      </group>
   );
}
