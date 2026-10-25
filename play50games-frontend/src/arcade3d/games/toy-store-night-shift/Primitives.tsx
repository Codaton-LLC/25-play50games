"use client";

// Stand-ins for the GLBs: bevelled, two or three tones, at the asset's fitted size. They draw only
// while a GLB is missing or broken. Props are authored at the drawn size of spot scale 1.
import { useEffect, useMemo } from "react";
import { BoxGeometry, ConeGeometry, CylinderGeometry, MeshStandardMaterial, SphereGeometry } from "three";
import type { InstancePart } from "@/arcade3d/core/render";
import { GLYPHS } from "./glyphs";
import type { Category } from "./levels";
import { COLORS } from "./looks";
import { SHELF_DEPTH, SHELF_H, SHELF_LEN } from "./rules";
import { TOY_SIZE } from "./assets";

/** The shelf unit: a yellow body with a pink top, instanced. */
export function shelfParts(): InstancePart[] {
   const body = new BoxGeometry(SHELF_LEN, SHELF_H - 0.1, SHELF_DEPTH);
   body.translate(0, (SHELF_H - 0.1) / 2, 0);
   const top = new BoxGeometry(SHELF_LEN + 0.08, 0.1, SHELF_DEPTH + 0.08);
   top.translate(0, SHELF_H - 0.05, 0);
   const mid = new BoxGeometry(SHELF_LEN + 0.02, 0.08, SHELF_DEPTH + 0.02);
   mid.translate(0, SHELF_H * 0.5, 0);
   return [
      { geometry: body, material: new MeshStandardMaterial({ color: COLORS.fallbackShelf, roughness: 0.6 }) },
      { geometry: top, material: new MeshStandardMaterial({ color: COLORS.fallbackShelfTop, roughness: 0.5 }) },
      { geometry: mid, material: new MeshStandardMaterial({ color: COLORS.shelfTrimBlue, roughness: 0.5 }) },
   ];
}

/** A toy of this kind as a small bevelled stand-in at its drawn size. */
export function toyParts(cat: Category): InstancePart[] {
   const s = TOY_SIZE[cat];
   const color = GLYPHS[cat].color;
   const mat = (c: string) => new MeshStandardMaterial({ color: c, roughness: 0.55 });
   const parts: InstancePart[] = [];
   const add = (g: BoxGeometry | SphereGeometry | CylinderGeometry | ConeGeometry, c: string) => parts.push({ geometry: g, material: mat(c) });
   switch (cat) {
      case "teddy": {
         const body = new SphereGeometry(s * 0.32, 10, 8); body.translate(0, s * 0.3, 0);
         const head = new SphereGeometry(s * 0.24, 10, 8); head.translate(0, s * 0.72, 0);
         add(body, color); add(head, "#fbbf24");
         break;
      }
      case "car": {
         const body = new BoxGeometry(s * 0.55, s * 0.2, s); body.translate(0, s * 0.18, 0);
         const cab = new BoxGeometry(s * 0.46, s * 0.16, s * 0.45); cab.translate(0, s * 0.34, -s * 0.05);
         add(body, color); add(cab, "#fecaca");
         break;
      }
      case "airplane": {
         const body = new CylinderGeometry(s * 0.07, s * 0.07, s * 0.8, 8); body.rotateX(Math.PI / 2); body.translate(0, s * 0.2, 0);
         const wing = new BoxGeometry(s, s * 0.04, s * 0.22); wing.translate(0, s * 0.2, 0);
         add(body, color); add(wing, "#e0f2fe");
         break;
      }
      case "ball": {
         const ball = new SphereGeometry(s * 0.5, 14, 10); ball.translate(0, s * 0.5, 0);
         add(ball, color);
         break;
      }
      case "blocks": {
         const a = new BoxGeometry(s * 0.45, s * 0.45, s * 0.45); a.translate(-s * 0.25, s * 0.225, 0);
         const b = new BoxGeometry(s * 0.45, s * 0.45, s * 0.45); b.translate(s * 0.25, s * 0.225, 0);
         const c = new BoxGeometry(s * 0.45, s * 0.45, s * 0.45); c.translate(0, s * 0.675, 0);
         add(a, color); add(b, "#c084fc"); add(c, "#e9d5ff");
         break;
      }
      case "train": {
         const body = new BoxGeometry(s * 0.34, s * 0.3, s * 0.8); body.translate(0, s * 0.25, 0);
         const stack = new CylinderGeometry(s * 0.07, s * 0.07, s * 0.22, 8); stack.translate(0, s * 0.5, s * 0.25);
         add(body, color); add(stack, "#134e4a");
         break;
      }
      case "robot": {
         const body = new BoxGeometry(s * 0.5, s * 0.5, s * 0.3); body.translate(0, s * 0.3, 0);
         const head = new BoxGeometry(s * 0.34, s * 0.28, s * 0.28); head.translate(0, s * 0.78, 0);
         add(body, color); add(head, "#fef9c3");
         break;
      }
   }
   return parts;
}

