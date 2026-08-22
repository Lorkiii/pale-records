// Defines safe API responses for body-parser and unexpected server errors.
import { z } from "zod";

// Error 400: Bad Request
// Schema for a malformed JSON response
export const malformedJsonResponseSchema = z.strictObject({
  success: z.literal(false),
  error: z.strictObject({
    code: z.literal("MALFORMED_JSON"),
    message: z.literal("The request body must contain valid JSON."),
  }),
});

// Error 413: Payload Too Large
// Schema for a payload too large response
export const payloadTooLargeResponseSchema = z.strictObject({
  success: z.literal(false),
  error: z.strictObject({
    code: z.literal("PAYLOAD_TOO_LARGE"),
    message: z.literal("The request body is too large."),
  }),
});

// Error 500: Internal Server Error
// Schema for an internal server error response
export const internalServerErrorResponseSchema = z.strictObject({
  success: z.literal(false),
  error: z.strictObject({
    code: z.literal("INTERNAL_SERVER_ERROR"),
    message: z.literal("An unexpected server error occurred."),
  }),
});
