import { NextResponse } from "next/server";
import { getActiveSubscription } from "@/lib/subscription";

export const dynamic = "force-dynamic";

// Polled by the upgrade form after an M-Pesa prompt, to find out when the
// Paystack webhook has activated the subscription.
export async function GET() {
  const { user, isActive, periodEnd } = await getActiveSubscription();
  return NextResponse.json(
    { signedIn: !!user, active: isActive, periodEnd },
    { headers: { "Cache-Control": "no-store" } }
  );
}
