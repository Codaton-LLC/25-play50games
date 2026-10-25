// Food is one instanced pool per kind, not five models on every slot.
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_ALIVE, SPAWN_Y, createRun } from "./rules";
import { FoodModels, placeFood } from "./Scene";

const pools = vi.hoisted(() => [] as { name?: string; count?: number; clone?: boolean }[]);

vi.mock("@/arcade3d/core/assets", () => ({
   DynamicInstancedModel: (props: { name?: string; count?: number }) => {
      pools.push({ name: props.name, count: props.count });
      return null;
   },
   Model: () => {
      pools.push({ clone: true });
      return null;
   },
}));

vi.mock("@/arcade3d/core/gameTime", () => ({
   useGameTime: () => ({ now: 0, delta: 0, play: 0 }),
}));

const KINDS = ["food-apple", "food-banana", "food-burger", "food-sock", "food-tinCan"];

beforeEach(() => {
   pools.length = 0;
});

describe("food-catcher model pool", () => {
   it("mounts one model pool per kind, not a clone of every kind on every slot", () => {
      renderToString(createElement(FoodModels, { run: createRun(1) }));
      expect(pools.filter((pool) => pool.clone)).toEqual([]);
      expect(pools.map((pool) => pool.name)).toEqual(KINDS);
      expect(pools).toHaveLength(KINDS.length);
      for (const pool of pools) expect(pool.count).toBe(MAX_ALIVE);
      expect(KINDS.length * MAX_ALIVE).toBe(80);
   });

   it("places the active kind where the slot group used to stand and hides the rest", () => {
      const run = createRun(1);
      const item = run.items[2];
      item.active = true;
      item.kind = "apple";
      item.x = 1.25;
      item.bornMs = 0;
      item.speed = 2;
      run.elapsedMs = 0;
      const now = 0.5;
      const matrix = new Matrix4();
      expect(placeFood("sock", run, now, 2, matrix)).toBe(false);
      expect(matrix.elements[0]).toBe(1);
      expect(placeFood("apple", run, now, 2, matrix)).toBe(true);
      const pos = new Vector3();
      const quat = new Quaternion();
      const scale = new Vector3();
      matrix.decompose(pos, quat, scale);
      expect(pos.x).toBeCloseTo(1.25);
      expect(pos.y).toBeCloseTo(SPAWN_Y);
      expect(pos.z).toBeCloseTo(0.2);
      expect(scale.x).toBeCloseTo(1);
      expect(scale.y).toBeCloseTo(1);
      expect(scale.z).toBeCloseTo(1);
      const euler = new Euler().setFromQuaternion(quat, "XYZ");
      expect(euler.x).toBeCloseTo(0);
      expect(euler.y).toBeCloseTo(0);
      expect(euler.z).toBeCloseTo(Math.sin(now * 1.4 + 2) * 0.15);
      item.active = false;
      matrix.identity();
      expect(placeFood("apple", run, now, 2, matrix)).toBe(false);
      expect(matrix.elements[0]).toBe(1);
   });
});
