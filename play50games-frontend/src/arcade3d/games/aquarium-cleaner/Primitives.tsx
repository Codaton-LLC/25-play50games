"use client";

// Stand-ins for the GLBs: bevelled, two or three tones, at the asset's fitted size. They draw only
// while a GLB is missing or broken. Props are authored at the drawn size of spot scale 1.
import { useEffect, useMemo } from "react";
import { BoxGeometry, ConeGeometry, CylinderGeometry, DodecahedronGeometry, MeshStandardMaterial, SphereGeometry } from "three";
import type { InstancePart } from "@/arcade3d/core/render";
import { COLORS } from "./looks";
import { CASTLE_R, FILTER_R, ROCK_R } from "./rules";

function useDisposable<T extends { dispose(): void }>(items: readonly T[]) {
   useEffect(() => () => items.forEach((item) => item.dispose()), [items]);
}

export function CastleStand() {
   const stuff = useMemo(
      () => ({
         base: new BoxGeometry(CASTLE_R * 1.7, 0.7, CASTLE_R * 1.7),
         tower: new CylinderGeometry(0.4, 0.46, 1.5, 10),
         roof: new ConeGeometry(0.55, 0.6, 10),
         stone: new MeshStandardMaterial({ color: COLORS.fallbackCastle, roughness: 0.8 }),
         roofMat: new MeshStandardMaterial({ color: COLORS.fallbackCastleRoof, roughness: 0.6 }),
      }),
      [],
   );
   useDisposable([stuff.base, stuff.tower, stuff.roof, stuff.stone, stuff.roofMat]);
   return (
      <group>
         <mesh geometry={stuff.base} material={stuff.stone} position={[0, 0.35, 0]} />
         <mesh geometry={stuff.tower} material={stuff.stone} position={[0, 1.4, 0]} />
         <mesh geometry={stuff.roof} material={stuff.roofMat} position={[0, 2.45, 0]} />
      </group>
   );
}

export function FilterStand() {
   const stuff = useMemo(
      () => ({
         body: new BoxGeometry(FILTER_R * 1.9, 0.8, FILTER_R * 1.3),
         top: new BoxGeometry(FILTER_R * 1.7, 0.2, FILTER_R * 1.1),
         pipe: new CylinderGeometry(0.08, 0.08, 0.5, 8),
         body1: new MeshStandardMaterial({ color: COLORS.fallbackFilter, roughness: 0.55, metalness: 0.2 }),
         body2: new MeshStandardMaterial({ color: COLORS.fallbackFilterTop, roughness: 0.5, metalness: 0.25 }),
      }),
      [],
   );
   useDisposable([stuff.body, stuff.top, stuff.pipe, stuff.body1, stuff.body2]);
   return (
      <group>
         <mesh geometry={stuff.body} material={stuff.body1} position={[0, 0.4, 0]} />
         <mesh geometry={stuff.top} material={stuff.body2} position={[0, 0.9, 0]} />
         <mesh geometry={stuff.pipe} material={stuff.body2} position={[0.35, 1.15, 0]} />
      </group>
   );
}

export function BasketStand() {
   const stuff = useMemo(
      () => ({
         body: new CylinderGeometry(0.55, 0.42, 0.5, 14, 1, true),
         rim: new CylinderGeometry(0.58, 0.58, 0.06, 14),
         mat: new MeshStandardMaterial({ color: COLORS.fallbackBasket, roughness: 0.6, side: 2 }),
      }),
      [],
   );
   useDisposable([stuff.body, stuff.rim, stuff.mat]);
   return (
      <group>
         <mesh geometry={stuff.body} material={stuff.mat} position={[0, 0.25, 0]} />
         <mesh geometry={stuff.rim} material={stuff.mat} position={[0, 0.5, 0]} />
      </group>
   );
}

