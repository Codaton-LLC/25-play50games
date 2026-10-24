import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The real client, pointed at a fake host; fetch is stubbed, so no request leaves the test.
vi.mock("@/arcade3d/flags", () => ({ ARCADE_ENABLED: true, ARCADE_LEADERBOARD: true, ARCADE_API_MOCK: false, ARCADE_LEVELS: false }));
vi.mock("./apiBase", () => ({ getApiBase: () => "https://wp.test/wp-json/play50/v1" }));

import { arcadeApi, ArcadeApiError, createMockArcadeClient, isRunToken } from "./arcade";

const fetchMock = vi.fn();

function reply(status: number, body: unknown) {
   fetchMock.mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
   });
}

beforeEach(() => {
   fetchMock.mockReset();
   vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
   vi.unstubAllGlobals();
});

const TOKEN = `r1.1791000000000.1791000362000.${"a".repeat(32)}.${"b".repeat(64)}`;

describe("arcadeApi.startRun (real client)", () => {
   it("POSTs the slug to /arcade/runs/start and returns the ticket", async () => {
      reply(200, { run_token: TOKEN });
      await expect(arcadeApi.startRun("robot-collector")).resolves.toEqual({ run_token: TOKEN });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://wp.test/wp-json/play50/v1/arcade/runs/start");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body)).toEqual({ slug: "robot-collector" });
   });

   it("fails as not_found on an old server without the route (the run then goes tokenless)", async () => {
      reply(404, { code: "rest_no_route", message: "No route", data: { status: 404 } });
      await expect(arcadeApi.startRun("robot-collector")).rejects.toMatchObject({ code: "not_found", status: 404 });
   });

   it("fails as network when offline", async () => {
      fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
      await expect(arcadeApi.startRun("robot-collector")).rejects.toMatchObject({ code: "network" });
   });

   it("rejects a 200 without a usable ticket (HTML page, wrong type, huge string)", async () => {
      reply(200, { run_token: 42 });
      await expect(arcadeApi.startRun("robot-collector")).rejects.toMatchObject({ code: "server" });
      reply(200, null);
      await expect(arcadeApi.startRun("robot-collector")).rejects.toMatchObject({ code: "server" });
      reply(200, { run_token: "x".repeat(257) });
      await expect(arcadeApi.startRun("robot-collector")).rejects.toMatchObject({ code: "server" });
   });
});

describe("arcadeApi.submit (real client)", () => {
   it("carries the server's ticket reason on the error", async () => {
      reply(400, { code: "invalid_data", message: "This run could not be verified.", data: { status: 400, field: "run_token", reason: "used" } });
      const error = await arcadeApi
         .submit({ slug: "robot-collector", score: 100, duration_ms: 30000, run_token: TOKEN })
         .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ArcadeApiError);
      expect(error).toMatchObject({ code: "invalid_data", status: 400, reason: "used" });
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).run_token).toBe(TOKEN);
   });

   it("has no reason for ordinary errors", async () => {
      reply(400, { code: "invalid_data", message: "Score rejected.", data: { status: 400, field: "score" } });
      await expect(arcadeApi.submit({ slug: "robot-collector", score: 99999, duration_ms: 30000 })).rejects.toMatchObject({
         code: "invalid_data",
         reason: null,
      });
   });
});

describe("isRunToken", () => {
   it("accepts printable ASCII up to 256 characters only", () => {
      expect(isRunToken(TOKEN)).toBe(true);
      expect(isRunToken("mock.1.abc")).toBe(true);
      expect(isRunToken("")).toBe(false);
      expect(isRunToken("has space")).toBe(false);
      expect(isRunToken("x".repeat(257))).toBe(false);
      expect(isRunToken(undefined)).toBe(false);
   });
});

