// The zone tiles lie just in front of the goal plane, so a ball in the net is seen through them. Lit
// (0.36 of the pink accent), the selected tile turned the white ball in the net pink and hid its black
// panels; at the idle 0.1 the ball reads as a football again. zoneOpacity keeps the highlight while it
// marks the chosen zone and fades it to idle before the ball goes behind it; Scene.tsx draws the tiles
// with it.
import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { BALL_RADIUS } from "./assets";
import { SPOT_Z } from "./layout";
import { FLIGHT_MS, HOLD_MS, RUNUP_MS, type Phase } from "./rules";
import { ZONE_FADE_FROM, ZONE_IDLE_OPACITY, ZONE_LIT_OPACITY, ZONE_PLANE_Z, zoneOpacity } from "./zones";

const PHASES: Array<[Phase, number]> = [
   ["aim", 20_000],
   ["runup", RUNUP_MS],
   ["flight", FLIGHT_MS],
   ["hold", HOLD_MS],
];
const PULSES = [-0.06, 0, 0.06];

/** Every frame of a phase at 60 fps, plus both ends. */
function frames(length: number): number[] {
   const out: number[] = [];
   for (let ms = 0; ms < length; ms += 1000 / 60) out.push(ms);
   out.push(length);
   return out;
}

describe("penalty-hero zone tiles", () => {
   it("draws every tile but the selected one at the idle level, in every phase", () => {
      for (const [phase, length] of PHASES)
         for (const ms of frames(length)) for (const pulse of PULSES) expect(zoneOpacity(phase, ms, false, pulse)).toBe(ZONE_IDLE_OPACITY);
   });

   it("lights the selected tile while the shot is aimed and run up to, the aim's pulse on top", () => {
      for (const pulse of PULSES) expect(zoneOpacity("aim", 5_000, true, pulse)).toBeCloseTo(ZONE_LIT_OPACITY + pulse, 12);
      for (const ms of frames(RUNUP_MS)) expect(zoneOpacity("runup", ms, true, 0)).toBe(ZONE_LIT_OPACITY);
      expect(ZONE_LIT_OPACITY).toBe(0.36);
      expect(ZONE_IDLE_OPACITY).toBe(0.1);
   });

   it("keeps the highlight through most of the flight, then fades it smoothly to idle", () => {
      let last = Infinity;
      for (const ms of frames(FLIGHT_MS)) {
         const o = zoneOpacity("flight", ms, true, 0);
         if (ms <= FLIGHT_MS * ZONE_FADE_FROM) expect(o).toBe(ZONE_LIT_OPACITY);
         expect(o).toBeLessThanOrEqual(last);
         // no pop: at most a fifth of the fade in one 60 fps frame
         if (last !== Infinity) expect(last - o).toBeLessThan((ZONE_LIT_OPACITY - ZONE_IDLE_OPACITY) / 5);
         last = o;
      }
      expect(zoneOpacity("flight", FLIGHT_MS, true, 0)).toBeCloseTo(ZONE_IDLE_OPACITY, 12);
   });

   it("is at the idle level from the moment the ball reaches the tiles, through the whole hold", () => {
      // Scene.tsx flies the ball's centre from SPOT_Z to the goal plane: z = SPOT_Z * (1 - p)
      const reach = 1 - (ZONE_PLANE_Z + BALL_RADIUS) / SPOT_Z;
      for (const ms of frames(FLIGHT_MS)) {
         if (ms / FLIGHT_MS < reach) continue;
         expect(zoneOpacity("flight", ms, true, 0)).toBeLessThan(ZONE_IDLE_OPACITY + 0.003);
      }
      // the hold: the ball in the net, saved back out or wide behind the goal line
      for (const ms of frames(HOLD_MS)) for (const pulse of PULSES) expect(zoneOpacity("hold", ms, true, pulse)).toBeLessThanOrEqual(ZONE_IDLE_OPACITY);
   });

   it("Scene.tsx draws the tiles with it, on the tiles' plane", () => {
      const source = ts.createSourceFile("Scene.tsx", readFileSync(new URL("./Scene.tsx", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const nodes: ts.Node[] = [];
      const visit = (n: ts.Node) => {
         nodes.push(n);
         ts.forEachChild(n, visit);
      };
      visit(source);
      const zones = nodes.find((n): n is ts.FunctionDeclaration => ts.isFunctionDeclaration(n) && n.name?.text === "Zones")!;
      const inZones = nodes.filter((n) => n.pos >= zones.pos && n.end <= zones.end);
      // each frame, every tile's opacity comes from zoneOpacity with the run's phase and its progress
      const opacity = inZones.filter(
         (n): n is ts.BinaryExpression => ts.isBinaryExpression(n) && /\.opacity$/.test(n.left.getText()) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken,
      );
      expect(opacity).toHaveLength(1);
      const value = opacity[0].right;
      expect(ts.isCallExpression(value) && value.expression.getText()).toBe("zoneOpacity");
      const args = (value as ts.CallExpression).arguments.map((a) => a.getText());
      expect(args.slice(0, 3)).toEqual(["run.phase", "run.phaseMs", "i === selected"]);
      // the tiles' group sits on ZONE_PLANE_Z, in front of the goal plane the reticle and the shots use
      const group = inZones.find((n): n is ts.JsxOpeningElement => ts.isJsxOpeningElement(n) && n.tagName.getText() === "group")!;
      expect(group.attributes.properties.map((a) => a.getText())).toEqual(['name="zones"', "position={[0, 0, ZONE_PLANE_Z]}"]);
      expect(ZONE_PLANE_Z).toBeGreaterThan(0);
   });
});
