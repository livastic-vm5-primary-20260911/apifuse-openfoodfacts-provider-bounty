import { describe, expect, it } from "bun:test";
import { runStandardTests } from "@apifuse/provider-sdk/testing";

import provider from "../index";
import manifest from "../manifest.json";

runStandardTests(provider, undefined, { ...manifest, sdkVersion: 1 });

describe("open-food-facts", () => {
  it("keeps manifest metadata on sdk v2", () => {
    expect(manifest.sdkVersion).toBe(2);
    expect(manifest.auth).toBe("none");
  });
});
