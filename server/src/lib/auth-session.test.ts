// Verifies signed-session identity and persistent-cookie behavior.
import assert from "node:assert/strict";
import test from "node:test";

import {
  createSessionToken,
  getSessionCookieClearOptions,
  getSessionCookieOptions,
  getSessionTokenFromCookieHeader,
  verifySessionToken,
} from "./auth-session.js";

test("session tokens are signed and resolve to the authenticated user", async () => {
  const userId = "7d51b6b3-8f2c-4db6-b9eb-f933cd085da3";
  const token = await createSessionToken(userId, 3, false);

  assert.deepEqual(await verifySessionToken(token), { userId, sessionVersion: 3 });
});

test("remember me creates a persistent HTTP-only cookie", () => {
  const sessionCookie = getSessionCookieOptions(false);
  const rememberedCookie = getSessionCookieOptions(true);

  assert.equal(sessionCookie.httpOnly, true);
  assert.equal(sessionCookie.sameSite, "lax");
  assert.equal(sessionCookie.maxAge, undefined);
  assert.equal(rememberedCookie.httpOnly, true);
  assert.equal(typeof rememberedCookie.maxAge, "number");
  assert.equal((rememberedCookie.maxAge ?? 0) > 0, true);
});

test("session cookies are parsed by exact name from a Cookie header", () => {
  const token = getSessionTokenFromCookieHeader(
    "theme=paper; pale.auth=signed%2Etoken; pale.auth.backup=ignored",
  );

  assert.equal(token, "signed.token");
  assert.equal(getSessionTokenFromCookieHeader("theme=paper"), undefined);
});

test("session cookie clearing preserves the security attributes", () => {
  const options = getSessionCookieClearOptions();

  assert.equal(options.httpOnly, true);
  assert.equal(options.sameSite, "lax");
  assert.equal(options.path, "/");
  assert.equal(options.maxAge, undefined);
});
