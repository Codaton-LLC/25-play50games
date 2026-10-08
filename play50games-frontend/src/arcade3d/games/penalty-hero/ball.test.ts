// The football as Scene.tsx draws it: BallPrimitive (BallMesh: a BALL_RADIUS sphere with black panels
// on a canvas texture) alone in the ball's spin group, the group the frame loop turns about x, inside
// the root group it moves along the shot. The sphere is centred on the spin pivot, so the ball rests
// on the grass at BALL_SPOT and spins in place. Neither Hyper3D ball GLB had black panels (README
// "Models"), so no ball GLB is listed or fetched.
import { readFileSync } from "node:fs";
import type { ReactElement } from "react";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { Matrix4, SphereGeometry, Vector3 } from "three";
import { MODEL_MANIFEST } from "@/arcade3d/core/modelManifest";
import { ASSETS, BALL_RADIUS } from "./assets";
import { BallMesh } from "./Primitives";
import { BALL_SPOT } from "./rules";

type Props = { children?: unknown; args?: unknown; [key: string]: unknown };

/** BallMesh's <mesh> element and its <sphereGeometry> args. BallMesh is hook-free. */
function ballMesh(): { mesh: ReactElement<Props>; radius: number; geometry: SphereGeometry } {
   const mesh = BallMesh({ map: null }) as ReactElement<Props>;
   const children = (Array.isArray(mesh.props.children) ? mesh.props.children : [mesh.props.children]) as Array<ReactElement<Props>>;
   const sphere = children.find((c) => c.type === "sphereGeometry")!;
   const [radius, widthSegments, heightSegments] = sphere.props.args as [number, number, number];
   return { mesh, radius, geometry: new SphereGeometry(radius, widthSegments, heightSegments) };
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

/**
 * Ball's frame loop: which refs it turns about x (`<ref>.current.rotation.x = …`, through a local
 * `const s = spin.current`) and which it moves (`….position.set(…)`).
 */
function frameTargets(ball: ts.FunctionDeclaration): { spun: Set<string>; moved: Set<string> } {
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
   for (const b of collect(frames[0], ts.isBinaryExpression)) {
      if (b.operatorToken.kind !== ts.SyntaxKind.EqualsToken) continue;
      const m = /^(.+)\.rotation\.x$/.exec(b.left.getText());
      const ref = m && refBehind(m[1]);
      if (ref) spun.add(ref);
   }
   for (const c of collect(frames[0], ts.isCallExpression)) {
      const m = /^(.+)\.position\.set$/.exec(c.expression.getText());
      const ref = m && refBehind(m[1]);
      if (ref) moved.add(ref);
   }
   return { spun, moved };
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
