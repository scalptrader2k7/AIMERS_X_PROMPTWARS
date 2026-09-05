import { describe, expect, it } from "vitest";
import { isAcknowledged, isSafeSessionAcknowledgmentId, SESSION_ACKNOWLEDGMENT_STATUS, toSessionAcknowledgmentId, toggleAcknowledgment } from "../lib/session-review-acknowledgment";

describe("session-only conflict review acknowledgment", () => {
  const allergy = toSessionAcknowledgmentId("allergy");
  const medication = toSessionAcknowledgmentId("medication");

  it("starts with no acknowledged conflict IDs", () => {
    expect(isAcknowledged(new Set(), allergy)).toBe(false);
  });

  it("adds and then removes a safe stable conflict ID", () => {
    const acknowledged = toggleAcknowledgment(new Set(), allergy);
    expect(isAcknowledged(acknowledged, allergy)).toBe(true);
    expect(isAcknowledged(toggleAcknowledgment(acknowledged, allergy), allergy)).toBe(false);
  });

  it("keeps multiple conflict IDs independent", () => {
    const acknowledged = toggleAcknowledgment(toggleAcknowledgment(new Set(), allergy), medication);
    expect(isAcknowledged(acknowledged, allergy)).toBe(true);
    expect(isAcknowledged(acknowledged, medication)).toBe(true);
    expect(isAcknowledged(toggleAcknowledgment(acknowledged, allergy), medication)).toBe(true);
  });

  it("rejects blank or unsafe identifiers", () => {
    expect(isSafeSessionAcknowledgmentId("")).toBe(false);
    expect(isSafeSessionAcknowledgmentId("conflict-review:allergy-user-text")).toBe(false);
    expect(toggleAcknowledgment(new Set(), "conflict-review:allergy-user-text")).toEqual(new Set());
  });

  it("uses the exact temporary, non-resolution status wording", () => {
    expect(SESSION_ACKNOWLEDGMENT_STATUS).toBe("Acknowledged for this session. This does not resolve the possible inconsistency.");
  });
});
