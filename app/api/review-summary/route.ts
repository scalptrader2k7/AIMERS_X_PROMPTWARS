import { NextResponse } from "next/server";
import { generateReviewSummary } from "@/lib/gemini-review-summary";
import { reviewSummaryRequestSchema, type ReviewSummary } from "@/lib/review-summary";

export const runtime = "nodejs";
export const MAX_REVIEW_SUMMARY_BODY_BYTES = 30_000;
type SummaryProcessor = (input: Parameters<typeof generateReviewSummary>[0]) => Promise<ReviewSummary | null>;

export async function handleReviewSummaryRequest(request: Request, process: SummaryProcessor = generateReviewSummary) {
  if (!request.headers.get("content-type")?.includes("application/json")) return NextResponse.json({ error: "Send a JSON request to generate an AI review summary." }, { status: 415 });
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REVIEW_SUMMARY_BODY_BYTES) return NextResponse.json({ error: "The review-summary request is too large." }, { status: 413 });
  let body: unknown;
  try { const raw = await request.text(); if (new TextEncoder().encode(raw).length > MAX_REVIEW_SUMMARY_BODY_BYTES) return NextResponse.json({ error: "The review-summary request is too large." }, { status: 413 }); body = JSON.parse(raw); } catch { return NextResponse.json({ error: "The request body must contain valid JSON." }, { status: 400 }); }
  const parsed = reviewSummaryRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "The review-summary request is not valid." }, { status: 400 });
  const summary = await process(parsed.data);
  if (!summary) return NextResponse.json({ error: "AI review summary is unavailable. The structured record remains available for human review." }, { status: 503 });
  return NextResponse.json(summary);
}

export async function POST(request: Request) { return handleReviewSummaryRequest(request); }
