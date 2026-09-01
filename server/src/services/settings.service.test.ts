// Verifies Settings account safety and isolated per-user preference behavior.
import assert from "node:assert/strict";
import test from "node:test";

import {
  UserPreferenceDateFormat,
  UserPreferenceTimeFormat,
} from "../generated/prisma/client.js";
import {
  changePassword,
  getSettings,
  resetSystemPreferences,
  SYSTEM_PREFERENCE_DEFAULTS,
  updateSystemPreferences,
  updateProfile,
  type SettingsServiceDependencies,
} from "./settings.service.js";

const userId = "a8a5bbc6-bbd1-44f8-9c73-1adbc04ff57c";
const profileInput = {
  firstName: "Ana",
  lastName: "Reyes",
  email: "ana@example.com",
  username: "ana.reyes" as string | null,
};
const databasePreferences = {
  defaultSchoolYear: "2025-2026",
  defaultSemester: "First Semester",
  defaultAttendanceState: "PRESENT" as const,
  tableDensity: "COMPACT" as const,
  dateFormat: UserPreferenceDateFormat.DAY_MONTH_YEAR,
  timeFormat: UserPreferenceTimeFormat.TWENTY_FOUR_HOUR,
  defaultExportFormat: "CSV" as const,
};

function createDependencies(
  overrides: Partial<SettingsServiceDependencies> = {},
): SettingsServiceDependencies {
  return {
    updateProfile: async () => ({ ...profileInput, id: userId }),
    isEmailUniqueConflict: () => false,
    isUsernameUniqueConflict: () => false,
    findPasswordUser: async () => ({ passwordHash: "old-hash" }),
    comparePassword: async () => true,
    hashPassword: async () => "new-hash",
    updatePasswordIfCurrent: async () => true,
    findSystemPreferences: async () => null,
    findSchoolYears: async () => [],
    findSemesters: async () => [],
    saveSystemPreferences: async () => databasePreferences,
    ...overrides,
  };
}

test("Profile update returns only safe public fields", async () => {
  const result = await updateProfile(userId, profileInput, createDependencies());

  assert.deepEqual(result, { status: "updated", user: { ...profileInput, id: userId } });
  assert.equal("passwordHash" in (result.status === "updated" ? result.user : {}), false);
  assert.equal("sessionVersion" in (result.status === "updated" ? result.user : {}), false);
});

test("Profile update returns field-specific email and username conflicts", async () => {
  const emailConflict = new Error("email conflict");
  const usernameConflict = new Error("username conflict");
  const emailResult = await updateProfile(userId, profileInput, createDependencies({
    updateProfile: async () => { throw emailConflict; },
    isEmailUniqueConflict: (error) => error === emailConflict,
  }));
  const usernameResult = await updateProfile(userId, profileInput, createDependencies({
    updateProfile: async () => { throw usernameConflict; },
    isUsernameUniqueConflict: (error) => error === usernameConflict,
  }));

  assert.deepEqual(emailResult, { status: "email_in_use" });
  assert.deepEqual(usernameResult, { status: "username_in_use" });
});

test("password changes hash and increments the session version exactly once", async () => {
  let passwordHash = "old-hash";
  let sessionVersion = 7;
  const result = await changePassword(userId, {
    currentPassword: "current-password",
    newPassword: "new-password",
  }, createDependencies({
    findPasswordUser: async () => ({ passwordHash }),
    comparePassword: async (password, storedHash) => password === "current-password" && storedHash === passwordHash,
    hashPassword: async () => "new-hash",
    updatePasswordIfCurrent: async (_userId, currentHash, newHash) => {
      if (currentHash !== passwordHash) return false;
      passwordHash = newHash;
      sessionVersion += 1;
      return true;
    },
  }));

  assert.deepEqual(result, { status: "changed" });
  assert.equal(passwordHash, "new-hash");
  assert.equal(sessionVersion, 8);
});

test("password changes reject an incorrect or raced current password", async () => {
  const incorrect = await changePassword(userId, {
    currentPassword: "wrong-password",
    newPassword: "new-password",
  }, createDependencies({ comparePassword: async () => false }));
  const raced = await changePassword(userId, {
    currentPassword: "current-password",
    newPassword: "new-password",
  }, createDependencies({ updatePasswordIfCurrent: async () => false }));

  assert.deepEqual(incorrect, { status: "invalid_current_password" });
  assert.deepEqual(raced, { status: "invalid_current_password" });
});

