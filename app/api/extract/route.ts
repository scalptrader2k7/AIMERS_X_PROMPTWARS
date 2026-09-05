import { NextResponse } from "next/server";
import { processExtraction } from "@/lib/extraction";
import { extractionRequestSchema } from "@/lib/medical-record";

export const runtime = "nodejs";

export async function handleExtractionRequest(
  request: Request,
  process = processExtraction,
) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Send a JSON request to create a structured record." }, { status: 415 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "The request body must contain valid JSON." }, { status: 400 });
  }
  const parsed = extractionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the patient details and report text, then try again." }, { status: 400 });
  }
  const response = await process(parsed.data);
  return NextResponse.json(response);
}

export async function POST(request: Request) {
  return handleExtractionRequest(request);
}
