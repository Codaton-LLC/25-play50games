import { mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

function fresh(mock) {
   return {
      version: 1, mock,
      accounts: {
         lab: { balance: mock ? 10 : null, entryOffset: 0 },
         prod: { balance: mock ? 45 : null, entryOffset: 0 }
      },
      entries: []
   };
}

export class Ledger {
   constructor(file, mock = false) {
      this.file = file;
      this.mock = mock;
      this.data = fresh(mock);
   }

   async load() {
      try {
         const data = JSON.parse(await readFile(this.file, "utf8"));
         if (data.version !== 1 || data.mock !== this.mock || !Array.isArray(data.entries)) {
            throw new Error("Invalid ledger version or environment");
         }
         for (const name of ["lab", "prod"]) {
            const account = data.accounts?.[name];
            if (!account || (account.balance !== null && (!Number.isFinite(account.balance) || account.balance < 0)) ||
               !Number.isInteger(account.entryOffset) || account.entryOffset < 0 || account.entryOffset > data.entries.length) {
               throw new Error("Invalid ledger account");
            }
         }
         for (const entry of data.entries) {
            if (!["lab", "prod"].includes(entry.account) || !Number.isFinite(entry.consumed) || entry.consumed < 0) {
               throw new Error("Invalid ledger entry");
            }
         }
         this.data = data;
      } catch (error) {
         if (error.code !== "ENOENT") { throw new Error("Cannot read ledger safely; inspect its format before generating"); }
      }
      return this;
   }

   remaining(account) {
      const snapshot = this.data.accounts[account];
      if (snapshot.balance === null) { return null; }
      const spent = this.data.entries.slice(snapshot.entryOffset).filter(e => e.account === account).reduce((sum, e) => sum + e.consumed, 0);
      return snapshot.balance - spent;
   }

   rate(account) {
      return Math.max(0.5, ...this.data.entries.filter(e => e.account === account).map(e => e.consumed));
   }

   requireReconciled(account) {
      if (this.data.entries.some(e => e.account === account && e.status === "uncertain")) {
         throw new Error("An uncertain submission exists; reconcile API usage and ledger before paid generation");
      }
   }

   async snapshot(account, balance) {
      if (!Number.isFinite(balance) || balance < 0) { throw new Error("Invalid API balance"); }
      this.data.accounts[account] = { balance, entryOffset: this.data.entries.length, checkedAt: new Date().toISOString() };
      await this.save();
   }

   async append(entry) {
      this.data.entries.push({ ...entry, time: new Date().toISOString() });
      await this.save();
      return this.data.entries.length - 1;
   }

   async update(index, changes) {
      Object.assign(this.data.entries[index], changes);
      await this.save();
   }

   async save() {
      await mkdir(path.dirname(this.file), { recursive: true });
      const temp = `${this.file}.${process.pid}.tmp`;
      await writeFile(temp, `${JSON.stringify(this.data, null, 3)}\n`, { mode: 0o600 });
      await rename(temp, this.file);
   }

   async lock(action) {
      await mkdir(path.dirname(this.file), { recursive: true });
      const lockFile = `${this.file}.lock`;
      let handle;
      try {
         handle = await open(lockFile, "wx", 0o600);
      } catch (error) {
         if (error.code === "EEXIST") { throw new Error("Hyper3D ledger is locked; another CLI may be running"); }
         throw error;
      }
      try {
         await handle.writeFile(String(process.pid));
         return await action();
      } finally {
         await handle.close();
         await unlink(lockFile);
      }
   }
}
