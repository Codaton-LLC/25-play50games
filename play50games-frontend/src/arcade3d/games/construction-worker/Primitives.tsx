"use client";

// Geometries and materials created once. Meshes that share them set dispose={null}
// so a Retry does not free the module-level objects.
import {
   BoxGeometry,
   BufferAttribute,
   BufferGeometry,
   Color,
   CylinderGeometry,
   MeshBasicMaterial,
   MeshStandardMaterial,
   PlaneGeometry,
   RingGeometry,
   SphereGeometry,
   TorusGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { COLORS } from "./looks";

function withColor(raw: BufferGeometry, hex: string): BufferGeometry {
   const geo = raw.index ? raw.toNonIndexed() : raw;
   const count = geo.attributes.position.count;
   const colors = new Float32Array(count * 3);
   const color = new Color(hex);
   for (let i = 0; i < count; i++) {
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
   }
   geo.setAttribute("color", new BufferAttribute(colors, 3));
   return geo;
}

export const KIND_COLOR = [
   new Color(COLORS.pieceSlab),
   new Color(COLORS.piecePillar),
   new Color(COLORS.pieceWall),
   new Color(COLORS.pieceWindow),
   new Color(COLORS.pieceRoof),
];

export const KIND_SCALE: ReadonlyArray<readonly [number, number, number]> = [
   [1.1, 0.28, 1.1],
   [0.34, 0.75, 0.34],
   [1.15, 0.75, 0.22],
   [1.0, 0.75, 0.18],
   [1.35, 0.28, 1.35],
];

export const GOLD = new Color(COLORS.guideGold);
export const MINT = new Color(COLORS.guideMint);
export const SLATE = new Color(COLORS.guideSlate);
export const GUIDE_COLOR = [SLATE, MINT, GOLD];

// Bevelled rounded box for placed and carried building pieces
export const pieceGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.05);

// Pile pallet helper
function palletBase(): BufferGeometry {
   return withColor(new BoxGeometry(0.86, 0.08, 0.86).translate(0, 0.04, 0), COLORS.woodPallet);
}

// 5 distinct material piles in the yard:
// 0: Slab stack on pallet with wooden spacers
const p0 = mergeGeometries([
   palletBase(),
   withColor(new RoundedBoxGeometry(0.76, 0.08, 0.76, 2, 0.02).translate(0, 0.12, 0), COLORS.pieceSlab),
   withColor(new BoxGeometry(0.7, 0.02, 0.06).translate(0, 0.17, -0.25), COLORS.woodPallet),
   withColor(new BoxGeometry(0.7, 0.02, 0.06).translate(0, 0.17, 0.25), COLORS.woodPallet),
   withColor(new RoundedBoxGeometry(0.76, 0.08, 0.76, 2, 0.02).translate(0, 0.22, 0), COLORS.pieceSlab),
   withColor(new BoxGeometry(0.7, 0.02, 0.06).translate(0, 0.27, -0.25), COLORS.woodPallet),
   withColor(new BoxGeometry(0.7, 0.02, 0.06).translate(0, 0.27, 0.25), COLORS.woodPallet),
   withColor(new RoundedBoxGeometry(0.76, 0.08, 0.76, 2, 0.02).translate(0, 0.32, 0), COLORS.pieceSlab),
]);
if (!p0) throw new Error("primitives: p0 merge failed");

// 1: Steel column beams racked on pallet
const p1 = mergeGeometries([
   palletBase(),
   withColor(new RoundedBoxGeometry(0.24, 0.16, 0.76, 2, 0.02).translate(-0.18, 0.16, 0), COLORS.piecePillar),
   withColor(new RoundedBoxGeometry(0.24, 0.16, 0.76, 2, 0.02).translate(0.18, 0.16, 0), COLORS.piecePillar),
   withColor(new RoundedBoxGeometry(0.24, 0.16, 0.76, 2, 0.02).translate(-0.18, 0.33, 0), COLORS.piecePillar),
   withColor(new RoundedBoxGeometry(0.24, 0.16, 0.76, 2, 0.02).translate(0.18, 0.33, 0), COLORS.piecePillar),
]);
if (!p1) throw new Error("primitives: p1 merge failed");

// 2: Modular brick wall panels with dark banding
const p2 = mergeGeometries([
   palletBase(),
   withColor(new RoundedBoxGeometry(0.75, 0.38, 0.75, 2, 0.02).translate(0, 0.27, 0), COLORS.pieceWall),
   withColor(new BoxGeometry(0.77, 0.4, 0.04).translate(0, 0.27, -0.2), COLORS.craneDark),
   withColor(new BoxGeometry(0.77, 0.4, 0.04).translate(0, 0.27, 0.2), COLORS.craneDark),
]);
if (!p2) throw new Error("primitives: p2 merge failed");

