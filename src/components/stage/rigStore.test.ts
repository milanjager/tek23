import { describe, it, expect } from "vitest";
import { formatSavedTime } from "./rigStore";

describe("formatSavedTime", () => {
  it("shows hours without a leading zero, e.g. 9:04", () => {
    expect(formatSavedTime(new Date(2026, 0, 1, 9, 4))).toBe("9:04");
  });
  it("keeps two-digit minutes in the afternoon", () => {
    expect(formatSavedTime(new Date(2026, 0, 1, 17, 30))).toBe("17:30");
  });
});
