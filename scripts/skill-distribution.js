import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { skillDownload } from "../src/config/skill.js";

const run = promisify(execFile);

/** Publish the archive prepared by npm's build hooks; dev prepares it before serving. */
export function skillDistributionPlugin(root, version) {
  const download = skillDownload(version);
  const archivePath = join(root, "dist-skill", download.filename);
  let command;
  return {
    name: "skill-distribution",
    configResolved(config) { command = config.command; },
    async buildStart() {
      if (command !== "build") return;
      let source;
      try { source = await readFile(archivePath); }
      catch (error) { throw new Error("Build the skill before the website with npm run build or npm run build:prod", { cause: error }); }
      this.emitFile({ type: "asset", fileName: download.path, source });
    },
    async configureServer(server) {
      await run(process.execPath, [join(root, "scripts", "build-skill.js")], { cwd: root });
      const source = await readFile(archivePath);
      server.middlewares.use((request, response, next) => {
        if (request.url?.split("?")[0] !== `/${download.path}`) return next();
        response.setHeader("Content-Type", "application/zip");
        response.setHeader("Content-Disposition", `attachment; filename="${download.filename}"`);
        response.setHeader("Cache-Control", "no-cache");
        response.setHeader("Content-Length", source.length);
        response.end(request.method === "HEAD" ? undefined : source);
      });
    },
  };
}
