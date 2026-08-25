// Converts validated Attendance requests into safe expected errors and public responses.
import type { NextFunction, Request, Response } from "express";

import {
  createAttendanceSession,
  deleteAttendanceSession,
  listAttendanceSessions,
  loadAttendanceSession,
  saveAttendanceRecords,
} from "../services/attendance.service.js";
import type {
  AttendanceClassIdParams,
  AttendanceSessionIdParams,
  CreateAttendanceSessionInput,
  SaveAttendanceRecordsInput,
} from "../validations/attendance.schema.js";
import {
  attendanceClassArchivedResponseSchema,
  attendanceClassHasNoStudentsResponseSchema,
  attendanceClassNotFoundResponseSchema,
  attendanceRosterMismatchResponseSchema,
  attendanceSessionExistsResponseSchema,
  attendanceSessionDeleteResponseSchema,
  attendanceSessionListResponseSchema,
  attendanceSessionNotFoundResponseSchema,
  attendanceSessionResponseSchema,
  attendanceStudentDuplicateResponseSchema,
} from "../validations/attendance.response.js";

export type AttendanceControllerDependencies = {
  createSession: typeof createAttendanceSession;
  deleteSession: typeof deleteAttendanceSession;
  listSessions: typeof listAttendanceSessions;
  loadSession: typeof loadAttendanceSession;
  saveRecords: typeof saveAttendanceRecords;
};

const defaultDependencies: AttendanceControllerDependencies = {
  createSession: createAttendanceSession,
  deleteSession: deleteAttendanceSession,
  listSessions: listAttendanceSessions,
  loadSession: loadAttendanceSession,
  saveRecords: saveAttendanceRecords,
};

// Builds the five handlers around replaceable service functions for focused HTTP tests.
export function createAttendanceControllerHandlers(
  dependencies: AttendanceControllerDependencies = defaultDependencies,
) {
  // Creates one date-only session or returns its safe product conflict.
  const createAttendanceSessionController = async (
    req: Request<AttendanceClassIdParams, unknown, CreateAttendanceSessionInput>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await dependencies.createSession(
        req.params.classId,
        req.body.sessionDate,
      );

      if (result.status === "class_not_found") {
        return res.status(404).json(attendanceClassNotFoundResponseSchema.parse({
          success: false,
          error: { code: "CLASS_NOT_FOUND", message: "Class was not found." },
        }));
      }

      if (result.status === "class_archived") {
        return res.status(409).json(attendanceClassArchivedResponseSchema.parse({
          success: false,
          error: {
            code: "CLASS_ARCHIVED",
            message: "Archived classes cannot create attendance sessions.",
          },
        }));
      }

      if (result.status === "class_has_no_students") {
        return res.status(409).json(attendanceClassHasNoStudentsResponseSchema.parse({
          success: false,
          error: {
            code: "CLASS_HAS_NO_STUDENTS",
            message: "The class has no enrolled students.",
          },
        }));
      }

      if (result.status === "session_exists") {
        return res.status(409).json(attendanceSessionExistsResponseSchema.parse({
          success: false,
          error: {
            code: "ATTENDANCE_SESSION_EXISTS",
            message: "Attendance already exists for this class and date.",
          },
        }));
      }

      return res.status(201).json(attendanceSessionResponseSchema.parse({
        success: true,
        data: { session: result.session },
      }));
    } catch (error) {
      next(error);
    }
  };

  // Returns the newest-first bounded class Attendance matrix.
  const listAttendanceSessionsController = async (
    req: Request<AttendanceClassIdParams>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await dependencies.listSessions(req.params.classId);

      if (result.status === "class_not_found") {
        return res.status(404).json(attendanceClassNotFoundResponseSchema.parse({
          success: false,
          error: { code: "CLASS_NOT_FOUND", message: "Class was not found." },
        }));
      }

      return res.status(200).json(attendanceSessionListResponseSchema.parse({
        success: true,
        data: { sessions: result.sessions },
      }));
    } catch (error) {
      next(error);
    }
  };

  // Returns one complete persisted Attendance roster or a safe not-found error.
  const loadAttendanceSessionController = async (
    req: Request<AttendanceSessionIdParams>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const session = await dependencies.loadSession(req.params.sessionId);

      if (!session) {
        return res.status(404).json(attendanceSessionNotFoundResponseSchema.parse({
          success: false,
          error: {
            code: "ATTENDANCE_SESSION_NOT_FOUND",
            message: "Attendance session was not found.",
          },
        }));
      }

      return res.status(200).json(attendanceSessionResponseSchema.parse({
        success: true,
        data: { session },
      }));
    } catch (error) {
      next(error);
    }
  };

  // Permanently removes one Attendance date and confirms the deleted identifier.
  const deleteAttendanceSessionController = async (
    req: Request<AttendanceSessionIdParams>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const wasDeleted = await dependencies.deleteSession(req.params.sessionId);

      if (!wasDeleted) {
        return res.status(404).json(attendanceSessionNotFoundResponseSchema.parse({
          success: false,
          error: {
            code: "ATTENDANCE_SESSION_NOT_FOUND",
            message: "Attendance session was not found.",
          },
        }));
      }

      return res.status(200).json(attendanceSessionDeleteResponseSchema.parse({
        success: true,
        data: { sessionId: req.params.sessionId },
      }));
    } catch (error) {
      next(error);
    }
  };

  // Saves the exact roster or reports the expected session and roster conflicts.
  const saveAttendanceRecordsController = async (
    req: Request<AttendanceSessionIdParams, unknown, SaveAttendanceRecordsInput>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await dependencies.saveRecords(
        req.params.sessionId,
        req.body.records,
      );

      if (result.status === "session_not_found") {
        return res.status(404).json(attendanceSessionNotFoundResponseSchema.parse({
          success: false,
          error: {
            code: "ATTENDANCE_SESSION_NOT_FOUND",
            message: "Attendance session was not found.",
          },
        }));
      }

      if (result.status === "student_duplicate") {
        return res.status(400).json(attendanceStudentDuplicateResponseSchema.parse({
          success: false,
          error: {
            code: "ATTENDANCE_STUDENT_DUPLICATE",
            message: "Submit each student exactly once.",
          },
        }));
      }

      if (result.status === "roster_mismatch") {
        return res.status(409).json(attendanceRosterMismatchResponseSchema.parse({
          success: false,
          error: {
            code: "ATTENDANCE_ROSTER_MISMATCH",
            message: "The submitted roster does not match the saved attendance session.",
          },
        }));
      }

      return res.status(200).json(attendanceSessionResponseSchema.parse({
        success: true,
        data: { session: result.session },
      }));
    } catch (error) {
      next(error);
    }
  };

  return {
    createAttendanceSessionController,
    deleteAttendanceSessionController,
    listAttendanceSessionsController,
    loadAttendanceSessionController,
    saveAttendanceRecordsController,
  };
}

export const {
  createAttendanceSessionController,
  deleteAttendanceSessionController,
  listAttendanceSessionsController,
  loadAttendanceSessionController,
  saveAttendanceRecordsController,
} = createAttendanceControllerHandlers();
