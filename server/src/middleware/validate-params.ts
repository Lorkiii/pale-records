// Validates route parameters and replaces them with normalized Zod output.
import type { RequestHandler } from "express";
import { z } from "zod";

// Builds middleware that replaces untrusted route params with validated Zod output.
export function validateParams(schema: z.ZodType): RequestHandler {
  // Rejects malformed params consistently before a controller reads them.
  return (req, res, next) => {
    const result = schema.safeParse(req.params);

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

    req.params = result.data as typeof req.params;
    next();
  };
}
