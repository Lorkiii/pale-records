import { z } from "zod";

export const loginSchema = z.strictObject({
  email: z
    .string({ error: "Email address is required" })
    .trim()
    .min(1, "Email address is required")
    .max(254, "Email address is too long")
    .email("Please enter a valid email address")
    .transform((email) => email.toLowerCase()),
  password: z
    .string({ error: "Password is required" })
    .min(1, "Password is required")
    .max(128, "Password must be at most 128 characters"),
  rememberMe: z.boolean().optional().default(false),
});

export type LoginInput = z.infer<typeof loginSchema>;
