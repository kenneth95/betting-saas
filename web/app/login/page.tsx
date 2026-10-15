import type { Metadata } from "next";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = { title: "Sign in" };

// Only same-site relative paths - never let ?next= redirect off-site.
function safeNext(value: string | undefined): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string; error?: string };
}) {
  return (
    <main className="mx-auto max-w-sm px-5 py-16">
      <h1 className="font-display text-2xl text-chalk">Sign in</h1>
      <p className="mt-2 text-sm text-sage">No password needed - we&apos;ll email you a link.</p>
      <LoginForm next={safeNext(searchParams?.next)} linkError={!!searchParams?.error} />
    </main>
  );
}
