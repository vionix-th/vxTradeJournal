import { describe, it, expect } from "vitest";
import { mkdtemp, chmod, stat, readFile, symlink, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SessionStore } from "../../src/cli/session-store.js";

const session = { version: 1, projectId: "demo-vxjournal-auto", uid: "alice", email: "alice@example.test", refreshToken: "synthetic-refresh" };
describe("private renewable sessions", () => {
  it("keeps profile sessions isolated and writes only private atomic files", async () => {
    const root = await mkdtemp(join(tmpdir(), "vxj-session-"));
    try {
      const store = new SessionStore(root);
      expect(await store.read("auto")).toBeNull();
      await store.write("auto", session);
      expect(await store.read("auto")).toEqual(session);
      expect(await store.read("dev")).toBeNull();
      expect((await stat(root)).mode & 0o777).toBe(0o700);
      expect((await stat(join(root, "auto.json"))).mode & 0o777).toBe(0o600);
      expect(JSON.parse(await readFile(join(root, "auto.json"), "utf8"))).toEqual(session);
      await store.remove("auto");
      expect(await store.read("auto")).toBeNull();
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it("rejects unsafe root/file permissions and symlink destinations", async () => {
    const root = await mkdtemp(join(tmpdir(), "vxj-session-"));
    try {
      const store = new SessionStore(root);
      await chmod(root, 0o755);
      await expect(store.write("auto", session)).rejects.toThrow(/private|permission/i);
      await chmod(root, 0o700);
      await store.write("auto", session);
      await chmod(join(root, "auto.json"), 0o644);
      await expect(store.read("auto")).rejects.toThrow(/private|permission/i);
      await rm(join(root, "auto.json"));
      await symlink(join(root, "elsewhere"), join(root, "auto.json"));
      await expect(store.write("auto", session)).rejects.toThrow(/symlink|symbolic/i);
      await expect(store.remove("auto")).rejects.toThrow(/symlink|symbolic/i);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it("serializes overlapping refreshes and releases locks after failure", async () => {
    const root = await mkdtemp(join(tmpdir(), "vxj-session-"));
    try {
      const store = new SessionStore(root);
      let active = 0, maximum = 0;
      await Promise.all(Array.from({ length: 3 }, () => store.withLock("auto", async () => {
        active++; maximum = Math.max(maximum, active);
        await new Promise((resolve) => setTimeout(resolve, 20)); active--;
      })));
      expect(maximum).toBe(1);
      await expect(store.withLock("auto", async () => { throw new Error("failure"); })).rejects.toThrow("failure");
      await store.withLock("auto", async () => store.write("auto", session));
      expect(await store.read("auto")).toEqual(session);
      await mkdir(join(root, "dev.lock"), { mode: 0o700 });
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it("rejects path traversal profiles and unexpected secret fields", async () => {
    const root = await mkdtemp(join(tmpdir(), "vxj-session-"));
    try {
      const store = new SessionStore(root);
      await expect(store.write("../bad", session)).rejects.toThrow(/profile/i);
      await expect(store.write("auto", { ...session, password: "never-persist" })).rejects.toThrow(/session|field/i);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
