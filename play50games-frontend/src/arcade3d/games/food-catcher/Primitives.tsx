"use client";

// Kitchen, chef and food stand-ins for Food Catcher.
// Deliberate 2-3 tone shapes with rounded/bevelled features from COLORS in looks.ts.
// The chef stand-in stands on WORKTOP_TOP_Y = 0.05 (Scene.tsx root position).
import { memo, useEffect, useMemo } from "react";
import {
   BoxGeometry,
   Color,
   CylinderGeometry,
   Euler,
   Float32BufferAttribute,
   Matrix4,
   Quaternion,
   RepeatWrapping,
   Vector3,
   type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useCanvasTexture, type CanvasDraw } from "@/arcade3d/core/render";
import { COLORS } from "./looks";

export { COLORS };

/** The counter box (centre y, height): its top face is the rules' floor, y 0. */
export const COUNTER = { y: -0.28, h: 0.56 } as const;
/** The wooden worktop on the counter (centre y, height), 1 cm sunk into the counter's top. */
export const WORKTOP = { y: 0.02, h: 0.06 } as const;
/**
 * The worktop's top face (y 0.05), where the chef stands: Scene.tsx puts the chef's root group here,
 * so its soles are on the board and not 5 cm inside it (the rules' catch box, y 0 to 1.6, is unchanged).
 */
export const WORKTOP_TOP_Y = WORKTOP.y + WORKTOP.h / 2;

/** The wall's front face (the wall box is centred on z = -0.85, 0.18 deep). */
const WALL_FRONT = -0.76;
/** The chalkboard's slate (the frame is 0.07 wider on every side). */
const BOARD = { x: -2.2, y: 4.65, w: 1.12, h: 0.72, border: 0.07 } as const;
/** The pot shelf: the plank's top centre, its width and depth. */
const SHELF = { x: 1.6, top: 4.78, w: 1.64, depth: 0.36, thick: 0.07 } as const;
const MENU_TEX = { w: 448, h: 288 } as const;

/** The chalkboard: "MENU" and three faint dish lines with a price dash, on dark slate. */
const drawMenuBoard: CanvasDraw = (ctx, w, h) => {
   ctx.fillStyle = COLORS.slate;
   ctx.fillRect(0, 0, w, h);
   // subtle chalk dusting
   ctx.fillStyle = "rgba(241, 245, 249, 0.05)";
   for (const [x, y, rx, ry] of [
      [0.3, 0.62, 0.22, 0.1],
      [0.72, 0.4, 0.18, 0.08],
      [0.55, 0.85, 0.3, 0.07],
   ]) {
      ctx.beginPath();
      ctx.ellipse(x * w, y * h, rx * w, ry * h, -0.12, 0, Math.PI * 2);
      ctx.fill();
   }
   ctx.fillStyle = COLORS.chalk;
   ctx.textAlign = "center";
   ctx.textBaseline = "middle";
   ctx.font = `700 ${Math.round(h * 0.32)}px "Trebuchet MS", "Segoe UI", Arial, sans-serif`;
   ctx.fillText("MENU", w / 2, h * 0.26);
   ctx.strokeStyle = COLORS.chalkFaint;
   ctx.lineCap = "round";
   ctx.lineWidth = h * 0.035;
   for (const [y, end] of [
      [0.56, 0.6],
      [0.71, 0.52],
      [0.86, 0.64],
   ]) {
      ctx.beginPath();
      ctx.moveTo(w * 0.13, h * y);
      ctx.lineTo(w * end, h * y);
      ctx.moveTo(w * 0.76, h * y);
      ctx.lineTo(w * 0.87, h * y);
      ctx.stroke();
   }
};

