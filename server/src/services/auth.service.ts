// Looks up login identities, compares password hashes, and returns safe user data.
import { compare } from "bcryptjs";

import prisma from "../lib/db-client.js";
import type { LoginInput } from "../validations/auth.schema.js";
import type { AuthenticatedUser } from "../validations/auth.response.js";

type LoginUserRecord = AuthenticatedUser & {
  passwordHash: string;
};

export type AuthServiceDependencies = {
  findUserByIdentifier: (
    identifier: string,
  ) => Promise<LoginUserRecord | null>;
  comparePassword: (password: string, passwordHash: string) => Promise<boolean>;
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
