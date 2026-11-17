"use client";

// The scoop meter over the player's head while E / Enter / Scoop is held: a ring that fills over
// SCOOP.max, grey under SCOOP.min ("HOLD…"), green from SCOOP.min ("LET GO!", or "HANDS FULL" at 3),
// red at SCOOP.max ("ROLLER!"). A camera-facing sprite drawn over everything, never smaller than
// METER_MIN_PX on screen. Reads the run; changes nothing.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CanvasTexture, PerspectiveCamera, SRGBColorSpace, SpriteMaterial, Vector2, Vector3, type Sprite } from "three";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { beaconScale } from "@/arcade3d/core/hud/beacon";
import { SCOOP, type Run } from "./rules";
import { scoopFill, scoopLabel, scoopZone, type ScoopZone } from "./feedback";

/** The meter's world size at scale 1 (m) and its smallest size on screen (CSS px). */
export const METER_SIZE = 0.9;
export const METER_MIN_PX = 128;
/** Height of the meter's lower edge over the player's feet (m): just over the beanie. */
export const METER_Y = 1.5;

export const METER_COLORS: Record<ScoopZone, string> = { short: "#94a3b8", ready: "#22c55e", roller: "#ef4444" };

const STEPS = 60;
/** Fill fraction from which the green fill turns orange and the red end zone starts (1.38 s of 1.50 s). */
export const ROLLER_WARN = 0.92;
const V = new Vector3();
const BOTTOM = new Vector2(0.5, 0);

function drawMeter(ctx: CanvasRenderingContext2D, fill: number, zone: ScoopZone, ammo: number): void {
   const w = 256;
   ctx.clearRect(0, 0, w, w);
   const cx = 128;
   const cy = 96;
   const r = 64;
   const start = -Math.PI / 2;
   const full = Math.PI * 2;
   const minK = SCOOP.min / SCOOP.max;
   // dark disc so the ring reads on white snow
   ctx.beginPath();
   ctx.arc(cx, cy, r + 20, 0, full);
   ctx.fillStyle = "rgba(15,23,42,0.82)";
   ctx.fill();
   // zones (dim)
   ctx.lineWidth = 20;
   ctx.lineCap = "butt";
   ctx.strokeStyle = "rgba(148,163,184,0.35)";
   ctx.beginPath();
   ctx.arc(cx, cy, r, start, start + full * minK);
   ctx.stroke();
   ctx.strokeStyle = "rgba(34,197,94,0.35)";
   ctx.beginPath();
   ctx.arc(cx, cy, r, start + full * minK, start + full * ROLLER_WARN);
   ctx.stroke();
   ctx.strokeStyle = "rgba(239,68,68,0.55)";
   ctx.beginPath();
   ctx.arc(cx, cy, r, start + full * ROLLER_WARN, start + full);
   ctx.stroke();
   // fill
   if (fill > 0) {
      // the last stretch before the roller turns orange: let go now
      ctx.strokeStyle = zone === "ready" && fill >= ROLLER_WARN ? "#f97316" : METER_COLORS[zone];
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(cx, cy, r, start, start + full * Math.min(1, fill));
      ctx.stroke();
   }
   // the green line: where "let go" starts
   ctx.strokeStyle = "#f8fafc";
   ctx.lineWidth = 5;
   ctx.lineCap = "butt";
   const a = start + full * minK;
   ctx.beginPath();
   ctx.moveTo(cx + Math.cos(a) * (r - 14), cy + Math.sin(a) * (r - 14));
   ctx.lineTo(cx + Math.cos(a) * (r + 14), cy + Math.sin(a) * (r + 14));
   ctx.stroke();
   // a snowball in the middle that grows with the press
   ctx.beginPath();
   ctx.arc(cx, cy, 10 + 26 * Math.min(1, fill), 0, full);
   ctx.fillStyle = "#f8fafc";
   ctx.fill();
   // the word
   const text = scoopLabel(zone, ammo);
   ctx.font = "800 34px system-ui, sans-serif";
   ctx.textAlign = "center";
   ctx.textBaseline = "middle";
   const tw = ctx.measureText(text).width + 28;
   ctx.fillStyle = "rgba(15,23,42,0.88)";
   ctx.beginPath();
   ctx.roundRect?.(cx - tw / 2, 192, tw, 52, 26);
   ctx.fill();
   ctx.fillStyle = zone === "short" ? "#f8fafc" : METER_COLORS[zone];
   ctx.fillText(text, cx, 219);
}

export default function ScoopMeter({ run }: { run: Run }) {
   const camera = useThree((s) => s.camera);
   const vh = useThree((s) => s.size.height);
   const sprite = useRef<Sprite>(null);
   const draw = useMemo(() => {
      if (typeof document === "undefined") return null;
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      const map = new CanvasTexture(canvas);
      map.colorSpace = SRGBColorSpace;
      const material = new SpriteMaterial({ map, depthTest: false, depthWrite: false, transparent: true, toneMapped: false });
      return { ctx, map, material, key: "" };
   }, []);
   useEffect(() => () => {
      draw?.map.dispose();
      draw?.material.dispose();
   }, [draw]);

   useFrame(() => {
      const s = sprite.current;
      if (!s || !draw) return;
      const on = run.scooping && !run.endReason;
      if (s.visible !== on) s.visible = on;
      if (!on) return;
      const player = run.kids[0];
      const fill = scoopFill(run.scoopT);
      const zone = scoopZone(run.scoopT);
      const key = `${Math.round(fill * STEPS)}|${zone}|${player.ammo >= SCOOP.maxAmmo ? 1 : 0}`;
      if (key !== draw.key) {
         draw.key = key;
         drawMeter(draw.ctx, fill, zone, player.ammo);
         draw.map.needsUpdate = true;
      }
      V.set(player.x, METER_Y, player.z);
      const fov = camera instanceof PerspectiveCamera ? camera.fov : 45;
      const k = beaconScale(camera.position.distanceTo(V), fov, vh, METER_MIN_PX, METER_SIZE, 6);
      s.position.copy(V);
      s.scale.set(METER_SIZE * k, METER_SIZE * k, 1);
   }, FRAME_PRIORITY.visuals);

   if (!draw) return null;
   return <sprite ref={sprite} material={draw.material} center={BOTTOM} visible={false} renderOrder={30} />;
}
