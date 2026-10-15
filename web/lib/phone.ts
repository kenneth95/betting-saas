/**
 * Accepts the ways Kenyans actually type their number (0712 345 678,
 * +254712345678, 254712345678, 712345678) and returns 2547XXXXXXXX /
 * 2541XXXXXXXX, or null if it isn't a valid Kenyan mobile number.
 */
export function normalizeKenyanMsisdn(input: string): string | null {
  let n = input.replace(/[\s\-().]/g, "");
  if (n.startsWith("+")) n = n.slice(1);
  if (/^0[17]\d{8}$/.test(n)) n = "254" + n.slice(1);
  else if (/^[17]\d{8}$/.test(n)) n = "254" + n;
  return /^254[17]\d{8}$/.test(n) ? n : null;
}