// 3: Glazing A-frame rack with window units
const p3 = mergeGeometries([
   palletBase(),
   withColor(new BoxGeometry(0.14, 0.38, 0.6).translate(0, 0.27, 0), COLORS.woodPallet),
   withColor(new BoxGeometry(0.04, 0.36, 0.65).translate(-0.16, 0.27, 0), COLORS.pieceWindowFrame),
   withColor(new BoxGeometry(0.05, 0.28, 0.55).translate(-0.16, 0.27, 0), COLORS.pieceWindow),
   withColor(new BoxGeometry(0.04, 0.36, 0.65).translate(0.16, 0.27, 0), COLORS.pieceWindowFrame),
   withColor(new BoxGeometry(0.05, 0.28, 0.55).translate(0.16, 0.27, 0), COLORS.pieceWindow),
]);
if (!p3) throw new Error("primitives: p3 merge failed");

// 4: Stacked roof caps / trusses
const p4 = mergeGeometries([
   palletBase(),
   withColor(new RoundedBoxGeometry(0.76, 0.12, 0.76, 2, 0.03).translate(0, 0.14, 0), COLORS.pieceRoof),
   withColor(new RoundedBoxGeometry(0.68, 0.12, 0.68, 2, 0.03).translate(0, 0.26, 0), COLORS.pieceRoof),
   withColor(new RoundedBoxGeometry(0.56, 0.12, 0.56, 2, 0.03).translate(0, 0.38, 0), COLORS.pieceRoof),
]);
if (!p4) throw new Error("primitives: p4 merge failed");

export const pileGeos: readonly BufferGeometry[] = [p0, p1, p2, p3, p4];
export const pileGeo = p0;

// Crane Tower Mast: lattice structure with 4 corner posts and collars
function createMast(): BufferGeometry {
   const geos: BufferGeometry[] = [];
   geos.push(withColor(new BoxGeometry(0.06, 10, 0.06).translate(-0.22, 5, -0.22), COLORS.craneYellow));
   geos.push(withColor(new BoxGeometry(0.06, 10, 0.06).translate(0.22, 5, -0.22), COLORS.craneYellow));
   geos.push(withColor(new BoxGeometry(0.06, 10, 0.06).translate(-0.22, 5, 0.22), COLORS.craneYellow));
   geos.push(withColor(new BoxGeometry(0.06, 10, 0.06).translate(0.22, 5, 0.22), COLORS.craneYellow));
   geos.push(withColor(new BoxGeometry(0.9, 0.1, 0.9).translate(0, 0.05, 0), COLORS.craneDark));
   for (let y = 1.6; y <= 10; y += 1.6) {
      geos.push(withColor(new BoxGeometry(0.44, 0.04, 0.04).translate(0, y, -0.22), COLORS.craneDark));
      geos.push(withColor(new BoxGeometry(0.44, 0.04, 0.04).translate(0, y, 0.22), COLORS.craneDark));
      geos.push(withColor(new BoxGeometry(0.04, 0.04, 0.44).translate(-0.22, y, 0), COLORS.craneDark));
      geos.push(withColor(new BoxGeometry(0.04, 0.04, 0.44).translate(0.22, y, 0), COLORS.craneDark));
   }
   const merged = mergeGeometries(geos);
   for (const g of geos) g.dispose();
   if (!merged) throw new Error("primitives: mast merge failed");
   return merged;
}
export const mastGeo = createMast();

