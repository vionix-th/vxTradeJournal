import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { zipSync } from "fflate";

/** Archive only the freshly generated installable folder, under one portable root. */
export async function createSkillArchive(folder, destination) {
  const files = {};
  async function collect(directory, prefix) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(directory, entry.name), name = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) await collect(path, name);
      else if (entry.isFile()) files[name] = await readFile(path);
      else throw new Error(`Skill archive requires regular files and directories: ${path}`);
    }
  }
  await collect(folder, basename(folder));
  // ZIP timestamps are container metadata; stable dates keep unchanged builds identical.
  await writeFile(destination, zipSync(files, { level: 9, mtime: new Date(1980, 0, 1) }));
}
