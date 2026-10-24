"use client";

// Every part on screen, from fixed pools (one draw call per shape): the belt's parts, the ones flying
// to the cradle or the bin, and the robot being built on the cradle. A display list is filled once
// per frame (after the run step and the camera), then each shape's pool picks its items from it.
// Also the cyan ring under every part the blueprint wants, the red "!" over faulty parts, and soft
// contact shadows on the belt.
import { useEffect, useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
   AdditiveBlending,
   CircleGeometry,
   Color,
   Euler,
   MeshBasicMaterial,
   MeshStandardMaterial,
   PlaneGeometry,
   Quaternion,
   RingGeometry,
   Vector3,
   type Matrix4,
} from "three";
import { DynamicInstancedModel } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { DynamicInstanced, useCanvasTexture, type InstancePart, type InstanceUpdate } from "@/arcade3d/core/render";
import { ASSETS } from "./assets";
import { cradleSlot, flyerAt, type Look } from "./look";
import { COLORS } from "./palette";
import { buildShape } from "./partShapes";
import { CLAW, SHAPES, STREAM, inZone, isWanted, type Run } from "./rules";

const ITEMS = STREAM.MAX_PARTS + 6 + 5;
const GLB_SHAPES = [ASSETS.barrel, ASSETS.crate, ASSETS.battery] as const;
/** Belt top over the path (Conveyor lift). */
const BELT_TOP = 0.02;
const BADGE_M = 0.42;

interface Item {
   on: boolean;
   shape: number;
   p: Vector3;
   q: Quaternion;
   s: Vector3;
   color: Color;
}

function drawBadge(ctx: CanvasRenderingContext2D, w: number, h: number) {
   ctx.clearRect(0, 0, w, h);
   ctx.fillStyle = COLORS.faulty;
   ctx.beginPath();
   ctx.moveTo(w / 2, h * 0.06);
   ctx.lineTo(w * 0.95, h * 0.9);
   ctx.lineTo(w * 0.05, h * 0.9);
   ctx.closePath();
   ctx.fill();
   ctx.strokeStyle = "#fff7ed";
   ctx.lineWidth = w * 0.06;
   ctx.lineJoin = "round";
   ctx.stroke();
   ctx.fillStyle = "#fff7ed";
   ctx.font = `900 ${Math.round(h * 0.56)}px system-ui, sans-serif`;
   ctx.textAlign = "center";
   ctx.textBaseline = "middle";
   ctx.fillText("!", w / 2, h * 0.6);
}

function drawShadow(ctx: CanvasRenderingContext2D, w: number, h: number) {
   const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
   g.addColorStop(0, "rgba(2,6,23,0.55)");
   g.addColorStop(1, "rgba(2,6,23,0)");
   ctx.fillStyle = g;
   ctx.fillRect(0, 0, w, h);
}

export function Parts({ run, look }: { run: Run; look: Look }) {
   const time = useGameTime();
   const camera = useThree((state) => state.camera);
   const [items] = useState<Item[]>(() =>
      Array.from({ length: ITEMS }, () => ({ on: false, shape: 0, p: new Vector3(), q: new Quaternion(), s: new Vector3(1, 1, 1), color: new Color() }))
   );
   const [s] = useState(() => ({
      e: new Euler(),
      v: new Vector3(),
      one: new Vector3(1, 1, 1),
      fly: { x: 0, y: 0, z: 0, spin: 0 },
      slot: { x: 0, y: 0, z: 0, s: 1 },
      palette: COLORS.parts.map((c) => new Color(c)),
      faulty: new Color(COLORS.faulty),
   }));

   const material = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.15 }), []);
   const parts = useMemo<InstancePart[][]>(() => SHAPES.map((_n, i) => [{ geometry: buildShape(i), material }]), [material]);
   useEffect(
      () => () => {
         for (const p of parts) p[0].geometry.dispose();
         material.dispose();
      },
      [parts, material]
   );

   // the display list: belt parts, flyers, the cradle build
   useFrame(() => {
      const now = time.now;
      let n = 0;
      for (const part of run.parts) {
         const it = items[n++];
         it.on = part.active;
         if (!part.active) continue;
         it.shape = part.shape;
         const hop = part.hop > 0 ? Math.sin((part.hop / CLAW.BOUNCE) * Math.PI) * 0.22 : 0;
         const shake = part.faulty ? 0.025 * Math.sin(now * 47 + part.uid) : 0;
         it.p.set(part.x + shake, part.y + BELT_TOP + hop, part.z);
         s.e.set(hop * 1.2, ((part.uid * 2.39996) % 1) * 0.8 - 0.4, shake * 3);
         it.q.setFromEuler(s.e);
         it.s.copy(s.one);
         const base = s.palette[part.colour];
         if (part.faulty) it.color.lerpColors(base, s.faulty, 0.45 + 0.4 * Math.max(0, Math.sin(now * 11 + part.uid)));
         else it.color.copy(base);
      }
      for (const f of look.flyers) {
         const it = items[n++];
         it.on = f.on;
         if (!f.on) continue;
         flyerAt(look, f, now, s.fly);
         it.shape = f.shape;
         it.p.set(s.fly.x, s.fly.y, s.fly.z);
         s.e.set(s.fly.spin, s.fly.spin * 0.6, 0);
         it.q.setFromEuler(s.e);
         it.s.copy(s.one);
         it.color.copy(f.faulty ? s.faulty : s.palette[f.colour]);
      }
      for (let k = 0; k < 5; k++) {
         const it = items[n++];
         it.on = k < look.landed;
         if (!it.on) continue;
         cradleSlot(look.cradleKind[k], k, look.cradleShape[0], s.slot);
         it.shape = look.cradleShape[k];
         it.p.set(s.slot.x, s.slot.y, s.slot.z);
         it.q.identity();
         it.s.setScalar(s.slot.s);
         it.color.copy(s.palette[look.cradleColour[k]]);
      }
   }, -0.05);

   const updates = useMemo<InstanceUpdate[]>(
      () =>
         SHAPES.map((_n, shape) => (i: number, m: Matrix4, color: Color) => {
            const it = items[i];
            if (!it.on || it.shape !== shape) return false;
            m.compose(it.p, it.q, it.s);
            color.copy(it.color);
         }),
      [items]
   );

   return (
      <group name="parts">
         {GLB_SHAPES.map((asset, shape) => (
            <DynamicInstancedModel key={asset.id} asset={asset} count={ITEMS} update={updates[shape]} fallbackParts={parts[shape]} tinted name={`part-${SHAPES[shape]}`} />
         ))}
         {parts.slice(GLB_SHAPES.length).map((p, k) => (
            <DynamicInstanced key={k} count={ITEMS} update={updates[k + GLB_SHAPES.length]} parts={p} tinted name={`part-${SHAPES[k + GLB_SHAPES.length]}`} />
         ))}
         <Rings run={run} />
         <Badges run={run} camera={camera} />
         <Shadows run={run} />
      </group>
   );
}

