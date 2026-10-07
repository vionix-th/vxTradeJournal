import { isDeepStrictEqual } from "node:util";
export class Lease {
  constructor(db, runId, identity, ttl = 120000) { this.db = db; this.runId = runId; this.identity = identity; this.ttl = ttl; this.owner = crypto.randomUUID(); }
  async acquire(resume = false) {
    const lock = this.db.doc("_system/lock"), run = this.db.doc(`_system/runs/history/${this.runId}`);
    await this.db.runTransaction(async (tx) => {
      const [held, previous] = await Promise.all([tx.get(lock), tx.get(run)]);
      if (held.exists && held.data().expiresAt > Date.now()) throw new Error("Another deployment or recovery run owns the database.");
      if (held.exists && (!resume || held.data().runId !== this.runId)) throw new Error(`Interrupted run requires explicit --resume ${held.data().runId}.`);
      if (resume && (!previous.exists || !isDeepStrictEqual(previous.data().identity, this.identity))) throw new Error("Resume source/build identity differs from recorded run.");
      if (!resume && previous.exists) throw new Error("Run already exists.");
      tx.set(lock, { runId: this.runId, owner: this.owner, expiresAt: Date.now() + this.ttl });
      if (!previous.exists) tx.set(run, { identity: this.identity, status: "running", startedAt: new Date().toISOString() });
    });
  }
  async transaction(operation) {
    return this.db.runTransaction(async (tx) => {
      const lock = await tx.get(this.db.doc("_system/lock"));
      if (!lock.exists || lock.data().owner !== this.owner || lock.data().expiresAt <= Date.now()) throw new Error("Database lease lost; stop this process.");
      return operation(tx);
    });
  }
  async renew() { await this.transaction(async (tx) => tx.update(this.db.doc("_system/lock"), { expiresAt: Date.now() + this.ttl })); }
  start() { this.timer = setInterval(() => { this.renew().catch((error) => { this.failure = error; }); }, 30000); this.timer.unref(); }
  assert() { if (this.failure) throw this.failure; }
  stop() { clearInterval(this.timer); }
  async release() { this.assert(); await this.transaction(async (tx) => tx.delete(this.db.doc("_system/lock"))); }
}
