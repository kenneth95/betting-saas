import { createServiceClient } from "./supabase/service";
import { paymentMatches } from "./billing";
import { SUBSCRIPTION_DAYS } from "./site";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

export type SettleOutcome =
  | "activated" //         we confirmed the payment and granted access just now
  | "already_processed" // it was completed earlier (or a concurrent call just did it)
  | "pending" //           Paystack says it hasn't finished yet - try again later
  | "failed" //            the payment failed or didn't match what we asked for
  | "unknown_reference" // not one of ours
  | "error"; //            a transient problem (network, database) - safe to retry

/**
 * The ONE place a payment turns into access. Called by the Paystack webhook
 * and by /api/subscription-status (a fallback for when the webhook is late or
 * misconfigured), so both paths behave identically and are safe to run
 * concurrently or repeatedly.
 *
 * Never trusts a caller: the status always comes from Paystack's
 * /transaction/verify, and the amount is checked against our own payments row.
 *
 * `onlyForUser` restricts settlement to that user's own payments - the status
 * endpoint passes the signed-in user's id so it can't be used to probe or
 * settle someone else's reference.
 */
export async function settlePayment(reference: string, onlyForUser?: string): Promise<SettleOutcome> {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    console.error("settlePayment: PAYSTACK_SECRET_KEY is not set");
    return "error";
  }

  try {
    const service = createServiceClient();

    const { data: payment, error: lookupError } = await service
      .from("payments")
      .select("user_id, status, amount, currency")
      .eq("api_ref", reference)
      .maybeSingle();
    if (lookupError) {
      console.error("settlePayment: payment lookup failed:", lookupError.message);
      return "error";
    }
    if (!payment || (onlyForUser && payment.user_id !== onlyForUser)) return "unknown_reference";
    if (payment.status === "completed") return "already_processed";
    if (payment.status === "failed") return "failed";

    // Source of truth: ask Paystack, don't trust the webhook body.
    const verifyResp = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
    const verify = await verifyResp.json().catch(() => null);
    if (!verifyResp.ok || verify?.status !== true) {
      console.error("settlePayment: verify call failed", verifyResp.status, verify?.message);
      return "error";
    }

    const status: string | undefined = verify.data?.status;

    if (status === "success") {
      if (!paymentMatches(payment, { amount: verify.data?.amount, currency: verify.data?.currency })) {
        console.error("settlePayment: amount/currency mismatch - not activating", {
          reference,
          expected: { amount: payment.amount, currency: payment.currency },
          paid: { amount: verify.data?.amount, currency: verify.data?.currency },
        });
        await service.from("payments").update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("api_ref", reference).eq("status", "pending");
        return "failed";
      }

      // Claim + extend in a single database transaction (see complete_payment in schema.sql).
      const { data: newEnd, error: rpcError } = await service.rpc("complete_payment", {
        p_reference: reference,
        p_days: SUBSCRIPTION_DAYS,
      });
      if (rpcError) {
        console.error("settlePayment: complete_payment failed (is schema.sql up to date?):", rpcError.message);
        return "error";
      }
      return newEnd ? "activated" : "already_processed";
    }

    if (status === "failed" || status === "abandoned" || status === "reversed") {
      await service.from("payments").update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("api_ref", reference).eq("status", "pending");
      return "failed";
    }

    return "pending"; // e.g. "pending", "ongoing", "pay_offline" - customer hasn't finished on their phone
  } catch (err) {
    console.error("settlePayment: unexpected error:", err);
    return "error";
  }
}
