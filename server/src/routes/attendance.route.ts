// Defines authenticated Attendance session creation, listing, loading, deletion, and roster saving routes.
import { Router } from "express";

import {
  createAttendanceSessionController,
  deleteAttendanceSessionController,
  listAttendanceSessionsController,
  loadAttendanceSessionController,
  saveAttendanceRecordsController,
} from "../controllers/attendance.controller.js";
import { requireAuthenticatedUser } from "../middleware/require-authenticated-user.js";
import { validateBody } from "../middleware/validate-body.js";
import { validateParams } from "../middleware/validate-params.js";
import {
  attendanceClassIdParamsSchema,
  attendanceSessionIdParamsSchema,
  createAttendanceSessionSchema,
  saveAttendanceRecordsSchema,
} from "../validations/attendance.schema.js";

const attendanceRouter = Router();

attendanceRouter.use(requireAuthenticatedUser);
attendanceRouter.post(
  "/classes/:classId/sessions",
  validateParams(attendanceClassIdParamsSchema),
  validateBody(createAttendanceSessionSchema),
  createAttendanceSessionController,
);
attendanceRouter.get(
  "/classes/:classId/sessions",
  validateParams(attendanceClassIdParamsSchema),
  listAttendanceSessionsController,
);
attendanceRouter.get(
  "/sessions/:sessionId",
  validateParams(attendanceSessionIdParamsSchema),
  loadAttendanceSessionController,
);
attendanceRouter.delete(
  "/sessions/:sessionId",
  validateParams(attendanceSessionIdParamsSchema),
  deleteAttendanceSessionController,
);
attendanceRouter.put(
  "/sessions/:sessionId/records",
  validateParams(attendanceSessionIdParamsSchema),
  validateBody(saveAttendanceRecordsSchema),
  saveAttendanceRecordsController,
);

export default attendanceRouter;
