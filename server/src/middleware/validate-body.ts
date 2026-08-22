// Validates request bodies and replaces them with normalized Zod output.
import type { RequestHandler } from "express";
import { z } from "zod";

export function validateBody(schema: z.ZodType): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const { fieldErrors, formErrors } = z.flattenError(result.error);

      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "The submitted data is invalid.",
          details: {
            fieldErrors,
            formErrors,
          },
        },
      });
      return;
    }

    req.body = result.data;
    next();
  };
}
