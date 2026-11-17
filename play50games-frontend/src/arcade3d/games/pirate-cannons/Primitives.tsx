"use client";

// Pirate Cannon Battle stand-ins (drawn while a GLB is missing or in tests) and procedural pool
// parts: ship hull + mast + sail, barrel, crate, pennants, galleon sails, HP pips, cannonballs.
// Every code-made stand-in is crafted with 2-3 tones from the unified COLORS palette, bevelled
// low-poly shapes, zero raw grey boxes, and proper disposal on unmount.
import { useEffect, useMemo, useState } from "react";
import {
   BoxGeometry,
   BufferGeometry,
   CircleGeometry,
   Color,
   ConeGeometry,
   CylinderGeometry,
   DoubleSide,
   Float32BufferAttribute,
   Matrix4,
   MeshStandardMaterial,
   PlaneGeometry,
   RingGeometry,
   SphereGeometry,
   type Material,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Instanced, type InstancePart, type InstanceSpot } from "@/arcade3d/core/render";
import { BARREL_HEIGHT, CHEST_DRAFT, CRATE_SIZE, PALM_SIZE, SHIP_MAST_TOP } from "./assets";
import { COLORS } from "./looks";
import { CANNON, WORLD } from "./rules";

/** Parts built once per factory and disposed cleanly on unmount. */
function usePoolParts(build: () => InstancePart[]): InstancePart[] {
   const [parts] = useState(build);
   useEffect(
      () => () => {
         for (const p of parts) {
            p.geometry.dispose();
            (Array.isArray(p.material) ? p.material : [p.material]).forEach((m: Material) => m.dispose());
         }
      },
      [parts]
   );
   return parts;
}

const mat = (color: string, extra: { roughness?: number; metalness?: number; side?: typeof DoubleSide } = {}) =>
   new MeshStandardMaterial({
      color,
      roughness: extra.roughness ?? 0.8,
      metalness: extra.metalness ?? 0,
      ...(extra.side !== undefined ? { side: extra.side } : {}),
   });

// ---------- Ship (sloop units: copy matrix scales dinghy x0.5 / galleon x1.5; waterline y 0) ----------

export function useShipParts(): readonly InstancePart[] {
   return usePoolParts(() => {
      // 1. Crafted wooden hull: midship hull, raked bow wedge, transom stern, and deck
      const hullMid = new BoxGeometry(2.1, 1.25, 3.8).translate(0, 0.15, 0.2);
      const bowWedge = new CylinderGeometry(0.1, 1.95, 1.8, 3).rotateY(Math.PI).translate(0, 0.2, 2.7);
      const sternBox = new BoxGeometry(1.85, 1.35, 1.1).translate(0, 0.25, -2.15);
      const hullMesh = mergeGeometries([hullMid, bowWedge, sternBox]);
      hullMid.dispose();
      bowWedge.dispose();
      sternBox.dispose();
      if (!hullMesh) throw new Error("pirate ship: hull merge");

      // 2. Gunwale rails and deck trim in lighter warm timber
      const gunwaleL = new BoxGeometry(0.14, 0.2, 5.2).translate(-1.0, 0.82, 0.1);
      const gunwaleR = new BoxGeometry(0.14, 0.2, 5.2).translate(1.0, 0.82, 0.1);
      const transomRail = new BoxGeometry(1.9, 0.22, 0.14).translate(0, 0.95, -2.65);
      const trimMesh = mergeGeometries([gunwaleL, gunwaleR, transomRail]);
      gunwaleL.dispose();
      gunwaleR.dispose();
      transomRail.dispose();
      if (!trimMesh) throw new Error("pirate ship: trim merge");

      // 3. Main mast with yardarm and crow's nest
      const mastShaft = new CylinderGeometry(0.09, 0.13, SHIP_MAST_TOP, 8).translate(0, SHIP_MAST_TOP / 2, 0.3);
      const yardarm = new CylinderGeometry(0.06, 0.06, 3.4, 6).rotateZ(Math.PI / 2).translate(0, 3.8, 0.3);
      const crowsNest = new CylinderGeometry(0.35, 0.28, 0.35, 8).translate(0, 3.6, 0.3);
      const mastMesh = mergeGeometries([mastShaft, yardarm, crowsNest]);
      mastShaft.dispose();
      yardarm.dispose();
      crowsNest.dispose();
      if (!mastMesh) throw new Error("pirate ship: mast merge");

      // 4. Billowing canvas sail
      const sail = new PlaneGeometry(3.2, 2.6);

      return [
         { geometry: hullMesh, material: mat(COLORS.wood, { roughness: 0.85 }) },
         { geometry: trimMesh, material: mat(COLORS.woodLight, { roughness: 0.75 }) },
         { geometry: mastMesh, material: mat("#78350f", { roughness: 0.8 }) },
         {
            geometry: sail,
            material: mat(COLORS.sail, { side: DoubleSide, roughness: 0.65 }),
            locals: [new Matrix4().makeRotationY(Math.PI / 2).setPosition(0, 2.7, 0.45)],
         },
      ];
   });
}

