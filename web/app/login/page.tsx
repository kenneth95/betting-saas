"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main className="mx-auto max-w-sm px-5 py-16">
      <h1 className="font-display text-2xl text-chalk">Sign in</h1>
      <p className="mt-2 text-sm text-sage">
        No password needed - we&apos;ll email you a link.
      </p>

      {sent ? (
        <p className="mt-6 text-sm text-sage">
          Check {email} for a sign-in link.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded border border-pitch-700 bg-pitch-800 px-3 py-2 text-chalk placeholder:text-sage"
          />
          <button
            type="submit"
            className="w-full rounded bg-amber px-3 py-2 font-medium text-pitch-950"
          >
            Send sign-in link
          </button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>
      )}
    </main>
  );
}
