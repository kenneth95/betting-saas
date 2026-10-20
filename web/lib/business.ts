export const BUSINESS = {
  legalName: "",
  registrationNumber: "",
  address: "",
  supportEmail: "",
  phone: "",
  whatsapp: "",
  supportHours: "",
  responseTime: "",
  socials: { x: "", instagram: "", facebook: "", tiktok: "", youtube: "", telegram: "", whatsappChannel: "" },
  licenceStatement: "",
  dataProtectionStatement: "",
  helpline: "",
} as const;

export type Business = typeof BUSINESS;

export const socialUrl = (network: keyof typeof BUSINESS.socials, value: string) => {
  if (!value) return "";
  if (value.startsWith("http")) return value;
  const bases = { x: "https://x.com/", instagram: "https://instagram.com/", facebook: "https://facebook.com/", tiktok: "https://tiktok.com/@", youtube: "https://youtube.com/", telegram: "https://t.me/", whatsappChannel: "https://whatsapp.com/channel/" };
  return `${bases[network]}${value}`;
};

export const bookmakerName = (label: string) => ({ sportpesa: "SportPesa", betika: "Betika", other: "Other books" }[label] ?? label);
export const sideName = (side: string) => ({ H: "Home", D: "Draw", A: "Away" }[side] ?? side);
export const formatKickoff = (iso: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" }).format(new Date(iso));
export const formatDate = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Nairobi" }).format(new Date(iso));
export const oddsForSide = (bet: { odds_home: number; odds_draw: number; odds_away: number }, side: string) => side === "H" ? bet.odds_home : side === "D" ? bet.odds_draw : bet.odds_away;
export const edgeLabel = (edge: number) => `${edge >= 0 ? "+" : ""}${(edge * 100).toFixed(1)}%`;

export const faqs = [
  ["What is included?", "Free visitors see a limited preview. Members see the full weekly fixture list, model probabilities, bookmaker comparisons and value flags."],
  ["How does M-Pesa payment work?", "Enter your Kenyan number, approve the STK prompt with your own M-Pesa PIN, and access unlocks automatically after confirmation."],
  ["How long does access last?", "Access lasts for the number of days shown on the pricing page. Paying again adds days to the end of an active period."],
  ["What does value mean?", "Value means the model probability is higher than the probability implied by the bookmaker price after removing the bookmaker margin."],
  ["Is anything guaranteed?", "No. Probabilities describe uncertainty; they do not guarantee a result. Betting involves risk and you can lose money."],
  ["Which bookmakers are compared?", "The page labels the available price source for each row. We are independent and not affiliated with any bookmaker."],
<<<<<<< HEAD
  ["I was charged but access is not unlocked", "Open your Account page to see whether the payment shows as pending, paid or not completed - pending payments are re-checked automatically. If it still hasn't unlocked, contact support with your M-Pesa confirmation code and the number used."],
=======
  ["I was charged but access is not unlocked", "TODO(owner): confirm the exact support escalation and expected resolution process. Contact support with your M-Pesa confirmation code and the number used."],
>>>>>>> 77b19cc5c52d77a83661efc52622894cf8be2216
] as const;

export const pageShell = "mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14";

<<<<<<< HEAD
=======
export function JsonLd() {
  return null;
}

>>>>>>> 77b19cc5c52d77a83661efc52622894cf8be2216
export default BUSINESS;

// TODO(owner): fill every empty BUSINESS field above before launch.
// TODO(owner): have the legal, privacy, refunds and responsible-gambling copy reviewed.
// TODO(owner): confirm the payment provider name and support escalation wording.
// TODO(owner): provide verified social handles and any genuine licence/data-protection statements.
// TODO(owner): provide a verified local gambling-support helpline.

