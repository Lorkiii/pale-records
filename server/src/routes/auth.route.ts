// Defines the public login and session endpoints with their boundary controls.
import { Router } from "express";
import { rateLimit } from "express-rate-limit";

import {
  loginController,
  sessionController,
} from "../controllers/auth.controller.js";
import { requireAuthenticatedUser } from "../middleware/require-authenticated-user.js";
import { validateBody } from "../middleware/validate-body.js";
import { loginSchema } from "../validations/auth.schema.js";
import { loginRateLimitResponseSchema } from "../validations/auth.response.js";

const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    const response = loginRateLimitResponseSchema.parse({
      success: false,
      error: {
        code: "TOO_MANY_LOGIN_ATTEMPTS",
        message: "Too many login attempts. Please try again later.",
      },
    });

    res.status(429).json(response);
  },
});

authRouter.post(
  "/login",
  loginLimiter,
  validateBody(loginSchema),
  loginController,
);

authRouter.get("/session", requireAuthenticatedUser, sessionController);

export default authRouter;
