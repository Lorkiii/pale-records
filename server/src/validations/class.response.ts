// Defines safe class records and expected errors returned by class API endpoints.
import { z } from "zod";

import { CLASS_SCHEDULE_TIME_PATTERN } from "./class.schema.js";

const nullableDateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();

export const classScheduleRecordSchema = z
  .strictObject({
    id: z.string().uuid(),
    dayOfWeek: z.number().int().min(1).max(7),
    startTime: z.string().regex(CLASS_SCHEDULE_TIME_PATTERN),
    endTime: z.string().regex(CLASS_SCHEDULE_TIME_PATTERN),
  })
  .superRefine((schedule, context) => {
    // Rejects internal records that violate the same non-overnight public contract.
    if (schedule.endTime <= schedule.startTime) {
      context.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "End time must be later than start time",
      });
    }
  });

const classScheduleRecordsSchema = z
  .array(classScheduleRecordSchema)
  .max(7)
  .superRefine((schedules, context) => {
    schedules.forEach((schedule, index) => {
      if (index > 0 && schedule.dayOfWeek <= schedules[index - 1]!.dayOfWeek) {
        context.addIssue({
          code: "custom",
          path: [index, "dayOfWeek"],
          message: "Schedules must be uniquely ordered Monday through Sunday",
        });
      }
    });
  });

export const classRecordSchema = z.strictObject({
  id: z.string().uuid(),
  subjectName: z.string(),
  subjectCode: z.string().nullable(),
  section: z.string().nullable(),
  schoolYear: z.string().nullable(),
  semester: z.string().nullable(),
  teacher: z.string().nullable(),
  room: z.string().nullable(),
  startDate: nullableDateOnlySchema,
  endDate: nullableDateOnlySchema,
  schedules: classScheduleRecordsSchema,
});

export type ClassRecord = z.infer<typeof classRecordSchema>;

export const classListResponseSchema = z.strictObject({
  success: z.literal(true),
  data: z.strictObject({
    classes: z.array(classRecordSchema),
  }),
});

export const classCreateResponseSchema = z.strictObject({
  success: z.literal(true),
  data: z.strictObject({
    class: classRecordSchema,
  }),
});

export const classUpdateResponseSchema = classCreateResponseSchema;

export const classArchiveResponseSchema = z.strictObject({
  success: z.literal(true),
  data: z.strictObject({
    classId: z.string().uuid(),
  }),
});

export const classNotFoundResponseSchema = z.strictObject({
  success: z.literal(false),
  error: z.strictObject({
    code: z.literal("CLASS_NOT_FOUND"),
    message: z.literal("Class was not found."),
  }),
});

export const classScheduleConflictResponseSchema = z.strictObject({
  success: z.literal(false),
  error: z.strictObject({
    code: z.literal("CLASS_SCHEDULE_CONFLICT"),
    message: z.literal("A weekly schedule overlaps another active class."),
  }),
});
