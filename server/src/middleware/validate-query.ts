// Validates request queries and stores normalized Zod output for the controller.
import type { RequestHandler } from "express";
import { z } from "zod";

export function validateQuery(schema: z.ZodType): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);

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

    res.locals.validatedQuery = result.data;
    next();
  };
}
