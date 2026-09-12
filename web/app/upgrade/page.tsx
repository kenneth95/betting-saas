import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UpgradeForm } from "@/components/UpgradeForm";

export default async function UpgradePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto max-w-sm px-5 py-16">
      <h1 className="font-display text-3xl text-chalk">Unlock full weekly picks</h1>
      <p className="mt-3 text-sm text-sage">KES 150 for 7 days of full access.</p>
      <UpgradeForm />
    </main>
  );
}
