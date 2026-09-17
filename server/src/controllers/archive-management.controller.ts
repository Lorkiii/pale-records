// Handles archived directory pages and password-confirmed batch deletion responses.
import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedResponseLocals } from "../middleware/require-authenticated-user.js";
import {
  deleteArchivedClasses,
  deleteArchivedStudents,
  listArchivedClasses,
  listArchivedStudents,
  type ArchiveDeletionResult,
} from "../services/archive-management.service.js";
import {
  archivedBatchDeleteResponseSchema,
  archivedBatchErrorResponseSchema,
  archivedClassListResponseSchema,
  archivedStudentListResponseSchema,
  type ArchivedPageQuery,
  type DeleteArchivedBatchInput,
} from "../validations/archive-management.schema.js";

export function sendDeletionResult(res: Response, result: ArchiveDeletionResult) {
  if (result.status === "deleted") {
    return res.status(200).json(archivedBatchDeleteResponseSchema.parse({
      success: true,
      data: { deletedIds: result.deletedIds },
    }));
  }

  const error = result.status === "invalid_password"
    ? {
        code: "INVALID_CURRENT_PASSWORD",
        message: "The current password could not be confirmed.",
      }
    : result.status === "protected"
      ? {
          code: "ARCHIVED_RECORDS_PROTECTED",
          message: "One or more selected records have saved history and cannot be deleted.",
          details: { blockedIds: result.blockedIds },
        }
      : {
          code: "ARCHIVED_SELECTION_CHANGED",
          message: "The selected records changed. Refresh the archive and try again.",
        };

  return res.status(result.status === "invalid_password" ? 400 : 409).json(
    archivedBatchErrorResponseSchema.parse({ success: false, error }),
  );
}

export async function listArchivedClassesController(
  _req: Request,
  res: Response<unknown, AuthenticatedResponseLocals & { validatedQuery: ArchivedPageQuery }>,
  next: NextFunction,
) {
  try {
    const data = await listArchivedClasses(res.locals.validatedQuery.page);
    return res.status(200).json(archivedClassListResponseSchema.parse({ success: true, data }));
  } catch (error) {
    next(error);
  }
}

export async function listArchivedStudentsController(
  _req: Request,
  res: Response<unknown, AuthenticatedResponseLocals & { validatedQuery: ArchivedPageQuery }>,
  next: NextFunction,
) {
  try {
    const data = await listArchivedStudents(res.locals.validatedQuery.page);
    return res.status(200).json(archivedStudentListResponseSchema.parse({ success: true, data }));
  } catch (error) {
    next(error);
  }
}

export async function deleteArchivedClassesController(
  req: Request<Record<string, never>, unknown, DeleteArchivedBatchInput>,
  res: Response<unknown, AuthenticatedResponseLocals>,
  next: NextFunction,
) {
  try {
    const { ids, currentPassword } = req.body;
    return sendDeletionResult(res, await deleteArchivedClasses(
      res.locals.authenticatedUser.id, ids, currentPassword,
    ));
  } catch (error) {
    next(error);
  }
}

export async function deleteArchivedStudentsController(
  req: Request<Record<string, never>, unknown, DeleteArchivedBatchInput>,
  res: Response<unknown, AuthenticatedResponseLocals>,
  next: NextFunction,
) {
  try {
    const { ids, currentPassword } = req.body;
    return sendDeletionResult(res, await deleteArchivedStudents(
      res.locals.authenticatedUser.id, ids, currentPassword,
    ));
  } catch (error) {
    next(error);
  }
}