/** Crisp running-bond subway tile pattern with bevelled highlights and clean grout lines. */
const drawSubwayTiles: CanvasDraw = (ctx, w, h) => {
   ctx.fillStyle = COLORS.wallGrout;
   ctx.fillRect(0, 0, w, h);
   const tileW = 64;
   const tileH = 32;
   const grout = 3;
   const rows = Math.ceil(h / tileH);
   const cols = Math.ceil(w / tileW) + 1;
   for (let r = 0; r < rows; r++) {
      const offsetX = (r % 2) * (tileW / 2);
      for (let c = -1; c < cols; c++) {
         const x = c * tileW + offsetX + grout;
         const y = r * tileH + grout;
         const bw = tileW - grout * 2;
         const bh = tileH - grout * 2;
         ctx.fillStyle = COLORS.wallTile;
         ctx.fillRect(x, y, bw, bh);
         // Subtle top/left bevel highlight
         ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
         ctx.fillRect(x, y, bw, 2);
         ctx.fillRect(x, y, 2, bh);
         // Subtle bottom/right bevel shadow
         ctx.fillStyle = "rgba(148, 163, 184, 0.35)";
         ctx.fillRect(x, y + bh - 2, bw, 2);
         ctx.fillRect(x + bw - 2, y, 2, bh);
      }
   }
};

/** Terracotta restaurant kitchen quarry floor tiles. */
const drawFloorTiles: CanvasDraw = (ctx, w, h) => {
   ctx.fillStyle = COLORS.floorGrout;
   ctx.fillRect(0, 0, w, h);
   const tileS = 64;
   const grout = 4;
   const rows = Math.ceil(h / tileS);
   const cols = Math.ceil(w / tileS);
   for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
         const x = c * tileS + grout;
         const y = r * tileS + grout;
         const s = tileS - grout * 2;
         ctx.fillStyle = (r + c) % 2 === 0 ? COLORS.floor : COLORS.floorTileAlt;
         ctx.fillRect(x, y, s, s);
         ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
         ctx.fillRect(x, y, s, 2);
         ctx.fillRect(x, y, 2, s);
      }
   }
};

type AddPiece = (
   geometry: BufferGeometry,
   color: string,
   x: number,
   y: number,
   z: number,
   rotX?: number,
   rotZ?: number
) => void;

/** Vertex-coloured pieces merged into one geometry, costing one draw call together. */
function mergedPieces(build: (add: AddPiece) => void): BufferGeometry {
   const pieces: BufferGeometry[] = [];
   const matrix = new Matrix4();
   const turn = new Quaternion();
   const euler = new Euler();
   const at = new Vector3();
   const one = new Vector3(1, 1, 1);
   const tint = new Color();
   build((geometry, color, x, y, z, rotX = 0, rotZ = 0) => {
      geometry.applyMatrix4(matrix.compose(at.set(x, y, z), turn.setFromEuler(euler.set(rotX, 0, rotZ)), one));
      tint.set(color);
      const colors = new Float32Array(geometry.getAttribute("position").count * 3);
      for (let i = 0; i < colors.length; i += 3) {
         colors[i] = tint.r;
         colors[i + 1] = tint.g;
         colors[i + 2] = tint.b;
      }
      geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
      pieces.push(geometry);
   });
   const merged = mergeGeometries(pieces);
   for (const piece of pieces) piece.dispose();
   if (!merged) throw new Error("food-catcher kitchen decor: pieces did not merge");
   return merged;
}

/** A pot on the shelf: a body, rolled rim, handles or lid. */
function addPot(
   add: AddPiece,
   x: number,
   radius: number,
   height: number,
   color: string,
   trim: string,
   kind: "saucepan" | "stockpot" | "pan"
): void {
   const z = WALL_FRONT + SHELF.depth / 2;
   const base = SHELF.top;
   add(new CylinderGeometry(radius, radius * 0.94, height, 22), color, x, base + height / 2, z);
   add(new CylinderGeometry(radius * 1.07, radius * 1.07, 0.028, 22), color, x, base + height - 0.014, z);
   if (kind === "stockpot") {
      add(new CylinderGeometry(radius * 0.4, radius * 1.02, 0.06, 22), color, x, base + height + 0.03, z);
      add(new CylinderGeometry(0.03, 0.04, 0.045, 10), COLORS.potKnob, x, base + height + 0.08, z);
      add(new BoxGeometry(0.08, 0.035, 0.05), trim, x - radius - 0.035, base + height * 0.8, z);
      add(new BoxGeometry(0.08, 0.035, 0.05), trim, x + radius + 0.035, base + height * 0.8, z);
      return;
   }
   const side = kind === "saucepan" ? -1 : 1;
   const length = radius * 1.7;
   add(
      new BoxGeometry(length, 0.035, 0.045),
      trim,
      x + side * (radius + length / 2 - 0.02),
      base + height - 0.025,
      z,
      0,
      side * 0.18
   );
}

