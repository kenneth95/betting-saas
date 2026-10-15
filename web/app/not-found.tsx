import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="font-display text-2xl text-chalk">Page not found</h1>
      <p className="mt-2 text-sm text-sage">That page doesn&apos;t exist.</p>
      <Link href="/" className="mt-5 inline-block text-sm text-amber underline underline-offset-2">
        Back to this week&apos;s picks
      </Link>
    </main>
  );
}
