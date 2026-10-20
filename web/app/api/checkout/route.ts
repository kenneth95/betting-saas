import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { normalizeKenyanMsisdn } from "@/lib/phone";
import { toMinorUnits } from "@/lib/billing";
import { WEEKLY_PRICE_KES } from "@/lib/site";

const PAYSTACK_BASE_URL = "https://api.paystack.co";
// An M-Pesa prompt stays open for about a minute. Refuse to send a second
// one inside this window so a double-tap or retry loop can't spam the
// customer's phone (or leave a pile of orphaned pending payments).
const DUPLICATE_WINDOW_MS = 60 * 1000;

// NOTE ON THIS INTEGRATION: reconstructed from Paystack's public
// documentation, not a live test against their API. Before going live, run
// one real payment through Paystack's test mode (sk_test_ key - one base URL
// serves both test and live; the key prefix decides) and confirm the
// response shape below still matches.
export async function POST(request: Request) {
  if (!process.env.PAYSTACK_SECRET_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Checkout called but PAYSTACK_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY is not set");
    return NextResponse.json({ error: "Payments are temporarily unavailable" }, { status: 503 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const msisdn = normalizeKenyanMsisdn(String(body?.phone_number ?? ""));
  if (!msisdn) {
    return NextResponse.json(
      { error: "Enter a valid Safaricom number, e.g. 0712 345 678" },
      { status: 400 }
    );
  }
  // Paystack's Kenya mobile money examples use E.164 with a leading "+".
  const phoneNumber = `+${msisdn}`;

  const service = createServiceClient();

  const { data: recent } = await service
    .from("payments")
    .select("api_ref")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .gte("created_at", new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString())
    .limit(1);
  if (recent && recent.length > 0) {
    return NextResponse.json(
      { error: "A payment prompt was just sent to your phone. Approve it, or wait a minute and try again." },
      { status: 429 }
    );
  }

  const reference = `epl_${randomUUID()}`;
  const { error: insertError } = await service.from("payments").insert({
    user_id: user.id,
    api_ref: reference, // this IS the Paystack reference - no separate provider id needed
    amount: WEEKLY_PRICE_KES,
    currency: "KES",
    status: "pending",
  });
  if (insertError) {
    console.error("Failed to record pending payment:", insertError.message);
    return NextResponse.json({ error: "Could not start payment" }, { status: 500 });
  }

  const markFailed = () =>
    service
      .from("payments")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("api_ref", reference)
      .eq("status", "pending");

  let paystackResponse: Response;
  try {
    paystackResponse = await fetch(`${PAYSTACK_BASE_URL}/charge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
      body: JSON.stringify({
        email: user.email,
        amount: toMinorUnits(WEEKLY_PRICE_KES), // Paystack wants the smallest currency unit - cents, not shillings
        currency: "KES",
        reference,
        mobile_money: {
          phone: phoneNumber,
          provider: "mpesa",
        },
      }),
    });
  } catch (err) {
    await markFailed();
    console.error("Paystack request failed to send:", err);
    return NextResponse.json({ error: "Could not reach the payment provider. Try again." }, { status: 502 });
  }

  const data = await paystackResponse.json().catch(() => null);

  // Full provider response goes to the server log only - it can contain
  // internal detail that has no business in a browser.
  if (!paystackResponse.ok || data?.status !== true || data?.data?.status === "failed") {
    await markFailed();
    console.error("Paystack rejected the charge:", paystackResponse.status, data);
    return NextResponse.json(
      { error: "We couldn't send the M-Pesa prompt. Check the number and try again." },
      { status: 502 }
    );
  }

  // Mobile money in Kenya completes asynchronously - the customer
  // authorizes on their phone, then access is granted by the webhook (or by
  // the status poll's fallback). This response only confirms the STK push was sent.
  return NextResponse.json({
    status: "pending",
    message: "Check your phone and enter your M-Pesa PIN to complete payment.",
  });
}