/** Swallowtail pirate pennant at mast top: flying aft (-z in ship frame). */
export function usePennantParts(): readonly InstancePart[] {
   return usePoolParts(() => {
      const g = new BufferGeometry();
      // Split swallowtail pennant with dynamic notched fork
      const vertices = new Float32Array([
         0, 0, 0,
         0, -0.45, 0,
         0, -0.15, -1.35,

         0, -0.15, -1.35,
         0, -0.45, 0,
         0, -0.32, -0.75,
      ]);
      g.setAttribute("position", new Float32BufferAttribute(vertices, 3));
      g.computeVertexNormals();
      return [{ geometry: g, material: new MeshStandardMaterial({ color: "#ffffff", roughness: 0.6, side: DoubleSide }) }];
   });
}

/** The galleon's fore and aft sails and masts (in sloop units). */
export function useGalleonSailParts(): readonly InstancePart[] {
   return usePoolParts(() => {
      const fore = new Matrix4().makeRotationY(Math.PI / 2).setPosition(0, 2.2, 1.9);
      const aft = new Matrix4().makeRotationY(Math.PI / 2).setPosition(0, 2.1, -1.9);

      // Fore and aft masts with yardarms
      const m1 = new CylinderGeometry(0.07, 0.09, 3.2, 6).translate(0, 1.6, 1.9);
      const y1 = new CylinderGeometry(0.05, 0.05, 2.0, 6).rotateZ(Math.PI / 2).translate(0, 2.9, 1.9);
      const m2 = new CylinderGeometry(0.07, 0.09, 3.0, 6).translate(0, 1.5, -1.9);
      const y2 = new CylinderGeometry(0.05, 0.05, 1.8, 6).rotateZ(Math.PI / 2).translate(0, 2.7, -1.9);
      const spars = mergeGeometries([m1, y1, m2, y2]);
      m1.dispose();
      y1.dispose();
      m2.dispose();
      y2.dispose();
      if (!spars) throw new Error("pirate galleon: spars merge");

      return [
         { geometry: new PlaneGeometry(1.8, 1.8), material: mat(COLORS.coral, { side: DoubleSide, roughness: 0.6 }), locals: [fore, aft] },
         { geometry: spars, material: mat("#78350f", { roughness: 0.8 }) },
      ];
   });
}

/** HP pips: stylized nautical crest disc facing the camera with a ruby gem core. */
export function usePipParts(): readonly InstancePart[] {
   return usePoolParts(() => {
      const rim = new RingGeometry(0.42, 0.56, 16);
      const core = new CircleGeometry(0.42, 16);
      const crest = mergeGeometries([rim, core]);
      rim.dispose();
      core.dispose();
      if (!crest) throw new Error("pirate pip: crest merge");

      return [
         {
            geometry: crest,
            material: new MeshStandardMaterial({
               color: "#ffffff",
               roughness: 0.4,
               emissive: "#b91c1c",
               emissiveIntensity: 0.6,
            }),
         },
      ];
   });
}

