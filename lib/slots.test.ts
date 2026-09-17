import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { upcomingSlots, tomorrowInfo } from "./slots";
import { getClinic } from "./clinic";

describe("slots", () => {
  it("offers 3 future slots after Thursday night", () => {
    const now = new Date("2026-09-17T22:05:00");
    const slots = upcomingSlots(3, getClinic(), now);
    assert.equal(slots.length, 3);
    assert.ok(slots[0].label.includes("09:00") || slots[0].time === "09:00");
  });

  it("tomorrow Friday is open", () => {
    const info = tomorrowInfo(getClinic(), new Date("2026-09-17T22:05:00"));
    assert.equal(info.open, true);
    assert.equal(info.weekday, "sexta");
  });

  it("tomorrow Sunday is closed", () => {
    const info = tomorrowInfo(getClinic(), new Date("2026-09-19T10:00:00"));
    assert.equal(info.open, false);
    assert.equal(info.weekday, "domingo");
  });
});
