import { mkdtemp, rm, chmod, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it, expect } from 'vitest';
import { SessionStore } from '../../../src/cli/session-store.js';
export function register(context) {
 const { cli, prerequisites } = context;
it("uses renewable sessions across processes and protects credentials", async () => {
    const { root, uid } = context;

  const status = await cli("auth status");
  expect(status.body.data, JSON.stringify(status.body)).toMatchObject({ uid, emailVerified: true });
  expect(status.stderr).toBe("");
  expect(JSON.stringify(status.body)).not.toMatch(/refreshToken|idToken|Synthetic-test/);
  const session = await readFile(join(root, "auto.json"), "utf8");
  expect(session).not.toMatch(/password|idToken|Synthetic-test/);
  const otherRoot = await mkdtemp(join(tmpdir(), "vxj-other-"));
  try { expect((await cli("accounts list", undefined, {}, otherRoot)).code).toBe(3); }
  finally { await rm(otherRoot, { recursive: true, force: true }); }
});

it("does not expose another user's records and rejects unsafe saved sessions", async () => {
    const { uid } = context;

  const repo = await prerequisites();
  expect(await repo.getEntity("accounts", "a")).toMatchObject({ id: "a", uid });
  expect((await cli("accounts get", undefined, { id: "a" })).code).toBe(0);
  const other = await mkdtemp(join(tmpdir(), "vxj-user-"));
  try {
    await cli("auth register", { email: `other-${crypto.randomUUID()}@example.test`, password: "Synthetic-test-123" }, {}, other);
    const listed = await cli("accounts list", undefined, {}, other);
    expect(listed.body.data, JSON.stringify(listed.body)).toEqual([]);
    expect((await cli("accounts get", undefined, { id: "a" }, other)).code).toBe(4);
    await chmod(join(other, "auto.json"), 0o644);
    expect((await cli("auth status", undefined, {}, other)).code).toBe(2);
  } finally { await rm(other, { recursive: true, force: true }); }
});

it("rejects sessions copied into another Firebase profile before token refresh", async () => {
    const { root } = context;

  const directory = await mkdtemp(join(tmpdir(), "vxj-profile-"));
  try {
    const saved = JSON.parse(await readFile(join(root, "auto.json"), "utf8"));
    const store = new SessionStore(directory);
    for (const profile of ["dev", "test"]) {
      await store.write(profile, saved);
      const rejected = await cli("auth status", undefined, {}, directory, profile);
      expect(rejected.body.error).toMatchObject({ code: "AUTH_REQUIRED", message: "Saved session belongs to another project. Sign in for this profile." });
      expect(rejected.code).toBe(3);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
it.each(["auth login", "auth register"])("rejects %s credential-file input before accessing a path", async (command) => {
  const { root } = context;
  const rejected = await cli(command, undefined, { input: join(root, "nonexistent-credentials.json") });
  expect(rejected.code).toBe(2);
  expect(rejected.body.error.code).toBe("INVALID_INPUT");
  expect(rejected.body.error.message).toMatch(/stdin|prompt/);
  expect(rejected.stderr).toBe("");
  expect(JSON.stringify(rejected.body)).not.toMatch(/Synthetic-test|password|nonexistent-credentials/);
});
}
