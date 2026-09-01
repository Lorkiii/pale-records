// Converts authenticated Settings requests into safe account and preference responses.
import type { NextFunction, Request, Response } from "express";

import {
  getSessionCookieClearOptions,
  SESSION_COOKIE_NAME,
} from "../lib/auth-session.js";
import type { AuthenticatedResponseLocals } from "../middleware/require-authenticated-user.js";
import {
  changePassword,
  getSettings,
  resetSystemPreferences,
  updateSystemPreferences,
  updateProfile,
} from "../services/settings.service.js";
import type {
  ChangePasswordInput,
  SystemPreferencesInput,
  UpdateProfileInput,
} from "../validations/settings.schema.js";
import {
  invalidCurrentPasswordResponseSchema,
  passwordChangeResponseSchema,
  profileEmailInUseResponseSchema,
  profileUpdateResponseSchema,
  profileUsernameInUseResponseSchema,
  settingsReadResponseSchema,
  systemPreferencesResponseSchema,
} from "../validations/settings.response.js";

export type SettingsControllerDependencies = {
  updateProfile: typeof updateProfile;
  changePassword: typeof changePassword;
  getSettings: typeof getSettings;
  updateSystemPreferences: typeof updateSystemPreferences;
  resetSystemPreferences: typeof resetSystemPreferences;
};

const defaultDependencies: SettingsControllerDependencies = {
  updateProfile,
  changePassword,
  getSettings,
  updateSystemPreferences,
  resetSystemPreferences,
};

// Builds Settings handlers with injectable services for isolated HTTP response tests.
export function createSettingsControllerHandlers(
  dependencies: SettingsControllerDependencies = defaultDependencies,
) {
  const updateProfileController = async (
    req: Request<Record<string, never>, unknown, UpdateProfileInput>,
    res: Response<unknown, AuthenticatedResponseLocals>,
    next: NextFunction,
  ) => {
    try {
      const result = await dependencies.updateProfile(
        res.locals.authenticatedUser.id,
        req.body,
      );

      if (result.status === "email_in_use") {
        return res.status(409).json(profileEmailInUseResponseSchema.parse({
          success: false,
          error: {
            code: "PROFILE_EMAIL_IN_USE",
            message: "This email address is already in use.",
            details: { fieldErrors: { email: ["This email address is already in use."] } },
          },
        }));
      }

      if (result.status === "username_in_use") {
        return res.status(409).json(profileUsernameInUseResponseSchema.parse({
          success: false,
          error: {
            code: "PROFILE_USERNAME_IN_USE",
            message: "This username is already in use.",
            details: { fieldErrors: { username: ["This username is already in use."] } },
          },
        }));
      }

      return res.status(200).json(profileUpdateResponseSchema.parse({
        success: true,
        data: { user: result.user },
      }));
    } catch (error) {
      next(error);
    }
  };

  const changePasswordController = async (
    req: Request<Record<string, never>, unknown, ChangePasswordInput>,
    res: Response<unknown, AuthenticatedResponseLocals>,
    next: NextFunction,
  ) => {
    try {
      const result = await dependencies.changePassword(
        res.locals.authenticatedUser.id,
        req.body,
      );

      if (result.status === "invalid_current_password") {
        return res.status(400).json(invalidCurrentPasswordResponseSchema.parse({
          success: false,
          error: {
            code: "INVALID_CURRENT_PASSWORD",
            message: "Unable to change the password with the provided credentials.",
          },
        }));
      }

      res.clearCookie(SESSION_COOKIE_NAME, getSessionCookieClearOptions());
      return res.status(200).json(passwordChangeResponseSchema.parse({
        success: true,
        data: { message: "Password changed. Sign in again to continue." },
      }));
    } catch (error) {
      next(error);
    }
  };

  const getSettingsController = async (
    _req: Request,
    res: Response<unknown, AuthenticatedResponseLocals>,
    next: NextFunction,
  ) => {
    try {
      const settings = await dependencies.getSettings(
        res.locals.authenticatedUser.id,
      );

      return res.status(200).json(settingsReadResponseSchema.parse({
        success: true,
        data: settings,
      }));
    } catch (error) {
      next(error);
    }
  };

  const updateSystemPreferencesController = async (
    req: Request<Record<string, never>, unknown, SystemPreferencesInput>,
    res: Response<unknown, AuthenticatedResponseLocals>,
    next: NextFunction,
  ) => {
    try {
      const system = await dependencies.updateSystemPreferences(
        res.locals.authenticatedUser.id,
        req.body,
      );

      return res.status(200).json(systemPreferencesResponseSchema.parse({
        success: true,
        data: { system },
      }));
    } catch (error) {
      next(error);
    }
  };

  const resetSystemPreferencesController = async (
    _req: Request,
    res: Response<unknown, AuthenticatedResponseLocals>,
    next: NextFunction,
  ) => {
    try {
      const system = await dependencies.resetSystemPreferences(
        res.locals.authenticatedUser.id,
      );

      return res.status(200).json(systemPreferencesResponseSchema.parse({
        success: true,
        data: { system },
      }));
    } catch (error) {
      next(error);
    }
  };

  return {
    updateProfileController,
    changePasswordController,
    getSettingsController,
    updateSystemPreferencesController,
    resetSystemPreferencesController,
  };
}

export const {
  updateProfileController,
  changePasswordController,
  getSettingsController,
  updateSystemPreferencesController,
  resetSystemPreferencesController,
} = createSettingsControllerHandlers();
