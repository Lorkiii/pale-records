// Verifies strict Profile, password, and System Settings request validation.
import assert from "node:assert/strict";
import test from "node:test";

import {
  changePasswordSchema,
  systemPreferencesSchema,
  updateProfileSchema,
} from "./settings.schema.js";

test("Profile schema trims names and normalizes email and username", () => {
  const result = updateProfileSchema.parse({
    firstName: "  Ana  ",
    lastName: "  Reyes ",
    email: " ANA@EXAMPLE.COM ",
    username: " Ana.Reyes ",
  });

  assert.deepEqual(result, {
    firstName: "Ana",
    lastName: "Reyes",
    email: "ana@example.com",
    username: "ana.reyes",
  });
});

test("Profile schema converts an empty optional username to null and rejects unknown fields", () => {
  const emptyUsername = updateProfileSchema.parse({
    firstName: "Ana",
    lastName: "Reyes",
    email: "ana@example.com",
    username: "   ",
  });
  const unknownField = updateProfileSchema.safeParse({
    ...emptyUsername,
    role: "ADMIN",
  });

  assert.equal(emptyUsername.username, null);
  assert.equal(unknownField.success, false);
});

test("password schema enforces a current password and an 8 to 128 character new password", () => {
  assert.equal(changePasswordSchema.safeParse({
    currentPassword: "current-password",
    newPassword: "new-password",
  }).success, true);
  assert.equal(changePasswordSchema.safeParse({
    currentPassword: "",
    newPassword: "short",
  }).success, false);
  assert.equal(changePasswordSchema.safeParse({
    currentPassword: "current-password",
    newPassword: "a".repeat(129),
  }).success, false);
});

test("System preference schema accepts the complete canonical contract", () => {
  const result = systemPreferencesSchema.parse({
    defaultSchoolYear: " 2025-2026 ",
    defaultSemester: null,
    defaultAttendanceState: "UNRECORDED",
    tableDensity: "COMPACT",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "24H",
    defaultExportFormat: "CSV",
  });

  assert.deepEqual(result, {
    defaultSchoolYear: "2025-2026",
    defaultSemester: null,
    defaultAttendanceState: "UNRECORDED",
    tableDensity: "COMPACT",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "24H",
    defaultExportFormat: "CSV",
  });
});

test("System preference schema rejects missing, unknown, and unsupported values", () => {
  const validInput = {
    defaultSchoolYear: null,
    defaultSemester: null,
    defaultAttendanceState: "PRESENT",
    tableDensity: "COMFORTABLE",
    dateFormat: "YYYY-MM-DD",
    timeFormat: "12H",
    defaultExportFormat: "PDF",
  };

  assert.equal(systemPreferencesSchema.safeParse({
    ...validInput,
    defaultExportFormat: undefined,
  }).success, false);
  assert.equal(systemPreferencesSchema.safeParse({
    ...validInput,
    unsupportedSetting: true,
  }).success, false);
  assert.equal(systemPreferencesSchema.safeParse({
    ...validInput,
    dateFormat: "MMMM D, YYYY",
  }).success, false);
  assert.equal(systemPreferencesSchema.safeParse({
    ...validInput,
    defaultSchoolYear: "   ",
  }).success, false);
});
