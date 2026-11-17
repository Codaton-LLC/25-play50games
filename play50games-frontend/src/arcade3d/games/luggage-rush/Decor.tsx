"use client";

// Instanced airport surroundings strictly outside the play area:
// luggage carts, LD3 air cargo containers, runway edge lights, and architectural columns.
// Geometries are built once and disposed on unmount.
// NEVER put dispose={null} on a <primitive ... attach="geometry">!
import { useEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry } from "three";
import { useQuality, scaledCount } from "@/arcade3d/core/quality";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { COLORS, DECOR_SPOTS, type DecorSpot } from "./looks";

function rgbOf(hex: string): [number, number, number] {
   const n = parseInt(hex.slice(1), 16);
   return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

interface MeshBuilder {
   positions: number[];
   colors: number[];
   normals: number[];
}

function pushQuad(
   b: MeshBuilder,
   v0: [number, number, number],
   v1: [number, number, number],
   v2: [number, number, number],
   v3: [number, number, number],
   normal: [number, number, number],
   hex: string
) {
   const c = rgbOf(hex);
   b.positions.push(...v0, ...v1, ...v2);
   b.normals.push(...normal, ...normal, ...normal);
   b.colors.push(...c, ...c, ...c);
   b.positions.push(...v0, ...v2, ...v3);
   b.normals.push(...normal, ...normal, ...normal);
   b.colors.push(...c, ...c, ...c);
}

function pushBox(
   b: MeshBuilder,
   cx: number,
   cy: number,
   cz: number,
   w: number,
   h: number,
   d: number,
   hex: string
) {
   const hw = w / 2;
   const hh = h / 2;
   const hd = d / 2;
   pushQuad(b, [cx + hw, cy - hh, cz + hd], [cx + hw, cy - hh, cz - hd], [cx + hw, cy + hh, cz - hd], [cx + hw, cy + hh, cz + hd], [1, 0, 0], hex);
   pushQuad(b, [cx - hw, cy - hh, cz - hd], [cx - hw, cy - hh, cz + hd], [cx - hw, cy + hh, cz + hd], [cx - hw, cy + hh, cz - hd], [-1, 0, 0], hex);
   pushQuad(b, [cx - hw, cy + hh, cz + hd], [cx + hw, cy + hh, cz + hd], [cx + hw, cy + hh, cz - hd], [cx - hw, cy + hh, cz - hd], [0, 1, 0], hex);
   pushQuad(b, [cx - hw, cy - hh, cz - hd], [cx + hw, cy - hh, cz - hd], [cx + hw, cy - hh, cz + hd], [cx - hw, cy - hh, cz + hd], [0, -1, 0], hex);
   pushQuad(b, [cx - hw, cy - hh, cz + hd], [cx + hw, cy - hh, cz + hd], [cx + hw, cy + hh, cz + hd], [cx - hw, cy + hh, cz + hd], [0, 0, 1], hex);
   pushQuad(b, [cx + hw, cy - hh, cz - hd], [cx - hw, cy - hh, cz - hd], [cx - hw, cy + hh, cz - hd], [cx + hw, cy + hh, cz - hd], [0, 0, -1], hex);
}

function buildGeometry(b: MeshBuilder): BufferGeometry {
   const geo = new BufferGeometry();
   geo.setAttribute("position", new BufferAttribute(new Float32Array(b.positions), 3));
   geo.setAttribute("normal", new BufferAttribute(new Float32Array(b.normals), 3));
   geo.setAttribute("color", new BufferAttribute(new Float32Array(b.colors), 3));
   return geo;
}

function createCartGeometry(): BufferGeometry {
   const b: MeshBuilder = { positions: [], colors: [], normals: [] };
   // Flatbed chassis in airport blue: 1.1 x 0.08 x 0.72
   pushBox(b, 0, 0.22, 0, 1.1, 0.08, 0.72, COLORS.cartBody);
   // Perimeter bumper strip in safety amber:
   pushBox(b, 0, 0.22, 0.38, 1.14, 0.09, 0.04, COLORS.cartBumper);
   pushBox(b, 0, 0.22, -0.38, 1.14, 0.09, 0.04, COLORS.cartBumper);
   pushBox(b, 0.57, 0.22, 0, 0.04, 0.09, 0.74, COLORS.cartBumper);
   pushBox(b, -0.57, 0.22, 0, 0.04, 0.09, 0.74, COLORS.cartBumper);
   // Tubular side guard rails in steel:
   pushBox(b, 0, 0.45, 0.37, 1.05, 0.04, 0.04, COLORS.cartFrame);
   pushBox(b, 0, 0.45, -0.37, 1.05, 0.04, 0.04, COLORS.cartFrame);
   pushBox(b, -0.48, 0.35, 0.37, 0.04, 0.22, 0.04, COLORS.cartFrame);
   pushBox(b, 0.48, 0.35, 0.37, 0.04, 0.22, 0.04, COLORS.cartFrame);
   pushBox(b, -0.48, 0.35, -0.37, 0.04, 0.22, 0.04, COLORS.cartFrame);
   pushBox(b, 0.48, 0.35, -0.37, 0.04, 0.22, 0.04, COLORS.cartFrame);
   // Wheels (4 corner solid rubber casters):
   const wheelSpots: [number, number][] = [
      [-0.42, -0.3],
      [0.42, -0.3],
      [-0.42, 0.3],
      [0.42, 0.3],
   ];
   for (const [wx, wz] of wheelSpots) {
      pushBox(b, wx, 0.09, wz, 0.16, 0.18, 0.08, COLORS.cartWheel);
   }
   // Tow hitch:
   pushBox(b, 0.68, 0.18, 0, 0.24, 0.04, 0.08, COLORS.cartFrame);
   return buildGeometry(b);
}

function createCargoGeometry(): BufferGeometry {
   const b: MeshBuilder = { positions: [], colors: [], normals: [] };
   // LD3 container: 1.3 x 1.3 x 1.3 m aluminum box
   pushBox(b, 0, 0.65, 0, 1.3, 1.3, 1.3, COLORS.cargoBox);
   // Frame edge reinforcement:
   pushBox(b, 0, 0.04, 0, 1.34, 0.08, 1.34, COLORS.cargoTrim);
   pushBox(b, 0, 1.28, 0, 1.34, 0.08, 1.34, COLORS.cargoTrim);
   pushBox(b, -0.64, 0.65, -0.64, 0.08, 1.3, 0.08, COLORS.cargoTrim);
   pushBox(b, 0.64, 0.65, -0.64, 0.08, 1.3, 0.08, COLORS.cargoTrim);
   pushBox(b, -0.64, 0.65, 0.64, 0.08, 1.3, 0.08, COLORS.cargoTrim);
   pushBox(b, 0.64, 0.65, 0.64, 0.08, 1.3, 0.08, COLORS.cargoTrim);
   return buildGeometry(b);
}

function createLightGeometry(): BufferGeometry {
   const b: MeshBuilder = { positions: [], colors: [], normals: [] };
   // Stanchion post:
   pushBox(b, 0, 0.12, 0, 0.08, 0.24, 0.08, COLORS.runwayPost);
   // Blue runway light lens housing:
   pushBox(b, 0, 0.27, 0, 0.12, 0.08, 0.12, COLORS.runwayLight);
   return buildGeometry(b);
}

function createPillarGeometry(): BufferGeometry {
   const b: MeshBuilder = { positions: [], colors: [], normals: [] };
   // Column body: 0.38 x 4.8 x 0.38
   pushBox(b, 0, 2.4, 0, 0.38, 4.8, 0.38, COLORS.pillar);
   // Base trim collar:
   pushBox(b, 0, 0.15, 0, 0.44, 0.3, 0.44, COLORS.pillarTrim);
   // Top header collar:
   pushBox(b, 0, 4.7, 0, 0.44, 0.2, 0.44, COLORS.pillarTrim);
   return buildGeometry(b);
}

function filterSpots(kind: DecorSpot["kind"]): InstanceSpot[] {
   return DECOR_SPOTS.filter((s) => s.kind === kind).map((s) => ({
      x: s.x,
      y: s.y,
      z: s.z,
      rotY: s.rotY,
   }));
}

export function Decor() {
   const quality = useQuality();
   const geo = useMemo(() => {
      return {
         cart: createCartGeometry(),
         cargo: createCargoGeometry(),
         light: createLightGeometry(),
         pillar: createPillarGeometry(),
      };
   }, []);

   // Clean disposal on unmount (zero memory leaks, safe across retries):
   useEffect(() => () => {
      for (const geometry of Object.values(geo)) geometry.dispose();
   }, [geo]);

   const rawCarts = useMemo(() => filterSpots("cart"), []);
   const rawCargo = useMemo(() => filterSpots("cargo"), []);
   const rawLights = useMemo(() => filterSpots("light"), []);
   const rawPillars = useMemo(() => filterSpots("pillar"), []);

   const carts = useMemo(() => rawCarts.slice(0, scaledCount(rawCarts.length, quality.decor)), [rawCarts, quality.decor]);
   const cargo = useMemo(() => rawCargo.slice(0, scaledCount(rawCargo.length, quality.decor)), [rawCargo, quality.decor]);
   const lights = useMemo(() => rawLights.slice(0, scaledCount(rawLights.length, quality.decor)), [rawLights, quality.decor]);
   const pillars = useMemo(() => rawPillars.slice(0, scaledCount(rawPillars.length, quality.decor)), [rawPillars, quality.decor]);

   return (
      <group name="airport-decor">
         {carts.length > 0 && (
            <Instanced spots={carts} name="decor-carts">
               <primitive object={geo.cart} attach="geometry" />
               <meshStandardMaterial vertexColors roughness={0.4} metalness={0.2} />
            </Instanced>
         )}
         {cargo.length > 0 && (
            <Instanced spots={cargo} name="decor-cargo">
               <primitive object={geo.cargo} attach="geometry" />
               <meshStandardMaterial vertexColors roughness={0.35} metalness={0.3} />
            </Instanced>
         )}
         {lights.length > 0 && (
            <Instanced spots={lights} name="decor-lights">
               <primitive object={geo.light} attach="geometry" />
               <meshStandardMaterial vertexColors roughness={0.2} emissive={COLORS.runwayLight} emissiveIntensity={0.6} />
            </Instanced>
         )}
         {pillars.length > 0 && (
            <Instanced spots={pillars} name="decor-pillars">
               <primitive object={geo.pillar} attach="geometry" />
               <meshStandardMaterial vertexColors roughness={0.5} />
            </Instanced>
         )}
      </group>
   );
}
