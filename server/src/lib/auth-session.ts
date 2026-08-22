// Signs, verifies, and configures the cookie used for authenticated sessions.
import type { CookieOptions } from "express";
import { jwtVerify, SignJWT } from "jose";

import { env } from "../config/env.js";

export const SESSION_COOKIE_NAME = "pale.auth";

const SESSION_ISSUER = "pale-server";
const SESSION_AUDIENCE = "pale-client";
const STANDARD_SESSION_SECONDS = 8 * 60 * 60;
const REMEMBERED_SESSION_SECONDS = 30 * 24 * 60 * 60;
const encodedSecret = new TextEncoder().encode(env.AUTH_SECRET);

function getSessionDurationSeconds(rememberMe: boolean) {
  return rememberMe
    ? REMEMBERED_SESSION_SECONDS
    : STANDARD_SESSION_SECONDS;
}

/** Creates a signed session token for the authenticated user. */
export async function createSessionToken(
  userId: string,
  rememberMe: boolean,
) {
  const durationSeconds = getSessionDurationSeconds(rememberMe);

  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + durationSeconds)
    .sign(encodedSecret);
}

/** Verifies a session token and returns its trusted user identifier. */
export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify(token, encodedSecret, {
    algorithms: ["HS256"],
    issuer: SESSION_ISSUER,
    audience: SESSION_AUDIENCE,
  });

  if (!payload.sub) {
    throw new Error("Session token is missing a user identifier");
  }

  return { userId: payload.sub };
}

/** Returns secure cookie settings, including persistence for remember-me logins. */
export function getSessionCookieOptions(
  rememberMe: boolean,
): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(rememberMe
      ? { maxAge: REMEMBERED_SESSION_SECONDS * 1_000 }
      : {}),
  };
}