/** Wooden parts: chalkboard frame, chalk ledge, shelf plank. */
function buildWood(): BufferGeometry {
   return mergedPieces((add) => {
      const frameW = BOARD.w + BOARD.border * 2;
      const frameH = BOARD.h + BOARD.border * 2;
      add(new BoxGeometry(frameW, frameH, 0.05), COLORS.frame, BOARD.x, BOARD.y, WALL_FRONT + 0.025);
      const ledgeY = BOARD.y - frameH / 2 - 0.02;
      add(new BoxGeometry(frameW * 0.82, 0.04, 0.1), COLORS.frame, BOARD.x, ledgeY, WALL_FRONT + 0.05);
      add(new CylinderGeometry(0.018, 0.018, 0.14, 8), COLORS.chalk, BOARD.x + 0.3, ledgeY + 0.038, WALL_FRONT + 0.06, 0, Math.PI / 2);
      add(
         new BoxGeometry(SHELF.w, SHELF.thick, SHELF.depth),
         COLORS.shelfWood,
         SHELF.x,
         SHELF.top - SHELF.thick / 2,
         WALL_FRONT + SHELF.depth / 2
      );
   });
}

/** Metal parts: shelf brackets, copper saucepan, steel stockpot, steel pan. */
function buildMetal(): BufferGeometry {
   return mergedPieces((add) => {
      const under = SHELF.top - SHELF.thick;
      const drop = 0.24;
      const reach = SHELF.depth - 0.06;
      const brace = Math.hypot(drop, reach);
      for (const dx of [-0.6, 0.6]) {
         add(new BoxGeometry(0.045, drop, 0.04), COLORS.ironBracket, SHELF.x + dx, under - drop / 2, WALL_FRONT + 0.02);
         add(
            new BoxGeometry(0.045, brace, 0.035),
            COLORS.ironBracket,
            SHELF.x + dx,
            under - drop / 2,
            WALL_FRONT + reach / 2,
            Math.atan2(reach, drop)
         );
      }
      addPot(add, SHELF.x - 0.6, 0.2, 0.25, COLORS.copperPot, COLORS.copperDark, "saucepan");
      addPot(add, SHELF.x, 0.26, 0.34, COLORS.steelPot, COLORS.steelDark, "stockpot");
      addPot(add, SHELF.x + 0.6, 0.21, 0.1, COLORS.steelPot, COLORS.potKnob, "pan");
   });
}

/** WallDecor: chalkboard and shelf of pots behind the falling food (3 draw calls). */
const WallDecor = memo(function WallDecor() {
   const menu = useCanvasTexture(MENU_TEX.w, MENU_TEX.h, drawMenuBoard);
   const parts = useMemo(() => ({ wood: buildWood(), metal: buildMetal() }), []);
   useEffect(
      () => () => {
         parts.wood.dispose();
         parts.metal.dispose();
      },
      [parts]
   );
   return (
      <group name="wall-decor">
         <mesh position={[BOARD.x, BOARD.y, WALL_FRONT + 0.056]} name="menu-board">
            <planeGeometry args={[BOARD.w, BOARD.h]} />
            <meshStandardMaterial map={menu} roughness={0.95} />
         </mesh>
         <mesh geometry={parts.wood} name="decor-wood">
            <meshStandardMaterial vertexColors roughness={0.8} />
         </mesh>
         <mesh geometry={parts.metal} name="decor-metal">
            <meshStandardMaterial vertexColors roughness={0.42} metalness={0.4} />
         </mesh>
      </group>
   );
});