/** The pulsing cyan ring under each part the blueprint wants: the next part to grab. */
function Rings({ run }: { run: Run }) {
   const time = useGameTime();
   const geometry = useMemo(() => new RingGeometry(0.27, 0.34, 40).rotateX(-Math.PI / 2), []);
   const material = useMemo(() => new MeshBasicMaterial({ color: COLORS.rim, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false, blending: AdditiveBlending }), []);
   useEffect(() => () => (geometry.dispose(), material.dispose()), [geometry, material]);
   const part = useMemo<InstancePart[]>(() => [{ geometry, material }], [geometry, material]);
   const [v] = useState(() => new Vector3());
   const update: InstanceUpdate = (i, m) => {
      const p = run.parts[i];
      if (!p.active || p.passed || !isWanted(run, p)) return false;
      const k = (inZone(p) ? 1.12 : 1) + 0.08 * Math.sin(time.now * 7);
      m.makeScale(k, 1, k).setPosition(v.set(p.x, p.y + BELT_TOP + 0.006, p.z));
   };
   return <DynamicInstanced count={STREAM.MAX_PARTS} update={update} parts={part} name="wanted-rings" />;
}

function Badges({ run, camera }: { run: Run; camera: { quaternion: Quaternion } }) {
   const time = useGameTime();
   const map = useCanvasTexture(128, 128, drawBadge);
   const geometry = useMemo(() => new PlaneGeometry(BADGE_M, BADGE_M), []);
   const material = useMemo(() => new MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false }), [map]);
   useEffect(() => () => (geometry.dispose(), material.dispose()), [geometry, material]);
   const part = useMemo<InstancePart[]>(() => [{ geometry, material }], [geometry, material]);
   const [s] = useState(() => ({ v: new Vector3(), one: new Vector3(1, 1, 1) }));
   const update: InstanceUpdate = (i, m) => {
      const p = run.parts[i];
      if (!p.active || !p.faulty) return false;
      s.v.set(p.x, p.y + 0.82 + 0.05 * Math.sin(time.now * 6 + p.uid), p.z);
      m.compose(s.v, camera.quaternion, s.one);
   };
   return <DynamicInstanced count={STREAM.MAX_PARTS} update={update} parts={part} name="fault-badges" />;
}

function Shadows({ run }: { run: Run }) {
   const map = useCanvasTexture(64, 64, drawShadow);
   const geometry = useMemo(() => new CircleGeometry(0.3, 20).rotateX(-Math.PI / 2), []);
   const material = useMemo(() => new MeshBasicMaterial({ map, transparent: true, depthWrite: false }), [map]);
   useEffect(() => () => (geometry.dispose(), material.dispose()), [geometry, material]);
   const part = useMemo<InstancePart[]>(() => [{ geometry, material }], [geometry, material]);
   const [v] = useState(() => new Vector3());
   const update: InstanceUpdate = (i, m) => {
      const p = run.parts[i];
      if (!p.active) return false;
      m.makeTranslation(v.set(p.x, p.y + BELT_TOP + 0.003, p.z));
   };
   return <DynamicInstanced count={STREAM.MAX_PARTS} update={update} parts={part} name="part-shadows" />;
}
