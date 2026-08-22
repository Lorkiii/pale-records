// Loads and validates server settings before the application accepts requests.
import { config } from "dotenv";
import { z } from "zod";

config({ path: [".env.local", ".env"], quiet: true });

const httpOriginSchema = z
  .url()
  .refine((origin) => ["http:", "https:"].includes(new URL(origin).protocol), {
    message: "Origin must use HTTP or HTTPS",
  });

const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(5_000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must contain at least 32 characters"),
  CLIENT_ORIGIN: z
    .string()
    .transform((value) => value.split(",").map((origin) => origin.trim()))
    .pipe(z.array(httpOriginSchema).min(1)),
});

const result = serverEnvSchema.safeParse(process.env);

if (!result.success) {
  const { fieldErrors } = z.flattenError(result.error);
  const invalidFields = Object.keys(fieldErrors).join(", ");

  throw new Error(`Invalid server environment configuration: ${invalidFields}`);
}

export const env = {
  ...result.data,
  CLIENT_ORIGINS: result.data.CLIENT_ORIGIN,
};
