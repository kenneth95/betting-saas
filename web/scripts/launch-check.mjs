// Pre-launch checklist. Run with:  npm run launch-check
// Exits non-zero while anything that needs a real-world fact (legal name,
// support contact, helpline, reviewed legal copy) is still missing, so it
// can't be forgotten. It is deliberately NOT part of `npm run build` - the
// site must still build and deploy while you're setting things up.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const problems = [];

// 1. Required BUSINESS fields in lib/business.ts must be non-empty.
const business = readFileSync("lib/business.ts", "utf8");
const required = {
  legalName: "Registered business name (shown in the footer and legal pages)",
  supportEmail: "Support email address",
  supportHours: "Support hours",
  helpline: "A verified Kenyan gambling-support helpline",
};
for (const [key, why] of Object.entries(required)) {
  const m = business.match(new RegExp(`^\\s*${key}:\\s*"([^"]*)"`, "m"));
  if (!m || !m[1].trim()) problems.push(`lib/business.ts: BUSINESS.${key} is empty - ${why}`);
}
const reach = ["whatsapp", "phone"].some((k) => new RegExp(`^\\s*${k}:\\s*"[^"]+"`, "m").test(business));
if (!reach) problems.push("lib/business.ts: set BUSINESS.whatsapp or BUSINESS.phone so customers have a fast way to report payment problems");

// 2. Outstanding TODO(owner) markers anywhere in the source.
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (["node_modules", ".next", "scripts", "tests"].includes(name)) continue;
    const p = join(dir, name);
    statSync(p).isDirectory() ? walk(p, out) : /\.(tsx?|mjs)$/.test(name) && out.push(p);
  }
  return out;
}
for (const file of ["app", "components", "lib"].flatMap((d) => walk(d))) {
  readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    const m = line.match(/TODO\(owner\):\s*(.*)/);
    if (m) problems.push(`${file}:${i + 1}: ${m[1].trim()}`);
  });
}

// 3. Env template sanity: every variable the code reads is documented.
const example = readFileSync(".env.local.example", "utf8");
for (const v of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "PAYSTACK_SECRET_KEY"]) {
  if (!example.includes(v)) problems.push(`.env.local.example is missing ${v}`);
}

if (problems.length) {
  console.error(`\nNot ready to launch - ${problems.length} item(s) outstanding:\n`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error("");
  process.exit(1);
}
console.log("Launch check passed.");