/**
 * Modern restaurant kitchen: clean subway tiled walls, extended cabinetry,
 * butcher block worktop and terracotta quarry floor covering all screen sizes.
 */
export const Kitchen = memo(function Kitchen() {
   const subwayTiles = useCanvasTexture(512, 512, drawSubwayTiles);
   const floorTiles = useCanvasTexture(512, 512, drawFloorTiles);

   useEffect(() => {
      subwayTiles.wrapS = subwayTiles.wrapT = RepeatWrapping;
      subwayTiles.repeat.set(12, 9);
      subwayTiles.needsUpdate = true;
      floorTiles.wrapS = floorTiles.wrapT = RepeatWrapping;
      floorTiles.repeat.set(10, 5);
      floorTiles.needsUpdate = true;
   }, [subwayTiles, floorTiles]);

   return (
      <group name="kitchen">
         {/* Subway-tiled back wall: spans wide and tall to fill portrait and ultra-wide */}
         <mesh position={[0, 4.0, -0.85]} receiveShadow={false} name="kitchen-wall">
            <planeGeometry args={[50, 36]} />
            <meshStandardMaterial map={subwayTiles} color={COLORS.wall} roughness={0.45} />
         </mesh>

         {/* Terracotta tiled floor plane: covers any downward view angle at 390x844 */}
         <mesh position={[0, -10.0, 5.0]} rotation={[-Math.PI / 2, 0, 0]} name="kitchen-floor">
            <planeGeometry args={[60, 30]} />
            <meshStandardMaterial map={floorTiles} roughness={0.7} />
         </mesh>

         {/* Extended base cabinetry spanning across screen */}
         <mesh position={[0, -5.8, 0.1]} name="kitchen-cabinet">
            <boxGeometry args={[48, 10.5, 1.5]} />
            <meshStandardMaterial color={COLORS.cabinet} roughness={0.75} />
         </mesh>

         {/* Base cabinet stainless toe-kick plate */}
         <mesh position={[0, -10.5, 0.82]} name="kitchen-toekick">
            <boxGeometry args={[48, 1.0, 0.1]} />
            <meshStandardMaterial color={COLORS.cabinetTrim} roughness={0.5} metalness={0.5} />
         </mesh>

         {/* Stainless steel counter body */}
         <mesh position={[0, COUNTER.y, 0.15]} name="counter-body">
            <boxGeometry args={[9.4, COUNTER.h, 1.7]} />
            <meshStandardMaterial color={COLORS.counter} roughness={0.4} metalness={0.4} />
         </mesh>

         {/* Butcher block worktop: oak wood grain tone, WORKTOP_TOP_Y = 0.05 */}
         <mesh position={[0, WORKTOP.y, 0.15]} name="worktop">
            <boxGeometry args={[9.2, WORKTOP.h, 1.55]} />
            <meshStandardMaterial color={COLORS.worktop} roughness={0.65} />
         </mesh>

         {/* Stainless steel counter front bevel lip */}
         <mesh position={[0, -0.02, 0.95]} name="counter-edge">
            <boxGeometry args={[9.4, 0.1, 0.08]} />
            <meshStandardMaterial color={COLORS.counterEdge} roughness={0.35} metalness={0.6} />
         </mesh>

         {/* Wall-mounted menu board and pot shelf */}
         <WallDecor />
      </group>
   );
});

/** Deliberate, rounded food & junk stand-ins */

