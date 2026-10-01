import { describe, expect, it } from "vitest";
import { firebaseConfiguration } from "../../src/config/firebase.js";

describe("Firebase environment boundaries", () => {
  const web = { projectId: "vionixtradejournal", apiKey: "public-key", authDomain: "vionixtradejournal.firebaseapp.com", appId: "web-app" };
  it("uses hosted credentials without emulator endpoints for production", () => {
    expect(firebaseConfiguration("prod", web)).toEqual({ options: web, useEmulators: false });
  });
  it("keeps each local profile on an isolated demo project", () => {
    for (const name of ["dev", "test", "auto"]) {
      const config = firebaseConfiguration(name, web);
      expect(config.useEmulators).toBe(true);
      expect(config.options.projectId).toBe(`demo-vxjournal-${name}`);
      expect(config.options.apiKey).toBe("demo-key");
      expect(config.authPort).toBeGreaterThan(0);
      expect(config.firestorePort).toBeGreaterThan(0);
    }
  });
  it("rejects unknown profiles and incomplete or wrong production targets", () => {
    expect(() => firebaseConfiguration("unknown", web)).toThrow();
    expect(() => firebaseConfiguration("prod", {})).toThrow();
    expect(() => firebaseConfiguration("prod", { ...web, projectId: "other-project" })).toThrow();
  });
});
