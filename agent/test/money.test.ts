import assert from "node:assert/strict";
import { test } from "node:test";
import { amountsIn, nearToYocto, yoctoToNear } from "../src/money.ts";

test("NEAR amounts convert to yoctoNEAR exactly", () => {
  assert.equal(nearToYocto("1"), "1000000000000000000000000");
  assert.equal(nearToYocto("0.25"), "250000000000000000000000");
  assert.equal(nearToYocto("0.000000000000000000000001"), "1");
});

test("yoctoNEAR converts back without rounding", () => {
  assert.equal(yoctoToNear("250000000000000000000000"), "0.25");
  assert.equal(yoctoToNear("1000000000000000000000000"), "1");
  assert.equal(yoctoToNear(nearToYocto("12.3456")), "12.3456");
});

test("anything that is not a plain amount is refused", () => {
  for (const bad of ["", "abc", "-1", "1e3", "0.1.2", "1,000", "0.0000000000000000000000001"]) {
    assert.throws(() => nearToYocto(bad), `expected "${bad}" to be refused`);
  }
});

test("amounts in text compare by value, so 0.4 matches 0.40", () => {
  const found = amountsIn("Amount due: 0.40 NEAR for 4 bags");
  assert.ok(found.has(nearToYocto("0.4")));
  assert.ok(found.has(nearToYocto("4")));
  assert.ok(!found.has(nearToYocto("0.5")));
});