describe("mock client run tickets", () => {
   const body = { slug: "robot-collector" as const, score: 100, duration_ms: 30000 };

   it("issues a ticket and accepts it exactly once when tickets are required", async () => {
      const mock = createMockArcadeClient({ requireRunToken: true });
      const { run_token } = await mock.startRun("robot-collector");
      await expect(mock.submit({ ...body, run_token })).resolves.toMatchObject({ success: true });
      await expect(mock.submit({ ...body, run_token })).rejects.toMatchObject({ code: "invalid_data", reason: "used" });
   });

   it("rejects a ticket for another game or one it never issued when tickets are required", async () => {
      const mock = createMockArcadeClient({ requireRunToken: true });
      const { run_token } = await mock.startRun("food-catcher");
      await expect(mock.submit({ ...body, run_token })).rejects.toMatchObject({ reason: "signature" });
      await expect(mock.submit({ ...body, run_token: "mock.9.forged" })).rejects.toMatchObject({ reason: "signature" });
   });

   it("accepts a failed ticket when tickets are optional (like the server with enforcement off)", async () => {
      const mock = createMockArcadeClient();
      const { run_token } = await mock.startRun("robot-collector");
      await expect(mock.submit({ ...body, run_token })).resolves.toMatchObject({ success: true, data: { plays: 1 } });
      await expect(mock.submit({ ...body, run_token })).resolves.toMatchObject({ success: true, data: { plays: 2 } });
      await expect(mock.submit({ ...body, run_token: "mock.9.forged" })).resolves.toMatchObject({ success: true });
   });

   it("accepts tokenless submits unless it requires tickets", async () => {
      await expect(createMockArcadeClient().submit(body)).resolves.toMatchObject({ success: true });
      await expect(createMockArcadeClient({ requireRunToken: true }).submit(body)).rejects.toMatchObject({
         code: "invalid_data",
         reason: "required",
      });
   });

   it("issues different tickets per start", async () => {
      const mock = createMockArcadeClient();
      const a = await mock.startRun("robot-collector");
      const b = await mock.startRun("robot-collector");
      expect(a.run_token).not.toBe(b.run_token);
   });
});

describe("levels on the wire", () => {
   it("startRun sends { slug } for level 1 and { slug, level } for levels 2-5", async () => {
      reply(200, { run_token: TOKEN });
      reply(200, { run_token: TOKEN });
      reply(200, { run_token: TOKEN });
      await arcadeApi.startRun("robot-collector");
      await arcadeApi.startRun("robot-collector", 1);
      await arcadeApi.startRun("robot-collector", 3);
      expect(fetchMock.mock.calls.map((call) => call[1].body)).toEqual([
         '{"slug":"robot-collector"}',
         '{"slug":"robot-collector"}',
         '{"slug":"robot-collector","level":3}',
      ]);
   });

   it("games() reads GET /arcade/games with its features", async () => {
      reply(200, { games: {}, features: { levels: true } });
      await expect(arcadeApi.games()).resolves.toMatchObject({ features: { levels: true } });
      expect(fetchMock.mock.calls[0][0]).toBe("https://wp.test/wp-json/play50/v1/arcade/games");
   });
});

describe("mock client levels", () => {
   const body = { slug: "robot-collector" as const, score: 100, duration_ms: 30000 };

   it("advertises features.levels", async () => {
      await expect(createMockArcadeClient().games()).resolves.toMatchObject({ features: { levels: true } });
   });

   it("keeps a best per level and ranks the sum of the level bests", async () => {
      const mock = createMockArcadeClient();
      await expect(mock.submit({ ...body, score: 400 })).resolves.toMatchObject({
         data: { best_score: 400, level: 1, level_best_score: 400, is_new_level_best: true },
      });
      await expect(mock.submit({ ...body, score: 300, level: 2 })).resolves.toMatchObject({
         data: { best_score: 700, level: 2, level_best_score: 300, is_new_best: true, plays: 2 },
      });
      // a worse level-1 run: the level best and the total stand
      await expect(mock.submit({ ...body, score: 100 })).resolves.toMatchObject({
         data: { best_score: 700, level_best_score: 400, is_new_level_best: false, plays: 3 },
      });
      const board = await mock.leaderboard("robot-collector");
      expect(board.me).toMatchObject({ best_score: 700 });
      const me = await mock.me();
      expect(me["robot-collector"]).toMatchObject({ best: 700, plays: 3, levels: { "1": { best: 400, plays: 2 }, "2": { best: 300, plays: 1 } } });
   });

   it("rejects an unknown level and a ticket for another level", async () => {
      const mock = createMockArcadeClient({ requireRunToken: true });
      await expect(mock.submit({ ...body, level: 6 as never })).rejects.toMatchObject({ code: "invalid_data" });
      const { run_token } = await mock.startRun("robot-collector", 3);
      await expect(mock.submit({ ...body, level: 5, run_token })).rejects.toMatchObject({ reason: "signature" });
      await expect(mock.submit({ ...body, level: 3, run_token })).resolves.toMatchObject({ success: true });
   });
});
