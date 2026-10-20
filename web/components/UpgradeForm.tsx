"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type State = "idle" | "sending" | "waiting" | "timeout" | "error";

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 40; // ~2 minutes - longer than an M-Pesa prompt stays alive

export function UpgradeForm() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string | null>(null);

  // After the STK push is sent, poll until the webhook activates the subscription.
  useEffect(() => {
    if (state !== "waiting") return;
    let polls = 0;
    const timer = setInterval(async () => {
      polls += 1;
      try {
        const res = await fetch("/api/subscription-status", { cache: "no-store" });
        const data = await res.json();
        if (data?.active) {
          clearInterval(timer);
          router.replace("/picks?upgraded=1");
          router.refresh();
          return;
        }
      } catch {
        // transient network error - keep polling
      }
      if (polls >= MAX_POLLS) {
        clearInterval(timer);
        setState("timeout");
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [state, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setState("sending");
    setMessage(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phone }),
      });
      const data = await res.json().catch(() => null);

      if (res.ok) {
        setState("waiting");
        setMessage(data?.message ?? "Check your phone and enter your M-Pesa PIN.");
      } else {
        setState("error");
        setMessage(data?.error ?? "Something went wrong. Try again.");
      }
    } catch {
      setState("error");
      setMessage("Couldn't reach the server. Check your connection and try again.");
    }
  }

  if (state === "waiting") {
    return (
      <div className="mt-6 rounded border border-pitch-700 bg-pitch-800 p-4 text-sm">
        <p className="text-chalk">{message}</p>
        <p className="mt-2 text-sage">Waiting for confirmation - this page updates automatically.</p>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <label className="block text-sm text-sage">
          M-Pesa number
          <input
            type="tel"
            required
            inputMode="tel"
            autoComplete="tel"
            placeholder="0712 345 678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded border border-pitch-700 bg-pitch-800 px-3 py-2 text-chalk placeholder:text-sage"
          />
        </label>
        <button
          type="submit"
          disabled={state === "sending"}
          className="w-full rounded bg-amber px-3 py-2 font-medium text-pitch-950 disabled:opacity-50"
        >
          {state === "sending" ? "Sending prompt…" : "Pay with M-Pesa"}
        </button>
      </form>

      {state === "timeout" && (
        <p className="mt-4 text-sm text-sage">
          We haven&apos;t seen your payment yet. If you completed it, it can take a few minutes -{" "}
          <a href="/picks" className="text-amber underline underline-offset-2">refresh the picks page</a> or check your <a href="/account" className="text-amber underline underline-offset-2">account</a>. If you
          didn&apos;t get a prompt, try again.
        </p>
      )}
      {state === "error" && message && <p className="mt-4 text-sm text-red-400">{message}</p>}
    </>
  );
}
