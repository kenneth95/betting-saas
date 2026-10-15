"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="font-display text-2xl text-chalk">Something went wrong</h1>
      <p className="mt-2 text-sm text-sage">We couldn&apos;t load this page. Try again in a moment.</p>
      <button onClick={reset} className="mt-5 rounded bg-amber px-4 py-2 text-sm font-medium text-pitch-950">
        Try again
      </button>
    </main>
  );
}
