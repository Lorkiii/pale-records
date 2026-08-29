// Converts validated Recitation requests into safe expected errors and public responses.
import type { NextFunction, Request, Response } from "express";

import {
  createRecitationSession,
  deleteRecitationSession,
  listRecitationSessions,
  loadRecitationSession,
  saveRecitationRecords,
} from "../services/recitation.service.js";
import type {
  CreateRecitationSessionInput,
  ListRecitationSessionsQuery,
  RecitationClassIdParams,
  RecitationSessionIdParams,
  SaveRecitationRecordsInput,
} from "../validations/recitation.schema.js";
import {
  recitationClassArchivedResponseSchema,
  recitationClassNotFoundResponseSchema,
  recitationRosterMismatchResponseSchema,
  recitationSessionDeleteResponseSchema,
  recitationSessionExistsResponseSchema,
  recitationSessionListResponseSchema,
  recitationSessionNotFoundResponseSchema,
  recitationSessionResponseSchema,
  recitationStudentDuplicateResponseSchema,
} from "../validations/recitation.response.js";

export type RecitationControllerDependencies = {
  createSession: typeof createRecitationSession;
  deleteSession: typeof deleteRecitationSession;
  listSessions: typeof listRecitationSessions;
  loadSession: typeof loadRecitationSession;
  saveRecords: typeof saveRecitationRecords;
};

const defaultDependencies: RecitationControllerDependencies = {
  createSession: createRecitationSession,
  deleteSession: deleteRecitationSession,
  listSessions: listRecitationSessions,
  loadSession: loadRecitationSession,
  saveRecords: saveRecitationRecords,
};

// Builds Recitation handlers around replaceable service functions for focused HTTP tests.
export function createRecitationControllerHandlers(
  dependencies: RecitationControllerDependencies = defaultDependencies,
) {
  // Creates one manual session or returns its safe class/date conflict.
  const createRecitationSessionController = async (
    req: Request<RecitationClassIdParams, unknown, CreateRecitationSessionInput>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await dependencies.createSession(
        req.params.classId,
        req.body.sessionDate,
      );

      if (result.status === "class_not_found") {
        return res.status(404).json(recitationClassNotFoundResponseSchema.parse({
          success: false,
          error: { code: "CLASS_NOT_FOUND", message: "Class was not found." },
        }));
      }

      if (result.status === "class_archived") {
        return res.status(409).json(recitationClassArchivedResponseSchema.parse({
          success: false,
          error: {
            code: "CLASS_ARCHIVED",
            message: "Archived classes cannot create recitation sessions.",
          },
        }));
      }

      if (result.status === "session_exists") {
        return res.status(409).json(recitationSessionExistsResponseSchema.parse({
          success: false,
          error: {
            code: "RECITATION_SESSION_EXISTS",
            message: "Recitation already exists for this class and date.",
          },
        }));
      }

      return res.status(201).json(recitationSessionResponseSchema.parse({
        success: true,
        data: { session: result.session },
      }));
    } catch (error) {
      next(error);
    }
  };

  // Returns one class's bounded sessions for the validated calendar month.
  const listRecitationSessionsController = async (
    req: Request<RecitationClassIdParams>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const query = res.locals.validatedQuery as ListRecitationSessionsQuery;
      const result = await dependencies.listSessions(
        req.params.classId,
        query.year,
        query.month,
      );

      if (result.status === "class_not_found") {
        return res.status(404).json(recitationClassNotFoundResponseSchema.parse({
          success: false,
          error: { code: "CLASS_NOT_FOUND", message: "Class was not found." },
        }));
      }

      return res.status(200).json(recitationSessionListResponseSchema.parse({
        success: true,
        data: { sessions: result.sessions },
      }));
    } catch (error) {
      next(error);
    }
  };

  // Returns one stored historical roster or response-only current-enrollment draft.
  const loadRecitationSessionController = async (
    req: Request<RecitationSessionIdParams>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const session = await dependencies.loadSession(req.params.sessionId);

      if (!session) {
        return res.status(404).json(recitationSessionNotFoundResponseSchema.parse({
          success: false,
          error: {
            code: "RECITATION_SESSION_NOT_FOUND",
            message: "Recitation session was not found.",
          },
        }));
      }

      return res.status(200).json(recitationSessionResponseSchema.parse({
        success: true,
        data: { session },
      }));
    } catch (error) {
      next(error);
    }
  };

  // Permanently removes one Recitation date and confirms the deleted identifier.
  const deleteRecitationSessionController = async (
    req: Request<RecitationSessionIdParams>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const wasDeleted = await dependencies.deleteSession(req.params.sessionId);

      if (!wasDeleted) {
        return res.status(404).json(recitationSessionNotFoundResponseSchema.parse({
          success: false,
          error: {
            code: "RECITATION_SESSION_NOT_FOUND",
            message: "Recitation session was not found.",
          },
        }));
      }

      return res.status(200).json(recitationSessionDeleteResponseSchema.parse({
        success: true,
        data: { sessionId: req.params.sessionId },
      }));
    } catch (error) {
      next(error);
    }
  };

  // Saves the exact roster or reports expected session and roster conflicts.
  const saveRecitationRecordsController = async (
    req: Request<RecitationSessionIdParams, unknown, SaveRecitationRecordsInput>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await dependencies.saveRecords(
        req.params.sessionId,
        req.body.records,
      );

      if (result.status === "session_not_found") {
        return res.status(404).json(recitationSessionNotFoundResponseSchema.parse({
          success: false,
          error: {
            code: "RECITATION_SESSION_NOT_FOUND",
            message: "Recitation session was not found.",
          },
        }));
      }

      if (result.status === "student_duplicate") {
        return res.status(400).json(recitationStudentDuplicateResponseSchema.parse({
          success: false,
          error: {
            code: "RECITATION_STUDENT_DUPLICATE",
            message: "Submit each student exactly once.",
          },
        }));
      }

      if (result.status === "roster_mismatch") {
        return res.status(409).json(recitationRosterMismatchResponseSchema.parse({
          success: false,
          error: {
            code: "RECITATION_ROSTER_MISMATCH",
            message: "The submitted roster does not match this recitation session. Reload and review the roster.",
          },
        }));
      }

      return res.status(200).json(recitationSessionResponseSchema.parse({
        success: true,
        data: { session: result.session },
      }));
    } catch (error) {
      next(error);
    }
  };

  return {
    createRecitationSessionController,
    deleteRecitationSessionController,
    listRecitationSessionsController,
    loadRecitationSessionController,
    saveRecitationRecordsController,
  };
}

export const {
  createRecitationSessionController,
  deleteRecitationSessionController,
  listRecitationSessionsController,
  loadRecitationSessionController,
  saveRecitationRecordsController,
} = createRecitationControllerHandlers();
