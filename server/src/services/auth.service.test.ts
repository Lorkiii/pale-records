// Verifies safe user output and timing-safe handling of missing accounts.
import assert from "node:assert/strict";
import test from "node:test";

import {
  authenticateUser,
  type AuthServiceDependencies,
} from "./auth.service.js";

const loginInput = {
  identifier: "admin",
  password: "correct horse battery staple",
  rememberMe: false,
};

test("authenticateUser returns only safe fields for valid credentials", async () => {
  let receivedIdentifier = "";
  let receivedPassword = "";

  const dependencies: AuthServiceDependencies = {
    findUserByIdentifier: async (identifier) => {
      receivedIdentifier = identifier;

      return {
        id: "7d51b6b3-8f2c-4db6-b9eb-f933cd085da3",
        firstName: "PALE",
        lastName: "Administrator",
        username: "admin",
        email: "admin@pale.local",
        passwordHash: "stored-password-hash",
      };
    },
    comparePassword: async (password, passwordHash) => {
      receivedPassword = password;
      return passwordHash === "stored-password-hash";
    },
  };

  const result = await authenticateUser(loginInput, dependencies);

  assert.equal(receivedIdentifier, "admin");
  assert.equal(receivedPassword, loginInput.password);
  assert.deepEqual(result, {
    id: "7d51b6b3-8f2c-4db6-b9eb-f933cd085da3",
    firstName: "PALE",
    lastName: "Administrator",
    username: "admin",
    email: "admin@pale.local",
  });
  assert.equal("passwordHash" in (result ?? {}), false);
});

test("authenticateUser still compares a password when the account is missing", async () => {
  let comparedHash = "";

  const result = await authenticateUser(loginInput, {
    findUserByIdentifier: async () => null,
    comparePassword: async (_password, passwordHash) => {
      comparedHash = passwordHash;
      return false;
    },
  });

  assert.equal(result, null);
  assert.match(comparedHash, /^\$2[aby]\$12\$/);
});
