import { describe, expect, it } from "vitest";
import {
   applyLobbyInput,
   beginRun,
   canStart,
   createPlayersStore,
   cycleHero,
   dropDevice,
   initialPlayers,
   isMultiplayerActive,
   joinPlayer,
   leavePlayer,
   openLobby,
   pickHero,
   setMode,
   setReady,
   startBlocker,
   updatePlayer,
   type PlayersState,
} from "./players";
import { createPlayerInput, type PlayerInput } from "./playerInput";
import { sessionRunPlayers } from "./leaderboard";

const HEROES = ["riko", "nami", "kiro", "zuno", "vexa"];

const lobby = (mode: "coop" | "versus" = "versus"): PlayersState => setMode(openLobby(initialPlayers(), HEROES), mode);

const input = (over: Partial<PlayerInput> = {}): PlayerInput => ({ ...createPlayerInput(), ...over });

describe("joining", () => {
   it("fills slots P1..P4 in order, one per device, at most four", () => {
      let s = lobby();
      for (const d of ["kb1", "pad0", "kb2", "pad1", "pad2"] as const) s = joinPlayer(s, d);
      expect(s.players.map((p) => [p.index, p.device])).toEqual([
         [0, "kb1"],
         [1, "pad0"],
         [2, "kb2"],
         [3, "pad1"],
      ]);
      expect(joinPlayer(s, "kb1")).toBe(s);
   });

   it("reuses the freed slot after a leave, and unplugging drops the player", () => {
      let s = lobby();
      s = joinPlayer(joinPlayer(joinPlayer(s, "kb1"), "kb2"), "pad0");
      s = leavePlayer(s, 1);
      s = joinPlayer(s, "pad3");
      expect(s.players.map((p) => p.index)).toEqual([0, 1, 2]);
      expect(s.players[1].device).toBe("pad3");
      s = dropDevice(s, "pad0");
      expect(s.players.map((p) => p.device)).toEqual(["kb1", "pad3"]);
   });

   it("only joins in the lobby", () => {
      expect(joinPlayer(initialPlayers(), "kb1").players).toHaveLength(0);
   });
});

describe("heroes", () => {
   it("co-op: two players may not pick the same hero", () => {
      let s = joinPlayer(joinPlayer(lobby("coop"), "kb1"), "kb2");
      expect(s.players.map((p) => p.heroId)).toEqual(["riko", "nami"]);
      expect(pickHero(s, 1, "riko")).toBe(s);
      s = cycleHero(s, 1, -1);
      // skips riko (taken) and wraps to vexa
      expect(s.players[1].heroId).toBe("vexa");
   });

   it("versus: the same hero is fine", () => {
      let s = joinPlayer(joinPlayer(lobby("versus"), "kb1"), "kb2");
      expect(s.players[1].heroId).toBe("riko");
      s = pickHero(s, 0, "zuno");
      s = pickHero(s, 1, "zuno");
      expect(s.players.map((p) => p.heroId)).toEqual(["zuno", "zuno"]);
      expect(canStart(setReady(setReady(s, 0, true), 1, true))).toBe(true);
   });

   it("switching versus -> co-op moves a duplicate to a free hero and unreadies it", () => {
      let s = joinPlayer(joinPlayer(lobby("versus"), "kb1"), "kb2");
      s = setReady(setReady(s, 0, true), 1, true);
      s = setMode(s, "coop");
      expect(s.players[0]).toMatchObject({ heroId: "riko", ready: true });
      expect(s.players[1]).toMatchObject({ heroId: "nami", ready: false });
   });

   it("a ready player cannot change hero", () => {
      let s = joinPlayer(lobby(), "kb1");
      s = setReady(s, 0, true);
      expect(pickHero(s, 0, "kiro")).toBe(s);
      expect(cycleHero(s, 0, 1)).toBe(s);
      expect(pickHero(setReady(s, 0, false), 0, "unknown").players[0].heroId).toBe("riko");
   });
});

