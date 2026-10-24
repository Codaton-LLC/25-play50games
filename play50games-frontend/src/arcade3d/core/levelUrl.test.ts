import { afterEach, describe, expect, it, vi } from "vitest";
import { parseLevelParam, readLastLevel, searchWithLevel, writeLastLevel, writeLevelToUrl } from "./levelUrl";

afterEach(() => vi.unstubAllGlobals());

describe("?level= and the last played level", () => {
   it("reads 1..5 only", () => {
      expect(parseLevelParam("?level=3")).toBe(3);
      expect(parseLevelParam("?foo=1&level=5")).toBe(5);
      for (const junk of ["", "?level=", "?level=0", "?level=6", "?level=2.5", "?level=03", "?level=x", "?level=-1"]) {
         expect(parseLevelParam(junk)).toBeNull();
      }
   });

   it("writes the level, removes it for level 1 and keeps other parameters", () => {
      expect(searchWithLevel("", 3)).toBe("?level=3");
      expect(searchWithLevel("?level=3", 1)).toBe("");
      expect(searchWithLevel("?perf=1&level=2", 4)).toBe("?perf=1&level=4");
      expect(searchWithLevel("?perf=1&level=2", 1)).toBe("?perf=1");
   });

   it("replaces the address without a history entry, only when it changes", () => {
      const replaceState = vi.fn();
      vi.stubGlobal("window", { location: { pathname: "/3d/robot-collector", search: "?perf=1", hash: "" }, history: { state: null, replaceState } });
      writeLevelToUrl(2);
      expect(replaceState).toHaveBeenCalledWith(null, "", "/3d/robot-collector?perf=1&level=2");
      writeLevelToUrl(1);
      expect(replaceState).toHaveBeenCalledTimes(1);
   });

   it("remembers the last level per game and survives blocked storage", () => {
      const data = new Map<string, string>();
      vi.stubGlobal("window", { localStorage: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) } });
      expect(readLastLevel("robot-collector")).toBeNull();
      writeLastLevel("robot-collector", 4);
      expect(data.get("play50games_3d_level:robot-collector")).toBe("4");
      expect(readLastLevel("robot-collector")).toBe(4);
      data.set("play50games_3d_level:robot-collector", "9");
      expect(readLastLevel("robot-collector")).toBeNull();
      vi.stubGlobal("window", { get localStorage(): Storage { throw new Error("blocked"); } });
      expect(readLastLevel("robot-collector")).toBeNull();
      expect(() => writeLastLevel("robot-collector", 2)).not.toThrow();
   });
});
