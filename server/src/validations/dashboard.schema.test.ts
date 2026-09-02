// Verifies the Dashboard overview accepts only one real local calendar date query.
import assert from "node:assert/strict";
import test from "node:test";

import { dashboardOverviewQuerySchema } from "./dashboard.schema.js";

test("Dashboard overview query accepts a real YYYY-MM-DD date", () => {
  assert.deepEqual(dashboardOverviewQuerySchema.parse({ date: "2028-02-29" }), {
    date: "2028-02-29",
  });
});

test("Dashboard overview query rejects missing, malformed, and impossible dates", () => {
  for (const query of [
    {},
    { date: "09/02/2026" },
    { date: "2026-9-2" },
    { date: "2026-02-29" },
    { date: "2026-09-31" },
    { date: "1999-12-31" },
    { date: "2101-01-01" },
    { date: ["2026-09-02"] },
  ]) {
    assert.equal(dashboardOverviewQuerySchema.safeParse(query).success, false);
  }
});

test("Dashboard overview query rejects unknown filters", () => {
  assert.equal(dashboardOverviewQuerySchema.safeParse({
    date: "2026-09-02",
    userId: "a8a5bbc6-bbd1-44f8-9c73-1adbc04ff57c",
  }).success, false);
});
