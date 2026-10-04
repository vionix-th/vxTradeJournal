import { readFileSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { Repository } from "../../src/persistence/repository.js";
import { createTrade } from "../../src/domain/journal.js";
let env, repo;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: process.env.GCLOUD_PROJECT || "demo-vxjournal-auto",
    firestore: {
      host: "127.0.0.1",
      port: Number(process.env.FIRESTORE_EMULATOR_HOST?.split(":")[1] || 8280),
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});
afterAll(async () => {
  await env?.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  repo = new Repository(
    env.authenticatedContext("alice", { email_verified: true }).firestore(),
    "alice",
    () => true,
  );
});
async function fixtures() {
  const account = await repo.saveEntity("accounts", {
    id: "a",
    name: "Main",
    currency: "USD",
  });
  const instrument = await repo.saveEntity("instruments", {
    id: "i",
    name: "Acme",
    symbol: "ACME",
    market: "Equities",
    preset: "equity",
    model: "linear",
    quantityUnit: "shares",
    quantityIncrement: "1",
    priceIncrement: "0.01",
    pointValue: "1",
    currency: "USD",
  });
  const strategy = await repo.saveEntity("strategies", {
    id: "s",
    name: "Breakout",
    entryRules: "Original",
  });
  return { account, instrument, strategy };
}
describe("transactional repository", () => {
  it("saves six distinct legs atomically with first-account lock, strategy and complete history", async () => {
    const { account, instrument, strategy } = await fixtures();
    const instruments = await Promise.all(Array.from({ length: 6 }, (_, index) =>
      repo.saveEntity("instruments", { ...instrument, id: `capacity-${index}`, revision: 0 })));
    const source = createTrade({ id: "capacity", account, strategy, instruments: instruments.map((item) => ({ instrument: item, direction: "long" })) });
    source.executions = source.legs.flatMap((leg, index) => ["entry", "exit"].map((kind, offset) => ({
      id: `${leg.id}-${kind}`, legId: leg.id, kind, quantity: "1", price: offset ? "12" : "10",
      fees: "0", feeCurrency: "USD", timestamp: `2026-01-0${offset + 1}T00:00:00Z`, sequence: index * 2 + offset,
    })));
    let saved = await repo.saveTrade(source, "capacity-create");
    expect(saved.summary.accountNet).toBe("12");
    expect((await repo.getEntity("accounts", account.id)).hasTrades).toBe(true);
    saved = await repo.saveTrade({ ...saved, legs: saved.legs.map((leg, index) => index ? leg : { ...leg, snapshot: { ...leg.snapshot, pointValue: "2" } }) }, "capacity-correct");
    expect(saved.summary.accountNet).toBe("14");
    await repo.deleteTrade(saved);
    expect(await repo.getTrade(saved.id)).toBeNull();
    for (const type of ["legs", "executions", "adjustments", "operations"])
      expect(await repo.listChildren(saved.id, type)).toEqual([]);
  });
  it("rejects rebinding persisted leg while retaining explicit snapshot corrections", async () => {
    const { account, instrument } = await fixtures();
    const replacement = await repo.saveEntity("instruments", { ...instrument, id: "other", revision: 0, pointValue: "10" });
    const t = createTrade({ id: "t", account, instruments: [{ instrument, direction: "long" }] });
    t.executions = ["entry", "exit"].map((kind, index) => ({
      id: `e${index}`, legId: t.legs[0].id, kind, quantity: "1", price: index ? "12" : "10",
      timestamp: `2026-01-0${index + 1}T00:00:00Z`, fees: "0", feeCurrency: "USD",
    }));
    const saved = await repo.saveTrade(t, "create");
    expect(saved.summary.accountNet).toBe("2");
    await expect(repo.saveTrade({ ...saved, legs: [{ ...saved.legs[0], instrumentId: replacement.id, snapshot: replacement }] }, "rebind")).rejects.toThrow(/leg instrument cannot change/i);
    expect((await repo.getTrade(t.id)).summary.accountNet).toBe("2");
    const corrected = await repo.saveTrade({ ...saved, legs: [{ ...saved.legs[0], snapshot: { ...saved.legs[0].snapshot, pointValue: "10" } }] }, "correct-snapshot");
    expect(corrected.summary.accountNet).toBe("20");
    expect((await repo.getTrade(t.id)).legs[0].instrumentId).toBe(instrument.id);
  });
  it("persists source records, snapshots, historical edits and export-ready reload", async () => {
    const { account, instrument, strategy } = await fixtures();
    let t = createTrade({
      id: "t",
      account,
      instruments: [{ instrument, direction: "long" }],
      strategy,
    });
    t.executions = [
      {
        id: "e",
        legId: t.legs[0].id,
        kind: "entry",
        quantity: "2",
        price: "10",
        fees: "1",
        feeCurrency: "USD",
        timestamp: "2026-01-01T00:00:00Z",
        orderReference: "shared",
      },
    ];
    t = await repo.saveTrade(t, "op1");
    await repo.saveEntity("instruments", { ...instrument, pointValue: "10" });
    await repo.saveEntity("strategies", { ...strategy, entryRules: "Changed" });
    const data = await repo.load();
    expect(data.trades[0].legs[0].snapshot.pointValue).toBe("1");
    expect(data.trades[0].strategySnapshot.entryRules).toBe("Original");
    expect(data.trades[0].executions[0].orderReference).toBe("shared");
    expect(data.accounts[0].hasTrades).toBe(true);
    expect(t.summary.accountNet).toBe("-1");
  });
  it("retains quotation units and absent metadata in historical snapshots", async () => {
    const { account, instrument } = await fixtures();
    const legacy = await repo.saveTrade(createTrade({ id: "legacy", account, instruments: [{ instrument, direction: "long" }] }), "legacy-create");
    const configured = await repo.saveEntity("instruments", { ...instrument, priceUnit: "USD/share" });
    const saved = await repo.saveTrade(createTrade({ id: "units", account, instruments: [{ instrument: configured, direction: "long" }] }), "units-create");
    await repo.saveEntity("instruments", { ...configured, priceUnit: "points" });
    const edited = await repo.saveTrade({ ...saved, review: "Historical unit retained" }, "units-edit");
    expect(edited.legs[0].snapshot.priceUnit).toBe("USD/share");
    const loaded = await repo.load();
    expect(loaded.trades.find((t) => t.id === "units").legs[0].snapshot.priceUnit).toBe("USD/share");
    const legacyEdit = await repo.saveTrade({ ...legacy, review: "No backfill" }, "legacy-edit");
    expect(legacyEdit.legs[0].snapshot).not.toHaveProperty("priceUnit");
    // The first save used a catalogue definition without quotation metadata.
    expect(instrument).not.toHaveProperty("priceUnit");
    expect(edited.calculationVersion).toBe(saved.calculationVersion);
  });
  it("retries create/edit idempotently and rejects stale revisions", async () => {
    const { account, instrument } = await fixtures();
    const t = createTrade({
      id: "t",
      account,
      instruments: [{ instrument, direction: "long" }],
    });
    const saved = await repo.saveTrade(t, "same-op");
    const retried = await repo.saveTrade(t, "same-op");
    expect(retried.revision).toBe(saved.revision);
    await expect(repo.saveTrade({ ...t, review: "Different intent" }, "same-op")).rejects.toMatchObject({ name: "ConflictError" });
    const edited = await repo.saveTrade({ ...saved, review: "New" }, "edit");
    await expect(
      repo.saveTrade({ ...saved, review: "Old" }, "stale"),
    ).rejects.toThrow(/conflict/i);
    expect((await repo.saveTrade(t, "same-op")).revision).toBe(edited.revision);
    expect((await repo.load()).trades).toHaveLength(1);
  });
  it("rejects currency changes for used accounts and invalid earlier corrections", async () => {
    const { account, instrument } = await fixtures();
    let t = createTrade({
      id: "t",
      account,
      instruments: [{ instrument, direction: "long" }],
    });
    t.executions = [
      {
        id: "e1",
        legId: t.legs[0].id,
        kind: "entry",
        quantity: "2",
        price: "10",
        fees: "0",
        feeCurrency: "USD",
        timestamp: "2026-01-01T00:00:00Z",
      },
      {
        id: "e2",
        legId: t.legs[0].id,
        kind: "exit",
        quantity: "2",
        price: "12",
        fees: "0",
        feeCurrency: "USD",
        timestamp: "2026-01-02T00:00:00Z",
      },
    ];
    t = await repo.saveTrade(t, "op");
    const latest = (await repo.load()).accounts[0];
    await expect(
      repo.saveEntity("accounts", { ...latest, currency: "EUR" }),
    ).rejects.toThrow(/currency/i);
    t.executions[0].quantity = "1";
    await expect(repo.saveTrade(t, "bad")).rejects.toThrow(/remaining/);
    expect((await repo.getTrade("t")).summary.accountNet).toBe("4");
  });
  it("cascades trade deletion including child records and supports archived existing trades", async () => {
    const { account, instrument } = await fixtures();
    let t = await repo.saveTrade(
      createTrade({
        id: "t",
        account,
        instruments: [{ instrument, direction: "long" }],
      }),
      "op",
    );
    await repo.saveEntity("accounts", {
      ...(await repo.load()).accounts[0],
      archived: true,
    });
    await repo.saveEntity("instruments", { ...instrument, archived: true });
    t = await repo.saveTrade({ ...t, review: "Still editable" }, "review");
    await repo.deleteTrade(t);
    expect(await repo.getTrade("t")).toBeNull();
    expect(await repo.listChildren("t", "legs")).toEqual([]);
    expect(await repo.listChildren("t", "operations")).toEqual([]);
  });
});
