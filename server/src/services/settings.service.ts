// Owns authenticated account changes and per-user System preference persistence.
import { compare, hash } from "bcryptjs";
import {
  Prisma,
  UserPreferenceDateFormat,
  UserPreferenceTimeFormat,
  type UserPreferenceAttendanceState,
  type UserPreferenceExportFormat,
  type UserPreferenceTableDensity,
} from "../generated/prisma/client.js";

import prisma from "../lib/db-client.js";
import type { AuthenticatedUser } from "../validations/auth.response.js";
import type {
  ChangePasswordInput,
  SystemPreferencesInput,
  UpdateProfileInput,
} from "../validations/settings.schema.js";

type PasswordUserRecord = {
  passwordHash: string;
};

type SystemPreferenceDatabaseRecord = {
  defaultSchoolYear: string | null;
  defaultSemester: string | null;
  defaultAttendanceState: UserPreferenceAttendanceState;
  tableDensity: UserPreferenceTableDensity;
  dateFormat: UserPreferenceDateFormat;
  timeFormat: UserPreferenceTimeFormat;
  defaultExportFormat: UserPreferenceExportFormat;
};

type AcademicSchoolYearRecord = { schoolYear: string | null };
type AcademicSemesterRecord = { semester: string | null };

export type SettingsReadResult = {
  system: SystemPreferencesInput;
  academicOptions: {
    schoolYears: string[];
    semesters: string[];
  };
};

export const SYSTEM_PREFERENCE_DEFAULTS: SystemPreferencesInput = {
  defaultSchoolYear: null,
  defaultSemester: null,
  // Uninitialized Attendance rosters currently use null/unrecorded marks.
  defaultAttendanceState: "UNRECORDED",
  tableDensity: "COMFORTABLE",
  dateFormat: "YYYY-MM-DD",
  timeFormat: "12H",
  defaultExportFormat: "PDF",
};

export type SettingsServiceDependencies = {
  updateProfile: (
    userId: string,
    input: UpdateProfileInput,
  ) => Promise<AuthenticatedUser>;
  isEmailUniqueConflict: (error: unknown) => boolean;
  isUsernameUniqueConflict: (error: unknown) => boolean;
  findPasswordUser: (userId: string) => Promise<PasswordUserRecord | null>;
  comparePassword: (password: string, passwordHash: string) => Promise<boolean>;
  hashPassword: (password: string) => Promise<string>;
  updatePasswordIfCurrent: (
    userId: string,
    currentPasswordHash: string,
    newPasswordHash: string,
  ) => Promise<boolean>;
  findSystemPreferences: (
    userId: string,
  ) => Promise<SystemPreferenceDatabaseRecord | null>;
  findSchoolYears: () => Promise<AcademicSchoolYearRecord[]>;
  findSemesters: () => Promise<AcademicSemesterRecord[]>;
  saveSystemPreferences: (
    userId: string,
    input: SystemPreferenceDatabaseRecord,
  ) => Promise<SystemPreferenceDatabaseRecord>;
};

const publicUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  email: true,
} as const;

const systemPreferenceSelect = {
  defaultSchoolYear: true,
  defaultSemester: true,
  defaultAttendanceState: true,
  tableDensity: true,
  dateFormat: true,
  timeFormat: true,
  defaultExportFormat: true,
} as const;

function isUniqueConflictForField(error: unknown, field: "email" | "username") {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return false;
  }

  const target = error.meta?.target;
  return target === field || target === `User_${field}_key` ||
    (Array.isArray(target) && target.includes(field));
}

const defaultDependencies: SettingsServiceDependencies = {
  updateProfile: (userId, input) =>
    prisma.user.update({
      where: { id: userId },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        username: input.username,
      },
      select: publicUserSelect,
    }),
  isEmailUniqueConflict: (error) => isUniqueConflictForField(error, "email"),
  isUsernameUniqueConflict: (error) => isUniqueConflictForField(error, "username"),
  findPasswordUser: (userId) =>
    prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    }),
  comparePassword: compare,
  hashPassword: (password) => hash(password, 12),
  updatePasswordIfCurrent: async (userId, currentPasswordHash, newPasswordHash) => {
    const result = await prisma.user.updateMany({
      where: { id: userId, passwordHash: currentPasswordHash },
      data: {
        passwordHash: newPasswordHash,
        sessionVersion: { increment: 1 },
      },
    });
    return result.count === 1;
  },
  findSystemPreferences: (userId) =>
    prisma.userPreference.findUnique({
      where: { userId },
      select: systemPreferenceSelect,
    }),
  findSchoolYears: () =>
    prisma.class.findMany({
      where: { archivedAt: null, schoolYear: { not: null } },
      distinct: ["schoolYear"],
      orderBy: { schoolYear: "asc" },
      take: 500,
      select: { schoolYear: true },
    }),
  findSemesters: () =>
    prisma.class.findMany({
      where: { archivedAt: null, semester: { not: null } },
      distinct: ["semester"],
      orderBy: { semester: "asc" },
      take: 500,
      select: { semester: true },
    }),
  saveSystemPreferences: (userId, input) =>
    prisma.userPreference.upsert({
      where: { userId },
      update: input,
      create: { userId, ...input },
      select: systemPreferenceSelect,
    }),
};

const dateFormatToDatabase = {
  "YYYY-MM-DD": UserPreferenceDateFormat.YEAR_MONTH_DAY,
  "DD/MM/YYYY": UserPreferenceDateFormat.DAY_MONTH_YEAR,
  "MM/DD/YYYY": UserPreferenceDateFormat.MONTH_DAY_YEAR,
} as const;