export function ApplePrimitive() {
   return (
      <group name="apple-primitive">
         <mesh position={[0, -0.04, 0]} scale={[1.05, 0.96, 1.05]}>
            <sphereGeometry args={[0.42, 18, 14]} />
            <meshStandardMaterial color={COLORS.apple} roughness={0.35} />
         </mesh>
         <mesh position={[0.1, 0.1, 0.1]} scale={[0.65, 0.65, 0.65]}>
            <sphereGeometry args={[0.22, 12, 10]} />
            <meshStandardMaterial color={COLORS.appleHighlight} roughness={0.3} />
         </mesh>
         <mesh position={[0, 0.32, 0]} scale={[1, 0.3, 1]}>
            <cylinderGeometry args={[0.1, 0.02, 0.08, 12]} />
            <meshStandardMaterial color={COLORS.appleShade} roughness={0.7} />
         </mesh>
         <mesh position={[0.02, 0.42, 0]} rotation={[0, 0, -0.2]}>
            <cylinderGeometry args={[0.025, 0.035, 0.22, 8]} />
            <meshStandardMaterial color={COLORS.stem} roughness={0.8} />
         </mesh>
         <mesh position={[0.12, 0.38, 0.06]} rotation={[0.4, 0.3, 0.6]} scale={[1.4, 0.5, 0.8]}>
            <sphereGeometry args={[0.14, 10, 8]} />
            <meshStandardMaterial color={COLORS.leaf} roughness={0.4} />
         </mesh>
      </group>
   );
}

export function BurgerPrimitive() {
   return (
      <group name="burger-primitive">
         {/* Bottom toasted bun */}
         <mesh position={[0, -0.22, 0]} scale={[1, 0.55, 1]}>
            <sphereGeometry args={[0.38, 18, 12]} />
            <meshStandardMaterial color={COLORS.bun} roughness={0.7} />
         </mesh>
         {/* Grilled burger patty */}
         <mesh position={[0, -0.06, 0]}>
            <cylinderGeometry args={[0.39, 0.39, 0.14, 18]} />
            <meshStandardMaterial color={COLORS.patty} roughness={0.85} />
         </mesh>
         {/* Melted cheese slice draped over patty */}
         <mesh position={[0, 0.03, 0]} rotation={[0, Math.PI / 4, 0]}>
            <boxGeometry args={[0.56, 0.035, 0.56]} />
            <meshStandardMaterial color={COLORS.cheese} roughness={0.4} />
         </mesh>
         {/* Crisp lettuce */}
         <mesh position={[0, 0.08, 0]} scale={[1.08, 0.2, 1.08]}>
            <cylinderGeometry args={[0.42, 0.38, 0.08, 10]} />
            <meshStandardMaterial color={COLORS.lettuce} roughness={0.5} flatShading />
         </mesh>
         {/* Juicy tomato slice */}
         <mesh position={[0, 0.14, 0]}>
            <cylinderGeometry args={[0.36, 0.36, 0.06, 16]} />
            <meshStandardMaterial color={COLORS.tomato} roughness={0.35} />
         </mesh>
         {/* Golden brioche crown */}
         <mesh position={[0, 0.28, 0]} scale={[1, 0.65, 1]}>
            <sphereGeometry args={[0.4, 18, 12]} />
            <meshStandardMaterial color={COLORS.bunTop} roughness={0.6} />
         </mesh>
         {/* Toasted sesame seeds */}
         <mesh position={[0.08, 0.49, 0.08]} rotation={[0.2, 0.4, 0.2]}>
            <boxGeometry args={[0.04, 0.02, 0.06]} />
            <meshStandardMaterial color={COLORS.sesame} roughness={0.5} />
         </mesh>
         <mesh position={[-0.1, 0.48, 0.05]} rotation={[-0.1, -0.3, 0.4]}>
            <boxGeometry args={[0.04, 0.02, 0.06]} />
            <meshStandardMaterial color={COLORS.sesame} roughness={0.5} />
         </mesh>
         <mesh position={[0.04, 0.47, -0.12]} rotation={[0.3, 0.1, -0.2]}>
            <boxGeometry args={[0.04, 0.02, 0.06]} />
            <meshStandardMaterial color={COLORS.sesame} roughness={0.5} />
         </mesh>
      </group>
   );
}

