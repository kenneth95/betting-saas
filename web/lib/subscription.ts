import { createClient } from "./supabase/server";
import { hasSupabaseEnv } from "./env";

export async function getActiveSubscription() {
  if (!hasSupabaseEnv()) return { user: null, isActive: false, periodEnd: null as string | null };

  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { user: null, isActive: false, periodEnd: null as string | null };
    }

    const { data } = await supabase
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("user_id", user.id)
      .maybeSingle();

    const isActive =
      !!data &&
      data.status === "active" &&
      !!data.current_period_end &&
      new Date(data.current_period_end) > new Date();

    return { user, isActive, periodEnd: isActive ? (data!.current_period_end as string) : null };
  } catch (err) {
    console.error("getActiveSubscription failed:", err);
    return { user: null, isActive: false, periodEnd: null as string | null };
  }
}