const dateFormatFromDatabase = {
  [UserPreferenceDateFormat.YEAR_MONTH_DAY]: "YYYY-MM-DD",
  [UserPreferenceDateFormat.DAY_MONTH_YEAR]: "DD/MM/YYYY",
  [UserPreferenceDateFormat.MONTH_DAY_YEAR]: "MM/DD/YYYY",
} as const;

const timeFormatToDatabase = {
  "12H": UserPreferenceTimeFormat.TWELVE_HOUR,
  "24H": UserPreferenceTimeFormat.TWENTY_FOUR_HOUR,
} as const;

const timeFormatFromDatabase = {
  [UserPreferenceTimeFormat.TWELVE_HOUR]: "12H",
  [UserPreferenceTimeFormat.TWENTY_FOUR_HOUR]: "24H",
} as const;

// Converts public display-oriented values into constrained Prisma enum values.
function toDatabaseSystemPreferences(
  input: SystemPreferencesInput,
): SystemPreferenceDatabaseRecord {
  return {
    defaultSchoolYear: input.defaultSchoolYear,
    defaultSemester: input.defaultSemester,
    defaultAttendanceState: input.defaultAttendanceState,
    tableDensity: input.tableDensity,
    dateFormat: dateFormatToDatabase[input.dateFormat],
    timeFormat: timeFormatToDatabase[input.timeFormat],
    defaultExportFormat: input.defaultExportFormat,
  };
}

// Maps the private persistence representation into the stable public API contract.
function toPublicSystemPreferences(
  record: SystemPreferenceDatabaseRecord,
): SystemPreferencesInput {
  return {
    defaultSchoolYear: record.defaultSchoolYear,
    defaultSemester: record.defaultSemester,
    defaultAttendanceState: record.defaultAttendanceState,
    tableDensity: record.tableDensity,
    dateFormat: dateFormatFromDatabase[record.dateFormat],
    timeFormat: timeFormatFromDatabase[record.timeFormat],
    defaultExportFormat: record.defaultExportFormat,
  };
}

// Returns unique nonempty class values and retains a saved value that is now inactive.
function collectAcademicOptions(
  values: Array<string | null>,
  savedValue: string | null,
) {
  const options = new Set(
    values
      .map((value) => value?.trim() ?? "")
      .filter((value) => value.length > 0),
  );

  if (savedValue?.trim()) {
    options.add(savedValue.trim());
  }

  return [...options].sort((first, second) =>
    first.localeCompare(second, undefined, { numeric: true, sensitivity: "base" })
  );
}

export type ProfileUpdateResult =
  | { status: "updated"; user: AuthenticatedUser }
  | { status: "email_in_use" }
  | { status: "username_in_use" };

// Updates only the authenticated user's safe identity fields and classifies uniqueness conflicts.
export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
  dependencies: SettingsServiceDependencies = defaultDependencies,
): Promise<ProfileUpdateResult> {
  try {
    const user = await dependencies.updateProfile(userId, input);
    return { status: "updated", user };
  } catch (error) {
    if (dependencies.isEmailUniqueConflict(error)) return { status: "email_in_use" };
    if (dependencies.isUsernameUniqueConflict(error)) return { status: "username_in_use" };
    throw error;
  }
}

export type PasswordChangeResult =
  | { status: "changed" }
  | { status: "invalid_current_password" };

// Verifies the current password, then atomically changes it and invalidates every issued session.
export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
  dependencies: SettingsServiceDependencies = defaultDependencies,
): Promise<PasswordChangeResult> {
  const user = await dependencies.findPasswordUser(userId);
  if (!user || !await dependencies.comparePassword(input.currentPassword, user.passwordHash)) {
    return { status: "invalid_current_password" };
  }

  const newPasswordHash = await dependencies.hashPassword(input.newPassword);
  const changed = await dependencies.updatePasswordIfCurrent(
    userId,
    user.passwordHash,
    newPasswordHash,
  );
  return changed ? { status: "changed" } : { status: "invalid_current_password" };
}

// Loads one user's saved preferences or server defaults with active Class-derived choices.
export async function getSettings(
  userId: string,
  dependencies: SettingsServiceDependencies = defaultDependencies,
): Promise<SettingsReadResult> {
  const [savedPreferences, schoolYearRecords, semesterRecords] = await Promise.all([
    dependencies.findSystemPreferences(userId),
    dependencies.findSchoolYears(),
    dependencies.findSemesters(),
  ]);
  const system = savedPreferences
    ? toPublicSystemPreferences(savedPreferences)
    : { ...SYSTEM_PREFERENCE_DEFAULTS };

  return {
    system,
    academicOptions: {
      schoolYears: collectAcademicOptions(
        schoolYearRecords.map((record) => record.schoolYear),
        system.defaultSchoolYear,
      ),
      semesters: collectAcademicOptions(
        semesterRecords.map((record) => record.semester),
        system.defaultSemester,
      ),
    },
  };
}

// Upserts the complete validated System section for only the authenticated user.
export async function updateSystemPreferences(
  userId: string,
  input: SystemPreferencesInput,
  dependencies: SettingsServiceDependencies = defaultDependencies,
) {
  const savedPreferences = await dependencies.saveSystemPreferences(
    userId,
    toDatabaseSystemPreferences(input),
  );

  return toPublicSystemPreferences(savedPreferences);
}

// Persists server-owned defaults so reset cannot drift with client constants.
export function resetSystemPreferences(
  userId: string,
  dependencies: SettingsServiceDependencies = defaultDependencies,
) {
  return updateSystemPreferences(
    userId,
    SYSTEM_PREFERENCE_DEFAULTS,
    dependencies,
  );
}
