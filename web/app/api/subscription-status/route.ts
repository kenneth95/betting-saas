import { NextResponse } from "next/server";
import { getActiveSubscription } from "@/lib/subscription";
import { createServiceClient } from "@/lib/supabase/service";
import { settlePayment } from "@/lib/payments";

export const dynamic = "force-dynamic";

const RECONCILE_WINDOW_MS = 30 * 60 * 1000;

// Polled by the upgrade form after an M-Pesa prompt, to find out when the
// subscription has been activated.
//
// Normally the Paystack webhook does that. But if the webhook is delayed,
// misconfigured (wrong URL, key mismatch), or the customer is on a slow
// network, a paid user would sit on a spinner. So while a recent payment of
// this user's is still pending, ask Paystack directly - settlePayment is
// idempotent, so it's safe for this to race the webhook.
export async function GET() {
  let state = await getActiveSubscription();

  if (state.user && !state.isActive && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { data: pending } = await createServiceClient()
        .from("payments")
        .select("api_ref")
        .eq("user_id", state.user.id)
        .eq("status", "pending")
        .gte("created_at", new Date(Date.now() - RECONCILE_WINDOW_MS).toISOString())
        .order("created_at", { ascending: false })
        .limit(1);

      const reference = pending?.[0]?.api_ref;
      if (reference) {
        const outcome = await settlePayment(reference, state.user.id);
        if (outcome === "activated" || outcome === "already_processed") {
          state = await getActiveSubscription();
        }
      }
    } catch (err) {
      console.error("subscription-status reconcile failed:", err);
    }
  }

  return NextResponse.json(
    { signedIn: !!state.user, active: state.isActive, periodEnd: state.periodEnd },
    { headers: { "Cache-Control": "no-store" } }
  );
}
