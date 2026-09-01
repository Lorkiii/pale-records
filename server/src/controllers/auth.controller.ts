// Converts login and session requests into safe auth responses and cookies.
import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  createSessionToken,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "../lib/auth-session.js";
import type { AuthenticatedResponseLocals } from "../middleware/require-authenticated-user.js";
import {
  authenticateUser,
} from "../services/auth.service.js";
import type { LoginInput } from "../validations/auth.schema.js";
import {
  invalidCredentialsResponseSchema,
  loginSuccessResponseSchema,
  sessionSuccessResponseSchema,
} from "../validations/auth.response.js";

export async function loginController(
  req: Request<Record<string, never>, unknown, LoginInput>,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = await authenticateUser(req.body);

    if (!user) {
      const response = invalidCredentialsResponseSchema.parse({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email, username, or password.",
        },
      });

      return res.status(401).json(response);
    }

    const response = loginSuccessResponseSchema.parse({
      success: true,
      data: { user: user.user },
    });
    const sessionToken = await createSessionToken(
      user.user.id,
      user.sessionVersion,
      req.body.rememberMe,
    );

    res.cookie(
      SESSION_COOKIE_NAME,
      sessionToken,
      getSessionCookieOptions(req.body.rememberMe),
    );

    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

export function sessionController(
  _req: Request,
  res: Response<unknown, AuthenticatedResponseLocals>,
) {
  const response = sessionSuccessResponseSchema.parse({
    success: true,
    data: { user: res.locals.authenticatedUser },
  });

  return res.status(200).json(response);
}
