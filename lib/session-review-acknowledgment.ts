import type { RecordConflict } from "@/lib/conflict-detection";

export const SESSION_ACKNOWLEDGMENT_STATUS = "Acknowledged for this session. This does not resolve the possible inconsistency.";
export type SessionAcknowledgmentId = `conflict-review:${RecordConflict["category"]}`;

export function toSessionAcknowledgmentId(category: RecordConflict["category"]): SessionAcknowledgmentId {
  return `conflict-review:${category}`;
}

export function isSafeSessionAcknowledgmentId(value: string): value is SessionAcknowledgmentId {
  return /^conflict-review:(allergy|medication|demographic)$/.test(value);
}

export function isAcknowledged(ids: ReadonlySet<SessionAcknowledgmentId>, id: string): boolean {
  return isSafeSessionAcknowledgmentId(id) && ids.has(id);
}

export function toggleAcknowledgment(ids: ReadonlySet<SessionAcknowledgmentId>, id: string): Set<SessionAcknowledgmentId> {
  if (!isSafeSessionAcknowledgmentId(id)) return new Set(ids);
  const next = new Set(ids);
  if (next.has(id)) next.delete(id); else next.add(id);
  return next;
}
