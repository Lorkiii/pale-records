// Verifies unexpected errors never expose private details or stack traces.
import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import request from "supertest";

import { errorHandler } from "./error-handler.js";

test("unexpected errors return a generic JSON response without a stack", async (t) => {
  t.mock.method(console, "error", () => undefined);

  const testApp = express();
  testApp.get("/failure", () => {
    throw new Error("private database detail");
  });
  testApp.use(errorHandler);

  const response = await request(testApp).get("/failure");

  assert.equal(response.status, 500);
  assert.deepEqual(response.body, {
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected server error occurred.",
    },
  });
  assert.equal(JSON.stringify(response.body).includes("private database detail"), false);
  assert.equal(JSON.stringify(response.body).includes("stack"), false);
});