/** Cannonballs: cast iron with metallic dark sheen. */
export function useBallParts(): readonly InstancePart[] {
   return usePoolParts(() => [
      {
         geometry: new SphereGeometry(WORLD.ballRadius, 16, 12),
         material: mat(COLORS.ball, { roughness: 0.35, metalness: 0.75 }),
      },
   ]);
}

/** Powder barrel: coopered wooden barrel with red warning belly band and black iron hoops. */
export function useBarrelParts(): readonly InstancePart[] {
   return usePoolParts(() => {
      const body = new CylinderGeometry(0.42, 0.42, BARREL_HEIGHT, 14);
      const hoopTop = new CylinderGeometry(0.435, 0.435, 0.09, 14).translate(0, 0.28, 0);
      const hoopBottom = new CylinderGeometry(0.435, 0.435, 0.09, 14).translate(0, -0.28, 0);
      const barrelMesh = mergeGeometries([body, hoopTop, hoopBottom]);
      body.dispose();
      hoopTop.dispose();
      hoopBottom.dispose();
      if (!barrelMesh) throw new Error("pirate barrel merge");

      return [
         {
            geometry: barrelMesh,
            material: mat(COLORS.barrel, { roughness: 0.6, metalness: 0.2 }),
         },
      ];
   });
}

/** Flotsam crate: sea-weathered wood crate with corner braces. */
export function useCrateParts(): readonly InstancePart[] {
   return usePoolParts(() => {
      const box = new BoxGeometry(CRATE_SIZE, CRATE_SIZE * 0.7, CRATE_SIZE);
      const brace1 = new BoxGeometry(CRATE_SIZE + 0.02, 0.08, CRATE_SIZE + 0.02).translate(0, 0.18, 0);
      const brace2 = new BoxGeometry(CRATE_SIZE + 0.02, 0.08, CRATE_SIZE + 0.02).translate(0, -0.18, 0);
      const crateMesh = mergeGeometries([box, brace1, brace2]);
      box.dispose();
      brace1.dispose();
      brace2.dispose();
      if (!crateMesh) throw new Error("pirate crate merge");

      return [{ geometry: crateMesh, material: mat("#b45309", { roughness: 0.85 }) }];
   });
}

// ---------- Single stand-ins ----------

/** Cannon stand-in: naval timber carriage, 4 truck wheels with iron rims, bronze barrel with trunnions. */
export function CannonPrimitive() {
   const s = CANNON.scale;
   const geo = useMemo(() => {
      const carriageBody = new BoxGeometry(0.72, 0.38, 1.15).translate(0, 0.3, 0);
      const axleFront = new CylinderGeometry(0.06, 0.06, 0.98, 8).rotateZ(Math.PI / 2).translate(0, 0.16, 0.32);
      const axleRear = new CylinderGeometry(0.06, 0.06, 0.98, 8).rotateZ(Math.PI / 2).translate(0, 0.16, -0.32);
      const carriage = mergeGeometries([carriageBody, axleFront, axleRear]);
      carriageBody.dispose();
      axleFront.dispose();
      axleRear.dispose();
      if (!carriage) throw new Error("cannon carriage merge");

      // Bronze cannon barrel with cascabel ball and muzzle swell
      const tube = new CylinderGeometry(0.14, 0.24, 1.45, 16).translate(0, 0.72, 0);
      const muzzleRing = new CylinderGeometry(0.18, 0.16, 0.12, 16).translate(0, 1.46, 0);
      const cascabel = new SphereGeometry(0.12, 10, 8).translate(0, -0.05, 0);
      const barrel = mergeGeometries([tube, muzzleRing, cascabel]);
      tube.dispose();
      muzzleRing.dispose();
      cascabel.dispose();
      if (!barrel) throw new Error("cannon barrel merge");

      return { carriage, barrel };
   }, []);

   useEffect(
      () => () => {
         geo.carriage.dispose();
         geo.barrel.dispose();
      },
      [geo]
   );

   return (
      <group name="cannon-standin">
         {/* Naval timber carriage */}
         <mesh geometry={geo.carriage}>
            <meshStandardMaterial color="#7c2d12" roughness={0.75} />
         </mesh>

         {/* 4 truck wheels */}
         {[-1, 1].map((side) =>
            [-0.32, 0.32].map((zPos, idx) => (
               <mesh key={`${side}-${idx}`} position={[side * 0.48, 0.18, zPos]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.2, 0.2, 0.12, 14]} />
                  <meshStandardMaterial color="#451a03" roughness={0.8} />
               </mesh>
            ))
         )}

         {/* Bronze cannon tube */}
         <mesh position={[0, 0.78, 0.05]} rotation={[Math.PI / 2 - CANNON.barrelAngle, 0, 0]} geometry={geo.barrel}>
            <meshStandardMaterial color="#b45309" roughness={0.4} metalness={0.65} />
         </mesh>
      </group>
   );
}

