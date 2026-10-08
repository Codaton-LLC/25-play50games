// The football as Scene.tsx draws it: BallPrimitive (BallMesh: a BALL_RADIUS sphere with black panels
// on a canvas texture) alone in the ball's spin group, the group the frame loop turns about x, inside
// the root group it moves along the shot. The sphere is centred on the spin pivot, so the ball rests
// on the grass at BALL_SPOT and spins in place. Neither Hyper3D ball GLB had black panels (README
// "Models"), so no ball GLB is listed or fetched. The football look is pinned too: the scene draws the
// ball, BallPrimitive hands BallMesh the drawBall texture, the texture is white with nine black
// pentagons, the mesh is visible and its material opaque, and the spin turns it about x only.
import { readFileSync } from "node:fs";
import type { ReactElement } from "react";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { Matrix4, SphereGeometry, Vector3, type Texture } from "three";
import { MODEL_MANIFEST } from "@/arcade3d/core/modelManifest";
import { ASSETS, BALL_RADIUS } from "./assets";
import { BallMesh, drawBall } from "./Primitives";
import { BALL_SPOT } from "./rules";

type Props = { children?: unknown; args?: unknown; [key: string]: unknown };

/** BallMesh's <mesh> element, its children and its <sphereGeometry> args. BallMesh is hook-free. */
function ballMesh(map: Texture | null = null): {
   mesh: ReactElement<Props>;
   children: Array<ReactElement<Props>>;
   radius: number;
   geometry: SphereGeometry;
} {
   const mesh = BallMesh({ map }) as ReactElement<Props>;
   const children = (Array.isArray(mesh.props.children) ? mesh.props.children : [mesh.props.children]) as Array<ReactElement<Props>>;
   const sphere = children.find((c) => c.type === "sphereGeometry")!;
   const [radius, widthSegments, heightSegments] = sphere.props.args as [number, number, number];
   return { mesh, children, radius, geometry: new SphereGeometry(radius, widthSegments, heightSegments) };
}

// ---------- drawBall on a recording 2D context ----------

type Point = [number, number];
type Paint = { op: "fillRect"; style: string; rect: [number, number, number, number] } | { op: "fill"; style: string; area: number };

