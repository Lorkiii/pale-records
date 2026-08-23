// Creates or synchronizes the private administrator from local environment values.
import { hash } from "bcryptjs";
import { config } from "dotenv";
import { z } from "zod";

import prisma from "../src/lib/db-client.js";

config({ path: [".env.local", ".env"], quiet: true });

const adminSeedSchema = z.object({
  ADMIN_USERNAME: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9._-]+$/)
    .transform((username) => username.toLowerCase()),
  ADMIN_EMAIL: z
    .string()
    .trim()
    .max(254)
    .email()
    .transform((email) => email.toLowerCase()),
  ADMIN_PASSWORD: z.string().min(8).max(128),
  ADMIN_FIRST_NAME: z.string().trim().min(1).max(100),
  ADMIN_LAST_NAME: z.string().trim().min(1).max(100),
});

async function seedAdmin() {
  const input = adminSeedSchema.parse(process.env);
  const [userByEmail, userByUsername] = await Promise.all([
    prisma.user.findUnique({
      where: { email: input.ADMIN_EMAIL },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { username: input.ADMIN_USERNAME },
      select: { id: true },
    }),
  ]);

  if (
    userByEmail &&
    userByUsername &&
    userByEmail.id !== userByUsername.id
  ) {
    throw new Error(
      "ADMIN_EMAIL and ADMIN_USERNAME belong to different users",
    );
  }

  const passwordHash = await hash(input.ADMIN_PASSWORD, 12);
  const existingUser = userByEmail ?? userByUsername;
  const data = {
    firstName: input.ADMIN_FIRST_NAME,
    lastName: input.ADMIN_LAST_NAME,
    username: input.ADMIN_USERNAME,
    email: input.ADMIN_EMAIL,
    passwordHash,
  };

  const admin = existingUser
    ? await prisma.user.update({
        where: { id: existingUser.id },
        data,
        select: { username: true, email: true },
      })
    : await prisma.user.create({
        data,
        select: { username: true, email: true },
      });

  console.log(`Admin account ready: ${admin.username} (${admin.email})`);
}

seedAdmin()
  .catch((error: unknown) => {
    console.error(
      "Admin seed failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
