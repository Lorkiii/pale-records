// Converts authenticated student requests into validated public API responses.
import type { NextFunction, Request, Response } from "express";

import {
  createStudent,
  listStudents,
} from "../services/student.service.js";
import type { CreateStudentInput } from "../validations/student.schema.js";
import {
  studentClassSelectionUnavailableResponseSchema,
  studentCreateResponseSchema,
  studentListResponseSchema,
  studentNumberExistsResponseSchema,
} from "../validations/student.response.js";

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

    if (result.status === "student_number_exists") {
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

    const response = studentCreateResponseSchema.parse({
      success: true,
      data: { student: result.student },
    });

    return res.status(201).json(response);
  } catch (error) {
    next(error);
  }
}
