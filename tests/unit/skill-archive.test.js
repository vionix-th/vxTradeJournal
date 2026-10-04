import { describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strFromU8, unzipSync } from "fflate";
import { createSkillArchive } from "../../scripts/skill-archive.js";

describe("portable skill ZIP", () => {
  it("produces identical ZIP bytes for unchanged contents across build times", async () => {
    const temporary = await mkdtemp(join(tmpdir(), "vxj-archive-time-test-"));
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const folder = join(temporary, "vx-trade-journal");
      await mkdir(folder);
      await writeFile(join(folder, "SKILL.md"), "Synthetic skill\n");
      const first = join(temporary, "first.zip"), second = join(temporary, "second.zip");
      vi.setSystemTime(new Date("2026-10-01T00:00:00Z"));
      await createSkillArchive(folder, first);
      vi.setSystemTime(new Date("2026-10-02T00:00:00Z"));
      await createSkillArchive(folder, second);
      expect(await readFile(second)).toEqual(await readFile(first));
    } finally {
      vi.useRealTimers();
      await rm(temporary, { recursive: true, force: true });
    }
  });

  it("contains the complete installable folder with original file contents", async () => {
    const temporary = await mkdtemp(join(tmpdir(), "vxj-archive-test-"));
    try {
      const folder = join(temporary, "vx-trade-journal");
      await mkdir(join(folder, "scripts"), { recursive: true });
      await mkdir(join(folder, "references"));
      const files = {
        "SKILL.md": "---\nname: vx-trade-journal\n---\n",
        "package.json": '{"version":"0.1.0"}',
        "package-lock.json": '{"lockfileVersion":3}',
        "scripts/vxjournal.mjs": 'console.log("Synthetic executable");\n',
        "references/commands.md": "Synthetic command reference\n",
      };
      for (const [path, content] of Object.entries(files)) await writeFile(join(folder, path), content);
      const archive = join(temporary, "skill.zip");
      await createSkillArchive(folder, archive);
      const entries = unzipSync(await readFile(archive));
      expect(Object.keys(entries).sort()).toEqual(Object.keys(files).map((path) => `vx-trade-journal/${path}`).sort());
      for (const [path, content] of Object.entries(files)) expect(strFromU8(entries[`vx-trade-journal/${path}`])).toBe(content);
    } finally { await rm(temporary, { recursive: true, force: true }); }
  });
});
