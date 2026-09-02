// Defines the authenticated and validated Dashboard overview read endpoint.
import { Router } from "express";

import { getDashboardOverviewController } from "../controllers/dashboard.controller.js";
import { requireAuthenticatedUser } from "../middleware/require-authenticated-user.js";
import { validateQuery } from "../middleware/validate-query.js";
import { dashboardOverviewQuerySchema } from "../validations/dashboard.schema.js";

const dashboardRouter = Router();

dashboardRouter.use(requireAuthenticatedUser);
dashboardRouter.get(
  "/overview",
  validateQuery(dashboardOverviewQuerySchema),
  getDashboardOverviewController,
);

export default dashboardRouter;
