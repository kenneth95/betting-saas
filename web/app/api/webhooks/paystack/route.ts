import crypto from "crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

const SUBSCRIPTION_LENGTH_DAYS = 7;
const PAYSTACK_BASE_URL = "https://api.paystack.co";

/**
 * Paystack signs every webhook with HMAC-SHA512 of the raw request body,
 * keyed with your secret key, sent in the x-paystack-signature header.
 * This is real cryptographic verification (unlike some other providers'
 * "shared string" approach) - but it MUST be computed over the raw,
 * unparsed body bytes, not a re-serialized JSON object, or the signature
 * will never match. That's why this reads request.text() first and only
 * calls JSON.parse() after the signature check passes.
 */
function isValidSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;

  const expected = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!)
    .update(rawBody)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(signatureHeader, "utf8");

  // timingSafeEqual throws if lengths differ, rather than returning false -
  // guard that explicitly so a malformed header doesn't crash the route.
  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!isValidSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const reference: string | undefined = payload?.data?.reference;

  if (!reference) {
    return NextResponse.json({ error: "No reference in payload" }, { status: 400 });
  }

  // Belt and braces even with a valid signature: re-fetch the
  // authoritative status from Paystack's API rather than trusting the
  // webhook body's status field on its own. Cheap, and protects against
  // any bug or edge case in how the event was generated upstream.
  const verifyResp = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
  });
  const verifyData = await verifyResp.json().catch(() => null);
  const status: string | undefined = verifyData?.data?.status;

  const service = createServiceClient();
  const { data: payment } = await service
    .from("payments")
    .select("user_id, status")
    .eq("api_ref", reference)
    .maybeSingle();

  if (!payment) {
    console.error("Webhook referenced an unknown reference:", reference);
    return NextResponse.json({ error: "Unknown payment" }, { status: 404 });
  }

  // Idempotent: Paystack retries webhook delivery, and a completed
  // payment being reprocessed shouldn't extend the subscription again.
  if (payment.status === "completed") {
    return NextResponse.json({ ok: true, note: "Already processed" });
  }

  if (status === "success") {
    await service.from("payments").update({ status: "completed" }).eq("api_ref", reference);

    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + SUBSCRIPTION_LENGTH_DAYS);

    await service.from("subscriptions").upsert({
      user_id: payment.user_id,
      status: "active",
      current_period_end: periodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    });
  } else if (status === "failed") {
    await service.from("payments").update({ status: "failed" }).eq("api_ref", reference);
  }
  // Any other status (e.g. still processing) - wait for the next webhook.

  return NextResponse.json({ ok: true });
}
