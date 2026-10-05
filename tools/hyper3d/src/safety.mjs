import { execFileSync } from "node:child_process";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { API } from "./config.mjs";

const secrets = new Set();

export function requireConfirm(confirm) {
   if (!confirm) { throw new Error("Generation (gen/smoke) requires --confirm (including --mock)"); }
}

export function guardBudget(balance, cost) {
   if (!Number.isFinite(balance) || balance < 0 || !Number.isFinite(cost) || cost < 0) {
      throw new Error("Cannot establish a safe account balance or estimate");
   }
   if (balance - cost < API.reserve) { throw new Error("Generation would violate the 2-credit reserve"); }
}

export function guardCheckout(gitDir, commonDir, expectedDir) {
   const normal = value => {
      const absolute = path.resolve(value);
      return process.platform === "win32" ? absolute.toLowerCase() : absolute;
   };
   if (normal(gitDir) !== normal(commonDir) || normal(gitDir) !== normal(expectedDir)) {
      throw new Error("Generation requires the main checkout; worktrees and alternate checkouts are forbidden");
   }
}

export async function requireMainCheckout(repo) {
   const git = flag => execFileSync("git", ["rev-parse", "--path-format=absolute", flag], { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
   guardCheckout(await realpath(git("--git-dir")), await realpath(git("--git-common-dir")), await realpath(path.join(repo, ".git")));
}

export function maskError(error, additionalSecrets = []) {
   let message = String(error?.message ?? error);
   for (const secret of [...secrets, ...additionalSecrets].filter(Boolean).sort((a, b) => b.length - a.length)) {
      message = message.split(secret).join("[REDACTED]").split(encodeURIComponent(secret)).join("[REDACTED]");
   }
   return message.replace(/Bearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
      .replace(/https?:\/\/[^\s]+/gi, "[URL REDACTED]")
      .replace(/(HYPER3D_KEY_(?:PROD|LAB)\s*=\s*)[^\s]+/g, "$1[REDACTED]");
}

export function personalDirectory() {
   if (!process.env.USERPROFILE) { throw new Error("USERPROFILE is required for the external Hyper3D configuration"); }
   return path.join(process.env.USERPROFILE, ".play50");
}

export async function readKey(account, repo) {
   if (!["lab", "prod"].includes(account)) { throw new Error("Account must be lab or prod"); }
   const file = await realpath(path.join(personalDirectory(), "hyper3d.env"));
   const root = await realpath(repo);
   const relative = path.relative(root, file);
   if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
      throw new Error("Refusing to read a key file inside the repository");
   }
   const contents = await readFile(file, "utf8");
   const keys = {};
   for (const line of contents.split(/\r?\n/)) {
      const match = /^\s*(HYPER3D_KEY_(?:PROD|LAB))\s*=\s*(.*?)\s*$/.exec(line);
      if (!match) { continue; }
      const value = match[2].replace(/^(["'])(.*)\1$/, "$2");
      if (value) { secrets.add(value); keys[match[1]] = value; }
   }
   const key = keys[`HYPER3D_KEY_${account.toUpperCase()}`];
   if (!key) { throw new Error(`Missing ${account} key in the external Hyper3D configuration`); }
   return key;
}
