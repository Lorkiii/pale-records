// Defines authenticated student listing, creation, editing, and archiving endpoints.
import { Router } from "express";

import {
  archiveStudentController,
  createStudentController,
  listStudentsController,
  updateStudentController,
} from "../controllers/student.controller.js";
import { requireAuthenticatedUser } from "../middleware/require-authenticated-user.js";
import { validateBody } from "../middleware/validate-body.js";
import { validateParams } from "../middleware/validate-params.js";
import {
  createStudentSchema,
  studentIdParamsSchema,
  updateStudentSchema,
} from "../validations/student.schema.js";

const studentRouter = Router();

studentRouter.use(requireAuthenticatedUser);
studentRouter.get("/", listStudentsController);
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
