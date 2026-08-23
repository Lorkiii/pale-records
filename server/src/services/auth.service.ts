// Looks up login and session identities while returning only safe user data.
import { compare } from "bcryptjs";

import prisma from "../lib/db-client.js";
import type { LoginInput } from "../validations/auth.schema.js";
import type { AuthenticatedUser } from "../validations/auth.response.js";

type LoginUserRecord = AuthenticatedUser & {
  passwordHash: string;
};

// Type for the dependencies of the auth service
export type AuthServiceDependencies = {
  // Function to find a user by their identifier
  findUserByIdentifier: (
    identifier: string,
  ) => Promise<LoginUserRecord | null>;
  comparePassword: (password: string, passwordHash: string) => Promise<boolean>;
};

export type SessionServiceDependencies = {
  findUserById: (userId: string) => Promise<AuthenticatedUser | null>;
};

const DUMMY_PASSWORD_HASH =
  "$2b$12$vVLPGMzycxap/miCs7i21uPaFxbcu22wXWdNMzSMNek5N90lM6Hy6";

const defaultDependencies: AuthServiceDependencies = {
  findUserByIdentifier: (identifier) =>
    prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        email: true,
        passwordHash: true,
      },
    }),
  comparePassword: compare,
};

const defaultSessionDependencies: SessionServiceDependencies = {
  findUserById: (userId) =>
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        email: true,
      },
    }),
};

/** Authenticates an email or username without exposing the password hash. */
export async function authenticateUser(
  { identifier, password }: LoginInput,
  dependencies: AuthServiceDependencies = defaultDependencies,
) {
  const user = await dependencies.findUserByIdentifier(identifier);
  const passwordMatches = await dependencies.comparePassword(
    password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );

  if (!user || !passwordMatches) {
    return null;
  }

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    email: user.email,
  };
}

/** Resolves a session identity without selecting credential data. */
export function getAuthenticatedUser(
  userId: string,
  dependencies: SessionServiceDependencies = defaultSessionDependencies,
) {
  return dependencies.findUserById(userId);
}
