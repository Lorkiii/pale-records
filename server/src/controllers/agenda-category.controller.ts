// Converts authenticated Agenda category requests into safe public responses.
import type { NextFunction, Request, Response } from "express";

import type { AuthenticatedResponseLocals } from "../middleware/require-authenticated-user.js";
import {
  createAgendaCategory,
  deleteAgendaCategory,
  listAgendaCategories,
  restoreDefaultAgendaCategories,
  updateAgendaCategory,
} from "../services/agenda-category.service.js";
import type {
  AgendaCategoryIdParams,
  CreateAgendaCategoryInput,
  UpdateAgendaCategoryInput,
} from "../validations/agenda-category.schema.js";
import {
  agendaCategoryDeleteResponseSchema,
  agendaCategoryLimitResponseSchema,
  agendaCategoryListResponseSchema,
  agendaCategoryMutationResponseSchema,
  agendaCategoryNotFoundResponseSchema,
  agendaCategoryRestoreResponseSchema,
  agendaCategoryShortCodeConflictResponseSchema,
} from "../validations/agenda-category.response.js";

export type AgendaCategoryControllerDependencies = {
  listCategories: typeof listAgendaCategories;
  createCategory: typeof createAgendaCategory;
  updateCategory: typeof updateAgendaCategory;
  deleteCategory: typeof deleteAgendaCategory;
  restoreDefaults: typeof restoreDefaultAgendaCategories;
};

const defaultDependencies: AgendaCategoryControllerDependencies = {
  listCategories: listAgendaCategories,
  createCategory: createAgendaCategory,
  updateCategory: updateAgendaCategory,
  deleteCategory: deleteAgendaCategory,
  restoreDefaults: restoreDefaultAgendaCategories,
};

function sendCategoryNotFound(res: Response) {
  return res.status(404).json(agendaCategoryNotFoundResponseSchema.parse({
    success: false,
    error: {
      code: "AGENDA_CATEGORY_NOT_FOUND",
      message: "Agenda category was not found.",
    },
  }));
}

function sendShortCodeConflict(res: Response) {
  return res.status(409).json(agendaCategoryShortCodeConflictResponseSchema.parse({
    success: false,
    error: {
      code: "AGENDA_CATEGORY_SHORT_CODE_CONFLICT",
      message: "That Agenda category short code is already in use.",
      details: {
        fieldErrors: { shortCode: ["Choose a different short code."] },
        formErrors: [],
      },
    },
  }));
}

export function createAgendaCategoryControllerHandlers(
  dependencies: AgendaCategoryControllerDependencies = defaultDependencies,
) {
  const listAgendaCategoriesController = async (
    req: Request,
    res: Response<unknown, AuthenticatedResponseLocals>,
    next: NextFunction,
  ) => {
    try {
      const categories = await dependencies.listCategories(
        res.locals.authenticatedUser.id,
      );
      return res.status(200).json(agendaCategoryListResponseSchema.parse({
        success: true,
        data: { categories },
      }));
    } catch (error) {
      next(error);
    }
  };

  const createAgendaCategoryController = async (
    req: Request<Record<string, never>, unknown, CreateAgendaCategoryInput>,
    res: Response<unknown, AuthenticatedResponseLocals>,
    next: NextFunction,
  ) => {
    try {
      const result = await dependencies.createCategory(
        res.locals.authenticatedUser.id,
        req.body,
      );
      if (result.status === "short_code_conflict") return sendShortCodeConflict(res);
      if (result.status === "limit_reached") {
        return res.status(409).json(agendaCategoryLimitResponseSchema.parse({
          success: false,
          error: {
            code: "AGENDA_CATEGORY_LIMIT_REACHED",
            message: "Agenda categories are limited to 100 per account.",
          },
        }));
      }
      return res.status(201).json(agendaCategoryMutationResponseSchema.parse({
        success: true,
        data: { category: result.category },
      }));
    } catch (error) {
      next(error);
    }
  };

  const updateAgendaCategoryController = async (
    req: Request<AgendaCategoryIdParams, unknown, UpdateAgendaCategoryInput>,
    res: Response<unknown, AuthenticatedResponseLocals>,
    next: NextFunction,
  ) => {
    try {
      const result = await dependencies.updateCategory(
        res.locals.authenticatedUser.id,
        req.params.categoryId,
        req.body,
      );
      if (result.status === "category_not_found") return sendCategoryNotFound(res);
      if (result.status === "short_code_conflict") return sendShortCodeConflict(res);
      return res.status(200).json(agendaCategoryMutationResponseSchema.parse({
        success: true,
        data: { category: result.category },
      }));
    } catch (error) {
      next(error);
    }
  };

  const deleteAgendaCategoryController = async (
    req: Request<AgendaCategoryIdParams>,
    res: Response<unknown, AuthenticatedResponseLocals>,
    next: NextFunction,
  ) => {
    try {
      const result = await dependencies.deleteCategory(
        res.locals.authenticatedUser.id,
        req.params.categoryId,
      );
      if (result.status === "category_not_found") return sendCategoryNotFound(res);
      return res.status(200).json(agendaCategoryDeleteResponseSchema.parse({
        success: true,
        data: {
          categoryId: req.params.categoryId,
          result: result.status === "deleted" ? "DELETED" : "DEACTIVATED",
        },
      }));
    } catch (error) {
      next(error);
    }
  };

  const restoreAgendaCategoryDefaultsController = async (
    req: Request,
    res: Response<unknown, AuthenticatedResponseLocals>,
    next: NextFunction,
  ) => {
    try {
      const categories = await dependencies.restoreDefaults(
        res.locals.authenticatedUser.id,
      );
      return res.status(200).json(agendaCategoryRestoreResponseSchema.parse({
        success: true,
        data: { categories },
      }));
    } catch (error) {
      next(error);
    }
  };

  return {
    listAgendaCategoriesController,
    createAgendaCategoryController,
    updateAgendaCategoryController,
    deleteAgendaCategoryController,
    restoreAgendaCategoryDefaultsController,
  };
}

export const {
  listAgendaCategoriesController,
  createAgendaCategoryController,
  updateAgendaCategoryController,
  deleteAgendaCategoryController,
  restoreAgendaCategoryDefaultsController,
} = createAgendaCategoryControllerHandlers();
