import { createClient } from "./supabase/server";

export async function getActiveSubscription() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, isActive: false };
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

  return { user, isActive };
}
