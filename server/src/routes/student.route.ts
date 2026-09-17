// Defines authenticated student listing, editing, archiving, and archive deletion endpoints.
import { Router } from "express";

import {
  deleteArchivedStudentsController,
  listArchivedStudentsController,
} from "../controllers/archive-management.controller.js";
import {
  archiveStudentController,
  createStudentController,
  listStudentsController,
  updateStudentController,
} from "../controllers/student.controller.js";
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
  createStudentSchema,
  studentIdParamsSchema,
  updateStudentSchema,
} from "../validations/student.schema.js";

const studentRouter = Router();

studentRouter.use(requireAuthenticatedUser);
studentRouter.get("/", listStudentsController);
studentRouter.get("/archived", validateQuery(archivedPageQuerySchema), listArchivedStudentsController);
studentRouter.post(
  "/archived/bulk-delete",
  archiveDeleteLimiter,
  validateBody(deleteArchivedBatchSchema),
  deleteArchivedStudentsController,
);
studentRouter.post("/", validateBody(createStudentSchema), createStudentController);
studentRouter.patch(
  "/:studentId",
  validateParams(studentIdParamsSchema),
  validateBody(updateStudentSchema),
  updateStudentController,
);
studentRouter.post(
  "/:studentId/archive",
  validateParams(studentIdParamsSchema),
  archiveStudentController,
);

export default studentRouter;
