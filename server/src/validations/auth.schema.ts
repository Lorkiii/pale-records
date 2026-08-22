// Validates and normalizes email-or-username login requests.
import { z } from "zod";

const emailSchema = z
  .string()
  .max(254, "Email address is too long")
  .email("Please enter a valid email address");

const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(32, "Username must be at most 32 characters")
  .regex(
    /^[a-z0-9._-]+$/,
    "Username may only contain letters, numbers, dots, underscores, and hyphens",
  );

const loginIdentifierSchema = z
  .string({ error: "Email address or username is required" })
  .trim()
  .min(1, "Email address or username is required")
  .transform((identifier) => identifier.toLowerCase())
  .pipe(z.union([emailSchema, usernameSchema]));

const passwordSchema = z
  .string({ error: "Password is required" })
  .min(1, "Password is required")
  .max(128, "Password must be at most 128 characters");

const rememberMeSchema = z.boolean().optional().default(false);

const identifierLoginSchema = z.strictObject({
  identifier: loginIdentifierSchema,
  password: passwordSchema,
  rememberMe: rememberMeSchema,
});

// Keep the original email payload working while clients move to `identifier`.
const legacyEmailLoginSchema = z
  .strictObject({
    email: z
      .string({ error: "Email address is required" })
      .trim()
      .min(1, "Email address is required")
      .transform((email) => email.toLowerCase())
      .pipe(emailSchema),
    password: passwordSchema,
    rememberMe: rememberMeSchema,
  })
  .transform(({ email, password, rememberMe }) => ({
    identifier: email,
    password,
    rememberMe,
  }));

export const loginSchema = z.union([
  identifierLoginSchema,
  legacyEmailLoginSchema,
]);

export type LoginInput = z.infer<typeof loginSchema>;
