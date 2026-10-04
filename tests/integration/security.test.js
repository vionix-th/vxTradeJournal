import { readFileSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, describe, it } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, deleteDoc, writeBatch } from "firebase/firestore";
let env;
const base = {
  id: "a",
  uid: "alice",
  schemaVersion: 1,
  revision: 1,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};
const account = {
  ...base,
  name: "Main",
  currency: "USD",
  archived: false,
  hasTrades: false,
};
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
});
const db = (uid = "alice", verified = true) =>
  env.authenticatedContext(uid, { email_verified: verified }).firestore();
describe("ownership and structural validation", () => {
  it("denies anonymous and cross-user access including children", async () => {
    await assertSucceeds(setDoc(doc(db(), "users/alice/accounts/a"), account));
    for (const store of [db("bob"), env.unauthenticatedContext().firestore()]) {
      await assertFails(getDoc(doc(store, "users/alice/accounts/a")));
      await assertFails(setDoc(doc(store, "users/alice/accounts/a"), account));
      await assertFails(
        getDoc(doc(store, "users/alice/trades/t/executions/e")),
      );
    }
  });
  it("denies unverified writes, malformed metadata and currencies", async () => {
    await assertFails(
      setDoc(doc(db("alice", false), "users/alice/accounts/a"), account),
    );
    await assertFails(
      setDoc(doc(db(), "users/alice/accounts/a"), { ...account, uid: "bob" }),
    );
    await assertFails(
      setDoc(doc(db(), "users/alice/accounts/a"), {
        ...account,
        currency: "usd",
      }),
    );
    await assertFails(
      setDoc(doc(db(), "users/alice/accounts/a"), { ...account, revision: 0 }),
    );
  });
  it("prevents revision bypass and used account currency change", async () => {
    const d = db();
    await setDoc(doc(d, "users/alice/accounts/a"), {
      ...account,
      hasTrades: true,
    });
    await assertFails(
      setDoc(doc(d, "users/alice/accounts/a"), {
        ...account,
        hasTrades: true,
        name: "Changed",
      }),
    );
    await assertFails(
      setDoc(doc(d, "users/alice/accounts/a"), {
        ...account,
        hasTrades: true,
        currency: "EUR",
        revision: 2,
      }),
    );
    await assertSucceeds(
      setDoc(doc(d, "users/alice/accounts/a"), {
        ...account,
        hasTrades: true,
        name: "Changed",
        revision: 2,
      }),
    );
  });
  it("rejects cross-owner account reference and orphan legs/executions", async () => {
    const d = db();
    await env.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), "users/bob/accounts/a"), {
        ...account,
        uid: "bob",
      });
    });
    const t = {
      ...base,
      id: "t",
      accountId: "a",
      accountCurrency: "USD",
      strategyId: null,
      strategySnapshot: null,
      rationale: "",
      review: "",
      tags: [],
      riskBudget: null,
      status: "open",
      summary: {},
      lastOperation: "op",
    };
    await assertFails(setDoc(doc(d, "users/alice/trades/t"), t));
    await assertFails(
      setDoc(doc(d, "users/alice/trades/t/executions/e"), {
        ...base,
        id: "e",
        legId: "l",
        kind: "entry",
        quantity: "1",
        price: "10",
        timestamp: base.createdAt,
        fees: "0",
        feeCurrency: "USD",
      }),
    );
    await assertFails(
      setDoc(doc(d, "users/alice/trades/t/legs/l"), {
        ...base,
        id: "l",
        instrumentId: "i",
        direction: "long",
        snapshot: {},
        planning: {},
      }),
    );
  });
  it("denies unknown paths and auth-secret export storage", async () => {
    await assertFails(setDoc(doc(db(), "users/alice/secrets/password"), base));
    await assertFails(deleteDoc(doc(db(), "users/bob/accounts/a")));
  });
  it("requires atomic parent revision for child changes and cascade deletion", async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      const d = c.firestore();
      await setDoc(doc(d, "users/alice/accounts/a"), {
        ...account,
        hasTrades: true,
      });
      await setDoc(doc(d, "users/alice/trades/t"), {
        ...base,
        id: "t",
        accountId: "a",
        accountCurrency: "USD",
        strategyId: null,
        strategySnapshot: null,
        rationale: "",
        review: "",
        tags: [],
        riskBudget: null,
        status: "open",
        summary: {},
        lastOperation: "op",
      });
      await setDoc(doc(d, "users/alice/trades/t/adjustments/x"), {
        ...base,
        id: "x",
        amount: "1",
        currency: "USD",
        rate: "1",
        reason: "Correction",
        timestamp: base.createdAt,
      });
    });
    const d = db();
    const ref = doc(d, "users/alice/trades/t/adjustments/x");
    await assertFails(
      setDoc(ref, {
        ...base,
        id: "x",
        amount: "2",
        currency: "USD",
        rate: "1",
        reason: "Changed",
        timestamp: base.createdAt,
        revision: 2,
      }),
    );
    const batch = writeBatch(d);
    batch.update(doc(d, "users/alice/trades/t"), { revision: 2 });
    batch.set(ref, {
      ...base,
      id: "x",
      amount: "2",
      currency: "USD",
      rate: "1",
      reason: "Changed",
      timestamp: base.createdAt,
      revision: 2,
    });
    await assertSucceeds(batch.commit());
  });
});

