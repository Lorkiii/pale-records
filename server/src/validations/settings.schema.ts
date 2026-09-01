// Validates and normalizes authenticated Profile, password, and System Settings requests.
import { z } from "zod";

const nameSchema = z
  .string({ error: "This field is required" })
  .trim()
  .min(1, "This field is required")
  .max(80, "This field must be at most 80 characters");

const emailSchema = z
  .string({ error: "Email address is required" })
  .trim()
  .toLowerCase()
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

const optionalUsernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((username) => username || null)
  .pipe(z.union([z.null(), usernameSchema]));

const currentPasswordSchema = z
  .string({ error: "Current password is required" })
  .min(1, "Current password is required")
  .max(128, "Password must be at most 128 characters");

const newPasswordSchema = z
  .string({ error: "New password is required" })
  .min(8, "New password must be 8 to 128 characters")
  .max(128, "New password must be 8 to 128 characters");

const optionalAcademicPreferenceSchema = z.union([
  z.string().trim().min(1, "Select a nonempty academic value").max(32),
  z.null(),
]);

export const updateProfileSchema = z.strictObject({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  username: optionalUsernameSchema,
});

export const changePasswordSchema = z.strictObject({
  currentPassword: currentPasswordSchema,
  newPassword: newPasswordSchema,
});

export const systemPreferencesSchema = z.strictObject({
  defaultSchoolYear: optionalAcademicPreferenceSchema,
  defaultSemester: optionalAcademicPreferenceSchema,
  defaultAttendanceState: z.enum(["PRESENT", "UNRECORDED"]),
  tableDensity: z.enum(["COMFORTABLE", "COMPACT"]),
  dateFormat: z.enum(["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY"]),
  timeFormat: z.enum(["12H", "24H"]),
  defaultExportFormat: z.enum(["PDF", "CSV"]),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type SystemPreferencesInput = z.infer<typeof systemPreferencesSchema>;
