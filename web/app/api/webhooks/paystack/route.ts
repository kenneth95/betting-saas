import crypto from "crypto";
import { NextResponse } from "next/server";
import { settlePayment } from "@/lib/payments";

/**
 * Paystack signs every webhook with HMAC-SHA512 of the raw request body,
 * keyed with your secret key, sent in the x-paystack-signature header.
 * It MUST be computed over the raw, unparsed body bytes, not a re-serialized
 * JSON object, or the signature will never match - which is why this reads
 * request.text() first and only parses JSON after the check passes.
 */
function isValidSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) return false;

  const expected = Buffer.from(crypto.createHmac("sha512", secret).update(rawBody).digest("hex"), "utf8");
  const received = Buffer.from(signatureHeader, "utf8");

  // timingSafeEqual throws if lengths differ - guard so a malformed header can't crash the route.
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

export async function POST(request: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    console.error("Paystack webhook received but PAYSTACK_SECRET_KEY is not set");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const rawBody = await request.text();
  if (!isValidSignature(rawBody, request.headers.get("x-paystack-signature"), secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: { event?: unknown; data?: { reference?: unknown } };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Paystack sends many event types to one URL; only charge outcomes matter.
  // Acknowledge the rest with a 200 so Paystack stops retrying them.
  if (typeof payload.event !== "string" || !payload.event.startsWith("charge.")) {
    return NextResponse.json({ ok: true, note: "Ignored event" });
  }

  const reference = payload.data?.reference;
  if (typeof reference !== "string" || !reference) {
    return NextResponse.json({ error: "No reference in payload" }, { status: 400 });
  }

  const outcome = await settlePayment(reference);

  // A transient failure must NOT be acknowledged with a 200: Paystack
  // retries non-2xx responses, which is exactly what rescues a paid customer
  // from a momentary database or network hiccup.
  if (outcome === "error") {
    return NextResponse.json({ error: "Temporary failure, please retry" }, { status: 500 });
  }
  // "unknown_reference" is acknowledged too: it isn't ours, so retrying can never help.
  return NextResponse.json({ ok: true, outcome });
}
