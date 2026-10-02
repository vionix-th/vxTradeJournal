import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, rename, rm, unlink } from "node:fs/promises";
import { homedir, userInfo } from "node:os";
import { join } from "node:path";

const PROFILES = new Set(["dev", "test", "auto", "prod"]);
const FIELDS = ["version", "projectId", "uid", "email", "refreshToken"];
const PRIVATE_DIR = 0o700;
const PRIVATE_FILE = 0o600;
const LOCK_WAIT_MS = 5_000;

function profileName(profile) {
  if (!PROFILES.has(profile)) throw new Error("Invalid profile; expected dev, test, auto, or prod");
  return profile;
}

function validateSession(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid session object");
  const keys = Object.keys(value).sort();
  if (keys.length !== FIELDS.length || keys.some((key, i) => key !== [...FIELDS].sort()[i])) {
    throw new Error("Invalid session fields; only version, projectId, uid, email, and refreshToken are allowed");
  }
  if (value.version !== 1 || FIELDS.slice(1).some((key) => typeof value[key] !== "string" || !value[key].trim())) {
    throw new Error("Invalid session values");
  }
}

function safeMode(info, expected, label) {
  if (info.uid !== userInfo().uid || (info.mode & 0o777) !== expected) {
    throw new Error(`${label} ownership or private permissions are unsafe`);
  }
}

async function inspect(path, { mode, label, absent = false, type } = {}) {
  let info;
  try { info = await lstat(path); }
  catch (error) {
    if (absent && error.code === "ENOENT") return null;
    throw error;
  }
  if (info.isSymbolicLink()) throw new Error(`${label} must not be a symlink`);
  if (!info.isFile() && !info.isDirectory()) throw new Error(`${label} has an unsafe file type`);
  if (type === "file" && !info.isFile()) throw new Error(`${label} must be a regular file`);
  if (type === "directory" && !info.isDirectory()) throw new Error(`${label} must be a directory`);
  safeMode(info, mode, label);
  return info;
}

async function readPrivateFile(path, label, { absent = false } = {}) {
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    const info = await handle.stat();
    if (!info.isFile()) throw new Error(`${label} must be a regular file`);
    safeMode(info, PRIVATE_FILE, label);
    return await handle.readFile("utf8");
  } catch (error) {
    if (absent && error.code === "ENOENT") return null;
    if (error.code === "ELOOP") throw new Error(`${label} must not be a symlink`);
    throw error;
  } finally {
    await handle?.close().catch(() => {});
  }
}

export class SessionStore {
  constructor(root = join(process.env.VXJ_CONFIG_DIR || join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "vx-trade-journal"))) {
    this.root = root;
  }

  async #ensureRoot() {
    try { await mkdir(this.root, { recursive: true, mode: PRIVATE_DIR }); }
    catch (error) { throw new Error("Could not create private session directory", { cause: error }); }
    const info = await inspect(this.root, { mode: PRIVATE_DIR, label: "Session directory", type: "directory" });
    safeMode(info, PRIVATE_DIR, "Session directory");
  }

  #file(profile) { return join(this.root, `${profileName(profile)}.json`); }

  async read(profile) {
    const path = this.#file(profile);
    await this.#ensureRoot();
    await inspect(path, { mode: PRIVATE_FILE, label: "Session file", absent: true, type: "file" });
    let text;
    try {
      text = await readPrivateFile(path, "Session file", { absent: true });
      if (text === null) return null;
      const value = JSON.parse(text);
      validateSession(value);
      return value;
    } catch (error) {
      if (error.message?.startsWith("Invalid session")) throw error;
      throw new Error("Session file is invalid or unreadable");
    }
  }

  async write(profile, value) {
    validateSession(value);
    const path = this.#file(profile);
    await this.#ensureRoot();
    await inspect(path, { mode: PRIVATE_FILE, label: "Session file", absent: true, type: "file" });
    const temp = join(this.root, `.${profile}.tmp-${process.pid}-${randomBytes(8).toString("hex")}`);
    let handle;
    try {
      handle = await open(temp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, PRIVATE_FILE);
      await handle.writeFile(`${JSON.stringify(value)}\n`, "utf8");
      await handle.sync();
      await handle.close(); handle = null;
      await rename(temp, path);
      const directory = await open(this.root, constants.O_RDONLY);
      try { await directory.sync(); } catch { /* Directory sync is unavailable on some filesystems. */ }
      finally { await directory.close(); }
    } catch (error) {
      if (handle) await handle.close().catch(() => {});
      await unlink(temp).catch(() => {});
      if (error.message?.includes("symlink") || error.message?.includes("permissions")) throw error;
      throw new Error("Could not safely write session file");
    }
  }

  async remove(profile) {
    const path = this.#file(profile);
    await this.#ensureRoot();
    await inspect(path, { mode: PRIVATE_FILE, label: "Session file", absent: true, type: "file" });
    await unlink(path).catch((error) => { if (error.code !== "ENOENT") throw error; });
  }

  async withLock(profile, callback) {
    profileName(profile);
    await this.#ensureRoot();
    const path = join(this.root, `${profile}.lock`);
    const started = Date.now();
    let handle;
    while (!handle) {
      try {
        handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, PRIVATE_FILE);
        await handle.writeFile(JSON.stringify({ pid: process.pid, createdAt: Date.now() }));
        await handle.sync();
      } catch (error) {
        if (handle && error.code !== "EEXIST") {
          await handle.close().catch(() => {});
          handle = null;
          await unlink(path).catch(() => {});
        }
        if (error.code !== "EEXIST") throw new Error("Could not acquire session lock safely", { cause: error });
        try { await inspect(path, { mode: PRIVATE_FILE, label: "Session lock", type: "file" }); }
        catch (inspectError) {
          if (inspectError.code === "ENOENT") continue;
          throw inspectError;
        }
        let lock;
        try { lock = JSON.parse(await readPrivateFile(path, "Session lock")); }
        catch (readError) {
          if (readError.code === "ENOENT") continue;
          if (readError.message?.includes("symlink")) throw readError;
          lock = null;
        }
        let alive = false;
        if (Number.isInteger(lock?.pid) && lock.pid > 0) {
          try { process.kill(lock.pid, 0); alive = true; } catch (e) { alive = e.code === "EPERM"; }
        }
        if (Number.isInteger(lock?.pid) && !alive) throw new Error("Session lock belongs to a stopped process; remove the stale lock file to continue");
        if (Date.now() - started >= LOCK_WAIT_MS) throw new Error("Timed out waiting for session lock");
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }
    try { return await callback(); }
    finally {
      await handle.close().catch(() => {});
      await rm(path, { force: true });
    }
  }
}