export function windupRobotParts(): InstancePart[] {
   const body = new BoxGeometry(0.5, 0.5, 0.36); body.translate(0, 0.4, 0);
   const head = new BoxGeometry(0.34, 0.26, 0.3); head.translate(0, 0.82, 0);
   const key = new BoxGeometry(0.34, 0.1, 0.06); key.translate(0, 0.5, -0.22);
   return [
      { geometry: body, material: new MeshStandardMaterial({ color: COLORS.windup, roughness: 0.5 }) },
      { geometry: head, material: new MeshStandardMaterial({ color: COLORS.windupDark, roughness: 0.5 }) },
      { geometry: key, material: new MeshStandardMaterial({ color: COLORS.windupKey, roughness: 0.4, metalness: 0.2 }) },
   ];
}

export function windupCarParts(): InstancePart[] {
   const body = new BoxGeometry(0.5, 0.26, 0.95); body.translate(0, 0.22, 0);
   const cab = new BoxGeometry(0.4, 0.2, 0.4); cab.translate(0, 0.46, -0.05);
   const key = new BoxGeometry(0.3, 0.08, 0.05); key.translate(0, 0.5, -0.4);
   return [
      { geometry: body, material: new MeshStandardMaterial({ color: COLORS.windup, roughness: 0.5 }) },
      { geometry: cab, material: new MeshStandardMaterial({ color: COLORS.windupDark, roughness: 0.5 }) },
      { geometry: key, material: new MeshStandardMaterial({ color: COLORS.windupKey, roughness: 0.4 }) },
   ];
}

export function GuardFigure() {
   const stuff = useMemo(
      () => ({
         legs: new CylinderGeometry(0.13, 0.15, 0.85, 8),
         torso: new CylinderGeometry(0.22, 0.24, 0.62, 8),
         head: new SphereGeometry(0.17, 10, 8),
         cap: new CylinderGeometry(0.18, 0.2, 0.1, 10),
         suit: new MeshStandardMaterial({ color: COLORS.guard, roughness: 0.6 }),
         skin: new MeshStandardMaterial({ color: COLORS.skin, roughness: 0.6 }),
         trim: new MeshStandardMaterial({ color: COLORS.guardTrim, roughness: 0.5 }),
      }),
      [],
   );
   useEffect(() => () => Object.values(stuff).forEach((x) => x.dispose()), [stuff]);
   return (
      <group>
         <mesh geometry={stuff.legs} material={stuff.suit} position={[0, 0.42, 0]} />
         <mesh geometry={stuff.torso} material={stuff.suit} position={[0, 1.15, 0]} />
         <mesh geometry={stuff.head} material={stuff.skin} position={[0, 1.62, 0]} />
         <mesh geometry={stuff.cap} material={stuff.trim} position={[0, 1.78, 0]} />
      </group>
   );
}

export function BinStand({ color }: { color: string }) {
   const stuff = useMemo(
      () => ({ body: new CylinderGeometry(0.5, 0.42, 0.6, 14), mat: new MeshStandardMaterial({ color, roughness: 0.6 }) }),
      [color],
   );
   useEffect(() => () => { stuff.body.dispose(); stuff.mat.dispose(); }, [stuff]);
   return <mesh geometry={stuff.body} material={stuff.mat} position={[0, 0.3, 0]} />;
}
