// Defines the only success and authentication-error shapes the login route may return.
import { z } from "zod";

export const authenticatedUserSchema = z.strictObject({
  id: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  username: z.string().nullable(),
  email: z.string().email(),
});

export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>;

export const loginSuccessResponseSchema = z.strictObject({
  success: z.literal(true),
  data: z.strictObject({
    user: authenticatedUserSchema,
  }),
});

export const invalidCredentialsResponseSchema = z.strictObject({
  success: z.literal(false),
  error: z.strictObject({
    code: z.literal("INVALID_CREDENTIALS"),
    message: z.literal("Invalid email, username, or password."),
  }),
});

export const loginRateLimitResponseSchema = z.strictObject({
  success: z.literal(false),
  error: z.strictObject({
    code: z.literal("TOO_MANY_LOGIN_ATTEMPTS"),
    message: z.literal("Too many login attempts. Please try again later."),
  }),
});