describe("ready-up and start", () => {
   it("needs two players, all ready", () => {
      let s = joinPlayer(lobby("coop"), "kb1");
      expect(startBlocker(s)).toMatch(/2 players/);
      s = joinPlayer(s, "pad0");
      expect(startBlocker(s)).toMatch(/ready/);
      s = setReady(s, 0, true);
      expect(canStart(s)).toBe(false);
      s = setReady(s, 1, true);
      expect(canStart(s)).toBe(true);
      expect(beginRun(lobby())).toEqual(lobby());
   });

   it("beginRun resets every per-run field and Retry can call it again", () => {
      let s = setReady(setReady(joinPlayer(joinPlayer(lobby(), "kb1"), "kb2"), 0, true), 1, true);
      s = beginRun(s, 3);
      expect(s.phase).toBe("playing");
      expect(isMultiplayerActive(s)).toBe(true);
      s = updatePlayer(s, 0, { score: 5, finished: true, finishMs: 12000, progress: 40 });
      expect(s.players[0]).toMatchObject({ score: 5, finished: true, finishMs: 12000 });
      s = beginRun(s, 3);
      expect(s.players[0]).toMatchObject({ score: 0, lives: 3, finished: false, finishMs: null, progress: 0 });
   });

   it("updatePlayer is a no-op (same object) when nothing changes", () => {
      const s = joinPlayer(lobby(), "kb1");
      expect(updatePlayer(s, 0, { score: 0 })).toBe(s);
      expect(updatePlayer(s, 7, { score: 3 })).toBe(s);
   });
});

describe("lobby input (press A / Space to join)", () => {
   it("joins on jump, picks with left/right, readies on jump, unreadies then leaves on action", () => {
      let s = lobby("coop");
      s = applyLobbyInput(s, "pad0", input({ pressed: { left: false, right: true, up: false, down: false } }));
      expect(s.players).toHaveLength(0);
      s = applyLobbyInput(s, "pad0", input({ jumpPressed: true }));
      expect(s.players[0]).toMatchObject({ device: "pad0", heroId: "riko", ready: false });
      s = applyLobbyInput(s, "pad0", input({ pressed: { left: false, right: true, up: false, down: false } }));
      expect(s.players[0].heroId).toBe("nami");
      s = applyLobbyInput(s, "pad0", input({ jumpPressed: true }));
      expect(s.players[0].ready).toBe(true);
      s = applyLobbyInput(s, "pad0", input({ pressed: { left: true, right: false, up: false, down: false } }));
      expect(s.players[0].heroId).toBe("nami");
      s = applyLobbyInput(s, "pad0", input({ actionPressed: true }));
      expect(s.players[0].ready).toBe(false);
      s = applyLobbyInput(s, "pad0", input({ actionPressed: true }));
      expect(s.players).toHaveLength(0);
   });
});

describe("the store", () => {
   it("runs the session and keeps live positions in place", () => {
      const store = createPlayersStore();
      const st = () => store.getState();
      st().openLobby(HEROES);
      st().join("kb1");
      st().join("kb2");
      expect(st().beginRun()).toBe(false);
      st().setReady(0, true);
      st().setReady(1, true);
      expect(st().beginRun(0)).toBe(true);
      const before = st().players;
      st().setPosition(1, 1, 2, 3);
      expect(st().players).toBe(before);
      expect(st().players[1].position).toEqual({ x: 1, y: 2, z: 3 });
      expect(sessionRunPlayers(st())).toBe(2);
      st().endSession();
      expect(st().phase).toBe("off");
      expect(sessionRunPlayers(st())).toBe(1);
   });

   it("sessionRunPlayers is 1 in the lobby (the solo scene runs behind the join screen)", () => {
      const s = joinPlayer(joinPlayer(lobby(), "kb1"), "kb2");
      expect(sessionRunPlayers(s)).toBe(1);
   });
});
