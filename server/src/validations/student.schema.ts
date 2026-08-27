// Validates and normalizes student identity, enrollment, and route input at the HTTP boundary.
import { z } from "zod";

const optionalStudentNumber = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z
    .string()
    .trim()
    .max(64, "Student number must be at most 64 characters")
    .transform((value) => value.toUpperCase())
    .optional(),
);

const requiredName = (label: string) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(120, `${label} must be at most 120 characters`);

const studentInputShape = {
  studentNo: optionalStudentNumber,
  firstName: requiredName("First name"),
  lastName: requiredName("Last name"),
  classIds: z
    .array(z.string().uuid("Each class ID must be a valid UUID"))
    .min(1, "Select at least one class")
    .max(100, "Select at most 100 classes")
    .refine(
      (classIds) => new Set(classIds).size === classIds.length,
      "Select each class only once",
    ),
};

export const createStudentSchema = z.strictObject(studentInputShape);
export const updateStudentSchema = z.strictObject(studentInputShape);

export const studentIdParamsSchema = z.strictObject({
  studentId: z.string().uuid("Student ID must be a valid UUID"),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type StudentIdParams = z.infer<typeof studentIdParamsSchema>;