export function BananaPrimitive() {
   return (
      <group name="banana-primitive" rotation={[0, 0, 0.7]}>
         {/* Curved peel body */}
         <mesh position={[0, 0, 0]}>
            <capsuleGeometry args={[0.16, 0.52, 6, 12]} />
            <meshStandardMaterial color={COLORS.banana} roughness={0.45} />
         </mesh>
         {/* Green tip */}
         <mesh position={[0, -0.32, 0]}>
            <coneGeometry args={[0.13, 0.16, 6]} />
            <meshStandardMaterial color={COLORS.bananaTip} roughness={0.5} />
         </mesh>
         {/* Brown stem cut */}
         <mesh position={[0, 0.34, 0]}>
            <cylinderGeometry args={[0.06, 0.09, 0.14, 6]} />
            <meshStandardMaterial color={COLORS.bananaStem} roughness={0.8} />
         </mesh>
      </group>
   );
}

export function SockPrimitive() {
   return (
      <group name="sock-primitive" rotation={[0, 0, 0.4]}>
         {/* Heather grey sock body */}
         <mesh>
            <capsuleGeometry args={[0.22, 0.42, 6, 12]} />
            <meshStandardMaterial color={COLORS.sock} roughness={0.8} />
         </mesh>
         {/* Ribbed cuff */}
         <mesh position={[0, 0.24, 0]}>
            <cylinderGeometry args={[0.23, 0.23, 0.12, 14]} />
            <meshStandardMaterial color={COLORS.sockStripe} roughness={0.85} />
         </mesh>
         {/* Contrast toe cap */}
         <mesh position={[0, -0.24, 0]} scale={[1.02, 0.5, 1.02]}>
            <sphereGeometry args={[0.22, 12, 8]} />
            <meshStandardMaterial color={COLORS.sockStripe} roughness={0.85} />
         </mesh>
         {/* Stitched burlap patch */}
         <mesh position={[0.14, -0.1, 0.12]} rotation={[0.2, 0.4, 0.1]}>
            <boxGeometry args={[0.16, 0.16, 0.04]} />
            <meshStandardMaterial color={COLORS.sockPatch} roughness={0.9} />
         </mesh>
         {/* Little hole in the heel */}
         <mesh position={[-0.12, -0.08, 0]}>
            <sphereGeometry args={[0.07, 8, 6]} />
            <meshStandardMaterial color={COLORS.sockHole} roughness={1.0} />
         </mesh>
      </group>
   );
}

export function TinPrimitive() {
   return (
      <group name="tin-primitive">
         {/* Corrugated metal body */}
         <mesh>
            <cylinderGeometry args={[0.28, 0.28, 0.62, 20]} />
            <meshStandardMaterial color={COLORS.tin} metalness={0.6} roughness={0.3} />
         </mesh>
         {/* Printed graphic label band */}
         <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.285, 0.285, 0.36, 20]} />
            <meshStandardMaterial color={COLORS.tinBand} roughness={0.4} />
         </mesh>
         {/* Rolled top rim */}
         <mesh position={[0, 0.31, 0]}>
            <cylinderGeometry args={[0.295, 0.295, 0.03, 20]} />
            <meshStandardMaterial color={COLORS.tinRim} metalness={0.7} roughness={0.2} />
         </mesh>
         {/* Rolled bottom rim */}
         <mesh position={[0, -0.31, 0]}>
            <cylinderGeometry args={[0.295, 0.295, 0.03, 20]} />
            <meshStandardMaterial color={COLORS.tinRim} metalness={0.7} roughness={0.2} />
         </mesh>
         {/* Recessed lid with pull-tab ring */}
         <mesh position={[0, 0.315, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.26, 16]} />
            <meshStandardMaterial color={COLORS.tinLid} metalness={0.65} roughness={0.35} />
         </mesh>
         <mesh position={[0.06, 0.33, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.04, 0.07, 12]} />
            <meshStandardMaterial color={COLORS.tinRim} metalness={0.8} roughness={0.2} />
         </mesh>
      </group>
   );
}

