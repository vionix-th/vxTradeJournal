import { assertJournalReady } from "./availability.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
} from "firebase/firestore";
import {
  normalizeAccount,
  normalizeInstrument,
  normalizeStrategy,
  validateSettings,
  requireValue,
  SCHEMA_VERSION,
} from "../domain/journal.js";
import { prepareTrade } from "../application/journal.js";
import { fingerprint } from "../application/fingerprint.js";
import { defaultSettings } from "../application/settings.js";
export class ConflictError extends Error {
  constructor(message = "Save conflict. Reload current records, then reconcile changes.") {
    super(message);
    this.name = "ConflictError";
  }
}
const normalize = {
  accounts: normalizeAccount,
  instruments: normalizeInstrument,
  strategies: normalizeStrategy,
  settings: validateSettings,
};
const clean = (value) => JSON.parse(JSON.stringify(value));
/** User-scoped adapter. All writes validate domain inputs, references and optimistic revisions. */
export class Repository {
  constructor(db, uid, verified = () => true) {
    this.db = db;
    this.uid = uid;
    this.verified = verified;
  }
  async guard(operation, writing = false) {
    await assertJournalReady(this.db, this.uid, writing);
    try { return await operation(); }
    catch (error) {
      if (String(error.code).includes("permission-denied")) await assertJournalReady(this.db, this.uid, writing);
      throw error;
    }
  }
  async list(...args) { return this.guard(() => this._list(...args)); }
  async listChildren(...args) { return this.guard(() => this._listChildren(...args)); }
  async getEntity(...args) { return this.guard(() => this._getEntity(...args)); }
  async getOperation(...args) { return this.guard(() => this._getOperation(...args)); }
  async getSettings(...args) { return this.guard(() => this._getSettings(...args)); }
  async getTrade(...args) { return this.guard(() => this._getTrade(...args)); }
  async load(...args) { return this.guard(() => this._load(...args)); }
  async saveEntity(...args) { return this.guard(() => this._saveEntity(...args), true); }
  async saveTrade(...args) { return this.guard(() => this._saveTrade(...args), true); }
  async deleteTrade(...args) { return this.guard(() => this._deleteTrade(...args), true); }
  ref(type, id) {
    return doc(this.db, "users", this.uid, type, id);
  }
  child(tid, type, id) {
    return doc(this.db, "users", this.uid, "trades", tid, type, id);
  }
  async _list(type) {
    return (
      await getDocs(collection(this.db, "users", this.uid, type))
    ).docs.map((d) => d.data());
  }
  async _listChildren(tid, type) {
    return (
      await getDocs(collection(this.db, "users", this.uid, "trades", tid, type))
    ).docs.map((d) => d.data());
  }
  async _getEntity(type, id) {
    const result = await getDoc(this.ref(type, id));
    return result.exists() ? result.data() : null;
  }
  async _getOperation(tid, operationId) {
    const result = await getDoc(this.child(tid, "operations", operationId));
    return result.exists() ? result.data() : null;
  }
  async _getSettings() {
    return (await this._getEntity("settings", "preferences")) || defaultSettings();
  }
  async _getTrade(id) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const before = await getDoc(this.ref("trades", id));
      if (!before.exists()) return null;
      const [legs, executions, adjustments] = await Promise.all(
        ["legs", "executions", "adjustments"].map((type) =>
          this._listChildren(id, type),
        ),
      );
      const after = await getDoc(this.ref("trades", id));
      if (!after.exists()) return null;
      if (before.data().revision === after.data().revision) {
        return { ...after.data(), legs, executions, adjustments };
      }
    }
    throw new ConflictError();
  }

  async _load() {
    const [accounts, instruments, strategies, parents, settings] =
      await Promise.all(
        ["accounts", "instruments", "strategies", "trades", "settings"].map(
          (type) => this._list(type),
        ),
      );
    const trades = await Promise.all(parents.map((t) => this._getTrade(t.id)));
    return {
      accounts,
      instruments,
      strategies,
      trades: trades.filter(Boolean),
      settings: settings.find((s) => s.id === "preferences") || defaultSettings(),
    };
  }
  metadata(input, old = null) {
    const now = new Date().toISOString();
    return {
      ...clean(input),
      uid: this.uid,
      id: input.id,
      schemaVersion: SCHEMA_VERSION,
      revision: (old?.revision || 0) + 1,
      createdAt: old?.createdAt || now,
      updatedAt: now,
    };
  }
  async _saveEntity(type, input) {
    requireValue(this.verified(), "Verify email before saving");
    requireValue(normalize[type], "Unknown entity type");
    const value = normalize[type](clean(input));
    value.id = value.id || crypto.randomUUID();
    const ref = this.ref(type, value.id);
    return runTransaction(this.db, async (tx) => {
      const s = await tx.get(ref);
      const old = s.exists() ? s.data() : null;
      if ((old?.revision || 0) !== (input.revision || 0))
        throw new ConflictError();
      if (type === "accounts" && old?.hasTrades) {
        requireValue(
          value.currency === old.currency,
          "Reporting currency is fixed after first trade",
        );
        value.hasTrades = true;
      }
      if (type === "settings" && value.defaultAccount) {
        requireValue(
          (await tx.get(this.ref("accounts", value.defaultAccount))).exists(),
          "Default account does not belong to user",
        );
      }
      const saved = this.metadata(value, old);
      tx.set(ref, saved);
      return saved;
    });
  }
  async _saveTrade(input, operationId = crypto.randomUUID(), requestFingerprint = null) {
    requireValue(this.verified(), "Verify email before saving");
    const requestHash = requestFingerprint || await fingerprint(input);
    const previous = await this._getTrade(input.id);
    const receipt = this.child(input.id, "operations", operationId);
    const ref = this.ref("trades", input.id);
    const result = await runTransaction(this.db, async (tx) => {
      const [receiptDoc, current, accountDoc] = await Promise.all([
        tx.get(receipt),
        tx.get(ref),
        tx.get(this.ref("accounts", input.accountId)),
      ]);
      if (receiptDoc.exists()) {
        if (receiptDoc.data().requestFingerprint && receiptDoc.data().requestFingerprint !== requestHash)
          throw new ConflictError("Operation ID already used with different input");
        return null;
      }
      const old = current.exists() ? current.data() : null;
      if (
        (old?.revision || 0) !== (input.revision || 0) ||
        (previous?.revision || 0) !== (old?.revision || 0)
      )
        throw new ConflictError();
      const instruments = await Promise.all(
        [...new Set(input.legs.map((l) => l.instrumentId))].map(async (id) => {
          const d = await tx.get(this.ref("instruments", id));
          return d.exists() ? d.data() : null;
        }),
      );
      const strategyDoc = input.strategyId
        ? await tx.get(this.ref("strategies", input.strategyId))
        : null;
      const data = {
        accounts: accountDoc.exists() ? [accountDoc.data()] : [],
        instruments: instruments.filter(Boolean),
        strategies: strategyDoc?.exists() ? [strategyDoc.data()] : [],
      };
      const prepared = prepareTrade(this.metadata(input, old), data, previous);
      const { legs, executions, adjustments, ...parent } = prepared;
      const saved = { ...parent, lastOperation: operationId };
      for (const [type, records] of Object.entries({
        legs,
        executions,
        adjustments,
      })) {
        const oldRecords = previous?.[type] || [];
        for (const record of records) {
          const before = oldRecords.find((r) => r.id === record.id);
          const content = clean(record);
          for (const key of [
            "revision",
            "createdAt",
            "updatedAt",
            "uid",
            "schemaVersion",
          ])
            delete content[key];
          const prior = before ? clean(before) : null;
          if (prior)
            for (const key of [
              "revision",
              "createdAt",
              "updatedAt",
              "uid",
              "schemaVersion",
            ])
              delete prior[key];
          if (JSON.stringify(content) !== JSON.stringify(prior))
            tx.set(
              this.child(input.id, type, record.id),
              this.metadata(content, before),
            );
        }
        for (const record of oldRecords.filter(
          (r) => !records.some((n) => n.id === r.id),
        ))
          tx.delete(this.child(input.id, type, record.id));
      }
      tx.set(ref, saved);
      tx.set(receipt, {
        id: operationId,
        uid: this.uid,
        requestFingerprint: requestHash,
        revision: saved.revision,
        createdAt: saved.updatedAt,
      });
      const a = accountDoc.data();
      if (!a.hasTrades)
        tx.set(
          this.ref("accounts", a.id),
          this.metadata({ ...a, hasTrades: true }, a),
        );
      return saved;
    });
    // Reading after either commit or a durable receipt returns current state; retries never recreate records.
    return (await this._getTrade(input.id)) || result;
  }
  async _deleteTrade(input) {
    requireValue(this.verified(), "Verify email before deleting");
    const previous = await this._getTrade(input.id);
    if (!previous) return;
    const operations = await this._listChildren(input.id, "operations");
    await runTransaction(this.db, async (tx) => {
      const s = await tx.get(this.ref("trades", input.id));
      if (!s.exists()) return;
      if (
        s.data().revision !== input.revision ||
        previous.revision !== input.revision
      )
        throw new ConflictError();
      for (const type of ["legs", "executions", "adjustments"])
        for (const r of previous[type])
          tx.delete(this.child(input.id, type, r.id));
      for (const r of operations)
        tx.delete(this.child(input.id, "operations", r.id));
      tx.delete(this.ref("trades", input.id));
    });
  }
}