describe("historical and configuration integrity", () => {
  it("denies atomic leg instrument replacement and permits same-instrument snapshot correction", async () => {
    const instrument = {
      ...base, id: "i", name: "Acme", symbol: "ACME", market: "Equities", venue: "",
      preset: "equity", model: "linear", quantityUnit: "shares", quantityIncrement: "1",
      priceIncrement: "0.01", pointValue: "1", currency: "USD", underlying: "", expiry: "",
      strike: null, optionType: "", draft: false, archived: false, lastUsedAt: null,
    };
    const replacement = { ...instrument, id: "other", pointValue: "10" };
    const leg = { ...base, id: "l", instrumentId: "i", snapshot: instrument, direction: "long", planning: {} };
    await env.withSecurityRulesDisabled(async (c) => {
      const d = c.firestore();
      await setDoc(doc(d, "users/alice/accounts/a"), { ...account, hasTrades: true });
      await setDoc(doc(d, "users/alice/instruments/i"), instrument);
      await setDoc(doc(d, "users/alice/instruments/other"), replacement);
      await setDoc(doc(d, "users/alice/trades/t"), {
        ...base, id: "t", accountId: "a", accountCurrency: "USD", strategyId: null,
        strategySnapshot: null, rationale: "", review: "", tags: [], riskBudget: null,
        status: "open", summary: {}, lastOperation: "op",
      });
      await setDoc(doc(d, "users/alice/trades/t/legs/l"), leg);
    });
    const d = db();
    const rebound = writeBatch(d);
    rebound.update(doc(d, "users/alice/trades/t"), { revision: 2 });
    rebound.set(doc(d, "users/alice/trades/t/legs/l"), {
      ...leg, revision: 2, instrumentId: "other", snapshot: replacement,
    });
    await assertFails(rebound.commit());
    const corrected = writeBatch(d);
    corrected.update(doc(d, "users/alice/trades/t"), { revision: 2 });
    corrected.set(doc(d, "users/alice/trades/t/legs/l"), {
      ...leg, revision: 2, snapshot: { ...instrument, pointValue: "10" },
    });
    await assertSucceeds(corrected.commit());
  });
  it("rejects forged strategy snapshots on new links and subsequent edits", async () => {
    const strategy = {
      ...base,
      id: "s",
      name: "Rules",
      purpose: "",
      markets: "",
      entryRules: "Original",
      exitRules: "",
      riskRules: "",
      archived: false,
    };
    const t = {
      ...base,
      id: "t",
      accountId: "a",
      accountCurrency: "USD",
      strategyId: "s",
      strategySnapshot: strategy,
      rationale: "",
      review: "",
      tags: [],
      riskBudget: null,
      status: "open",
      summary: {},
      lastOperation: "op",
    };
    await env.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), "users/alice/accounts/a"), {
        ...account,
        hasTrades: true,
      });
      await setDoc(doc(c.firestore(), "users/alice/strategies/s"), strategy);
    });
    const d = db();
    await assertFails(
      setDoc(doc(d, "users/alice/trades/t"), {
        ...t,
        strategySnapshot: { ...strategy, entryRules: "Forged" },
      }),
    );
    await assertSucceeds(setDoc(doc(d, "users/alice/trades/t"), t));
    await assertFails(
      setDoc(doc(d, "users/alice/trades/t"), {
        ...t,
        revision: 2,
        strategySnapshot: { ...strategy, entryRules: "Changed" },
      }),
    );
  });
  it("requires trade creation to lock account reporting currency atomically", async () => {
    await setDoc(doc(db(), "users/alice/accounts/a"), account);
    const t = {
      ...base,
      id: "t",
      accountId: "a",
      accountCurrency: "USD",
      strategyId: null,
      strategySnapshot: null,
      rationale: "",
      review: "",
      tags: [],
      riskBudget: null,
      status: "open",
      summary: {},
      lastOperation: "op",
    };
    await assertFails(setDoc(doc(db(), "users/alice/trades/t"), t));
  });
  it("rejects negative point values even on manual definitions", async () => {
    const i = {
      ...base,
      id: "i",
      name: "Option",
      symbol: "OPT",
      market: "Options",
      venue: "",
      preset: "options",
      model: "manual",
      quantityUnit: "contracts",
      quantityIncrement: "1",
      priceIncrement: "0.01",
      pointValue: "-1",
      currency: "USD",
      underlying: "",
      expiry: "",
      strike: null,
      optionType: "",
      draft: false,
      archived: false,
      lastUsedAt: null,
    };
    await assertFails(setDoc(doc(db(), "users/alice/instruments/i"), i));
  });
});

describe("quotation-unit persistence boundary", () => {
  const instrument = {
    ...base, id: "i", name: "Acme", symbol: "ACME", market: "Equities", venue: "",
    preset: "equity", model: "linear", quantityUnit: "shares", quantityIncrement: "1",
    priceIncrement: "0.01", pointValue: "1", currency: "USD", underlying: "", expiry: "",
    strike: null, optionType: "", draft: false, archived: false, lastUsedAt: null,
  };
  it("accepts optional units and rejects malformed metadata", async () => {
    const ref = doc(db(), "users/alice/instruments/i");
    await assertSucceeds(setDoc(ref, { ...instrument, priceUnit: "USD/share" }));
    for (const priceUnit of ["x".repeat(81), 123, null])
      await assertFails(setDoc(ref, { ...instrument, revision: 2, priceUnit }));
    await assertSucceeds(setDoc(ref, { ...instrument, revision: 2 }));
  });
});