export function ChefPrimitive() {
   return (
      <group name="chef-primitive">
         {/* Double-breasted chef tunic */}
         <mesh position={[0, 0.62, 0]}>
            <capsuleGeometry args={[0.38, 0.55, 6, 14]} />
            <meshStandardMaterial color={COLORS.apron} roughness={0.7} />
         </mesh>
         {/* Double-breasted coat flap */}
         <mesh position={[0, 0.72, 0.28]}>
            <boxGeometry args={[0.55, 0.42, 0.08]} />
            <meshStandardMaterial color={COLORS.apron} roughness={0.7} />
         </mesh>
         {/* Double-breasted buttons (2 columns of 3) */}
         {[-0.12, 0.12].map((bx) =>
            [0.6, 0.74, 0.88].map((by) => (
               <mesh key={`${bx}-${by}`} position={[bx, by, 0.33]}>
                  <cylinderGeometry args={[0.025, 0.025, 0.02, 10]} />
                  <meshStandardMaterial color={COLORS.buttons} roughness={0.5} />
               </mesh>
            ))
         )}
         {/* Folded red cravat / scarf */}
         <mesh position={[0, 1.05, 0.22]}>
            <boxGeometry args={[0.28, 0.16, 0.08]} />
            <meshStandardMaterial color={COLORS.scarf} roughness={0.6} />
         </mesh>
         {/* Friendly round head */}
         <mesh position={[0, 1.22, 0]}>
            <sphereGeometry args={[0.28, 18, 14]} />
            <meshStandardMaterial color={COLORS.skin} roughness={0.6} />
         </mesh>
         {/* Rosy cheeks */}
         <mesh position={[-0.16, 1.18, 0.18]}>
            <sphereGeometry args={[0.06, 10, 8]} />
            <meshStandardMaterial color={COLORS.skinCheek} roughness={0.6} />
         </mesh>
         <mesh position={[0.16, 1.18, 0.18]}>
            <sphereGeometry args={[0.06, 10, 8]} />
            <meshStandardMaterial color={COLORS.skinCheek} roughness={0.6} />
         </mesh>
         {/* Eyes */}
         <mesh position={[-0.1, 1.28, 0.22]}>
            <sphereGeometry args={[0.045, 10, 8]} />
            <meshStandardMaterial color={COLORS.buttons} roughness={0.3} />
         </mesh>
         <mesh position={[0.1, 1.28, 0.22]}>
            <sphereGeometry args={[0.045, 10, 8]} />
            <meshStandardMaterial color={COLORS.buttons} roughness={0.3} />
         </mesh>
         {/* Crisp pleated toque blanche crown */}
         <mesh position={[0, 1.64, 0]}>
            <cylinderGeometry args={[0.36, 0.32, 0.44, 18]} />
            <meshStandardMaterial color={COLORS.hat} roughness={0.5} />
         </mesh>
         {/* Toque headband */}
         <mesh position={[0, 1.4, 0]}>
            <cylinderGeometry args={[0.42, 0.42, 0.1, 18]} />
            <meshStandardMaterial color={COLORS.hatBand} roughness={0.6} />
         </mesh>
      </group>
   );
}

/**
 * The junk tell: unlit two-tone warning disc and rim.
 * Flat in the XY plane facing the camera.
 */
export function BadRing() {
   return (
      <group name="bad-ring">
         <mesh position={[0, 0, -0.5]}>
            <circleGeometry args={[0.62, 28]} />
            <meshBasicMaterial color={COLORS.ring} toneMapped={false} />
         </mesh>
         <mesh>
            <ringGeometry args={[0.52, 0.62, 28]} />
            <meshBasicMaterial color={COLORS.ringRim} toneMapped={false} />
         </mesh>
      </group>
   );
}
