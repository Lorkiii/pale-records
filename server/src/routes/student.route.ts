// Defines authenticated student listing and multi-class creation endpoints.
import { Router } from "express";

import {
  createStudentController,
  listStudentsController,
} from "../controllers/student.controller.js";
import { requireAuthenticatedUser } from "../middleware/require-authenticated-user.js";
import { validateBody } from "../middleware/validate-body.js";
import { createStudentSchema } from "../validations/student.schema.js";

const studentRouter = Router();

studentRouter.use(requireAuthenticatedUser);
studentRouter.get("/", listStudentsController);
studentRouter.post("/", validateBody(createStudentSchema), createStudentController);

export default studentRouter;
