// Defines authenticated class listing, creation, editing, and archiving endpoints.
import { Router } from "express";

import {
  archiveClassController,
  createClassController,
  listClassesController,
  updateClassController,
} from "../controllers/class.controller.js";
import { requireAuthenticatedUser } from "../middleware/require-authenticated-user.js";
import { validateBody } from "../middleware/validate-body.js";
import { validateParams } from "../middleware/validate-params.js";
import {
  classIdParamsSchema,
  createClassSchema,
  updateClassSchema,
} from "../validations/class.schema.js";

const classRouter = Router();

classRouter.use(requireAuthenticatedUser);
classRouter.get("/", listClassesController);
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
