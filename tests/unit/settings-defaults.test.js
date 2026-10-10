import { describe, expect, it, vi } from "vitest";
vi.mock("firebase/firestore", () => ({
  doc: (_db, ...parts) => parts.join("/"),
  collection: (_db, ...parts) => parts.join("/"),
  getDocFromServer: async () => ({ exists: () => true, data: () => ({ metadataVersion: 1, schemaVersion: 2, status: "ready" }) }),
  getDoc: async () => ({ exists: () => false }),
  getDocs: async () => ({ docs: [] }),
  runTransaction: vi.fn(),
}));
import { Repository } from "../../src/persistence/repository.js";

describe("unsaved preference defaults", () => {
  it("uses the same complete contract for direct reads and journal loads", async () => {
    const repository = new Repository({}, "synthetic-user");
    const settings = await repository.getSettings();
    const loaded = (await repository.load()).settings;
    expect(loaded).toEqual(settings);
    expect(loaded).toMatchObject({ id: "preferences", theme: "system", defaultAccount: null, revision: 0 });
    expect(loaded).not.toBe(settings);
  });
});
