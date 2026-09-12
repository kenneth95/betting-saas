"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh(); // clears any cached Server Component data tied to the old session
  }

  return (
    <button onClick={handleSignOut} className="text-sage hover:text-chalk">
      Sign out
    </button>
  );
}
