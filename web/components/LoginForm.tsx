"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/browser";

export function LoginForm({ next, linkError }: { next: string; linkError: boolean }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(
    linkError ? "That sign-in link is invalid or has expired. Request a new one." : null
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) setError(error.message);
      else setSent(true);
    } catch {
      setError("Sign-in isn't available right now. Please try again later.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <p className="mt-6 text-sm text-sage">
        Check <span className="text-chalk">{email}</span> for a sign-in link. It can take a minute - look in
        spam if it doesn&apos;t arrive.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-3">
      <input
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full rounded border border-pitch-700 bg-pitch-800 px-3 py-2 text-chalk placeholder:text-sage"
      />
      <button
        type="submit"
        disabled={sending}
        className="w-full rounded bg-amber px-3 py-2 font-medium text-pitch-950 disabled:opacity-50"
      >
        {sending ? "Sending…" : "Send sign-in link"}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}
