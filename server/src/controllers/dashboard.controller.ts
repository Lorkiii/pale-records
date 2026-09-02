// Converts an authenticated Dashboard overview request into its strict public response.
import type { NextFunction, Request, Response } from "express";

import type { AuthenticatedResponseLocals } from "../middleware/require-authenticated-user.js";
import { getDashboardOverview } from "../services/dashboard.service.js";
import type { DashboardOverviewQuery } from "../validations/dashboard.schema.js";
import { dashboardOverviewResponseSchema } from "../validations/dashboard.response.js";

export type DashboardControllerDependencies = {
  getOverview: typeof getDashboardOverview;
};

type DashboardResponseLocals = AuthenticatedResponseLocals & {
  validatedQuery?: unknown;
};

const defaultDependencies: DashboardControllerDependencies = {
  getOverview: getDashboardOverview,
};

// Builds the handler around a replaceable service function for focused HTTP tests.
export function createDashboardControllerHandlers(
  dependencies: DashboardControllerDependencies = defaultDependencies,
) {
  const getDashboardOverviewController = async (
    _req: Request,
    res: Response<unknown, DashboardResponseLocals>,
    next: NextFunction,
  ) => {
    try {
      const query = res.locals.validatedQuery as DashboardOverviewQuery;
      const overview = await dependencies.getOverview(
        res.locals.authenticatedUser.id,
        query.date,
      );

      return res.status(200).json(dashboardOverviewResponseSchema.parse({
        success: true,
        data: overview,
      }));
    } catch (error) {
      next(error);
    }
  };

  return { getDashboardOverviewController };
}

export const { getDashboardOverviewController } =
  createDashboardControllerHandlers();
