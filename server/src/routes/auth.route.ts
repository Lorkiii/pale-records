// Defines the public login endpoint and its abuse/validation controls.
import { Router } from "express";
import { rateLimit } from "express-rate-limit";

import { loginController } from "../controllers/auth.controller.js";
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

export default authRouter;
