import { el } from "./components.js";
import { skillDownload } from "../config/skill.js";

export function skillDownloadPanel({ compact = false } = {}) {
  const download = skillDownload(__APP_VERSION__);
  return el("div", { class: "skill-download" },
    el("a", {
      class: compact ? "session-action" : "button secondary",
      href: `${import.meta.env.BASE_URL}${download.path}`,
      download: download.filename,
    }, "Download agent skill (ZIP)"),
    el("p", { class: "help" }, "Requires Node.js 22.13+. Extract into the agent’s skill directory, then run ",
      el("code", {}, "npm ci --omit=dev"), " inside vx-trade-journal."));
}