test("Settings read returns server defaults without creating a preference row", async () => {
  let didSave = false;
  const result = await getSettings(userId, createDependencies({
    findSchoolYears: async () => [
      { schoolYear: "2025-2026" },
      { schoolYear: "" },
      { schoolYear: "2025-2026" },
      { schoolYear: null },
    ],
    findSemesters: async () => [
      { semester: "Second Semester" },
      { semester: "First Semester" },
    ],
    saveSystemPreferences: async () => {
      didSave = true;
      return databasePreferences;
    },
  }));

  assert.deepEqual(result.system, SYSTEM_PREFERENCE_DEFAULTS);
  assert.deepEqual(result.academicOptions, {
    schoolYears: ["2025-2026"],
    semesters: ["First Semester", "Second Semester"],
  });
  assert.equal(didSave, false);
});

test("Settings read retains saved academic values missing from active Classes", async () => {
  const result = await getSettings(userId, createDependencies({
    findSystemPreferences: async () => databasePreferences,
    findSchoolYears: async () => [{ schoolYear: "2026-2027" }],
    findSemesters: async () => [{ semester: "Second Semester" }],
  }));

  assert.deepEqual(result.system, {
    defaultSchoolYear: "2025-2026",
    defaultSemester: "First Semester",
    defaultAttendanceState: "PRESENT",
    tableDensity: "COMPACT",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "24H",
    defaultExportFormat: "CSV",
  });
  assert.deepEqual(result.academicOptions, {
    schoolYears: ["2025-2026", "2026-2027"],
    semesters: ["First Semester", "Second Semester"],
  });
});

test("System preference upserts remain isolated to the authenticated user", async () => {
  const secondUserId = "f3196201-37df-4f45-8f48-3ec6504928a5";
  const savedByUser = new Map<
    string,
    Parameters<SettingsServiceDependencies["saveSystemPreferences"]>[1]
  >();
  const dependencies = createDependencies({
    findSystemPreferences: async (requestedUserId) => savedByUser.get(requestedUserId) ?? null,
    saveSystemPreferences: async (requestedUserId, input) => {
      savedByUser.set(requestedUserId, input);
      return input;
    },
  });

  const updated = await updateSystemPreferences(userId, {
    defaultSchoolYear: "2025-2026",
    defaultSemester: "First Semester",
    defaultAttendanceState: "PRESENT",
    tableDensity: "COMPACT",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "24H",
    defaultExportFormat: "CSV",
  }, dependencies);
  const otherUser = await getSettings(secondUserId, dependencies);

  assert.deepEqual(updated, {
    defaultSchoolYear: "2025-2026",
    defaultSemester: "First Semester",
    defaultAttendanceState: "PRESENT",
    tableDensity: "COMPACT",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "24H",
    defaultExportFormat: "CSV",
  });
  assert.equal(savedByUser.has(userId), true);
  assert.equal(savedByUser.has(secondUserId), false);
  assert.deepEqual(otherUser.system, SYSTEM_PREFERENCE_DEFAULTS);
});

test("System preference reset persists server-owned canonical defaults", async () => {
  let persistedRecord: Parameters<SettingsServiceDependencies["saveSystemPreferences"]>[1] | null = null;
  const result = await resetSystemPreferences(userId, createDependencies({
    saveSystemPreferences: async (_requestedUserId, input) => {
      persistedRecord = input;
      return input;
    },
  }));

  assert.deepEqual(result, SYSTEM_PREFERENCE_DEFAULTS);
  assert.deepEqual(persistedRecord, {
    defaultSchoolYear: null,
    defaultSemester: null,
    defaultAttendanceState: "UNRECORDED",
    tableDensity: "COMFORTABLE",
    dateFormat: UserPreferenceDateFormat.YEAR_MONTH_DAY,
    timeFormat: UserPreferenceTimeFormat.TWELVE_HOUR,
    defaultExportFormat: "PDF",
  });
});
