// Verifies password and batch-conflict responses reveal only safe archive details.
import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import type { Response } from "express";
import request from "supertest";
import { archiveDeleteLimiter } from "../middleware/archive-delete-limiter.js";
import { sendDeletionResult } from "./archive-management.controller.js";

const id = "2c6e62cc-584d-4faf-90f6-fdb50b27c9d0";

function captureResponse(result: Parameters<typeof sendDeletionResult>[1]) {
  let status = 0;
  let body: unknown;
  const response = {
    status(value: number) { status = value; return this; },
    json(value: unknown) { body = value; return this; },
  } as Response;
  sendDeletionResult(response, result);
  return { status, body };
}

test("archive deletion requires a confirmed current password", () => {
  assert.deepEqual(captureResponse({ status: "invalid_password" }), {
    status: 400,
    body: {
      success: false,
      error: {
        code: "INVALID_CURRENT_PASSWORD",
        message: "The current password could not be confirmed.",
      },
    },
  });
});

test("protected or stale selections return a conflict without partial success", () => {
  const protectedResponse = captureResponse({ status: "protected", blockedIds: [id] });
  assert.equal(protectedResponse.status, 409);
  assert.deepEqual((protectedResponse.body as { error: { details: { blockedIds: string[] } } }).error.details.blockedIds, [id]);
  const staleResponse = captureResponse({ status: "selection_changed" });
  assert.equal(staleResponse.status, 409);
  assert.equal((staleResponse.body as { error: { code: string } }).error.code, "ARCHIVED_SELECTION_CHANGED");
});

test("successful deletion reports only affected identifiers", () => {
  assert.deepEqual(captureResponse({ status: "deleted", deletedIds: [id] }), {
    status: 200,
    body: { success: true, data: { deletedIds: [id] } },
  });
});

test("repeated failed password confirmations are rate limited", async () => {
  const testApp = express();
  testApp.use((_req, res, next) => {
    res.locals.authenticatedUser = { id };
    next();
  });
  testApp.post("/delete", archiveDeleteLimiter, (_req, res) => res.status(400).json({ success: false }));
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await request(testApp).post("/delete");
    assert.equal(response.status, 400);
  }
  const blocked = await request(testApp).post("/delete");
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error.code, "TOO_MANY_ARCHIVE_DELETE_ATTEMPTS");
});