/** Instanced rock stand-ins at the drawn size of scale 1 (width 2 x ROCK_R). */
export function rockParts(): InstancePart[] {
   const rock = new DodecahedronGeometry(ROCK_R, 0);
   rock.scale(1, 0.62, 1);
   rock.translate(0, ROCK_R * 0.55, 0);
   return [{ geometry: rock, material: new MeshStandardMaterial({ color: COLORS.fallbackRock, roughness: 0.9, flatShading: true }) }];
}

/** The bottle pool's stand-in: a body and a cap. */
export function bottleParts(): InstancePart[] {
   const body = new CylinderGeometry(0.11, 0.11, 0.34, 10);
   body.translate(0, 0.17, 0);
   const cap = new CylinderGeometry(0.05, 0.05, 0.1, 8);
   cap.translate(0, 0.39, 0);
   return [
      { geometry: body, material: new MeshStandardMaterial({ color: COLORS.fallbackBottle, roughness: 0.3, transparent: true, opacity: 0.85 }) },
      { geometry: cap, material: new MeshStandardMaterial({ color: COLORS.fallbackBottleCap, roughness: 0.5 }) },
   ];
}

export function fishParts(): InstancePart[] {
   const body = new SphereGeometry(0.2, 8, 6);
   body.scale(0.45, 0.7, 1.4);
   body.translate(0, 0.2, 0);
   const tail = new ConeGeometry(0.12, 0.25, 6);
   tail.rotateX(-Math.PI / 2);
   tail.translate(0, 0.2, -0.32);
   return [
      { geometry: body, material: new MeshStandardMaterial({ color: COLORS.fallbackFish, roughness: 0.5 }) },
      { geometry: tail, material: new MeshStandardMaterial({ color: COLORS.fallbackFish, roughness: 0.5 }) },
   ];
}

export function sharkParts(): InstancePart[] {
   const body = new SphereGeometry(0.5, 12, 8);
   body.scale(0.75, 0.6, 2.7);
   body.translate(0, 0.55, 0);
   const fin = new ConeGeometry(0.28, 0.6, 6);
   fin.translate(0, 1.2, 0);
   return [
      { geometry: body, material: new MeshStandardMaterial({ color: COLORS.fallbackShark, roughness: 0.6 }) },
      { geometry: fin, material: new MeshStandardMaterial({ color: COLORS.fallbackShark2, roughness: 0.6 }) },
   ];
}

export function coralParts(): InstancePart[] {
   const stem = new CylinderGeometry(0.1, 0.16, 0.7, 7);
   stem.translate(0, 0.35, 0);
   const head = new SphereGeometry(0.3, 8, 6);
   head.translate(0, 0.8, 0);
   return [
      { geometry: stem, material: new MeshStandardMaterial({ color: COLORS.fallbackCoral2, roughness: 0.7 }) },
      { geometry: head, material: new MeshStandardMaterial({ color: COLORS.fallbackCoral, roughness: 0.6 }) },
   ];
}

export function DiverFigure() {
   const stuff = useMemo(
      () => ({
         legs: new CylinderGeometry(0.12, 0.14, 0.8, 8),
         torso: new CylinderGeometry(0.2, 0.22, 0.6, 8),
         head: new SphereGeometry(0.2, 10, 8),
         suit: new MeshStandardMaterial({ color: COLORS.suit, roughness: 0.55 }),
         glass: new MeshStandardMaterial({ color: COLORS.glass, roughness: 0.2, metalness: 0.1 }),
      }),
      [],
   );
   useDisposable([stuff.legs, stuff.torso, stuff.head, stuff.suit, stuff.glass]);
   return (
      <group>
         <mesh geometry={stuff.legs} material={stuff.suit} position={[0, 0.4, 0]} />
         <mesh geometry={stuff.torso} material={stuff.suit} position={[0, 1.1, 0]} />
         <mesh geometry={stuff.head} material={stuff.glass} position={[0, 1.6, 0]} />
      </group>
   );
}
