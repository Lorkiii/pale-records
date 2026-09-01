// Signs, verifies, and configures the cookie used for authenticated sessions.
import type { CookieOptions } from "express";
import { jwtVerify, SignJWT } from "jose";

import { env } from "../config/env.js";

export const SESSION_COOKIE_NAME = "pale.auth";

const SESSION_ISSUER = "pale-server"; // The issuer of the session token
const SESSION_AUDIENCE = "pale-client"; // The audience of the session token
const STANDARD_SESSION_SECONDS = 8 * 60 * 60;
const REMEMBERED_SESSION_SECONDS = 30 * 24 * 60 * 60; // 30 days
const encodedSecret = new TextEncoder().encode(env.AUTH_SECRET);

const sessionCookieBaseOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

// Returns the duration of the session in seconds
function getSessionDurationSeconds(rememberMe: boolean) {
  return rememberMe
    ? REMEMBERED_SESSION_SECONDS
    : STANDARD_SESSION_SECONDS;
}

/** Creates a signed session token for the authenticated user. */
export async function createSessionToken(
  userId: string,
  sessionVersion: number,
  rememberMe: boolean,
) {
  // Get the duration of the session in seconds
  const durationSeconds = getSessionDurationSeconds(rememberMe);

  return new SignJWT({ sessionVersion })
    // Set the protected header
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    // Set the subject of the session token
    .setSubject(userId)
    // Set the issuer of the session token
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + durationSeconds)
    .sign(encodedSecret);
}

/** Verifies a session token and returns its trusted private identity claims. */
export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify(token, encodedSecret, {
    algorithms: ["HS256"],
    issuer: SESSION_ISSUER,
    audience: SESSION_AUDIENCE,
  });
  // Check if the session token is missing a user identifier
  const sessionVersion = payload.sessionVersion;
  if (
    !payload.sub ||
    typeof sessionVersion !== "number" ||
    !Number.isInteger(sessionVersion) ||
    sessionVersion < 0
  ) {
    throw new Error("Session token is missing a user identifier");
  }

  return { userId: payload.sub, sessionVersion };
}

/** Returns secure cookie settings, including persistence for remember-me logins. */
export function getSessionCookieOptions(
  rememberMe: boolean,
): CookieOptions {
  return {
    ...sessionCookieBaseOptions,
    ...(rememberMe
      ? { maxAge: REMEMBERED_SESSION_SECONDS * 1_000 }
      : {}),
  };
}

/** Returns the matching session token from an untrusted Cookie header. */
export function getSessionTokenFromCookieHeader(cookieHeader?: string) {
  const cookiePrefix = `${SESSION_COOKIE_NAME}=`;
  const encodedToken = cookieHeader
    ?.split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(cookiePrefix))
    ?.slice(cookiePrefix.length);

  if (!encodedToken) {
    return undefined;
  }

  try {
    return decodeURIComponent(encodedToken);
  } catch {
    return encodedToken;
  }
}

/** Returns the matching options needed to remove the session cookie. */
export function getSessionCookieClearOptions(): CookieOptions {
  return { ...sessionCookieBaseOptions };
}
