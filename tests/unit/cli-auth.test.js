import { describe, it, expect, vi, afterEach } from "vitest";
import { UserSession } from "../../src/cli/auth.js";
import { firebaseConfiguration } from "../../src/config/firebase.js";
const saved = { version: 1, projectId: "demo-vxjournal-auto", uid: "alice", email: "alice@example.test", refreshToken: "synthetic-refresh" };
const store = { withLock: async (_profile, work) => work(), read: async () => saved, write: vi.fn() };
afterEach(() => { vi.unstubAllGlobals(); store.write.mockReset(); });
it("restores sessions whose refresh metadata uses a project number", async () => {
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id_token: "synthetic-id", refresh_token: "rotated", project_id: "12345" }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ users: [{ localId: "alice", email: saved.email, emailVerified: true }] }) }));
  const session = new UserSession("auto", firebaseConfiguration("auto"), store);
  expect(await session.token()).toMatchObject({ uid: "alice", emailVerified: true });
  expect(store.write).toHaveBeenCalledWith("auto", { ...saved, refreshToken: "rotated" });
});
describe("refresh identity and service failures", () => {
  it("rejects changed user identities before persisting any token", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id_token: "synthetic-id", refresh_token: "rotated", project_id: saved.projectId }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ users: [{ localId: "bob", email: "bob@example.test" }] }) }));
    await expect(new UserSession("auto", firebaseConfiguration("auto"), store).token()).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    expect(store.write).not.toHaveBeenCalled();
  });
  it("redacts authentication service errors and invalid refresh tokens", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: { message: "INVALID_REFRESH_TOKEN : synthetic-refresh" } }) }));
    await expect(new UserSession("auto", firebaseConfiguration("auto"), store).token()).rejects.toMatchObject({ code: "AUTH_FAILED", message: "Authentication failed. Check credentials or sign in again." });
  });
});