// Crane Jib: working truss arm, counter-jib with counterweight, cab with windows and apex tower
function createJib(): BufferGeometry {
   const geos: BufferGeometry[] = [];
   // Front working arm: bottom chords and top apex chord
   geos.push(withColor(new BoxGeometry(0.05, 0.05, 10.5).translate(-0.18, -0.1, 5.25), COLORS.craneYellow));
   geos.push(withColor(new BoxGeometry(0.05, 0.05, 10.5).translate(0.18, -0.1, 5.25), COLORS.craneYellow));
   geos.push(withColor(new BoxGeometry(0.05, 0.05, 10.5).translate(0, 0.45, 5.25), COLORS.craneYellow));
   for (let z = 1.5; z <= 10.5; z += 1.5) {
      geos.push(withColor(new BoxGeometry(0.36, 0.03, 0.03).translate(0, -0.1, z), COLORS.craneDark));
      geos.push(withColor(new BoxGeometry(0.03, 0.55, 0.03).rotateZ(0.33).translate(-0.09, 0.175, z), COLORS.craneDark));
      geos.push(withColor(new BoxGeometry(0.03, 0.55, 0.03).rotateZ(-0.33).translate(0.09, 0.175, z), COLORS.craneDark));
   }
   // Rear counter-jib deck and counterweight
   geos.push(withColor(new BoxGeometry(0.55, 0.08, 3.2).translate(0, -0.06, -1.6), COLORS.craneDark));
   geos.push(withColor(new BoxGeometry(0.8, 0.65, 0.85).translate(0, 0.35, -2.6), COLORS.craneDark));
   // Slewing collar
   geos.push(withColor(new CylinderGeometry(0.42, 0.42, 0.25, 12).translate(0, -0.2, 0), COLORS.craneDark));
   // Operator's Cab
   geos.push(withColor(new BoxGeometry(0.55, 0.75, 0.75).translate(0.42, -0.15, 0.45), COLORS.craneYellow));
   geos.push(withColor(new BoxGeometry(0.45, 0.35, 0.04).translate(0.42, -0.05, 0.83), COLORS.cabGlass));
   geos.push(withColor(new BoxGeometry(0.04, 0.35, 0.45).translate(0.7, -0.05, 0.45), COLORS.cabGlass));
   // Apex tower
   geos.push(withColor(new BoxGeometry(0.05, 1.4, 0.05).rotateX(-0.2).translate(0, 0.9, -0.15), COLORS.craneYellow));

   const merged = mergeGeometries(geos);
   for (const g of geos) g.dispose();
   if (!merged) throw new Error("primitives: jib merge failed");
   return merged;
}
export const jibGeo = createJib();

// Trolley carriage that rides along the jib
function createTrolley(): BufferGeometry {
   const geos: BufferGeometry[] = [];
   geos.push(withColor(new BoxGeometry(0.46, 0.12, 0.36), COLORS.craneYellow));
   geos.push(withColor(new CylinderGeometry(0.06, 0.06, 0.08, 8).rotateZ(Math.PI / 2).translate(-0.16, 0.06, -0.14), COLORS.craneDark));
   geos.push(withColor(new CylinderGeometry(0.06, 0.06, 0.08, 8).rotateZ(Math.PI / 2).translate(0.16, 0.06, -0.14), COLORS.craneDark));
   geos.push(withColor(new CylinderGeometry(0.06, 0.06, 0.08, 8).rotateZ(Math.PI / 2).translate(-0.16, 0.06, 0.14), COLORS.craneDark));
   geos.push(withColor(new CylinderGeometry(0.06, 0.06, 0.08, 8).rotateZ(Math.PI / 2).translate(0.16, 0.06, 0.14), COLORS.craneDark));
   const merged = mergeGeometries(geos);
   for (const g of geos) g.dispose();
   if (!merged) throw new Error("primitives: trolley merge failed");
   return merged;
}
export const trolleyGeo = createTrolley();

export const cableGeo = new CylinderGeometry(0.02, 0.02, 1, 6);

// Hook block: pulley block housing, sheave, swivel pin and metallic hook (height 1.2m, centered at y = 0)
function createHookBlock(): BufferGeometry {
   const housing = withColor(new RoundedBoxGeometry(0.34, 0.64, 0.32, 2, 0.04).translate(0, 0.22, 0), COLORS.craneYellow);
   const sheave = withColor(new CylinderGeometry(0.12, 0.12, 0.35, 12).rotateZ(Math.PI / 2).translate(0, 0.22, 0), COLORS.craneDark);
   const pin = withColor(new CylinderGeometry(0.065, 0.065, 0.16, 8).translate(0, -0.18, 0), COLORS.steel);
   const hookCurve = withColor(new TorusGeometry(0.14, 0.045, 8, 16, Math.PI * 1.3).rotateZ(Math.PI * 0.4).translate(0, -0.38, 0), COLORS.steelLight);
   const merged = mergeGeometries([housing, sheave, pin, hookCurve]);
   housing.dispose();
   sheave.dispose();
   pin.dispose();
   hookCurve.dispose();
   if (!merged) throw new Error("primitives: hook merge failed");
   return merged;
}
export const hookGeo = createHookBlock();

