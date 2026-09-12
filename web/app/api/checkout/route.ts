import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const WEEKLY_PRICE_KES = 150;
const PAYSTACK_BASE_URL = "https://api.paystack.co";

// NOTE ON THIS INTEGRATION: reconstructed from Paystack's public
// documentation, not a live test against their API (no network access to
// paystack.co from this environment). Before going live: run one real
// payment through Paystack's test mode (use your sk_test_ secret key -
// Paystack uses one base URL for both test and live, distinguished only
// by which key you use, unlike some other providers with separate
// sandbox hosts) and confirm the response shape below still matches.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const phoneNumberInput: string | undefined = body?.phone_number;
  if (!phoneNumberInput || !/^2547\d{8}$/.test(phoneNumberInput)) {
    return NextResponse.json(
      { error: "Enter your M-Pesa number as 2547XXXXXXXX" },
      { status: 400 }
    );
  }
  // Paystack's Kenya mobile money examples use E.164 with a leading "+".
  const phoneNumber = `+${phoneNumberInput}`;

  const reference = `epl_${randomUUID()}`;
  const service = createServiceClient();

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
        amount: WEEKLY_PRICE_KES * 100, // Paystack wants the smallest currency unit - cents, not shillings
        currency: "KES",
        reference,
        mobile_money: {
          phone: phoneNumber,
          provider: "mpesa",
        },
      }),
    });
  } catch (err) {
    await service.from("payments").update({ status: "failed" }).eq("api_ref", reference);
    console.error("Paystack request failed to send:", err);
    return NextResponse.json({ error: "Could not reach payment provider" }, { status: 502 });
  }

  const data = await paystackResponse.json().catch(() => null);

  if (!paystackResponse.ok || data?.status !== true) {
    await service.from("payments").update({ status: "failed" }).eq("api_ref", reference);
    console.error("Paystack rejected the charge:", data);
    return NextResponse.json({ error: "M-Pesa request failed", details: data }, { status: 502 });
  }

  // Mobile money in Kenya completes asynchronously - the customer
  // authorizes on their phone, then Paystack calls our webhook with the
  // final result. This response just confirms the STK push was sent.
  return NextResponse.json({
    status: "pending",
    message: "Check your phone and enter your M-Pesa PIN to complete payment.",
  });
}
