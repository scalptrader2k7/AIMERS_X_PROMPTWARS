import { describe, expect, it } from "vitest";
import { classifyLabStatus } from "../lib/lab-status";

describe("classifyLabStatus", () => {
  it("classifies a result using only an explicit numeric source range", () => {
    expect(classifyLabStatus(3.2, "3.5 - 5.0")).toBe("low");
    expect(classifyLabStatus(4.2, "3.5–5.0")).toBe("normal");
    expect(classifyLabStatus(5.4, "3.5 to 5.0")).toBe("high");
  });

  it("does not assess missing, malformed, or non-comparable data", () => {
    expect(classifyLabStatus(4.2, null)).toBe("not_assessed");
    expect(classifyLabStatus("not reported", "3.5 - 5.0")).toBe("not_assessed");
    expect(classifyLabStatus(4.2, "within range")).toBe("not_assessed");
    expect(classifyLabStatus(4.2, "5.0 - 3.5")).toBe("not_assessed");
  });
});
