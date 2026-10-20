import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeKenyanMsisdn } from "../lib/phone.ts";

test("accepts every way Kenyans actually type a Safaricom number", () => {
  for (const input of ["0712 345 678", "0712345678", "+254712345678", "254712345678", "712345678", "0712-345-678", " (0712) 345 678 "]) {
    assert.equal(normalizeKenyanMsisdn(input), "254712345678", input);
  }
});

test("accepts the 01xx number range", () => {
  assert.equal(normalizeKenyanMsisdn("0110 123 456"), "254110123456");
});

test("rejects numbers that aren't Kenyan mobiles", () => {
  for (const input of ["", "abc", "071234567", "07123456789", "+255712345678", "0212345678", "+1 415 555 0100"]) {
    assert.equal(normalizeKenyanMsisdn(input), null, input);
  }
});
