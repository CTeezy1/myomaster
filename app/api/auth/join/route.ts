import { NextResponse } from "next/server";
import { createLearnerAccount } from "@/src/lib/auth/join-account";
import { MAX_JOIN_REQUEST_BODY_BYTES } from "@/src/lib/auth/join.types";

export async function POST(request: Request) {
  const contentLengthHeader = request.headers.get("content-length");

  if (contentLengthHeader) {
    const contentLength = Number.parseInt(contentLengthHeader, 10);

    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_JOIN_REQUEST_BODY_BYTES
    ) {
      return NextResponse.json(
        { error: "Invalid request." },
        { status: 413 },
      );
    }
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const result = await createLearnerAccount(body);

  return NextResponse.json(result.body, { status: result.status });
}
