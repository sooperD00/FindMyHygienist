/**
 * ProviderCard unit tests — pure helper functions.
 *
 * truncateBio is the only logic worth testing independently;
 * the rest of ProviderCard is rendering (covered by visual QA
 * and future integration tests).
 */

import { describe, it, expect } from "vitest";
import { truncateBio } from "../components/ProviderCard";

describe("truncateBio", () => {
  it("returns short text unchanged", () => {
    expect(truncateBio("Hello world")).toBe("Hello world");
  });

  it("returns text at exactly maxLen unchanged", () => {
    const bio = "a".repeat(200);
    expect(truncateBio(bio)).toBe(bio);
  });

  it("truncates at last space before maxLen", () => {
    const bio = "word ".repeat(50); // 250 chars
    const result = truncateBio(bio);
    expect(result.endsWith("…")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(201); // 200 + ellipsis
    expect(result).not.toMatch(/\s…$/); // no trailing space before ellipsis
  });

  it("handles no spaces in long text", () => {
    const bio = "a".repeat(250);
    const result = truncateBio(bio);
    expect(result).toBe("a".repeat(200) + "…");
  });

  it("respects custom maxLen", () => {
    const bio = "one two three four five six";
    const result = truncateBio(bio, 15);
    expect(result).toBe("one two three…");
  });
});