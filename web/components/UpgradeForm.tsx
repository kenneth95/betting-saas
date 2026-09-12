"use client";

import { useState, type FormEvent } from "react";

type State = "idle" | "sending" | "sent" | "error";

export function UpgradeForm() {
  const [phone, setPhone] = useState("");
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setState("sending");
    setMessage(null);

    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone_number: phone }),
    });
    const data = await res.json().catch(() => null);

    if (res.ok) {
      setState("sent");
      setMessage(data?.message ?? "Check your phone to complete payment.");
    } else {
      setState("error");
      setMessage(data?.error ?? "Something went wrong. Try again.");
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <label className="block text-sm text-sage">
          M-Pesa number
          <input
            type="tel"
            required
            placeholder="2547XXXXXXXX"
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

      {message && (
        <p className={`mt-4 text-sm ${state === "error" ? "text-red-400" : "text-sage"}`}>
          {message}
        </p>
      )}
    </>
  );
}
