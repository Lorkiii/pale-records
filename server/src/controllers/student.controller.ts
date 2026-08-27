// Converts authenticated student list, save, and archive requests into safe API responses.
import type { NextFunction, Request, Response } from "express";

import {
  archiveStudent,
  createStudent,
  listStudents,
  updateStudent,
} from "../services/student.service.js";
import type {
  CreateStudentInput,
  StudentIdParams,
  UpdateStudentInput,
} from "../validations/student.schema.js";
import {
  studentArchiveResponseSchema,
  studentClassSelectionUnavailableResponseSchema,
  studentCreateResponseSchema,
  studentListResponseSchema,
  studentNotFoundResponseSchema,
  studentNumberExistsResponseSchema,
  studentUpdateResponseSchema,
} from "../validations/student.response.js";

// Sends the safe unavailable-class conflict shared by student create and edit.
function sendClassSelectionUnavailableResponse(res: Response) {
  const response = studentClassSelectionUnavailableResponseSchema.parse({
    success: false,
    error: {
      code: "CLASS_SELECTION_UNAVAILABLE",
      message: "One or more selected classes are unavailable.",
      details: {
        fieldErrors: {
          classIds: ["Choose only active classes."],
        },
      },
    },
  });

  return res.status(409).json(response);
}

// Sends the safe student-number conflict shared by student create and edit.
function sendStudentNumberExistsResponse(res: Response) {
  const response = studentNumberExistsResponseSchema.parse({
    success: false,
    error: {
      code: "STUDENT_NUMBER_EXISTS",
      message: "A student with this student number already exists.",
      details: {
        fieldErrors: {
          studentNo: ["Student number is already in use."],
        },
      },
    },
  });

  return res.status(409).json(response);
}

// Sends the single not-found response shared by student edit and archive.
function sendStudentNotFoundResponse(res: Response) {
  const response = studentNotFoundResponseSchema.parse({
    success: false,
    error: {
      code: "STUDENT_NOT_FOUND",
      message: "Student was not found.",
    },
  });

  return res.status(404).json(response);
}

// Returns the bounded saved student directory.
export async function listStudentsController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const students = await listStudents();
    const response = studentListResponseSchema.parse({
      success: true,
      data: { students },
    });

    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

// Creates one student with all validated class assignments or returns a safe conflict.
export async function createStudentController(
  req: Request<Record<string, never>, unknown, CreateStudentInput>,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await createStudent(req.body);

    if (result.status === "class_selection_unavailable") {
      return sendClassSelectionUnavailableResponse(res);
    }

    if (result.status === "student_number_exists") {
      return sendStudentNumberExistsResponse(res);
    }

    const response = studentCreateResponseSchema.parse({
      success: true,
      data: { student: result.student },
    });

    return res.status(201).json(response);
  } catch (error) {
    next(error);
  }
}

// Updates one active student or returns an expected conflict/not-found response.
export async function updateStudentController(
  req: Request<StudentIdParams, unknown, UpdateStudentInput>,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await updateStudent(req.params.studentId, req.body);

    if (result.status === "class_selection_unavailable") {
      return sendClassSelectionUnavailableResponse(res);
    }

    if (result.status === "student_number_exists") {
      return sendStudentNumberExistsResponse(res);
    }

    if (result.status === "student_not_found") {
      return sendStudentNotFoundResponse(res);
    }

    const response = studentUpdateResponseSchema.parse({
      success: true,
      data: { student: result.student },
    });

    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

// Soft-archives one active student and confirms the affected identifier.
export async function archiveStudentController(
  req: Request<StudentIdParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const wasArchived = await archiveStudent(req.params.studentId);

    if (!wasArchived) {
      return sendStudentNotFoundResponse(res);
    }

    const response = studentArchiveResponseSchema.parse({
      success: true,
      data: { studentId: req.params.studentId },
    });

    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}