/** Relative luminance (0..255) of a `#rrggbb` fill style. */
function luminance(style: string): number {
   const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(style);
   if (!m) throw new Error(`unexpected fill style ${style}`);
   const [r, g, b] = [m[1], m[2], m[3]].map((c) => parseInt(c, 16));
   return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The polygon clipped to the canvas (Sutherland-Hodgman), so panels running off an edge count only on it. */
function clipToCanvas(polygon: Point[], w: number, h: number): Point[] {
   const edges: Array<[(p: Point) => number, number]> = [
      [(p) => p[0], 0],
      [(p) => -p[0], -w],
      [(p) => p[1], 0],
      [(p) => -p[1], -h],
   ];
   let out = polygon;
   for (const [value, limit] of edges) {
      const input = out;
      out = [];
      for (let i = 0; i < input.length; i++) {
         const a = input[i];
         const b = input[(i + 1) % input.length];
         const da = value(a) - limit;
         const db = value(b) - limit;
         if (da >= 0) out.push(a);
         if (da >= 0 !== db >= 0) {
            const t = da / (da - db);
            out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
         }
      }
   }
   return out;
}

/** Shoelace area of a polygon. */
function area(polygon: Point[]): number {
   let sum = 0;
   for (let i = 0; i < polygon.length; i++) {
      const [x0, y0] = polygon[i];
      const [x1, y1] = polygon[(i + 1) % polygon.length];
      sum += x0 * y1 - x1 * y0;
   }
   return Math.abs(sum) / 2;
}

/** Every paint drawBall makes on a w × h canvas, in order. Any other canvas call throws. */
function paintBall(w: number, h: number): Paint[] {
   const paints: Paint[] = [];
   let path: Point[] = [];
   const ctx = {
      fillStyle: "" as string,
      fillRect(x: number, y: number, rw: number, rh: number) {
         paints.push({ op: "fillRect", style: this.fillStyle, rect: [x, y, rw, rh] });
      },
      beginPath() {
         path = [];
      },
      moveTo(x: number, y: number) {
         path = [[x, y]];
      },
      lineTo(x: number, y: number) {
         path.push([x, y]);
      },
      closePath() {},
      fill() {
         paints.push({ op: "fill", style: this.fillStyle, area: area(clipToCanvas(path, w, h)) });
      },
   };
   drawBall(ctx as unknown as CanvasRenderingContext2D, w, h);
   return paints;
}

// ---------- the scene's JSX, read with the TypeScript parser ----------

type Jsx = ts.JsxElement | ts.JsxSelfClosingElement;

function parse(file: string): ts.SourceFile {
   return ts.createSourceFile(file, readFileSync(new URL(`./${file}`, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function collect<T extends ts.Node>(node: ts.Node, test: (n: ts.Node) => n is T): T[] {
   const out: T[] = [];
   const visit = (n: ts.Node) => {
      if (test(n)) out.push(n);
      ts.forEachChild(n, visit);
   };
   visit(node);
   return out;
}

const isJsx = (n: ts.Node): n is Jsx => ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n);
const opening = (n: Jsx) => (ts.isJsxElement(n) ? n.openingElement : n);
const tagOf = (n: Jsx) => opening(n).tagName.getText();
const attributesOf = (n: Jsx) => opening(n).attributes.properties.map((a) => a.getText());

/** The identifier in `ref={x}`, or null. */
function refOf(n: Jsx): string | null {
   for (const a of opening(n).attributes.properties) {
      if (!ts.isJsxAttribute(a) || a.name.getText() !== "ref") continue;
      const e = a.initializer && ts.isJsxExpression(a.initializer) ? a.initializer.expression : undefined;
      return e && ts.isIdentifier(e) ? e.text : null;
   }
   return null;
}

/** Element children, whitespace dropped. */
function childrenOf(n: Jsx): ts.JsxChild[] {
   if (!ts.isJsxElement(n)) return [];
   return n.children.filter((c) => !(ts.isJsxText(c) && c.containsOnlyTriviaWhiteSpaces));
}

function functionNamed(source: ts.SourceFile, name: string): ts.FunctionDeclaration {
   const fn = collect(source, ts.isFunctionDeclaration).find((f) => f.name?.text === name);
   if (!fn) throw new Error(`no function ${name} in ${source.fileName}`);
   return fn;
}

type Turn = { ref: string | null; axis: string; node: ts.BinaryExpression };

/**
 * Ball's frame loop: which refs it turns about x (`<ref>.current.rotation.x = …`, through a local
 * `const s = spin.current`), which it moves (`….position.set(…)`), and every assignment to a
 * `.rotation.<axis>` in it, whatever the axis or the operator.
 */
function frameTargets(ball: ts.FunctionDeclaration): { spun: Set<string>; moved: Set<string>; turns: Turn[] } {
   const refs = new Set(
      collect(ball, ts.isVariableDeclaration)
         .filter((d) => d.initializer && ts.isCallExpression(d.initializer) && d.initializer.expression.getText() === "useRef")
         .map((d) => d.name.getText()),
   );
   const frames = collect(ball, ts.isCallExpression).filter((c) => c.expression.getText() === "useFrame");
   expect(frames).toHaveLength(1);
   const alias = new Map<string, string>();
   for (const d of collect(frames[0], ts.isVariableDeclaration)) {
      const m = d.initializer && /^(\w+)\.current$/.exec(d.initializer.getText());
      if (m && refs.has(m[1])) alias.set(d.name.getText(), m[1]);
   }
   const refBehind = (expr: string): string | null => {
      const m = /^(\w+)(\.current)?$/.exec(expr);
      if (!m) return null;
      if (m[2]) return refs.has(m[1]) ? m[1] : null;
      return alias.get(m[1]) ?? null;
   };
   const spun = new Set<string>();
   const moved = new Set<string>();
   const turns: Turn[] = [];
   for (const b of collect(frames[0], ts.isBinaryExpression)) {
      const kind = b.operatorToken.kind;
      if (kind < ts.SyntaxKind.FirstAssignment || kind > ts.SyntaxKind.LastAssignment) continue;
      const t = /^(.+)\.rotation\.(\w+)$/.exec(b.left.getText());
      if (t) turns.push({ ref: refBehind(t[1]), axis: t[2], node: b });
      if (kind !== ts.SyntaxKind.EqualsToken) continue;
      const m = /^(.+)\.rotation\.x$/.exec(b.left.getText());
      const ref = m && refBehind(m[1]);
      if (ref) spun.add(ref);
   }
   for (const c of collect(frames[0], ts.isCallExpression)) {
      const m = /^(.+)\.position\.set$/.exec(c.expression.getText());
      const ref = m && refBehind(m[1]);
      if (ref) moved.add(ref);
   }
   return { spun, moved, turns };
}

describe("penalty-hero ball", () => {
   it("is BallPrimitive: no ball GLB is listed, fetched or drawn", () => {
      expect(Object.keys(ASSETS).sort()).toEqual(["keeper", "striker"]);
      const listed = MODEL_MANIFEST.filter((url) => url.startsWith("/models/3d/penalty-hero/")).sort();
      expect(listed).toEqual([ASSETS.keeper.url, ASSETS.striker.url].sort());
      const scene = readFileSync(new URL("./Scene.tsx", import.meta.url), "utf8");
      expect(scene).not.toMatch(/ASSETS\.ball|ball\.glb|<Model\b/);
   });

   it("BallPrimitive draws BallMesh: a BALL_RADIUS sphere centred on its group's origin", () => {
      const primitive = functionNamed(parse("Primitives.tsx"), "BallPrimitive");
      expect(collect(primitive, isJsx).map(tagOf)).toEqual(["BallMesh"]);
      const { mesh, radius, geometry } = ballMesh();
      expect(radius).toBe(BALL_RADIUS);
      expect(mesh.type).toBe("mesh");
      // nothing moves, turns or scales the sphere off the spin pivot
      for (const key of Object.keys(mesh.props)) expect(key).not.toMatch(/^(position|rotation|scale|quaternion)/);
      geometry.computeBoundingBox();
      const centre = geometry.boundingBox!.getCenter(new Vector3());
      expect(centre.length()).toBeLessThan(1e-9);
      geometry.dispose();
   });

   it("BallPrimitive hands BallMesh the drawBall texture", () => {
      const primitive = functionNamed(parse("Primitives.tsx"), "BallPrimitive");
      const textures = collect(primitive, ts.isVariableDeclaration).filter((d) => {
         const init = d.initializer;
         return !!init && ts.isCallExpression(init) && init.expression.getText() === "useCanvasTexture" && init.arguments.at(-1)?.getText() === "drawBall";
      });
      expect(textures).toHaveLength(1);
      const meshes = collect(primitive, isJsx).filter((n) => tagOf(n) === "BallMesh");
      expect(meshes.map(attributesOf)).toEqual([[`map={${textures[0].name.getText()}}`]]);
   });

   it("drawBall paints a white ball with nine black pentagons over a tenth of it", () => {
      // the canvas size BallPrimitive asks useCanvasTexture for
      const primitive = functionNamed(parse("Primitives.tsx"), "BallPrimitive");
      const call = collect(primitive, ts.isCallExpression).find((c) => c.expression.getText() === "useCanvasTexture")!;
      const [w, h] = call.arguments.slice(0, 2).map((a) => Number(a.getText()));
      expect([w, h]).toEqual([256, 128]);

      const paints = paintBall(w, h);
      // first the white ground over the whole canvas, once
      const rects = paints.filter((p) => p.op === "fillRect");
      expect(rects).toHaveLength(1);
      expect(paints[0]).toBe(rects[0]);
      expect(rects[0].op === "fillRect" && rects[0].rect).toEqual([0, 0, w, h]);
      expect(luminance(rects[0].style)).toBeGreaterThan(200);
      // then nine black panels and nothing else
      const fills = paints.filter((p): p is Extract<Paint, { op: "fill" }> => p.op === "fill");
      expect(fills).toHaveLength(9);
      expect(paints).toHaveLength(10);
      for (const f of fills) {
         expect(luminance(f.style)).toBeLessThan(40);
         expect(f.area).toBeGreaterThan(0);
      }
      // the panels cover more than a tenth of the texture on the canvas (11.5 % today)
      const dark = fills.reduce((sum, f) => sum + f.area, 0);
      expect(dark / (w * h)).toBeGreaterThan(0.1);
   });

   it("BallMesh is visible, with an opaque material carrying the texture", () => {
      const sentinel = { isTexture: true } as unknown as Texture;
      const { mesh, children, geometry } = ballMesh(sentinel);
      geometry.dispose();
      expect(Object.keys(mesh.props).sort()).toEqual(["children", "name"]);
      expect(children.map((c) => c.type)).toEqual(["sphereGeometry", "meshStandardMaterial"]);
      const material = children[1];
      expect(material.props.map).toBe(sentinel);
      // no tint, transparency, hidden side or switch that would lose the white and black look
      expect(Object.keys(material.props).sort()).toEqual(["map", "roughness"]);
   });

   it("Scene draws the ball once, with the run", () => {
      const scene = functionNamed(parse("Scene.tsx"), "Scene");
      const balls = collect(scene, isJsx).filter((n) => tagOf(n) === "Ball");
      expect(balls.map(attributesOf)).toEqual([["run={run}"]]);
   });

   it("spins about x only, in the flight and through the hold, on the spin group", () => {
      const ball = functionNamed(parse("Scene.tsx"), "Ball");
      const { spun, turns } = frameTargets(ball);
      const spinRef = [...spun][0];
      // the flight, the hold and the rest each set the spin group's turn about x, and nothing else turns
      expect(turns.map((t) => [t.ref, t.axis, t.node.operatorToken.getText()])).toEqual([
         [spinRef, "x", "="],
         [spinRef, "x", "="],
         [spinRef, "x", "="],
      ]);
      expect(collect(ball, ts.isCallExpression).map((c) => c.expression.getText())).not.toContainEqual(
         expect.stringMatching(/\.(rotation|quaternion)\.|\.rotate(X|Y|Z|OnAxis|OnWorldAxis)$|\.lookAt$/),
      );
      // the flight's own branch turns it
      const flight = collect(ball, ts.isIfStatement).filter((s) => /\bphase === "flight"/.test(s.expression.getText()));
      expect(flight).toHaveLength(1);
      const inFlight = turns.filter((t) => t.node.pos >= flight[0].thenStatement.pos && t.node.end <= flight[0].thenStatement.end);
      expect(inFlight).toHaveLength(1);
   });

   it("rests on the grass at the spot and never sinks into it, whatever its spin", () => {
      // Scene.tsx puts the spin group's origin at BALL_SPOT.y on the spot and through the hold
      expect(BALL_SPOT.y).toBe(BALL_RADIUS);
      const { geometry } = ballMesh();
      const position = geometry.getAttribute("position");
      const lowest = (spin: number): number => {
         const turn = new Matrix4().makeRotationX(spin);
         const p = new Vector3();
         let min = Infinity;
         for (let i = 0; i < position.count; i++) min = Math.min(min, p.fromBufferAttribute(position, i).applyMatrix4(turn).y);
         return BALL_SPOT.y + min;
      };
      // unspun (the aim and the run-up): the sole on the grass
      expect(Math.abs(lowest(0))).toBeLessThan(1e-9);
      // spun (Scene.tsx turns it about x by up to -18 rad in the flight and the hold)
      for (let i = 0; i < 72; i++) expect(lowest((i / 72) * Math.PI * 2)).toBeGreaterThan(-1e-9);
      geometry.dispose();
   });

   it("Scene draws it alone in the spin group, centred on the pivot, inside the group that moves it", () => {
      const scene = parse("Scene.tsx");
      const ball = functionNamed(scene, "Ball");
      const { spun, moved } = frameTargets(ball);
      // one group turns about x (the spin), and it is not one the frame loop moves
      expect([...spun]).toHaveLength(1);
      const spinRef = [...spun][0];
      expect(moved.has(spinRef)).toBe(false);

      const groups = collect(ball, isJsx).filter((n) => tagOf(n) === "group" && refOf(n) === spinRef);
      expect(groups).toHaveLength(1);
      const spinGroup = groups[0];
      // no offset of its own: the spin pivot is the root's origin, the ball's centre
      expect(attributesOf(spinGroup)).toEqual([`ref={${spinRef}}`]);
      // the ball, and only the ball, straight inside it
      const inside = childrenOf(spinGroup);
      expect(inside).toHaveLength(1);
      expect(isJsx(inside[0]) && tagOf(inside[0] as Jsx)).toBe("BallPrimitive");
      expect(attributesOf(inside[0] as Jsx)).toEqual([]);

      // the spin group sits straight inside the group the frame loop moves along the shot
      const parent = spinGroup.parent;
      expect(ts.isJsxElement(parent)).toBe(true);
      const rootRef = refOf(parent as ts.JsxElement);
      expect(tagOf(parent as ts.JsxElement)).toBe("group");
      expect(rootRef && moved.has(rootRef)).toBe(true);
      expect(attributesOf(parent as ts.JsxElement).filter((a) => !/^(ref|name)=/.test(a))).toEqual([]);

      // and it is the only ball the scene draws
      const balls = collect(scene, isJsx).filter((n) => /^Ball(Primitive|Mesh)$/.test(tagOf(n)));
      expect(balls).toEqual([inside[0]]);
   });
});
