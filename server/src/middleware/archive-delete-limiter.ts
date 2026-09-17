// Limits password-confirmed archive deletion attempts across both resource routes.
import { rateLimit } from "express-rate-limit";
import type { AuthenticatedUser } from "../validations/auth.response.js";
import { archivedBatchErrorResponseSchema } from "../validations/archive-management.schema.js";

export const archiveDeleteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (_req, res) => (res.locals.authenticatedUser as AuthenticatedUser).id,
  handler: (_req, res) => res.status(429).json(archivedBatchErrorResponseSchema.parse({
    success: false,
    error: {
      code: "TOO_MANY_ARCHIVE_DELETE_ATTEMPTS",
      message: "Too many deletion attempts. Please try again later.",
    },
  })),
});
