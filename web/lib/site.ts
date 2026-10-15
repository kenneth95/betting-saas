export const SITE_NAME = "EPL Value Picks";
export const SITE_TAGLINE = "Premier League model probabilities vs Kenyan bookmaker odds";
export const SITE_DESCRIPTION =
  "Weekly Premier League predictions from a Dixon-Coles model, compared against the odds Kenyan bookmakers are pricing from - with a public, fully settled track record.";

// Single source of truth for price: the checkout route charges this, the
// upgrade page and homepage display it.
export const WEEKLY_PRICE_KES = 150;
export const SUBSCRIPTION_DAYS = 7;
export const FREE_TIER_VISIBLE_COUNT = 2;

export const SITE_URL: string =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
  "http://localhost:3000";
