"use client";

// Geometries and materials created once. Meshes that share them set dispose={null}
// so a Retry does not free the module-level objects.
import { Color, CylinderGeometry, BoxGeometry, PlaneGeometry, RingGeometry, MeshStandardMaterial, MeshBasicMaterial } from "three";

export const KIND_COLOR = [
   new Color("#94a3b8"),
   new Color("#64748b"),
   new Color("#e7e5e4"),
   new Color("#7dd3fc"),
   new Color("#fbbf24"),
];

export const KIND_SCALE: ReadonlyArray<readonly [number, number, number]> = [
   [1.1, 0.28, 1.1],
   [0.34, 0.75, 0.34],
   [1.15, 0.75, 0.22],
   [1.0, 0.75, 0.18],
   [1.35, 0.28, 1.35],
];

export const GOLD = new Color("#fbbf24");
export const MINT = new Color("#6ee7b7");
export const SLATE = new Color("#64748b");
export const GUIDE_COLOR = [SLATE, MINT, GOLD];

export const pieceGeo = new BoxGeometry(1, 1, 1);
export const pileGeo = new BoxGeometry(0.72, 0.5, 0.72);
export const mastGeo = new BoxGeometry(0.28, 1, 0.28);
export const jibGeo = new BoxGeometry(0.22, 0.18, 1);
export const cableGeo = new CylinderGeometry(0.025, 0.025, 1, 6);
export const hookGeo = new BoxGeometry(0.34, 1.2, 0.34);
export const groundGeo = new PlaneGeometry(16, 14);
export const ringGeo = new RingGeometry(0.42, 0.55, 20);
export const blobGeo = new RingGeometry(0.15, 0.32, 16);

export const steel = new MeshStandardMaterial({ color: "#334155", roughness: 0.6, metalness: 0.2 });
export const jibMat = new MeshStandardMaterial({ color: "#f8fafc", roughness: 0.45, metalness: 0.15 });
export const hookMat = new MeshStandardMaterial({ color: "#e2e8f0", roughness: 0.35, metalness: 0.4 });
export const groundMat = new MeshStandardMaterial({ color: "#d6d3d1", roughness: 0.95 });
export const pieceMat = new MeshStandardMaterial({ color: "#ffffff", roughness: 0.7 });
export const slotMat = new MeshStandardMaterial({ color: "#fbbf24", emissive: "#fbbf24", emissiveIntensity: 0.85, roughness: 0.4 });
export const guideMat = new MeshBasicMaterial({ color: "#64748b", transparent: true, opacity: 0.9, depthWrite: false });
export const flashMat = new MeshBasicMaterial({ color: "#fb7185", transparent: true, opacity: 0, depthWrite: false });
export const pileMats = KIND_COLOR.map((color) => new MeshStandardMaterial({ color, roughness: 0.75 }));

export function drawPad(ctx: CanvasRenderingContext2D, w: number, h: number): void {
   ctx.fillStyle = "#d6d3d1";
   ctx.fillRect(0, 0, w, h);
   ctx.strokeStyle = "#a8a29e";
   ctx.lineWidth = 2;
   for (let i = 0; i <= 8; i++) {
      ctx.beginPath();
      ctx.moveTo((i / 8) * w, 0);
      ctx.lineTo((i / 8) * w, h);
      ctx.stroke();
   }
}
