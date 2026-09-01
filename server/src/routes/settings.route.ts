// Registers authenticated account and per-user preference Settings endpoints.
import { Router } from "express";
import { rateLimit } from "express-rate-limit";

import {
  changePasswordController,
  getSettingsController,
  resetSystemPreferencesController,
  updateSystemPreferencesController,
  updateProfileController,
} from "../controllers/settings.controller.js";
import { requireAuthenticatedUser } from "../middleware/require-authenticated-user.js";
import { validateBody } from "../middleware/validate-body.js";
import {
  changePasswordSchema,
  systemPreferencesSchema,
  updateProfileSchema,
} from "../validations/settings.schema.js";
import { passwordChangeRateLimitResponseSchema } from "../validations/settings.response.js";

const settingsRouter = Router();

export const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_req, res) => {
    res.status(429).json(passwordChangeRateLimitResponseSchema.parse({
      success: false,
      error: {
        code: "TOO_MANY_PASSWORD_CHANGE_ATTEMPTS",
        message: "Too many password change attempts. Please try again later.",
      },
    }));
  },
});

settingsRouter.use(requireAuthenticatedUser);
settingsRouter.get("/", getSettingsController);
settingsRouter.patch(
  "/profile",
  validateBody(updateProfileSchema),
  updateProfileController,
);
settingsRouter.post(
  "/password",
  passwordChangeLimiter,
  validateBody(changePasswordSchema),
  changePasswordController,
);
settingsRouter.patch(
  "/system",
  validateBody(systemPreferencesSchema),
  updateSystemPreferencesController,
);
settingsRouter.post(
  "/system/reset",
  resetSystemPreferencesController,
);

export default settingsRouter;
