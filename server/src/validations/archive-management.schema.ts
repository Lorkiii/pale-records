// Validates archived-list paging, password-confirmed batches, and their safe responses.
import { z } from "zod";

export const archivedPageQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

export const deleteArchivedBatchSchema = z.strictObject({
  ids: z.array(z.string().uuid()).min(1).max(50).refine(
    (ids) => new Set(ids).size === ids.length,
    "Select each record only once",
  ),
  currentPassword: z.string().min(1).max(128),
});

const archivedClassSchema = z.strictObject({
  id: z.string().uuid(),
  subjectName: z.string(),
  subjectCode: z.string().nullable(),
  section: z.string().nullable(),
  schoolYear: z.string().nullable(),
  semester: z.string().nullable(),
  archivedAt: z.iso.datetime(),
  canDelete: z.boolean(),
});

const archivedStudentClassSchema = z.strictObject({
  id: z.string().uuid(),
  subjectName: z.string(),
  subjectCode: z.string().nullable(),
  section: z.string().nullable(),
});

const archivedStudentSchema = z.strictObject({
  id: z.string().uuid(),
  studentNo: z.string().nullable(),
  firstName: z.string(),
  lastName: z.string(),
  archivedAt: z.iso.datetime(),
  canDelete: z.boolean(),
  classes: z.array(archivedStudentClassSchema),
});

export const archivedClassListResponseSchema = z.strictObject({
  success: z.literal(true),
  data: z.strictObject({ classes: z.array(archivedClassSchema), hasMore: z.boolean() }),
});

export const archivedStudentListResponseSchema = z.strictObject({
  success: z.literal(true),
  data: z.strictObject({ students: z.array(archivedStudentSchema), hasMore: z.boolean() }),
});

export const archivedBatchDeleteResponseSchema = z.strictObject({
  success: z.literal(true),
  data: z.strictObject({ deletedIds: z.array(z.string().uuid()) }),
});

export const archivedBatchErrorResponseSchema = z.strictObject({
  success: z.literal(false),
  error: z.strictObject({
    code: z.enum([
      "INVALID_CURRENT_PASSWORD",
      "ARCHIVED_SELECTION_CHANGED",
      "ARCHIVED_RECORDS_PROTECTED",
      "TOO_MANY_ARCHIVE_DELETE_ATTEMPTS",
    ]),
    message: z.string(),
    details: z.strictObject({ blockedIds: z.array(z.string().uuid()) }).optional(),
  }),
});

export type ArchivedPageQuery = z.infer<typeof archivedPageQuerySchema>;
export type DeleteArchivedBatchInput = z.infer<typeof deleteArchivedBatchSchema>;
