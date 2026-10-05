import { setTimeout as delay } from "node:timers/promises";
import { API, generationFields } from "./config.mjs";
import { maskError } from "./safety.mjs";

export class RodinClient {
   constructor(key, fetchImpl = globalThis.fetch, sleep = delay) {
      this.key = key;
      this.fetch = fetchImpl;
      this.sleep = sleep;
   }

   async request(endpoint, body, method = "POST") {
      try {
         const response = await this.fetch(`${API.base}${API.paths[endpoint]}`, {
            method,
            headers: { Authorization: `Bearer ${this.key}`, ...(body instanceof FormData || !body ? {} : { "Content-Type": "application/json" }) },
            body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
            signal: AbortSignal.timeout(API.timeoutMs)
         });
         if (!response.ok) {
            const retry = Number(response.headers.get("Retry-After"));
            const error = new Error(`Rodin ${endpoint}: HTTP ${response.status}`);
            if (response.status === 429) { error.retryAfterMs = Math.min(30000, Math.max(5000, retry * 1000 || 5000)); }
            throw error;
         }
         const json = await response.json();
         if (json.error) { throw new Error(`Rodin ${endpoint} rejected the request`); }
         return json;
      } catch (error) {
         const safe = new Error(maskError(error, [this.key]));
         safe.retryAfterMs = error.retryAfterMs;
         throw safe;
      }
   }

   async balance() {
      const result = await this.request("balance", undefined, "GET");
      if (!Number.isFinite(result.balance) || result.balance < 0) { throw new Error("Invalid API balance response"); }
      return result.balance;
   }

   async submit(asset, seed, image) {
      const form = new FormData();
      for (const [key, value] of Object.entries(generationFields(asset, seed))) { form.append(key, value); }
      if (asset.mode === "image") {
         if (!image?.length) { throw new Error("Image generation requires a concept PNG"); }
         form.append(API.fields.images, new Blob([image], { type: "image/png" }), "concept.png");
      }
      // Never retry a submission: a transport failure may already have incurred a charge.
      const result = await this.request("submit", form);
      if (!result.uuid || !result.jobs?.subscription_key || !Number.isFinite(result.consumed) || result.consumed < 0) {
         throw new Error("Malformed generation response; reconcile API usage before another paid submission");
      }
      return result;
   }

   async poll(subscription) {
      const deadline = Date.now() + API.pollDeadlineMs;
      let pause = 5000;
      while (Date.now() < deadline) {
         await this.sleep(pause);
         let result;
         try {
            result = await this.request("status", { [API.fields.subscription]: subscription });
         } catch (error) {
            if (!error.retryAfterMs) { throw error; }
            pause = error.retryAfterMs;
            continue;
         }
         if (!Array.isArray(result.jobs) || !result.jobs.length) { throw new Error("Malformed status response: no jobs"); }
         if (result.jobs.some(j => j.status === "Failed")) { throw new Error("Rodin generation failed"); }
         if (result.jobs.some(j => !["Waiting", "Generating", "Done"].includes(j.status))) { throw new Error("Unknown job status"); }
         if (result.jobs.every(j => j.status === "Done")) { return; }
         pause = Math.min(pause * 1.5, 30000);
      }
      throw new Error("Rodin polling deadline exceeded; charge remains recorded");
   }

   async download(task) {
      for (let attempt = 0; attempt < 2; attempt++) {
         const result = await this.request("download", { [API.fields.task]: task });
         const file = result.list?.find(item => /\.glb$/i.test(item.name));
         if (!file) { throw new Error("Download response has no GLB output"); }
         const url = new URL(file.url);
         if (url.protocol !== "https:") { throw new Error("Refusing a non-HTTPS download link"); }
         try {
            // Signed links authenticate themselves. Never forward the API key to a file host.
            const response = await this.fetch(url.href, { signal: AbortSignal.timeout(API.timeoutMs) });
            if (!response.ok) { throw new Error(`Artifact download: HTTP ${response.status}`); }
            return new Uint8Array(await response.arrayBuffer());
         } catch (error) {
            if (attempt === 1) { throw new Error(maskError(error, [this.key])); }
         }
      }
   }
}

export class MockClient {
   async submit() {
      return { uuid: `mock-${crypto.randomUUID()}`, jobs: { subscription_key: "mock-subscription", uuids: ["mock-job"] }, consumed: 0.5 };
   }

   async poll() {}

   async download() {
      const { fixtureGLB } = await import("./models.mjs");
      return fixtureGLB();
   }
}
