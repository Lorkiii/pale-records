// Converts authenticated class requests into validated API responses.
import type { NextFunction, Request, Response } from "express";

import {
  archiveClass,
  ClassScheduleConflictError,
  createClass,
  listClasses,
  updateClass,
} from "../services/class.service.js";
import type {
  ClassIdParams,
  CreateClassInput,
  UpdateClassInput,
} from "../validations/class.schema.js";
import {
  classArchiveResponseSchema,
  classCreateResponseSchema,
  classListResponseSchema,
  classNotFoundResponseSchema,
  classScheduleConflictResponseSchema,
  classUpdateResponseSchema,
} from "../validations/class.response.js";

// Sends the single safe not-found shape shared by edit and archive operations.
function sendClassNotFoundResponse(res: Response) {
  const response = classNotFoundResponseSchema.parse({
    success: false,
    error: {
      code: "CLASS_NOT_FOUND",
      message: "Class was not found.",
    },
  });

  return res.status(404).json(response);
}

// Sends the safe expected conflict shared by class creation and schedule replacement.
function sendClassScheduleConflictResponse(res: Response) {
  return res.status(409).json(classScheduleConflictResponseSchema.parse({
    success: false,
    error: {
      code: "CLASS_SCHEDULE_CONFLICT",
      message: "A weekly schedule overlaps another active class.",
    },
  }));
}

// Returns the bounded active class directory in the public response contract.
export async function listClassesController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const classes = await listClasses();
    const response = classListResponseSchema.parse({
      success: true,
      data: { classes },
    });

    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

// Persists validated class input and returns the newly created public record.
export async function createClassController(
  req: Request<Record<string, never>, unknown, CreateClassInput>,
  res: Response,
  next: NextFunction,
) {
  try {
    const createdClass = await createClass(req.body);
    const response = classCreateResponseSchema.parse({
      success: true,
      data: { class: createdClass },
    });

    return res.status(201).json(response);
  } catch (error) {
    if (error instanceof ClassScheduleConflictError) {
      return sendClassScheduleConflictResponse(res);
    }

    next(error);
  }
}

// Updates an active class or returns the shared not-found response.
export async function updateClassController(
  req: Request<ClassIdParams, unknown, UpdateClassInput>,
  res: Response,
  next: NextFunction,
) {
  try {
    const updatedClass = await updateClass(req.params.classId, req.body);

    if (!updatedClass) {
      return sendClassNotFoundResponse(res);
    }

    const response = classUpdateResponseSchema.parse({
      success: true,
      data: { class: updatedClass },
    });

    return res.status(200).json(response);
  } catch (error) {
    if (error instanceof ClassScheduleConflictError) {
      return sendClassScheduleConflictResponse(res);
    }

    next(error);
  }
}

// Soft-archives an active class and confirms the affected identifier.
export async function archiveClassController(
  req: Request<ClassIdParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const wasArchived = await archiveClass(req.params.classId);

    if (!wasArchived) {
      return sendClassNotFoundResponse(res);
    }

    const response = classArchiveResponseSchema.parse({
      success: true,
      data: { classId: req.params.classId },
    });

    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}
