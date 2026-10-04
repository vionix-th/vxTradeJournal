/** Unsaved preferences have the same shape in individual reads and full exports. */
export function defaultSettings(timezone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  return { id: "preferences", theme: "system", timezone, defaultAccount: null, revision: 0 };
}
