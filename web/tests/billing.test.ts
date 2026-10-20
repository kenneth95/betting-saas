import { test } from "node:test";
import assert from "node:assert/strict";
import { daysRemaining, nextPeriodEnd, paymentMatches, toMinorUnits } from "../lib/billing.ts";

test("toMinorUnits converts shillings to cents without float drift", () => {
  assert.equal(toMinorUnits(150), 15000);
  assert.equal(toMinorUnits("150"), 15000);
  assert.equal(toMinorUnits(0.1 + 0.2), 30); // 0.30000000000000004 must not become 30.000000000000004
  assert.equal(toMinorUnits(99.99), 9999);
});

test("paymentMatches accepts exactly the amount and currency we asked for", () => {
  const row = { amount: 150, currency: "KES" };
  assert.equal(paymentMatches(row, { amount: 15000, currency: "KES" }), true);
  // numeric columns come back from Postgres as strings
  assert.equal(paymentMatches({ amount: "150", currency: "KES" }, { amount: 15000, currency: "KES" }), true);
});

test("paymentMatches rejects underpayment, the 100x unit mistake, wrong currency and missing data", () => {
  const row = { amount: 150, currency: "KES" };
  assert.equal(paymentMatches(row, { amount: 14999, currency: "KES" }), false);
  assert.equal(paymentMatches(row, { amount: 150, currency: "KES" }), false); // shillings where cents expected
  assert.equal(paymentMatches(row, { amount: 15000, currency: "NGN" }), false);
  assert.equal(paymentMatches(row, { amount: undefined, currency: undefined }), false);
});

test("nextPeriodEnd starts from now for new or lapsed members", () => {
  const now = new Date("2026-10-20T10:00:00Z");
  assert.equal(nextPeriodEnd(null, now, 7).toISOString(), "2026-10-27T10:00:00.000Z");
  assert.equal(nextPeriodEnd("2026-10-01T00:00:00Z", now, 7).toISOString(), "2026-10-27T10:00:00.000Z");
});

test("nextPeriodEnd stacks early renewals on the remaining time", () => {
  const now = new Date("2026-10-20T10:00:00Z");
  assert.equal(nextPeriodEnd("2026-10-23T10:00:00Z", now, 7).toISOString(), "2026-10-30T10:00:00.000Z");
});

test("nextPeriodEnd does not mutate its inputs", () => {
  const now = new Date("2026-10-20T10:00:00Z");
  const existing = new Date("2026-10-23T10:00:00Z");
  nextPeriodEnd(existing, now, 7);
  assert.equal(now.toISOString(), "2026-10-20T10:00:00.000Z");
  assert.equal(existing.toISOString(), "2026-10-23T10:00:00.000Z");
});

test("daysRemaining rounds up and floors at zero", () => {
  const now = new Date("2026-10-20T10:00:00Z");
  assert.equal(daysRemaining("2026-10-27T10:00:00Z", now), 7);
  assert.equal(daysRemaining("2026-10-20T10:00:01Z", now), 1);
  assert.equal(daysRemaining("2026-10-19T10:00:00Z", now), 0);
});
