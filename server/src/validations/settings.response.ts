// Defines safe Profile, password, and System Settings response contracts.
import { z } from "zod";

import { authenticatedUserSchema } from "./auth.response.js";

export const systemPreferencesResponseValueSchema = z.strictObject({
  defaultSchoolYear: z.string().trim().min(1).max(32).nullable(),
  defaultSemester: z.string().trim().min(1).max(32).nullable(),
  defaultAttendanceState: z.enum(["PRESENT", "UNRECORDED"]),
  tableDensity: z.enum(["COMFORTABLE", "COMPACT"]),
  dateFormat: z.enum(["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY"]),
  timeFormat: z.enum(["12H", "24H"]),
  defaultExportFormat: z.enum(["PDF", "CSV"]),
});

export const settingsReadResponseSchema = z.strictObject({
  success: z.literal(true),
  data: z.strictObject({
    system: systemPreferencesResponseValueSchema,
    academicOptions: z.strictObject({
      schoolYears: z.array(z.string().trim().min(1).max(32)).max(500),
      semesters: z.array(z.string().trim().min(1).max(32)).max(500),
    }),
  }),
});

export const systemPreferencesResponseSchema = z.strictObject({
  success: z.literal(true),
  data: z.strictObject({
    system: systemPreferencesResponseValueSchema,
  }),
});

export const profileUpdateResponseSchema = z.strictObject({
  success: z.literal(true),
  data: z.strictObject({
    user: authenticatedUserSchema,
  }),
});

export const passwordChangeResponseSchema = z.strictObject({
  success: z.literal(true),
  data: z.strictObject({
    message: z.literal("Password changed. Sign in again to continue."),
  }),
});

export const profileEmailInUseResponseSchema = z.strictObject({
  success: z.literal(false),
  error: z.strictObject({
    code: z.literal("PROFILE_EMAIL_IN_USE"),
    message: z.literal("This email address is already in use."),
    details: z.strictObject({
      fieldErrors: z.strictObject({ email: z.array(z.string()).length(1) }),
    }),
  }),
});

export const profileUsernameInUseResponseSchema = z.strictObject({
  success: z.literal(false),
  error: z.strictObject({
    code: z.literal("PROFILE_USERNAME_IN_USE"),
    message: z.literal("This username is already in use."),
    details: z.strictObject({
      fieldErrors: z.strictObject({ username: z.array(z.string()).length(1) }),
    }),
  }),
});

export const invalidCurrentPasswordResponseSchema = z.strictObject({
  success: z.literal(false),
  error: z.strictObject({
    code: z.literal("INVALID_CURRENT_PASSWORD"),
    message: z.literal("Unable to change the password with the provided credentials."),
  }),
});

export const passwordChangeRateLimitResponseSchema = z.strictObject({
  success: z.literal(false),
  error: z.strictObject({
    code: z.literal("TOO_MANY_PASSWORD_CHANGE_ATTEMPTS"),
    message: z.literal("Too many password change attempts. Please try again later."),
  }),
});
