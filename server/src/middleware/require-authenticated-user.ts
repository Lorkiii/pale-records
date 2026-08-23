// Resolves the signed session cookie and exposes only the safe authenticated user.
import type { NextFunction, Request, Response } from "express";

import {
  getSessionCookieClearOptions,
  getSessionTokenFromCookieHeader,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "../lib/auth-session.js";
import { getAuthenticatedUser } from "../services/auth.service.js";
import type { AuthenticatedUser } from "../validations/auth.response.js";
import { unauthenticatedResponseSchema } from "../validations/auth.response.js";

export type AuthenticatedResponseLocals = {
  authenticatedUser: AuthenticatedUser;
};

// Returns the safe authentication failure shape and optionally removes a stale cookie.
function sendUnauthenticatedResponse(res: Response, clearCookie = false) {
  if (clearCookie) {
    res.clearCookie(SESSION_COOKIE_NAME, getSessionCookieClearOptions());
  }

  const response = unauthenticatedResponseSchema.parse({
    success: false,
    error: {
      code: "UNAUTHENTICATED",
      message: "Authentication is required.",
    },
  });

  return res.status(401).json(response);
}

// Resolves a valid session user before allowing a protected request to continue.
export async function requireAuthenticatedUser(
  req: Request,
  res: Response<unknown, AuthenticatedResponseLocals>,
  next: NextFunction,
) {
  res.set("Cache-Control", "no-store");
  const sessionToken = getSessionTokenFromCookieHeader(req.headers.cookie);

  if (!sessionToken) {
    sendUnauthenticatedResponse(res);
    return;
  }

  try {
    let userId: string;

    try {
      ({ userId } = await verifySessionToken(sessionToken));
    } catch {
      sendUnauthenticatedResponse(res, true);
      return;
    }

    const user = await getAuthenticatedUser(userId);

    if (!user) {
      sendUnauthenticatedResponse(res, true);
      return;
    }

    res.locals.authenticatedUser = user;
    next();
  } catch (error) {
    next(error);
  }
}