// Stylized construction hard hat for worker: curved dome crown, brim and top ridge
function createHardHat(): BufferGeometry {
   const dome = withColor(new SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5).translate(0, 0.02, 0), COLORS.craneYellow);
   const brim = withColor(new CylinderGeometry(0.155, 0.155, 0.015, 14).translate(0, 0.01, 0), COLORS.craneYellow);
   const ridge = withColor(new BoxGeometry(0.025, 0.03, 0.16).translate(0, 0.08, 0), COLORS.craneYellow);
   const merged = mergeGeometries([dome, brim, ridge]);
   dome.dispose();
   brim.dispose();
   ridge.dispose();
   if (!merged) throw new Error("primitives: hat merge failed");
   return merged;
}
export const hatGeo = createHardHat();

export const groundGeo = new PlaneGeometry(16, 14);
export const ringGeo = new RingGeometry(0.42, 0.55, 24);
export const blobGeo = new RingGeometry(0.15, 0.32, 20);

export const steel = new MeshStandardMaterial({ color: COLORS.craneDark, roughness: 0.5, metalness: 0.2 });
export const jibMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.45 });
export const hookMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.15 });
export const craneLatticeMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.1 });
export const trolleyMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.45 });
export const pileMats = pileGeos.map(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.65 }));
export const hatMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.35 });
export const groundMat = new MeshStandardMaterial({ color: COLORS.dirt, roughness: 0.95 });
export const pieceMat = new MeshStandardMaterial({ color: "#ffffff", roughness: 0.65 });
export const slotMat = new MeshStandardMaterial({ color: COLORS.guideGold, emissive: COLORS.guideGold, emissiveIntensity: 0.9, roughness: 0.4 });
export const guideMat = new MeshBasicMaterial({ color: COLORS.guideSlate, transparent: true, opacity: 0.9, depthWrite: false });
export const flashMat = new MeshBasicMaterial({ color: COLORS.flashRed, transparent: true, opacity: 0, depthWrite: false });

/**
 * Procedural canvas texture for the construction site ground pad (512x512).
 * Sandy dirt foundation, vehicle tracks, building slab, pile bays and hazard safety markings.
 */
export function drawPad(ctx: CanvasRenderingContext2D, w: number, h: number): void {
   // Warm sandy earth base
   ctx.fillStyle = COLORS.dirt;
   ctx.fillRect(0, 0, w, h);

   // Soil noise and ruts
   ctx.fillStyle = COLORS.dirtDark;
   for (let i = 0; i < 64; i++) {
      const rx = (i * 97) % w;
      const ry = (i * 53) % h;
      ctx.globalAlpha = 0.15 + (i % 4) * 0.05;
      ctx.beginPath();
      ctx.ellipse(rx, ry, 12 + (i % 8) * 3, 6 + (i % 5) * 2, (i * 0.3) % Math.PI, 0, Math.PI * 2);
      ctx.fill();
   }

   // Truck tire tracks from rear entrance towards site
   ctx.globalAlpha = 0.22;
   ctx.fillStyle = COLORS.dirtDark;
   ctx.fillRect(w * 0.28, 0, 14, h * 0.45);
   ctx.fillRect(w * 0.34, 0, 14, h * 0.45);
   ctx.fillRect(w * 0.62, 0, 14, h * 0.45);
   ctx.fillRect(w * 0.68, 0, 14, h * 0.45);

   // Concrete foundation pad for the building slots (z approx 8 to 11, bottom portion)
   ctx.globalAlpha = 0.9;
   ctx.fillStyle = COLORS.concrete;
   const bx = w * 0.18;
   const by = h * 0.65;
   const bw = w * 0.64;
   const bh = h * 0.28;
   ctx.fillRect(bx, by, bw, bh);

   // Concrete expansion joints
   ctx.strokeStyle = COLORS.concreteDark;
   ctx.lineWidth = 2;
   ctx.beginPath();
   ctx.moveTo(bx + bw * 0.33, by);
   ctx.lineTo(bx + bw * 0.33, by + bh);
   ctx.moveTo(bx + bw * 0.66, by);
   ctx.lineTo(bx + bw * 0.66, by + bh);
   ctx.moveTo(bx, by + bh * 0.5);
   ctx.lineTo(bx + bw, by + bh * 0.5);
   ctx.stroke();

   // Crane foundation base pad with diagonal hazard stripes
   const cx = w * 0.44;
   const cy = h * 0.08;
   const cw = w * 0.12;
   const ch = h * 0.1;
   ctx.fillStyle = COLORS.craneDark;
   ctx.fillRect(cx, cy, cw, ch);

   ctx.lineWidth = 3;
   ctx.strokeStyle = COLORS.safetyYellow;
   ctx.strokeRect(cx + 2, cy + 2, cw - 4, ch - 4);

   ctx.globalAlpha = 1;
}