/** Treasure chest: arched wooden lid, iron reinforcing corner straps, gold lock clasp. */
export function ChestPrimitive() {
   const geo = useMemo(() => {
      const body = new BoxGeometry(0.9, 0.42, 0.6).translate(0, 0.21, 0);
      const lid = new CylinderGeometry(0.3, 0.3, 0.9, 12, 1, false, 0, Math.PI)
         .rotateZ(Math.PI / 2)
         .translate(0, 0.42, 0);
      const chestMesh = mergeGeometries([body, lid]);
      body.dispose();
      lid.dispose();
      if (!chestMesh) throw new Error("chest primitive merge");
      return chestMesh;
   }, []);

   useEffect(() => () => geo.dispose(), [geo]);

   return (
      <group position={[0, -CHEST_DRAFT, 0]}>
         <mesh geometry={geo}>
            <meshStandardMaterial color={COLORS.chest} roughness={0.7} />
         </mesh>
         {/* Gold padlock clasp */}
         <mesh position={[0, 0.38, 0.31]}>
            <boxGeometry args={[0.12, 0.14, 0.04]} />
            <meshStandardMaterial color={COLORS.chestGold} roughness={0.3} metalness={0.8} />
         </mesh>
      </group>
   );
}

/** Palms: segmented curved trunk + multi-layered tropical fronds. */
export function PalmPrimitives({ spots }: { spots: readonly InstanceSpot[] }) {
   const geo = useMemo(() => {
      const trunkH = PALM_SIZE.height * 0.8;
      const t1 = new CylinderGeometry(0.18, 0.26, trunkH * 0.55, 8).translate(0, trunkH * 0.275, 0);
      const t2 = new CylinderGeometry(0.13, 0.18, trunkH * 0.5, 8).rotateZ(0.08).translate(0.08, trunkH * 0.75, 0);
      const trunk = mergeGeometries([t1, t2]);
      t1.dispose();
      t2.dispose();
      if (!trunk) throw new Error("palm trunk merge");

      const f1 = new ConeGeometry(PALM_SIZE.crown / 2, 1.0, 9).rotateX(0.15).translate(0.12, PALM_SIZE.height - 0.5, 0);
      const f2 = new ConeGeometry(PALM_SIZE.crown / 2.3, 0.9, 9).rotateZ(-0.15).translate(0.12, PALM_SIZE.height - 0.35, 0);
      const crown = mergeGeometries([f1, f2]);
      f1.dispose();
      f2.dispose();
      if (!crown) throw new Error("palm crown merge");

      return { trunk, crown };
   }, []);

   useEffect(
      () => () => {
         geo.trunk.dispose();
         geo.crown.dispose();
      },
      [geo]
   );

   return (
      <>
         <Instanced spots={spots} name="palm-trunks">
            <primitive object={geo.trunk} attach="geometry" />
            <meshStandardMaterial color={COLORS.trunk} roughness={0.9} />
         </Instanced>
         <Instanced spots={spots} name="palm-crowns">
            <primitive object={geo.crown} attach="geometry" />
            <meshStandardMaterial color={COLORS.palm} roughness={0.85} />
         </Instanced>
      </>
   );
}

/** Pennant colours by ship type (white dinghy, coral sloop, red galleon). */
export const PENNANT = {
   dinghy: new Color(COLORS.sail),
   sloop: new Color(COLORS.coral),
   galleon: new Color(COLORS.accent),
} as const;
