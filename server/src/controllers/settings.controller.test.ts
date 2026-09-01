// Verifies safe account and System Settings controller response envelopes.
import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import request from "supertest";

import {
  createSettingsControllerHandlers,
  type SettingsControllerDependencies,
} from "./settings.controller.js";
import { errorHandler } from "../middleware/error-handler.js";
import { validateBody } from "../middleware/validate-body.js";
import { passwordChangeLimiter } from "../routes/settings.route.js";
import {
  changePasswordSchema,
  systemPreferencesSchema,
  updateProfileSchema,
} from "../validations/settings.schema.js";

const user = {
  id: "a8a5bbc6-bbd1-44f8-9c73-1adbc04ff57c",
  firstName: "Ana",
  lastName: "Reyes",
  username: "ana.reyes",
  email: "ana@example.com",
};
const system = {
  defaultSchoolYear: "2025-2026",
  defaultSemester: "First Semester",
  defaultAttendanceState: "UNRECORDED" as const,
  tableDensity: "COMFORTABLE" as const,
  dateFormat: "YYYY-MM-DD" as const,
  timeFormat: "12H" as const,
  defaultExportFormat: "PDF" as const,
};

function profileBody(overrides: Record<string, unknown> = {}) {
  return { firstName: "Ana", lastName: "Reyes", email: "ana@example.com", username: "ana.reyes", ...overrides };
}

function createTestApp(overrides: Partial<SettingsControllerDependencies> = {}) {
  const handlers = createSettingsControllerHandlers({
    updateProfile: async () => ({ status: "updated", user }),
    changePassword: async () => ({ status: "changed" }),
    getSettings: async () => ({
      system,
      academicOptions: {
        schoolYears: ["2025-2026"],
        semesters: ["First Semester"],
      },
    }),
    updateSystemPreferences: async (_userId, input) => input,
    resetSystemPreferences: async () => ({
      ...system,
      defaultSchoolYear: null,
      defaultSemester: null,
    }),
    ...overrides,
  });
  const testApp = express();
  testApp.use(express.json());
  testApp.use((_req, res, next) => { res.locals.authenticatedUser = user; next(); });
  testApp.patch("/profile", validateBody(updateProfileSchema), handlers.updateProfileController);
  testApp.post("/password", validateBody(changePasswordSchema), handlers.changePasswordController);
  testApp.get("/", handlers.getSettingsController);
  testApp.patch("/system", validateBody(systemPreferencesSchema), handlers.updateSystemPreferencesController);
  testApp.post("/system/reset", handlers.resetSystemPreferencesController);
  testApp.use(errorHandler);
  return testApp;
}

test("Settings controllers return safe Profile and password success responses", async () => {
  const profileResponse = await request(createTestApp()).patch("/profile").send(profileBody());
  const passwordResponse = await request(createTestApp()).post("/password").send({ currentPassword: "current-password", newPassword: "new-password" });

  assert.equal(profileResponse.status, 200);
  assert.deepEqual(profileResponse.body, { success: true, data: { user } });
  assert.equal("passwordHash" in profileResponse.body.data.user, false);
  assert.equal("sessionVersion" in profileResponse.body.data.user, false);
  assert.equal(passwordResponse.status, 200);
  assert.match(passwordResponse.headers["set-cookie"]?.[0] ?? "", /^pale\.auth=;/);
  assert.deepEqual(passwordResponse.body, { success: true, data: { message: "Password changed. Sign in again to continue." } });
});

test("Settings controllers return safe field conflicts and generic current-password failures", async () => {
  const emailConflict = await request(createTestApp({
    updateProfile: async () => ({ status: "email_in_use" }),
    changePassword: async () => ({ status: "changed" }),
  })).patch("/profile").send(profileBody());
  const passwordFailure = await request(createTestApp({
    updateProfile: async () => ({ status: "updated", user }),
    changePassword: async () => ({ status: "invalid_current_password" }),
  })).post("/password").send({ currentPassword: "wrong-password", newPassword: "new-password" });

  assert.equal(emailConflict.status, 409);
  assert.equal(emailConflict.body.error.code, "PROFILE_EMAIL_IN_USE");
  assert.equal(emailConflict.body.error.details.fieldErrors.email[0], "This email address is already in use.");
  assert.equal(passwordFailure.status, 400);
  assert.equal(passwordFailure.body.error.code, "INVALID_CURRENT_PASSWORD");
});

test("Settings controllers return strict read, update, and reset preference responses", async () => {
  const settingsResponse = await request(createTestApp()).get("/");
  const updateResponse = await request(createTestApp()).patch("/system").send(system);
  const resetResponse = await request(createTestApp()).post("/system/reset");

  assert.equal(settingsResponse.status, 200);
  assert.deepEqual(settingsResponse.body, {
    success: true,
    data: {
      system,
      academicOptions: {
        schoolYears: ["2025-2026"],
        semesters: ["First Semester"],
      },
    },
  });
  assert.equal(updateResponse.status, 200);
  assert.deepEqual(updateResponse.body, {
    success: true,
    data: { system },
  });
  assert.equal(resetResponse.status, 200);
  assert.deepEqual(resetResponse.body, {
    success: true,
    data: {
      system: {
        ...system,
        defaultSchoolYear: null,
        defaultSemester: null,
      },
    },
  });
});

test("System preference update validation rejects partial and extra request fields", async () => {
  const partialResponse = await request(createTestApp()).patch("/system").send({
    defaultSchoolYear: null,
  });
  const extraFieldResponse = await request(createTestApp()).patch("/system").send({
    ...system,
    unsupportedSetting: true,
  });

  assert.equal(partialResponse.status, 400);
  assert.equal(partialResponse.body.error.code, "VALIDATION_ERROR");
  assert.equal(extraFieldResponse.status, 400);
  assert.equal(extraFieldResponse.body.error.code, "VALIDATION_ERROR");
});

test("System preference controllers derive ownership from the authenticated user", async () => {
  const receivedUserIds: string[] = [];
  const testApp = createTestApp({
    getSettings: async (receivedUserId) => {
      receivedUserIds.push(receivedUserId);
      return {
        system,
        academicOptions: { schoolYears: [], semesters: [] },
      };
    },
    updateSystemPreferences: async (receivedUserId, input) => {
      receivedUserIds.push(receivedUserId);
      return input;
    },
    resetSystemPreferences: async (receivedUserId) => {
      receivedUserIds.push(receivedUserId);
      return system;
    },
  });

  await request(testApp).get("/");
  await request(testApp).patch("/system").send(system);
  await request(testApp).post("/system/reset");

  assert.deepEqual(receivedUserIds, [user.id, user.id, user.id]);
});

test("password rate limiting returns the documented safe response shape", async () => {
  const limitedApp = express();
  limitedApp.post("/password", passwordChangeLimiter, (_req, res) => {
    res.status(400).json({ success: false });
  });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await request(limitedApp).post("/password");
    assert.equal(response.status, 400);
  }

  const limitedResponse = await request(limitedApp).post("/password");
  assert.equal(limitedResponse.status, 429);
  assert.deepEqual(limitedResponse.body, {
    success: false,
    error: {
      code: "TOO_MANY_PASSWORD_CHANGE_ATTEMPTS",
      message: "Too many password change attempts. Please try again later.",
    },
  });
});
