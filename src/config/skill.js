/** Shared name for the generated archive and its website download. */
export function skillDownload(version) {
  const filename = `vx-trade-journal-${version}.zip`;
  return { filename, path: `downloads/${filename}` };
}
