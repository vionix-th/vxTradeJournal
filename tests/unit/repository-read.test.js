import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getDoc: vi.fn(), getDocs: vi.fn() }));
vi.mock("firebase/firestore", () => ({
  doc: (_db, ...parts) => parts.join("/"),
  collection: (_db, ...parts) => parts.join("/"),
  getDoc: mocks.getDoc,
  getDocFromServer: async () => ({ exists: () => true, data: () => ({ metadataVersion: 1, schemaVersion: 1, status: "ready" }) }),
  getDocs: mocks.getDocs,
  runTransaction: vi.fn(),
}));
import { Repository } from "../../src/persistence/repository.js";
const snapshot = (revision) => ({
  exists: () => revision !== null,
  data: () => ({ id: "t", revision }),
});
beforeEach(() => {
  vi.resetAllMocks();
});
describe("consistent source reads", () => {
  it("retries when children are read across a concurrent parent revision", async () => {
    mocks.getDoc
      .mockResolvedValueOnce(snapshot(1))
      .mockResolvedValueOnce(snapshot(2))
      .mockResolvedValueOnce(snapshot(2))
      .mockResolvedValueOnce(snapshot(2));
    let reads = 0;
    mocks.getDocs.mockImplementation(async (path) => {
      if (path.endsWith("/executions")) {
        reads++;
        return {
          docs: [{ data: () => ({ id: reads === 1 ? "old" : "current" }) }],
        };
      }
      return { docs: [] };
    });
    const trade = await new Repository({}, "alice").getTrade("t");
    expect(trade.revision).toBe(2);
    expect(trade.executions).toEqual([{ id: "current" }]);
  });
  it("returns absent when deletion commits during source read", async () => {
    mocks.getDoc
      .mockResolvedValueOnce(snapshot(1))
      .mockResolvedValue(snapshot(null));
    mocks.getDocs.mockResolvedValue({ docs: [] });
    expect(await new Repository({}, "alice").getTrade("t")).toBeNull();
  });
});
