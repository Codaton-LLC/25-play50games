import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// fetch is stubbed and the base points at a fake host, so no request leaves the test.
vi.mock("./apiBase", () => ({ getApiBase: () => "https://wp.test/wp-json/play50/v1" }));

import { sendContact, validateContact, waitText, type ContactPayload } from "./contact";

const fetchMock = vi.fn();

function reply(status: number, body: unknown) {
   fetchMock.mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
   });
}

const VALID = { name: "Ana", email: "ana@example.com", subject: "", message: "Hello, a question about levels." };
const PAYLOAD: ContactPayload = { ...VALID, website: "", elapsed_ms: 5234.6 };

beforeEach(() => {
   fetchMock.mockReset();
   vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
   vi.unstubAllGlobals();
});

describe("validateContact", () => {
   it("accepts a valid message with no subject", () => {
      expect(validateContact(VALID)).toEqual({});
   });

   it("needs a name, an email and a message", () => {
      expect(validateContact({ name: " ", email: "", subject: "", message: "" })).toEqual({
         name: "Enter your name.",
         email: "Enter your email address.",
         message: "Write a message.",
      });
   });

   it("checks the email shape", () => {
      expect(validateContact({ ...VALID, email: "ana@" }).email).toBe("Enter a valid email address.");
      expect(validateContact({ ...VALID, email: "ana example.com" }).email).toBe("Enter a valid email address.");
      expect(validateContact({ ...VALID, email: " ana@example.com " }).email).toBeUndefined();
   });

   it("applies the length limits after trimming", () => {
      expect(validateContact({ ...VALID, name: "a".repeat(80) }).name).toBeUndefined();
      expect(validateContact({ ...VALID, name: "a".repeat(81) }).name).toBe("Use 80 characters or fewer.");
      expect(validateContact({ ...VALID, subject: "s".repeat(121) }).subject).toBe("Use 120 characters or fewer.");
      expect(validateContact({ ...VALID, message: "  short   " }).message).toBe("Write at least 10 characters.");
      expect(validateContact({ ...VALID, message: "m".repeat(10) }).message).toBeUndefined();
      expect(validateContact({ ...VALID, message: "m".repeat(4001) }).message).toBe("Use 4000 characters or fewer.");
   });
});

describe("sendContact", () => {
   it("POSTs the trimmed fields, the honeypot and the elapsed time to /contact", async () => {
      reply(200, { ok: true });
      await expect(sendContact({ ...PAYLOAD, name: "  Ana  " })).resolves.toEqual({ ok: true });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://wp.test/wp-json/play50/v1/contact");
      expect(init.method).toBe("POST");
      expect(init.headers["Content-Type"]).toBe("application/json");
      expect(init.headers.Authorization).toBeUndefined();
      expect(JSON.parse(init.body)).toEqual({
         name: "Ana",
         email: "ana@example.com",
         subject: "",
         message: "Hello, a question about levels.",
         website: "",
         elapsed_ms: 5235,
      });
   });

   it("maps per-field errors from a 400 invalid_data", async () => {
      reply(400, {
         code: "invalid_data",
         message: "Please check the highlighted fields.",
         data: { status: 400, fields: { email: "Enter a valid email address.", other: "x" } },
      });
      await expect(sendContact(PAYLOAD)).resolves.toEqual({
         ok: false,
         kind: "invalid",
         fields: { email: "Enter a valid email address." },
         message: "Please check the highlighted fields.",
      });
   });

   it("maps a 429 with retry_after", async () => {
      reply(429, { code: "rate_limited", message: "Too many messages.", data: { status: 429, retry_after: 420 } });
      await expect(sendContact(PAYLOAD)).resolves.toMatchObject({ ok: false, kind: "rate_limited", retryAfter: 420 });
   });

   it("defaults retry_after when a 429 has no body", async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 429, json: async () => { throw new Error("no json"); } });
      await expect(sendContact(PAYLOAD)).resolves.toMatchObject({ kind: "rate_limited", retryAfter: 600 });
   });

   it("maps too_fast", async () => {
      reply(400, { code: "too_fast", message: "That was quick.", data: { status: 400 } });
      await expect(sendContact(PAYLOAD)).resolves.toEqual({ ok: false, kind: "too_fast", message: "That was quick." });
   });

   it("treats a mail failure with a saved message as delivered", async () => {
      reply(500, { code: "mail_failed", message: "Saved, mail not sent.", data: { status: 500, saved: true } });
      await expect(sendContact(PAYLOAD)).resolves.toEqual({ ok: true, saved: true });
   });

   it("returns a generic retryable error for other failures", async () => {
      reply(500, { code: "server_error", message: "Something went wrong.", data: { status: 500, saved: false } });
      await expect(sendContact(PAYLOAD)).resolves.toMatchObject({ ok: false, kind: "error" });
      reply(404, { code: "rest_no_route", message: "No route was found", data: { status: 404 } });
      await expect(sendContact(PAYLOAD)).resolves.toMatchObject({ ok: false, kind: "error" });
   });

   it("never throws on a network failure", async () => {
      fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
      await expect(sendContact(PAYLOAD)).resolves.toMatchObject({ ok: false, kind: "error" });
   });
});

describe("waitText", () => {
   it("rounds the wait for people", () => {
      expect(waitText(30)).toBe("a minute");
      expect(waitText(420)).toBe("about 7 minutes");
      expect(waitText(3600)).toBe("about 60 minutes");
      expect(waitText(5400)).toBe("about 2 hours");
      expect(waitText(86000)).toBe("about 24 hours");
   });
});
