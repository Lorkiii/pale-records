// Defines authenticated class listing, editing, archiving, and archive deletion endpoints.
import { Router } from "express";

import {
  deleteArchivedClassesController,
  listArchivedClassesController,
} from "../controllers/archive-management.controller.js";
import {
  archiveClassController,
  createClassController,
  listClassesController,
  updateClassController,
} from "../controllers/class.controller.js";
import { requireAuthenticatedUser } from "../middleware/require-authenticated-user.js";
import { archiveDeleteLimiter } from "../middleware/archive-delete-limiter.js";
import { validateBody } from "../middleware/validate-body.js";
import { validateParams } from "../middleware/validate-params.js";
import { validateQuery } from "../middleware/validate-query.js";
import {
  archivedPageQuerySchema,
  deleteArchivedBatchSchema,
} from "../validations/archive-management.schema.js";
import {
  classIdParamsSchema,
  createClassSchema,
  updateClassSchema,
} from "../validations/class.schema.js";

const classRouter = Router();

classRouter.use(requireAuthenticatedUser);
classRouter.get("/", listClassesController);
classRouter.get("/archived", validateQuery(archivedPageQuerySchema), listArchivedClassesController);
classRouter.post(
  "/archived/bulk-delete",
  archiveDeleteLimiter,
  validateBody(deleteArchivedBatchSchema),
  deleteArchivedClassesController,
);
classRouter.post("/", validateBody(createClassSchema), createClassController);
classRouter.patch(
  "/:classId",
  validateParams(classIdParamsSchema),
  validateBody(updateClassSchema),
  updateClassController,
);
classRouter.post(
  "/:classId/archive",
  validateParams(classIdParamsSchema),
  archiveClassController,
);

export default classRouter;
